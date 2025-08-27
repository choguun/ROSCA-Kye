import { WebhookEvent, MessageEvent, PostbackEvent, FollowEvent, UnfollowEvent, JoinEvent, LeaveEvent } from '@line/bot-sdk';
import { LineBotService } from './linebot.service';
import { NotificationService } from './notification.service';
import { DatabaseManager } from '@/database/manager';
import { IntentProcessor } from '@/ai/intent';
import { Logger } from '@/utils/logger';
import { validateWebhookEvent, sanitizeText } from '@/utils/validation';
import { TextMessage, FlexMessage, Intent, NotificationType } from '@/types';
import * as Sentry from '@sentry/nextjs';

export class WebhookService {
  private logger: Logger;
  private intentProcessor: IntentProcessor;

  constructor(
    private botService: LineBotService,
    private notificationService: NotificationService,
    private databaseManager: DatabaseManager
  ) {
    this.logger = new Logger('WebhookService');
    this.intentProcessor = new IntentProcessor();
  }

  /**
   * Handle incoming webhook events from LINE
   */
  async handleWebhook(body: { events: WebhookEvent[] }): Promise<void> {
    try {
      if (!body.events || body.events.length === 0) {
        this.logger.debug('Received webhook with no events');
        return;
      }

      this.logger.info(`Processing ${body.events.length} webhook event(s)`);

      // Process each event
      for (const event of body.events) {
        await this.processEvent(event);
      }

    } catch (error) {
      this.logger.error('Failed to process webhook:', error);
      Sentry.captureException(error, {
        tags: { service: 'WebhookService', action: 'handleWebhook' }
      });
      throw error;
    }
  }

  /**
   * Process individual webhook event
   */
  private async processEvent(event: WebhookEvent): Promise<void> {
    try {
      // Validate event structure
      validateWebhookEvent(event);

      this.logger.webhookReceived(event.type, event.source);

      Sentry.addBreadcrumb({
        message: `Processing webhook event: ${event.type}`,
        category: 'webhook',
        level: 'info',
        data: {
          eventType: event.type,
          sourceType: event.source.type,
          sourceId: event.source.userId || event.source.groupId,
        }
      });

      // Route to appropriate handler
      switch (event.type) {
        case 'message':
          await this.handleMessageEvent(event as MessageEvent);
          break;

        case 'postback':
          await this.handlePostbackEvent(event as PostbackEvent);
          break;

        case 'follow':
          await this.handleFollowEvent(event as FollowEvent);
          break;

        case 'unfollow':
          await this.handleUnfollowEvent(event as UnfollowEvent);
          break;

        case 'join':
          await this.handleJoinEvent(event as JoinEvent);
          break;

        case 'leave':
          await this.handleLeaveEvent(event as LeaveEvent);
          break;

        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
      }

    } catch (error) {
      this.logger.error(`Failed to process event ${event.type}:`, error);
      Sentry.captureException(error, {
        tags: { 
          service: 'WebhookService', 
          action: 'processEvent',
          eventType: event.type 
        },
        extra: { event }
      });

      // Send error message to user if possible
      if (event.source.userId && event.replyToken) {
        try {
          await this.botService.replyToEvent(event.replyToken, {
            type: 'text',
            text: 'Sorry, I encountered an error processing your request. Please try again later.'
          });
        } catch (replyError) {
          this.logger.error('Failed to send error reply:', replyError);
        }
      }
    }
  }

  /**
   * Handle text/message events
   */
  private async handleMessageEvent(event: MessageEvent): Promise<void> {
    if (!event.source.userId) {
      this.logger.debug('Ignoring message event without userId');
      return;
    }

    if (event.message.type !== 'text') {
      await this.handleNonTextMessage(event);
      return;
    }

    const messageText = sanitizeText(event.message.text);
    const lineUserId = event.source.userId;

    this.logger.userInteraction(lineUserId, 'message', { text: messageText });

    // Ensure user exists in database
    await this.ensureUserExists(lineUserId);

    // Process intent
    const intentResult = await this.intentProcessor.processMessage({
      text: messageText,
      userId: lineUserId,
      groupId: event.source.groupId,
      timestamp: event.timestamp
    });

    this.logger.botEvent('intent_processed', {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      userId: lineUserId
    });

    // Handle based on intent
    await this.handleIntent(intentResult, event);
  }

