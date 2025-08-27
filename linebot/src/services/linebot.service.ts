import { Client, ClientConfig, WebhookEvent, TextMessage, FlexMessage, validateSignature } from '@line/bot-sdk';
import * as Sentry from '@sentry/node';
import { Logger } from '@/utils/logger';
import { LineApiError } from '@/types';

export class LineBotService {
  private client: Client;
  private logger: Logger;
  private channelSecret: string;

  constructor(config: { channelAccessToken: string; channelSecret: string }) {
    const clientConfig: ClientConfig = {
      channelAccessToken: config.channelAccessToken,
      channelSecret: config.channelSecret,
    };

    this.client = new Client(clientConfig);
    this.logger = new Logger('LineBotService');
    this.channelSecret = config.channelSecret;
  }

  /**
   * Send a text message to a user
   */
  async sendTextMessage(lineUserId: string, text: string): Promise<void> {
    try {
      const message: TextMessage = {
        type: 'text',
        text: text.slice(0, 5000), // LINE text message limit
      };

      await this.client.pushMessage(lineUserId, message);
      this.logger.notificationSent(lineUserId, 'text', true);

      Sentry.addBreadcrumb({
        message: 'Text message sent successfully',
        category: 'line_bot',
        level: 'info',
        data: { lineUserId, messageLength: text.length },
      });

    } catch (error) {
      this.logger.error('Failed to send text message:', error);
      this.logger.notificationSent(lineUserId, 'text', false);

      Sentry.captureException(error, {
        tags: { service: 'LineBotService', action: 'sendTextMessage' },
        extra: { lineUserId, text: text.slice(0, 100) },
      });

      throw new LineApiError(
        `Failed to send text message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        (error as any)?.response?.data?.message || 'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Send a Flex message to a user
   */
  async sendFlexMessage(lineUserId: string, flexMessage: FlexMessage): Promise<void> {
    try {
      await this.client.pushMessage(lineUserId, flexMessage);
      this.logger.notificationSent(lineUserId, 'flex', true);

      Sentry.addBreadcrumb({
        message: 'Flex message sent successfully',
        category: 'line_bot',
        level: 'info',
        data: { lineUserId, altText: flexMessage.altText },
      });

    } catch (error) {
      this.logger.error('Failed to send Flex message:', error);
      this.logger.notificationSent(lineUserId, 'flex', false);

      Sentry.captureException(error, {
        tags: { service: 'LineBotService', action: 'sendFlexMessage' },
        extra: { lineUserId, altText: flexMessage.altText },
      });

      throw new LineApiError(
        `Failed to send Flex message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        (error as any)?.response?.data?.message || 'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Send a message to a group
   */
  async sendGroupMessage(groupId: string, message: TextMessage | FlexMessage): Promise<void> {
    try {
      await this.client.pushMessage(groupId, message);
      this.logger.botEvent('group_message_sent', { groupId, messageType: message.type });

      Sentry.addBreadcrumb({
        message: 'Group message sent successfully',
        category: 'line_bot',
        level: 'info',
        data: { groupId, messageType: message.type },
      });

    } catch (error) {
      this.logger.error('Failed to send group message:', error);

      Sentry.captureException(error, {
        tags: { service: 'LineBotService', action: 'sendGroupMessage' },
        extra: { groupId, messageType: message.type },
      });

      throw new LineApiError(
        `Failed to send group message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        (error as any)?.response?.data?.message || 'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Reply to a webhook event
   */
  async replyToEvent(replyToken: string, message: TextMessage | FlexMessage): Promise<void> {
    try {
      await this.client.replyMessage(replyToken, message);
      this.logger.botEvent('event_replied', { messageType: message.type });

      Sentry.addBreadcrumb({
        message: 'Event reply sent successfully',
        category: 'line_bot',
        level: 'info',
        data: { messageType: message.type },
      });

    } catch (error) {
      this.logger.error('Failed to reply to event:', error);

      Sentry.captureException(error, {
        tags: { service: 'LineBotService', action: 'replyToEvent' },
        extra: { messageType: message.type },
      });

      throw new LineApiError(
        `Failed to reply to event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        (error as any)?.response?.data?.message || 'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(lineUserId: string): Promise<{
    displayName: string;
    userId: string;
    pictureUrl?: string;
    statusMessage?: string;
    language?: string;
  }> {
    try {
      const profile = await this.client.getProfile(lineUserId);
      
      Sentry.addBreadcrumb({
        message: 'User profile retrieved successfully',
        category: 'line_bot',
        level: 'info',
        data: { lineUserId, hasDisplayName: !!profile.displayName },
      });

      return profile;

    } catch (error) {
      this.logger.error('Failed to get user profile:', error);

      Sentry.captureException(error, {
        tags: { service: 'LineBotService', action: 'getUserProfile' },
        extra: { lineUserId },
      });

      throw new LineApiError(
        `Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        (error as any)?.response?.data?.message || 'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Get group member profile
   */
  async getGroupMemberProfile(groupId: string, lineUserId: string): Promise<{
    displayName: string;
    userId: string;
    pictureUrl?: string;
  }> {
    try {
      const profile = await this.client.getGroupMemberProfile(groupId, lineUserId);
      
      Sentry.addBreadcrumb({
        message: 'Group member profile retrieved successfully',
        category: 'line_bot',
        level: 'info',
        data: { groupId, lineUserId },
      });

      return profile;

    } catch (error) {
      this.logger.error('Failed to get group member profile:', error);

      Sentry.captureException(error, {
        tags: { service: 'LineBotService', action: 'getGroupMemberProfile' },
        extra: { groupId, lineUserId },
      });

      throw new LineApiError(
        `Failed to get group member profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        (error as any)?.response?.data?.message || 'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: string): Promise<void> {
    try {
      await this.client.leaveGroup(groupId);
      this.logger.botEvent('left_group', { groupId });

      Sentry.addBreadcrumb({
        message: 'Left group successfully',
        category: 'line_bot',
        level: 'info',
        data: { groupId },
      });

    } catch (error) {
      this.logger.error('Failed to leave group:', error);

      Sentry.captureException(error, {
        tags: { service: 'LineBotService', action: 'leaveGroup' },
        extra: { groupId },
      });

      throw new LineApiError(
        `Failed to leave group: ${error instanceof Error ? error.message : 'Unknown error'}`,
        (error as any)?.response?.data?.message || 'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Validate webhook signature
   */
  validateSignature(body: string, signature: string): boolean {
    try {
      return validateSignature(body, this.channelSecret, signature);
    } catch (error) {
      this.logger.error('Failed to validate signature:', error);
      return false;
    }
  }

  /**
   * Send multiple messages (up to 5 messages per call)
   */
  async sendMultipleMessages(
    lineUserId: string, 
    messages: (TextMessage | FlexMessage)[]
  ): Promise<void> {
    try {
      // LINE allows up to 5 messages per push
      const messageChunks = this.chunkArray(messages, 5);
      
      for (const chunk of messageChunks) {
        await this.client.pushMessage(lineUserId, chunk);
        // Small delay to avoid rate limiting
        await this.delay(100);
      }

      this.logger.notificationSent(lineUserId, 'multiple', true);

      Sentry.addBreadcrumb({
        message: 'Multiple messages sent successfully',
        category: 'line_bot',
        level: 'info',
        data: { lineUserId, messageCount: messages.length },
      });

    } catch (error) {
      this.logger.error('Failed to send multiple messages:', error);
      this.logger.notificationSent(lineUserId, 'multiple', false);

      Sentry.captureException(error, {
        tags: { service: 'LineBotService', action: 'sendMultipleMessages' },
        extra: { lineUserId, messageCount: messages.length },
      });

      throw new LineApiError(
        `Failed to send multiple messages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        (error as any)?.response?.data?.message || 'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Check if user has blocked the bot
   */
  async isUserBlocked(lineUserId: string): Promise<boolean> {
    try {
      await this.getUserProfile(lineUserId);
      return false;
    } catch (error) {
      // If we get a 403 or specific error, user has blocked the bot
      if ((error as any)?.response?.status === 403) {
        return true;
      }
      // For other errors, we can't determine the status
      throw error;
    }
  }

  /**
   * Get LINE Bot info
   */
  async getBotInfo(): Promise<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
  }> {
    try {
      const info = await this.client.getBotInfo();
      
      Sentry.addBreadcrumb({
        message: 'Bot info retrieved successfully',
        category: 'line_bot',
        level: 'info',
      });

      return info;

    } catch (error) {
      this.logger.error('Failed to get bot info:', error);

      Sentry.captureException(error, {
        tags: { service: 'LineBotService', action: 'getBotInfo' },
      });

      throw new LineApiError(
        `Failed to get bot info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        (error as any)?.response?.data?.message || 'UNKNOWN_ERROR'
      );
    }
  }

  // Utility methods
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Message validation
  validateMessage(message: TextMessage | FlexMessage): boolean {
    if (message.type === 'text') {
      return !!(message.text && message.text.length > 0 && message.text.length <= 5000);
    }
    
    if (message.type === 'flex') {
      return !!(message.altText && message.contents);
    }
    
    return false;
  }

  // Rich menu operations (if needed in future)
  async setRichMenu(lineUserId: string, richMenuId: string): Promise<void> {
    try {
      await this.client.linkRichMenuToUser(lineUserId, richMenuId);
      this.logger.botEvent('rich_menu_linked', { lineUserId, richMenuId });
    } catch (error) {
      this.logger.error('Failed to link rich menu:', error);
      throw new LineApiError(`Failed to link rich menu: ${(error as any)?.message || 'Unknown error'}`);
    }
  }
}