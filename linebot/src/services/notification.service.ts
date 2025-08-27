import cron from 'node-cron';
import { LineBotService } from './linebot.service';
import { DatabaseManager } from '@/database/manager';
import { FlexMessageBuilder } from '@/templates/flex-messages';
import { I18nManager } from '@/templates/i18n';
import { Logger } from '@/utils/logger';
import { 
  NotificationType, 
  NotificationEvent, 
  NotificationStatus, 
  DepositReminderData,
  CircleStatusData,
  PayoutNotificationData,
  RiskAlertData,
  CelebrationData,
  WelcomeMessageData,
  HelpMenuData,
  FlexMessage,
  TextMessage
} from '@/types';
import * as Sentry from '@sentry/node';

export class NotificationService {
  private logger: Logger;
  private flexMessageBuilder: FlexMessageBuilder;
  private i18nManager: I18nManager;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private isRunning: boolean = false;

  constructor(
    private botService: LineBotService,
    private databaseManager: DatabaseManager,
    private config: {
      reminderIntervals: number[];
      maxRetries: number;
      retryDelay: number;
    }
  ) {
    this.logger = new Logger('NotificationService');
    this.flexMessageBuilder = new FlexMessageBuilder();
    this.i18nManager = new I18nManager();
  }

  /**
   * Start the notification service and schedulers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Notification service is already running');
      return;
    }

    this.logger.info('Starting notification service...');

    try {
      // Schedule periodic tasks
      this.scheduleDepositReminderCheck();
      this.scheduleNotificationProcessing();
      this.scheduleRetryFailedNotifications();
      this.scheduleCleanupOldNotifications();

      this.isRunning = true;
      this.logger.info('Notification service started successfully');

      Sentry.addBreadcrumb({
        message: 'Notification service started',
        category: 'notification',
        level: 'info',
      });

    } catch (error) {
      this.logger.error('Failed to start notification service:', error);
      throw error;
    }
  }

  /**
   * Stop the notification service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('Stopping notification service...');

    // Stop all scheduled jobs
    for (const [jobName, task] of this.scheduledJobs) {
      task.stop();
      this.logger.debug(`Stopped scheduled job: ${jobName}`);
    }

    this.scheduledJobs.clear();
    this.isRunning = false;

    this.logger.info('Notification service stopped');
  }

  /**
   * Send a notification to a user
   */
  async sendNotification(
    lineUserId: string, 
    type: NotificationType, 
    data: any
  ): Promise<void> {
    try {
      this.logger.info(`Sending notification: ${type} to ${lineUserId}`);

      // Get user preferences
      const user = await this.databaseManager.getUser(lineUserId);
      if (!user) {
        this.logger.warn(`User not found for notification: ${lineUserId}`);
        return;
      }

      // Check if user wants this type of notification
      if (!this.shouldSendNotification(user.notificationPreferences, type)) {
        this.logger.debug(`Notification disabled by user preferences: ${type}`);
        return;
      }

      // Create notification event
      const notificationEvent: Omit<NotificationEvent, 'id'> = {
        type,
        lineUserId,
        messageContent: await this.createMessage(type, data, user.language),
        scheduledTime: new Date(),
        status: NotificationStatus.PENDING,
        retryCount: 0,
        metadata: { originalData: data }
      };

      // Save to database
      const eventId = await this.databaseManager.createNotificationEvent(notificationEvent);
      
      // Send immediately
      await this.processNotification({ ...notificationEvent, id: eventId });

    } catch (error) {
      this.logger.error(`Failed to send notification ${type}:`, error);
      Sentry.captureException(error, {
        tags: { service: 'NotificationService', action: 'sendNotification' },
        extra: { lineUserId, type, data }
      });
    }
  }

  /**
   * Schedule a notification for future delivery
   */
  async scheduleNotification(
    lineUserId: string,
    type: NotificationType,
    data: any,
    scheduledTime: Date
  ): Promise<string> {
    try {
      const user = await this.databaseManager.getUser(lineUserId);
      if (!user) {
        throw new Error(`User not found: ${lineUserId}`);
      }

      const notificationEvent: Omit<NotificationEvent, 'id'> = {
        type,
        lineUserId,
        messageContent: await this.createMessage(type, data, user.language),
        scheduledTime,
        status: NotificationStatus.PENDING,
        retryCount: 0,
        metadata: { originalData: data }
      };

      const eventId = await this.databaseManager.createNotificationEvent(notificationEvent);
      this.logger.info(`Scheduled notification ${type} for ${scheduledTime.toISOString()}`);

      return eventId;

    } catch (error) {
      this.logger.error('Failed to schedule notification:', error);
      throw error;
    }
  }