  /**
   * Handle postback events (button clicks, etc.)
   */
  private async handlePostbackEvent(event: PostbackEvent): Promise<void> {
    if (!event.source.userId) {
      return;
    }

    const lineUserId = event.source.userId;
    const postbackData = event.postback.data;

    this.logger.userInteraction(lineUserId, 'postback', { data: postbackData });

    try {
      const data = JSON.parse(postbackData);
      
      switch (data.action) {
        case 'create_circle':
          await this.handleCreateCirclePostback(lineUserId, data, event.replyToken);
          break;

        case 'join_circle':
          await this.handleJoinCirclePostback(lineUserId, data, event.replyToken);
          break;

        case 'deposit_reminder':
          await this.handleDepositReminderPostback(lineUserId, data, event.replyToken);
          break;

        case 'set_preferences':
          await this.handlePreferencesPostback(lineUserId, data, event.replyToken);
          break;

        default:
          this.logger.warn(`Unknown postback action: ${data.action}`);
          await this.botService.replyToEvent(event.replyToken, {
            type: 'text',
            text: 'Sorry, I didn\'t understand that action.'
          });
      }

    } catch (parseError) {
      this.logger.error('Failed to parse postback data:', parseError);
      await this.botService.replyToEvent(event.replyToken, {
        type: 'text',
        text: 'Sorry, there was an error processing your request.'
      });
    }
  }

  /**
   * Handle user following the bot
   */
  private async handleFollowEvent(event: FollowEvent): Promise<void> {
    if (!event.source.userId) return;

    const lineUserId = event.source.userId;
    this.logger.botEvent('user_followed', { userId: lineUserId });

    try {
      // Get user profile and create/update user record
      const profile = await this.botService.getUserProfile(lineUserId);
      await this.databaseManager.createOrUpdateUser({
        lineUserId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        language: 'ko', // Default to Korean
        notificationPreferences: {
          depositReminders: true,
          payoutAlerts: true,
          circleUpdates: true,
          riskWarnings: true,
          celebrations: true,
          reminderTimes: [48, 24, 6, 1]
        },
        createdAt: new Date(),
        lastActivity: new Date()
      });

      // Send welcome message
      await this.notificationService.sendNotification(
        lineUserId,
        NotificationType.WELCOME,
        {
          userName: profile.displayName,
          isNewUser: true,
          hasExistingCircles: false,
          suggestedActions: [
            {
              title: '🔴 Create New Circle',
              description: 'Start your own savings circle',
              actionType: 'create',
              actionUrl: `${process.env.LIFF_BASE_URL}?action=create`
            },
            {
              title: '🔵 Join Existing Circle',
              description: 'Join a friend\'s circle with an invite code',
              actionType: 'join',
              actionUrl: `${process.env.LIFF_BASE_URL}?action=join`
            },
            {
              title: '💰 Check Balance',
              description: 'View your USDT balance',
              actionType: 'balance'
            }
          ]
        }
      );

    } catch (error) {
      this.logger.error('Failed to handle follow event:', error);
    }
  }

  /**
   * Handle user unfollowing the bot
   */
  private async handleUnfollowEvent(event: UnfollowEvent): Promise<void> {
    if (!event.source.userId) return;

    const lineUserId = event.source.userId;
    this.logger.botEvent('user_unfollowed', { userId: lineUserId });

    try {
      // Mark user as inactive but don't delete data
      await this.databaseManager.deactivateUser(lineUserId);
    } catch (error) {
      this.logger.error('Failed to handle unfollow event:', error);
    }
  }

