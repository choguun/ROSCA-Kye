import { BotConfig, ValidationError } from '@/types';

// Simple validation system to replace Joi for now
interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
}

interface ValidationSchema {
  [key: string]: ValidationRule | ValidationSchema;
}

// Simple validation functions
function validateConfig(config: BotConfig): void {
  const errors: string[] = [];

  // Validate LINE configuration
  if (!config.line?.channelAccessToken) errors.push('LINE channel access token is required');
  if (!config.line?.channelSecret) errors.push('LINE channel secret is required');

  // Validate server configuration
  if (!config.server?.port || config.server.port < 1 || config.server.port > 65535) {
    errors.push('Valid server port (1-65535) is required');
  }
  if (!config.server?.baseUrl) errors.push('Server base URL is required');
  if (!config.server?.webhookPath?.startsWith('/')) errors.push('Webhook path must start with /');

  // Validate blockchain configuration
  if (!config.blockchain?.rpcUrl) errors.push('Blockchain RPC URL is required');
  if (!config.blockchain?.chainId) errors.push('Blockchain chain ID is required');
  if (!isValidEthereumAddress(config.blockchain?.contracts?.usdtAddress)) {
    errors.push('Valid USDT contract address is required');
  }
  if (!isValidEthereumAddress(config.blockchain?.contracts?.kyeFactoryAddress)) {
    errors.push('Valid KyeFactory contract address is required');
  }

  // Validate database configuration
  if (!config.database?.path) errors.push('Database path is required');
  if (!config.database?.maxConnections || config.database.maxConnections < 1) {
    errors.push('Database max connections must be positive');
  }

  if (errors.length > 0) {
    throw new ValidationError(`Configuration validation failed: ${errors.join(', ')}`);
  }
}

// Helper validation functions
function isValidLineUserId(userId: string): boolean {
  return /^U[0-9a-f]{32}$/.test(userId);
}

function isValidEthereumAddress(address?: string): boolean {
  return address ? /^0x[a-fA-F0-9]{40}$/.test(address) : false;
}

function isValidAmount(amount: string): boolean {
  return /^\d+$/.test(amount);
}

function validateWebhookEvent(event: any): void {
  const errors: string[] = [];
  
  if (!event.type) errors.push('Event type is required');
  if (!event.timestamp) errors.push('Event timestamp is required');
  if (!event.source?.type) errors.push('Event source type is required');
  if (!event.webhookEventId) errors.push('Webhook event ID is required');
  
  if (errors.length > 0) {
    throw new ValidationError(`Webhook event validation failed: ${errors.join(', ')}`);
  }
}

function validateNotificationData(type: string, data: any): void {
  const errors: string[] = [];
  
  switch (type) {
    case 'deposit_reminder':
      if (!data.hoursRemaining || data.hoursRemaining < 0) errors.push('Valid hours remaining required');
      if (!isValidAmount(data.depositAmount)) errors.push('Valid deposit amount required');
      if (!isValidEthereumAddress(data.circleAddress)) errors.push('Valid circle address required');
      break;
    case 'circle_status':
      if (!data.circleName) errors.push('Circle name required');
      if (!isValidEthereumAddress(data.circleAddress)) errors.push('Valid circle address required');
      break;
    // Add more cases as needed
  }
  
  if (errors.length > 0) {
    throw new ValidationError(`Notification data validation failed: ${errors.join(', ')}`);
  }
}

// Export the validation functions (using custom validation, not Joi)
export { validateConfig, validateWebhookEvent, validateNotificationData };

export function validateLineUserId(userId: string): void {
  if (!isValidLineUserId(userId)) {
    throw new ValidationError(`Invalid LINE User ID: ${userId}`);
  }
}

export function validateEthereumAddress(address: string): void {
  if (!isValidEthereumAddress(address)) {
    throw new ValidationError(`Invalid Ethereum address: ${address}`);
  }
}

export function validateAmount(amount: string): void {
  if (!isValidAmount(amount)) {
    throw new ValidationError(`Invalid amount format: ${amount}`);
  }
}

export function validateUserPreferences(preferences: any): void {
  const errors: string[] = [];
  
  if (preferences.language && !['en', 'ko', 'ja'].includes(preferences.language)) {
    errors.push('Language must be en, ko, or ja');
  }
  
  if (preferences.timezone && typeof preferences.timezone !== 'string') {
    errors.push('Timezone must be a string');
  }
  
  if (errors.length > 0) {
    throw new ValidationError(`User preferences validation failed: ${errors.join(', ')}`);
  }
}

export function validateCreateCircleData(data: any): void {
  const errors: string[] = [];
  
  if (!data.groupName || typeof data.groupName !== 'string') {
    errors.push('Group name is required and must be a string');
  }
  
  if (!data.depositAmount || !isValidAmount(data.depositAmount)) {
    errors.push('Valid deposit amount is required');
  }
  
  if (errors.length > 0) {
    throw new ValidationError(`Create circle data validation failed: ${errors.join(', ')}`);
  }
}

export function validateJoinCircleData(data: any): void {
  const errors: string[] = [];
  
  if (!data.circleAddress || !isValidEthereumAddress(data.circleAddress)) {
    errors.push('Valid circle address is required');
  }
  
  if (data.inviteCode && typeof data.inviteCode !== 'string') {
    errors.push('Invite code must be a string');
  }
  
  if (errors.length > 0) {
    throw new ValidationError(`Join circle data validation failed: ${errors.join(', ')}`);
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

// Express validation middleware using custom validation
export function validationMiddleware(validationFn: (data: any) => void) {
  return (req: any, res: any, next: any) => {
    try {
      validationFn(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof ValidationError ? error.message : 'Validation failed',
      });
    }
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