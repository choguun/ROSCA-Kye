import * as winston from 'winston';
import * as path from 'path';

export class Logger {
  private logger: winston.Logger;

  constructor(service: string) {
    const logDir = process.env.LOG_DIR || 'logs';
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isDevelopment = process.env.NODE_ENV === 'development';

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${service}] ${level.toUpperCase()}: ${message}${metaString ? '\n' + metaString : ''}`;
        })
      ),
      defaultMeta: { service },
      transports: [
        // Console transport for development
        ...(isDevelopment ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
          })
        ] : []),

        // File transports for production
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 10,
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 10,
        }),

        // Separate log for bot-specific events
        new winston.transports.File({
          filename: path.join(logDir, 'bot.log'),
          level: 'info',
          maxsize: 5242880, // 5MB
          maxFiles: 10,
        }),
      ],
    });

    // Handle logging errors
    this.logger.on('error', (error) => {
      console.error('Logger error:', error);
    });
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      this.logger.error(message, {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
    } else {
      this.logger.error(message, { error });
    }
  }

  // Special methods for bot events
  botEvent(event: string, data?: any): void {
    this.logger.info(`BOT_EVENT: ${event}`, data);
  }

  webhookReceived(eventType: string, source: any): void {
    this.logger.info('WEBHOOK_RECEIVED', {
      eventType,
      sourceType: source.type,
      sourceId: source.userId || source.groupId || source.roomId,
    });
  }

  blockchainEvent(eventName: string, contractAddress: string, data: any): void {
    this.logger.info('BLOCKCHAIN_EVENT', {
      eventName,
      contractAddress,
      data,
    });
  }

  notificationSent(lineUserId: string, notificationType: string, success: boolean): void {
    this.logger.info('NOTIFICATION_SENT', {
      lineUserId,
      notificationType,
      success,
    });
  }

  // Performance monitoring
  startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.logger.info(`PERFORMANCE: ${label}`, { duration: `${duration}ms` });
    };
  }

  // User interaction tracking
  userInteraction(lineUserId: string, action: string, data?: any): void {
    this.logger.info('USER_INTERACTION', {
      lineUserId,
      action,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Contract interaction tracking
  contractCall(contractAddress: string, method: string, success: boolean, gasUsed?: string): void {
    this.logger.info('CONTRACT_CALL', {
      contractAddress,
      method,
      success,
      gasUsed,
    });
  }
}

// Create a default logger instance
export const logger = new Logger('LineBot');