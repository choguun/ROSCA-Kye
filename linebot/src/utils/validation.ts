import Joi from 'joi';
import { BotConfig, ValidationError } from '@/types';

// Configuration validation schema
const configSchema = Joi.object({
  line: Joi.object({
    channelAccessToken: Joi.string().required(),
    channelSecret: Joi.string().required(),
    liffId: Joi.string().optional(),
  }).required(),

  server: Joi.object({
    port: Joi.number().port().required(),
    baseUrl: Joi.string().uri().required(),
    webhookPath: Joi.string().pattern(/^\//).required(),
  }).required(),

  blockchain: Joi.object({
    rpcUrl: Joi.string().uri().required(),
    chainId: Joi.number().required(),
    privateKey: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).optional(),
    contracts: Joi.object({
      usdtAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
      savingsPocketAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).allow(''),
      kyeFactoryAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    }).required(),
  }).required(),

  database: Joi.object({
    path: Joi.string().required(),
    maxConnections: Joi.number().positive().required(),
    busyTimeout: Joi.number().positive().required(),
  }).required(),

  ai: Joi.object({
    openaiApiKey: Joi.string().optional(),
    enabled: Joi.boolean().required(),
  }).required(),

  notifications: Joi.object({
    reminderIntervals: Joi.array().items(Joi.number().positive()).required(),
    maxRetries: Joi.number().positive().required(),
    retryDelay: Joi.number().positive().required(),
  }).required(),

  security: Joi.object({
    encryptionKey: Joi.string().min(32).required(),
    jwtSecret: Joi.string().min(32).required(),
    rateLimitWindow: Joi.number().positive().required(),
    rateLimitMax: Joi.number().positive().required(),
  }).required(),

  i18n: Joi.object({
    defaultLanguage: Joi.string().valid('ko', 'en', 'ja').required(),
    supportedLanguages: Joi.array().items(Joi.string().valid('ko', 'en', 'ja')).required(),
  }).required(),
});

// LINE User ID validation
export const lineUserIdSchema = Joi.string().pattern(/^U[0-9a-f]{32}$/);

// Ethereum address validation
export const ethereumAddressSchema = Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/);

// Amount validation (wei format)
export const amountSchema = Joi.string().pattern(/^\d+$/);

// Webhook event validation schema
const webhookEventSchema = Joi.object({
  type: Joi.string().required(),
  mode: Joi.string().required(),
  timestamp: Joi.number().required(),
  source: Joi.object({
    type: Joi.string().valid('user', 'group', 'room').required(),
    userId: Joi.string().optional(),
    groupId: Joi.string().optional(),
    roomId: Joi.string().optional(),
  }).required(),
  webhookEventId: Joi.string().required(),
  deliveryContext: Joi.object({
    isRedelivery: Joi.boolean().required(),
  }).required(),
  message: Joi.object({
    id: Joi.string().required(),
    type: Joi.string().required(),
    text: Joi.string().optional(),
  }).optional(),
  postback: Joi.object({
    data: Joi.string().required(),
    params: Joi.object().optional(),
  }).optional(),
});

// Notification data validation schemas
export const notificationSchemas = {
  deposit_reminder: Joi.object({
    hoursRemaining: Joi.number().positive().required(),
    depositAmount: amountSchema.required(),
    penalty: amountSchema.required(),
    urgency: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
    circleAddress: ethereumAddressSchema.required(),
    roundIndex: Joi.number().min(0).required(),
    beneficiaryName: Joi.string().optional(),
  }),

  circle_status: Joi.object({
    circleName: Joi.string().required(),
    circleAddress: ethereumAddressSchema.required(),
    phase: Joi.string().valid('setup', 'active', 'completed').required(),
    memberCount: Joi.number().positive().required(),
    maxMembers: Joi.number().positive().required(),
    currentRound: Joi.number().min(0).required(),
    totalRounds: Joi.number().positive().required(),
    nextDeadline: Joi.number().optional(),
    totalValueLocked: amountSchema.required(),
    userRole: Joi.string().valid('creator', 'member', 'beneficiary').required(),
    canDeposit: Joi.boolean().required(),
  }),

  payout_notification: Joi.object({
    beneficiaryName: Joi.string().required(),
    amount: amountSchema.required(),
    roundIndex: Joi.number().min(0).required(),
    totalRounds: Joi.number().positive().required(),
    yieldEarned: amountSchema.optional(),
    nextBeneficiary: Joi.string().optional(),
    nextDeadline: Joi.number().optional(),
  }),
};