  /**
   * Handle bot joining a group
   */
  private async handleJoinEvent(event: JoinEvent): Promise<void> {
    if (!event.source.groupId) return;

    const groupId = event.source.groupId;
    this.logger.botEvent('joined_group', { groupId });

    try {
      // Send group introduction message
      const introMessage: TextMessage = {
        type: 'text',
        text: `👋 Hello! I'm the Kye Circle Bot!\n\n` +
              `I help manage Korean rotating savings circles (ROSCA) with blockchain security.\n\n` +
              `✨ Features:\n` +
              `• Create & join savings circles\n` +
              `• Automated deposit reminders\n` +
              `• Real-time payout notifications\n` +
              `• Smart penalty calculations\n` +
              `• Yield generation tracking\n\n` +
              `Type "help" to get started or use /create to start a new circle!`
      };

      await this.botService.sendGroupMessage(groupId, introMessage);

    } catch (error) {
      this.logger.error('Failed to handle join event:', error);
    }
  }

  /**
   * Handle bot leaving a group
   */
  private async handleLeaveEvent(event: LeaveEvent): Promise<void> {
    if (!event.source.groupId) return;

    const groupId = event.source.groupId;
    this.logger.botEvent('left_group', { groupId });

    try {
      // Update database to mark group circles as inactive if needed
      await this.databaseManager.deactivateGroupCircles(groupId);
    } catch (error) {
      this.logger.error('Failed to handle leave event:', error);
    }
  }

  /**
   * Handle non-text messages (images, stickers, etc.)
   */
  private async handleNonTextMessage(event: MessageEvent): Promise<void> {
    if (!event.replyToken) return;

    const messageType = event.message.type;
    this.logger.userInteraction(event.source.userId || 'unknown', 'non_text_message', { type: messageType });

    const responses: Record<string, string> = {
      image: '📷 Thanks for the image! I can help with text commands like "create circle" or "check balance".',
      sticker: '😊 Nice sticker! Try typing "help" to see what I can do for you.',
      audio: '🎵 I received your audio message! Please use text commands to interact with circles.',
      video: '🎬 Thanks for the video! I work with text commands like "join circle" or "status".',
      file: '📁 I received a file! For circle management, please use text commands.',
      location: '📍 Thanks for sharing your location! Use text commands to manage your circles.'
    };

    const response = responses[messageType] || 'I received your message! Please use text commands to interact with the bot.';

    try {
      await this.botService.replyToEvent(event.replyToken, {
        type: 'text',
        text: response
      });
    } catch (error) {
      this.logger.error('Failed to reply to non-text message:', error);
    }
  }

  /**
   * Handle different user intents
   */
  private async handleIntent(intentResult: any, event: MessageEvent): Promise<void> {
    const { intent, entities } = intentResult;
    const lineUserId = event.source.userId!;
    const groupId = event.source.groupId;

    switch (intent) {
      case Intent.CREATE_CIRCLE:
        await this.handleCreateCircleIntent(lineUserId, entities, event.replyToken, groupId);
        break;

      case Intent.JOIN_CIRCLE:
        await this.handleJoinCircleIntent(lineUserId, entities, event.replyToken);
        break;

      case Intent.CHECK_BALANCE:
        await this.handleCheckBalanceIntent(lineUserId, event.replyToken);
        break;

      case Intent.CIRCLE_STATUS:
        await this.handleCircleStatusIntent(lineUserId, entities, event.replyToken);
        break;

      case Intent.DEPOSIT_INFO:
        await this.handleDepositInfoIntent(lineUserId, entities, event.replyToken);
        break;

      case Intent.HELP:
        await this.handleHelpIntent(lineUserId, event.replyToken);
        break;

      case Intent.GREETING:
        await this.handleGreetingIntent(lineUserId, event.replyToken);
        break;

      default:
        await this.handleUnknownIntent(lineUserId, intentResult.originalText, event.replyToken);
    }
  }

  /**
   * Ensure user exists in database
   */
  private async ensureUserExists(lineUserId: string): Promise<void> {
    try {
      const existingUser = await this.databaseManager.getUser(lineUserId);
      if (!existingUser) {
        // Create user with default preferences
        const profile = await this.botService.getUserProfile(lineUserId);
        await this.databaseManager.createOrUpdateUser({
          lineUserId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          language: 'ko',
          notificationPreferences: {
            depositReminders: true,
            payoutAlerts: true,
            circleUpdates: true,
            riskWarnings: true,
            celebrations: true,
            reminderTimes: [48, 24, 6, 1]
          },
          createdAt: new Date(),
          lastActivity: new Date()
        });
      } else {
        // Update last activity
        await this.databaseManager.updateUserActivity(lineUserId);
      }
    } catch (error) {
      this.logger.error('Failed to ensure user exists:', error);
    }
  }

