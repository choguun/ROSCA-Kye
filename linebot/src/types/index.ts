// Core LINE Bot Types
export interface LineUser {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  walletAddress?: string;
  language: 'ko' | 'en' | 'ja';
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
  lastActivity: Date;
}

export interface NotificationPreferences {
  depositReminders: boolean;
  payoutAlerts: boolean;
  circleUpdates: boolean;
  riskWarnings: boolean;
  celebrations: boolean;
  reminderTimes: number[]; // Hours before deadline [48, 24, 6, 1]
}

// Circle Management Types
export interface BotCircle {
  circleAddress: string;
  lineGroupId?: string;
  creatorLineId: string;
  status: CircleStatus;
  memberCount: number;
  maxMembers: number;
  depositAmount: string; // Wei format
  currentRound: number;
  nextDeadline?: Date;
  createdAt: Date;
  metadata: CircleMetadata;
}

export enum CircleStatus {
  SETUP = 'setup',
  ACTIVE = 'active', 
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed'
}

export interface CircleMetadata {
  name: string;
  description?: string;
  roundDurationDays: number;
  penaltyBps: number;
  totalValueLocked: string;
  yieldEarned: string;
  depositAmount?: string; // Added for notification service
}

// Notification System Types
export interface NotificationEvent {
  id: string;
  type: NotificationType;
  lineUserId: string;
  circleAddress?: string;
  messageContent: any; // LINE SDK message type
  scheduledTime: Date;
  status: NotificationStatus;
  retryCount: number;
  metadata: Record<string, any>;
}

export enum NotificationType {
  DEPOSIT_REMINDER = 'deposit_reminder',
  DEPOSIT_CONFIRMED = 'deposit_confirmed',
  PAYOUT_EXECUTED = 'payout_executed',
  ROUND_STARTED = 'round_started',
  PENALTY_APPLIED = 'penalty_applied',
  CIRCLE_COMPLETED = 'circle_completed',
  CIRCLE_STATUS = 'circle_status',
  RISK_ALERT = 'risk_alert',
  GRACE_PERIOD_GRANTED = 'grace_period_granted',
  WELCOME = 'welcome',
  HELP = 'help'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent', 
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Import LINE SDK types directly to avoid conflicts
export type {
  FlexMessage,
  FlexBubble,
  FlexBox,
  FlexCarousel,
  FlexComponent,
  FlexButton,
  FlexText,
  FlexImage,
  FlexSeparator,
  FlexSpacer,
  FlexContainer,
  TextMessage,
  QuickReply,
  QuickReplyItem,
  Action,
  PostbackAction,
  MessageAction,
  URIAction,
  DatetimePickerAction
} from '@line/bot-sdk';

// AI & Intelligence Types
export interface IntentRecognitionResult {
  intent: Intent;
  confidence: number;
  entities: Record<string, any>;
  originalText: string;
  language: string;
}

export enum Intent {
  CREATE_CIRCLE = 'create_circle',
  JOIN_CIRCLE = 'join_circle', 
  CHECK_BALANCE = 'check_balance',
  CIRCLE_STATUS = 'circle_status',
  DEPOSIT_INFO = 'deposit_info',
  HELP = 'help',
  GREETING = 'greeting',
  UNKNOWN = 'unknown'
}

export interface UserBehaviorProfile {
  lineUserId: string;
  consistencyScore: number; // 0-1 scale
  riskLevel: 'low' | 'medium' | 'high';
  preferredCommunicationTime: string; // ISO time string
  responsePatterns: ResponsePattern[];
  financialCapacity: FinancialCapacity;
  lastUpdated: Date;
}

export interface ResponsePattern {
  messageType: NotificationType;
  averageResponseTime: number; // milliseconds
  responseRate: number; // 0-1 scale
  preferredFormat: 'text' | 'flex' | 'rich';
}

export interface FinancialCapacity {
  recommendedDepositRange: {
    min: string;
    max: string;
  };
  riskFactors: string[];
  suggestions: string[];
}

// Blockchain Integration Types
export interface BlockchainEvent {
  eventName: string;
  contractAddress: string;
  blockNumber: number;
  transactionHash: string;
  args: Record<string, any>;
  timestamp: Date;
}

export interface ContractEventHandler {
  eventName: string;
  handler: (event: BlockchainEvent) => Promise<void>;
}

// Webhook Types
export interface LineWebhookEvent {
  type: string;
  mode: string;
  timestamp: number;
  source: EventSource;
  webhookEventId: string;
  deliveryContext: DeliveryContext;
  message?: Message;
  postback?: Postback;
}

export interface EventSource {
  type: 'user' | 'group' | 'room';
  userId?: string;
  groupId?: string;
  roomId?: string;
}

export interface DeliveryContext {
  isRedelivery: boolean;
}

export interface Message {
  id: string;
  type: string;
  text?: string;
  contentProvider?: ContentProvider;
}

export interface ContentProvider {
  type: string;
  originalContentUrl?: string;
  previewImageUrl?: string;
}

export interface Postback {
  data: string;
  params?: PostbackParams;
}

export interface PostbackParams {
  date?: string;
  time?: string;
  datetime?: string;
}

// Database Types
export interface DatabaseConfig {
  path: string;
  maxConnections: number;
  busyTimeout: number;
}

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

// Configuration Types
export interface BotConfig {
  line: {
    channelAccessToken: string;
    channelSecret: string;
    liffId?: string;
  };
  server: {
    port: number;
    baseUrl: string;
    webhookPath: string;
  };
  blockchain: {
    rpcUrl: string;
    chainId: number;
    privateKey?: string;
    contracts: {
      usdtAddress: string;
      savingsPocketAddress: string;
      kyeFactoryAddress: string;
    };
  };
  database: DatabaseConfig;
  ai: {
    openaiApiKey?: string;
    enabled: boolean;
  };
  notifications: {
    reminderIntervals: number[];
    maxRetries: number;
    retryDelay: number;
  };
  security: {
    encryptionKey: string;
    jwtSecret: string;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  i18n: {
    defaultLanguage: 'ko' | 'en' | 'ja';
    supportedLanguages: ('ko' | 'en' | 'ja')[];
  };
}

// Error Types
export class BotError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'BotError';
  }
}

export class ValidationError extends BotError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400, { field });
    this.name = 'ValidationError';
  }
}

export class BlockchainError extends BotError {
  constructor(message: string, transactionHash?: string) {
    super(message, 'BLOCKCHAIN_ERROR', 500, { transactionHash });
    this.name = 'BlockchainError';
  }
}

export class LineApiError extends BotError {
  constructor(message: string, lineErrorCode?: string) {
    super(message, 'LINE_API_ERROR', 500, { lineErrorCode });
    this.name = 'LineApiError';
  }
}

// Utility Types
export type AsyncResult<T> = Promise<{
  success: boolean;
  data?: T;
  error?: string;
}>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Export all types
export * from './flex-messages';
export * from './smart-contracts';