import { BotConfig } from '@/types';
import { BotError } from '@/types';

export function createBotConfig(): BotConfig {
  const requiredEnvVars = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'KAIA_RPC_URL',
    'USDT_CONTRACT_ADDRESS',
    'KYE_FACTORY_ADDRESS',
  ];

  // Check for required environment variables
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    throw new BotError(
      `Missing required environment variables: ${missing.join(', ')}`,
      'CONFIG_ERROR'
    );
  }

  return {
    line: {
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
      channelSecret: process.env.LINE_CHANNEL_SECRET!,
      liffId: process.env.LINE_LIFF_ID,
    },
    server: {
      port: parseInt(process.env.PORT || '3001', 10),
      baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || '3001'}`,
      webhookPath: process.env.WEBHOOK_PATH || '/webhook',
    },
    blockchain: {
      rpcUrl: process.env.KAIA_RPC_URL!,
      chainId: parseInt(process.env.KAIA_CHAIN_ID || '1001', 10),
      privateKey: process.env.PRIVATE_KEY,
      contracts: {
        usdtAddress: process.env.USDT_CONTRACT_ADDRESS!,
        savingsPocketAddress: process.env.SAVINGS_POCKET_ADDRESS || '',
        kyeFactoryAddress: process.env.KYE_FACTORY_ADDRESS!,
      },
    },
    database: {
      path: process.env.DATABASE_URL || './data/linebot.db',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
      busyTimeout: parseInt(process.env.DB_BUSY_TIMEOUT || '5000', 10),
    },
    ai: {
      openaiApiKey: process.env.OPENAI_API_KEY,
      enabled: process.env.AI_ENABLED === 'true',
    },
    notifications: {
      reminderIntervals: process.env.REMINDER_INTERVALS 
        ? process.env.REMINDER_INTERVALS.split(',').map(Number)
        : [48, 24, 6, 1],
      maxRetries: parseInt(process.env.NOTIFICATION_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.NOTIFICATION_RETRY_DELAY || '5000', 10),
    },
    security: {
      encryptionKey: process.env.ENCRYPTION_KEY || generateRandomKey(),
      jwtSecret: process.env.JWT_SECRET || generateRandomKey(),
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
    },
    i18n: {
      defaultLanguage: (process.env.DEFAULT_LANGUAGE as 'ko' | 'en' | 'ja') || 'ko',
      supportedLanguages: process.env.SUPPORTED_LANGUAGES 
        ? (process.env.SUPPORTED_LANGUAGES.split(',') as ('ko' | 'en' | 'ja')[])
        : ['ko', 'en', 'ja'],
    },
  };
}

function generateRandomKey(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

export function getWebAppUrls() {
  const baseUrl = process.env.WEB_APP_BASE_URL || 'http://localhost:3000';
  const liffUrl = process.env.LIFF_BASE_URL || `https://liff.line.me/${process.env.LINE_LIFF_ID}`;

  return {
    baseUrl,
    liffUrl,
    endpoints: {
      createCircle: `${liffUrl}?action=create`,
      joinCircle: `${liffUrl}?action=join`,
      deposit: `${liffUrl}?action=deposit`,
      dashboard: `${liffUrl}`,
    },
  };
}