  /**
   * Schedule deposit reminders for a circle
   */
  async scheduleDepositReminders(
    circleAddress: string,
    roundDeadline: Date,
    excludeBeneficiary?: string
  ): Promise<void> {
    try {
      const members = await this.databaseManager.getCircleMembers(circleAddress);
      const circle = await this.databaseManager.getCircle(circleAddress);
      
      if (!circle) {
        throw new Error(`Circle not found: ${circleAddress}`);
      }

      for (const member of members) {
        // Skip beneficiary for current round
        if (excludeBeneficiary && member.walletAddress === excludeBeneficiary) {
          continue;
        }

        const user = await this.databaseManager.getUserByWallet(member.walletAddress);
        if (!user) continue;

        // Schedule reminders at configured intervals
        for (const hours of this.config.reminderIntervals) {
          const reminderTime = new Date(roundDeadline.getTime() - (hours * 60 * 60 * 1000));
          
          // Only schedule future reminders
          if (reminderTime > new Date()) {
            const urgency = this.calculateUrgency(hours);
            const penalty = await this.calculatePenalty(member.walletAddress, circleAddress);

            const reminderData: DepositReminderData = {
              hoursRemaining: hours,
              depositAmount: circle.metadata.depositAmount || circle.depositAmount,
              penalty: penalty.toString(),
              urgency,
              circleAddress,
              roundIndex: circle.currentRound,
              beneficiaryName: excludeBeneficiary ? await this.getBeneficiaryName(excludeBeneficiary) : undefined
            };

            await this.scheduleNotification(
              user.lineUserId,
              NotificationType.DEPOSIT_REMINDER,
              reminderData,
              reminderTime
            );
          }
        }
      }

      this.logger.info(`Scheduled deposit reminders for circle ${circleAddress}`);

    } catch (error) {
      this.logger.error('Failed to schedule deposit reminders:', error);
      throw error;
    }
  }