// User preferences validation schema
export const userPreferencesSchema = Joi.object({
  depositReminders: Joi.boolean().required(),
  payoutAlerts: Joi.boolean().required(),
  circleUpdates: Joi.boolean().required(),
  riskWarnings: Joi.boolean().required(),
  celebrations: Joi.boolean().required(),
  reminderTimes: Joi.array().items(Joi.number().positive()).required(),
});

// Circle creation data validation
export const createCircleSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  depositAmount: amountSchema.required(),
  penaltyBps: Joi.number().min(0).max(5000).required(),
  roundDurationDays: Joi.number().min(1).max(365).required(),
  maxMembers: Joi.number().min(2).max(5).required(),
  lineGroupId: Joi.string().optional(),
});

// Join circle data validation
export const joinCircleSchema = Joi.object({
  circleAddress: ethereumAddressSchema.required(),
  inviteCode: Joi.string().optional(),
});

// Validation functions
export function validateConfig(config: BotConfig): void {
  const { error } = configSchema.validate(config);
  if (error) {
    throw new ValidationError(`Configuration validation failed: ${error.message}`);
  }
}

export function validateWebhookEvent(event: any): void {
  const { error } = webhookEventSchema.validate(event);
  if (error) {
    throw new ValidationError(`Webhook event validation failed: ${error.message}`);
  }
}

export function validateNotificationData(type: string, data: any): void {
  const schema = notificationSchemas[type as keyof typeof notificationSchemas];
  if (!schema) {
    throw new ValidationError(`Unknown notification type: ${type}`);
  }

  const { error } = schema.validate(data);
  if (error) {
    throw new ValidationError(`Notification data validation failed: ${error.message}`, type);
  }
}

export function validateLineUserId(userId: string): void {
  const { error } = lineUserIdSchema.validate(userId);
  if (error) {
    throw new ValidationError(`Invalid LINE User ID: ${userId}`);
  }
}

export function validateEthereumAddress(address: string): void {
  const { error } = ethereumAddressSchema.validate(address);
  if (error) {
    throw new ValidationError(`Invalid Ethereum address: ${address}`);
  }
}

export function validateAmount(amount: string): void {
  const { error } = amountSchema.validate(amount);
  if (error) {
    throw new ValidationError(`Invalid amount format: ${amount}`);
  }
}

export function validateUserPreferences(preferences: any): void {
  const { error } = userPreferencesSchema.validate(preferences);
  if (error) {
    throw new ValidationError(`User preferences validation failed: ${error.message}`);
  }
}

export function validateCreateCircleData(data: any): void {
  const { error } = createCircleSchema.validate(data);
  if (error) {
    throw new ValidationError(`Create circle data validation failed: ${error.message}`);
  }
}

export function validateJoinCircleData(data: any): void {
  const { error } = joinCircleSchema.validate(data);
  if (error) {
    throw new ValidationError(`Join circle data validation failed: ${error.message}`);
  }
}

// Input sanitization
export function sanitizeText(text: string): string {
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
}

export function sanitizeAmount(amount: string): string {
  return amount.replace(/[^0-9]/g, '');
}

// Rate limiting helpers
export function createRateLimitKey(userId: string, action: string): string {
  return `rate_limit:${userId}:${action}`;
}

// Validation middleware for Express
export function validationMiddleware(schema: Joi.ObjectSchema) {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${error.message}`,
      });
    }
    next();
  };
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  LINE_USER_ID: /^U[0-9a-f]{32}$/,
  LINE_GROUP_ID: /^C[0-9a-f]{32}$/,
  WEI_AMOUNT: /^\d+$/,
  HEX_COLOR: /^#[0-9A-Fa-f]{6}$/,
  JAPANESE_TEXT: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
  KOREAN_TEXT: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
} as const;