  // Intent handlers (to be implemented)
  private async handleCreateCircleIntent(lineUserId: string, entities: any, replyToken?: string, groupId?: string): Promise<void> {
    // Implementation will be added
    if (replyToken) {
      await this.botService.replyToEvent(replyToken, {
        type: 'text',
        text: 'Create circle feature coming soon! Visit the web app to create circles.'
      });
    }
  }

  private async handleJoinCircleIntent(lineUserId: string, entities: any, replyToken?: string): Promise<void> {
    // Implementation will be added
    if (replyToken) {
      await this.botService.replyToEvent(replyToken, {
        type: 'text',
        text: 'Join circle feature coming soon! Visit the web app to join circles.'
      });
    }
  }

  private async handleCheckBalanceIntent(lineUserId: string, replyToken?: string): Promise<void> {
    // Implementation will be added
    if (replyToken) {
      await this.botService.replyToEvent(replyToken, {
        type: 'text',
        text: 'Balance check feature coming soon!'
      });
    }
  }

  private async handleCircleStatusIntent(lineUserId: string, entities: any, replyToken?: string): Promise<void> {
    // Implementation will be added
    if (replyToken) {
      await this.botService.replyToEvent(replyToken, {
        type: 'text',
        text: 'Circle status feature coming soon!'
      });
    }
  }

  private async handleDepositInfoIntent(lineUserId: string, entities: any, replyToken?: string): Promise<void> {
    // Implementation will be added
    if (replyToken) {
      await this.botService.replyToEvent(replyToken, {
        type: 'text',
        text: 'Deposit info feature coming soon!'
      });
    }
  }

  private async handleHelpIntent(lineUserId: string, replyToken?: string): Promise<void> {
    if (!replyToken) return;

    const helpMessage = `🤖 Kye Circle Bot Help\n\n` +
                       `Available commands:\n` +
                       `• "create circle" - Start a new savings circle\n` +
                       `• "join circle [code]" - Join with invite code\n` +
                       `• "check balance" - View your USDT balance\n` +
                       `• "my circles" - See your circle status\n` +
                       `• "deposit info" - Check deposit requirements\n` +
                       `• "help" - Show this help message\n\n` +
                       `🌐 Web App: ${process.env.WEB_APP_BASE_URL || 'Available soon'}\n\n` +
                       `For support, contact the development team.`;

    await this.botService.replyToEvent(replyToken, {
      type: 'text',
      text: helpMessage
    });
  }

  private async handleGreetingIntent(lineUserId: string, replyToken?: string): Promise<void> {
    if (!replyToken) return;

    const greetings = [
      '👋 Hello! Ready to manage your savings circles?',
      '😊 Hi there! How can I help with your Kye circles today?',
      '🌟 Greetings! Let\'s make saving money fun and social!',
      '💫 Hey! Your digital Kye circle assistant is here!'
    ];

    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

    await this.botService.replyToEvent(replyToken, {
      type: 'text',
      text: `${randomGreeting}\n\nType "help" to see what I can do!`
    });
  }

  private async handleUnknownIntent(lineUserId: string, originalText: string, replyToken?: string): Promise<void> {
    if (!replyToken) return;

    await this.botService.replyToEvent(replyToken, {
      type: 'text',
      text: `I didn't understand "${originalText}". Try typing "help" to see available commands!`
    });
  }

  // Postback handlers (placeholder implementations)
  private async handleCreateCirclePostback(lineUserId: string, data: any, replyToken?: string): Promise<void> {
    // Implementation will be added
  }

  private async handleJoinCirclePostback(lineUserId: string, data: any, replyToken?: string): Promise<void> {
    // Implementation will be added
  }

  private async handleDepositReminderPostback(lineUserId: string, data: any, replyToken?: string): Promise<void> {
    // Implementation will be added
  }

  private async handlePreferencesPostback(lineUserId: string, data: any, replyToken?: string): Promise<void> {
    // Implementation will be added
  }
}