  /**
   * Send immediate notification for blockchain events
   */
  async handleBlockchainEvent(eventName: string, eventData: any): Promise<void> {
    try {
      this.logger.blockchainEvent(eventName, eventData.contractAddress, eventData);

      switch (eventName) {
        case 'MemberJoined':
          await this.handleMemberJoinedEvent(eventData);
          break;

        case 'DepositMade':
          await this.handleDepositMadeEvent(eventData);
          break;

        case 'PayoutExecuted':
          await this.handlePayoutExecutedEvent(eventData);
          break;

        case 'RoundStarted':
          await this.handleRoundStartedEvent(eventData);
          break;

        case 'PenaltyCharged':
          await this.handlePenaltyChargedEvent(eventData);
          break;

        case 'CircleCompleted':
          await this.handleCircleCompletedEvent(eventData);
          break;

        default:
          this.logger.debug(`Unhandled blockchain event: ${eventName}`);
      }

    } catch (error) {
      this.logger.error(`Failed to handle blockchain event ${eventName}:`, error);
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalSent: number;
    totalFailed: number;
    successRate: number;
    byType: Record<string, number>;
    recent24h: number;
  }> {
    try {
      return await this.databaseManager.getNotificationStats();
    } catch (error) {
      this.logger.error('Failed to get notification stats:', error);
      throw error;
    }
  }

  // Private methods

  private shouldSendNotification(preferences: any, type: NotificationType): boolean {
    const typeMap = {
      [NotificationType.DEPOSIT_REMINDER]: preferences.depositReminders,
      [NotificationType.DEPOSIT_CONFIRMED]: preferences.circleUpdates,
      [NotificationType.PAYOUT_EXECUTED]: preferences.payoutAlerts,
      [NotificationType.ROUND_STARTED]: preferences.circleUpdates,
      [NotificationType.PENALTY_APPLIED]: preferences.riskWarnings,
      [NotificationType.CIRCLE_COMPLETED]: preferences.celebrations,
      [NotificationType.RISK_ALERT]: preferences.riskWarnings,
      [NotificationType.GRACE_PERIOD_GRANTED]: preferences.circleUpdates,
      [NotificationType.WELCOME]: true, // Always send welcome messages
      [NotificationType.HELP]: true, // Always send help messages
    };

    return typeMap[type] ?? true;
  }

  private async createMessage(
    type: NotificationType, 
    data: any, 
    language: string
  ): Promise<FlexMessage | TextMessage> {
    switch (type) {
      case NotificationType.DEPOSIT_REMINDER:
        return this.flexMessageBuilder.createDepositReminderMessage(data as DepositReminderData, language);

      case NotificationType.CIRCLE_STATUS:
        return this.flexMessageBuilder.createCircleStatusMessage(data as CircleStatusData, language);

      case NotificationType.PAYOUT_EXECUTED:
        return this.flexMessageBuilder.createPayoutNotificationMessage(data as PayoutNotificationData, language);

      case NotificationType.RISK_ALERT:
        return this.flexMessageBuilder.createRiskAlertMessage(data as RiskAlertData, language);

      case NotificationType.CIRCLE_COMPLETED:
        return this.flexMessageBuilder.createCelebrationMessage(data as CelebrationData, language);

      case NotificationType.WELCOME:
        return this.flexMessageBuilder.createWelcomeMessage(data as WelcomeMessageData, language);

      case NotificationType.HELP:
        return this.flexMessageBuilder.createHelpMenuMessage(data as HelpMenuData, language);

      default:
        // Fallback to text message
        return {
          type: 'text',
          text: this.i18nManager.getMessage(`notification.${type}`, language, data)
        };
    }
  }

  private async processNotification(notification: NotificationEvent): Promise<void> {
    try {
      // Check if user is blocked
      const isBlocked = await this.botService.isUserBlocked(notification.lineUserId);
      if (isBlocked) {
        await this.databaseManager.updateNotificationStatus(notification.id, NotificationStatus.CANCELLED);
        return;
      }

      // Send the message
      if (notification.messageContent.type === 'flex') {
        await this.botService.sendFlexMessage(notification.lineUserId, notification.messageContent as FlexMessage);
      } else {
        await this.botService.sendTextMessage(notification.lineUserId, (notification.messageContent as TextMessage).text);
      }

      // Mark as sent
      await this.databaseManager.updateNotificationStatus(notification.id, NotificationStatus.SENT);

    } catch (error) {
      this.logger.error(`Failed to process notification ${notification.id}:`, error);

      // Handle retry logic
      if (notification.retryCount < this.config.maxRetries) {
        await this.databaseManager.incrementNotificationRetry(notification.id);
        
        // Schedule retry
        setTimeout(() => {
          this.processNotification({ ...notification, retryCount: notification.retryCount + 1 });
        }, this.config.retryDelay * Math.pow(2, notification.retryCount)); // Exponential backoff

      } else {
        await this.databaseManager.updateNotificationStatus(notification.id, NotificationStatus.FAILED);
      }
    }
  }

  // Scheduled job methods
  private scheduleDepositReminderCheck(): void {
    const task = cron.schedule('0 */10 * * * *', async () => { // Every 10 minutes
      try {
        const pendingReminders = await this.databaseManager.getPendingDepositReminders();
        
        for (const reminder of pendingReminders) {
          await this.processNotification(reminder);
        }

      } catch (error) {
        this.logger.error('Deposit reminder check failed:', error);
      }
    });

    this.scheduledJobs.set('depositReminderCheck', task);
  }

  private scheduleNotificationProcessing(): void {
    const task = cron.schedule('0 * * * * *', async () => { // Every minute
      try {
        const pendingNotifications = await this.databaseManager.getPendingNotifications();
        
        for (const notification of pendingNotifications) {
          if (notification.scheduledTime <= new Date()) {
            await this.processNotification(notification);
          }
        }

      } catch (error) {
        this.logger.error('Notification processing failed:', error);
      }
    });

    this.scheduledJobs.set('notificationProcessing', task);
  }

  private scheduleRetryFailedNotifications(): void {
    const task = cron.schedule('0 */5 * * * *', async () => { // Every 5 minutes
      try {
        const failedNotifications = await this.databaseManager.getFailedNotifications();
        
        for (const notification of failedNotifications) {
          if (notification.retryCount < this.config.maxRetries) {
            await this.processNotification(notification);
          }
        }

      } catch (error) {
        this.logger.error('Failed notification retry failed:', error);
      }
    });

    this.scheduledJobs.set('retryFailedNotifications', task);
  }

  private scheduleCleanupOldNotifications(): void {
    const task = cron.schedule('0 0 2 * * *', async () => { // Daily at 2 AM
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days

        await this.databaseManager.cleanupOldNotifications(cutoffDate);
        this.logger.info('Cleaned up old notifications');

      } catch (error) {
        this.logger.error('Notification cleanup failed:', error);
      }
    });

    this.scheduledJobs.set('cleanupOldNotifications', task);
  }

  // Event handlers
  private async handleMemberJoinedEvent(eventData: any): Promise<void> {
    // Implementation for member joined notifications
  }

  private async handleDepositMadeEvent(eventData: any): Promise<void> {
    // Implementation for deposit confirmed notifications
  }

  private async handlePayoutExecutedEvent(eventData: any): Promise<void> {
    // Implementation for payout notifications
  }

  private async handleRoundStartedEvent(eventData: any): Promise<void> {
    // Implementation for round started notifications
  }

  private async handlePenaltyChargedEvent(eventData: any): Promise<void> {
    // Implementation for penalty notifications
  }

  private async handleCircleCompletedEvent(eventData: any): Promise<void> {
    // Implementation for circle completion celebrations
  }

  // Utility methods
  private calculateUrgency(hoursRemaining: number): 'low' | 'medium' | 'high' | 'critical' {
    if (hoursRemaining <= 1) return 'critical';
    if (hoursRemaining <= 6) return 'high';
    if (hoursRemaining <= 24) return 'medium';
    return 'low';
  }

  private async calculatePenalty(walletAddress: string, circleAddress: string): Promise<number> {
    // Implementation to calculate penalty
    return 0;
  }

  private async getBeneficiaryName(walletAddress: string): Promise<string> {
    // Implementation to get beneficiary display name
    return 'Member';
  }
}