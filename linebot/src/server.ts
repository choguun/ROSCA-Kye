import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import { middleware } from '@line/bot-sdk';
import dotenv from 'dotenv';

import { BotConfig } from './types';
import { WebhookService } from './services/webhook.service';
import { LineBotService } from './services/linebot.service';
import { NotificationService } from './services/notification.service';
import { BlockchainMonitor } from './blockchain/monitor';
import { DatabaseManager } from './database/manager';
import { Logger } from './utils/logger';
import { validateConfig } from './utils/validation';
import { createBotConfig } from './utils/config';

// Load environment variables
dotenv.config();

class LineBotServer {
  private app: express.Application;
  private config: BotConfig;
  private logger: Logger;
  private webhookService: WebhookService;
  private botService: LineBotService;
  private notificationService: NotificationService;
  private blockchainMonitor: BlockchainMonitor;
  private databaseManager: DatabaseManager;

  constructor() {
    this.app = express();
    this.config = createBotConfig();
    this.logger = new Logger('LineBotServer');
    
    // Initialize Sentry for error tracking
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 1.0,
      });
    }

    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private initializeServices(): void {
    try {
      // Initialize database
      this.databaseManager = new DatabaseManager(this.config.database);
      
      // Initialize core services
      this.botService = new LineBotService(this.config.line);
      this.notificationService = new NotificationService(
        this.botService,
        this.databaseManager,
        this.config.notifications
      );
      this.webhookService = new WebhookService(
        this.botService,
        this.notificationService,
        this.databaseManager
      );
      
      // Initialize blockchain monitor
      this.blockchainMonitor = new BlockchainMonitor(
        this.config.blockchain,
        this.databaseManager,
        this.notificationService
      );

      this.logger.info('Services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.line.me"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: [
        this.config.server.baseUrl,
        'https://api.line.me',
        'https://liff.line.me',
        process.env.WEB_APP_BASE_URL || 'http://localhost:3000'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Line-Signature'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.security.rateLimitWindow,
      max: this.config.security.rateLimitMax,
      message: {
        error: 'Too many requests, please try again later',
        retryAfter: Math.ceil(this.config.security.rateLimitWindow / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });
      next();
    });

    // JSON parsing with size limit
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      });
    });

    // LINE webhook endpoint with signature validation
    this.app.post(
      this.config.server.webhookPath,
      middleware({
        channelSecret: this.config.line.channelSecret,
        channelAccessToken: this.config.line.channelAccessToken,
      }),
      async (req, res) => {
        try {
          await this.webhookService.handleWebhook(req.body);
          res.status(200).send('OK');
        } catch (error) {
          this.logger.error('Webhook handling error:', error);
          Sentry.captureException(error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    );

    // API endpoints for integration with web app
    this.app.get('/api/circles/:lineGroupId', async (req, res) => {
      try {
        const circles = await this.databaseManager.getCirclesForGroup(req.params.lineGroupId);
        res.json({ success: true, data: circles });
      } catch (error) {
        this.logger.error('Error fetching circles:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch circles' });
      }
    });

    this.app.post('/api/notifications/send', async (req, res) => {
      try {
        const { lineUserId, type, data } = req.body;
        await this.notificationService.sendNotification(lineUserId, type, data);
        res.json({ success: true });
      } catch (error) {
        this.logger.error('Error sending notification:', error);
        res.status(500).json({ success: false, error: 'Failed to send notification' });
      }
    });

    // User management endpoints
    this.app.get('/api/users/:lineUserId', async (req, res) => {
      try {
        const user = await this.databaseManager.getUser(req.params.lineUserId);
        res.json({ success: true, data: user });
      } catch (error) {
        this.logger.error('Error fetching user:', error);
        res.status(500).json({ success: false, error: 'User not found' });
      }
    });

    this.app.put('/api/users/:lineUserId/preferences', async (req, res) => {
      try {
        await this.databaseManager.updateUserPreferences(req.params.lineUserId, req.body);
        res.json({ success: true });
      } catch (error) {
        this.logger.error('Error updating preferences:', error);
        res.status(500).json({ success: false, error: 'Failed to update preferences' });
      }
    });

    // Statistics and monitoring endpoints
    this.app.get('/api/stats/circles', async (req, res) => {
      try {
        const stats = await this.databaseManager.getCircleStats();
        res.json({ success: true, data: stats });
      } catch (error) {
        this.logger.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
      }
    });

    this.app.get('/api/stats/notifications', async (req, res) => {
      try {
        const stats = await this.notificationService.getNotificationStats();
        res.json({ success: true, data: stats });
      } catch (error) {
        this.logger.error('Error fetching notification stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch notification statistics' });
      }
    });

    // Manual blockchain sync endpoint (for debugging)
    this.app.post('/api/blockchain/sync', async (req, res) => {
      try {
        await this.blockchainMonitor.syncEvents();
        res.json({ success: true, message: 'Blockchain sync completed' });
      } catch (error) {
        this.logger.error('Manual sync error:', error);
        res.status(500).json({ success: false, error: 'Sync failed' });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
      });
    });
  }

  private setupErrorHandling(): void {
    // Sentry error handler (must be first)
    this.app.use(Sentry.Handlers.errorHandler());

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled error:', error);

      // Don't log 404 errors
      if (res.statusCode !== 404) {
        Sentry.captureException(error);
      }

      const status = res.statusCode !== 200 ? res.statusCode : 500;
      const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message;

      res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      Sentry.captureException(error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      Sentry.captureException(new Error(`Unhandled Rejection: ${reason}`));
    });
  }

  public async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig(this.config);

      // Initialize database
      await this.databaseManager.initialize();
      await this.databaseManager.runMigrations();

      // Start blockchain monitoring
      await this.blockchainMonitor.start();

      // Start notification scheduler
      await this.notificationService.start();

      // Start HTTP server
      const server = this.app.listen(this.config.server.port, () => {
        this.logger.info(`LINE Bot server started on port ${this.config.server.port}`);
        this.logger.info(`Webhook endpoint: ${this.config.server.baseUrl}${this.config.server.webhookPath}`);
        this.logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        this.logger.info('🤖 ROSCA Kye LINE Bot is ready!');
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        this.logger.info('Received SIGTERM, shutting down gracefully...');
        
        server.close(async () => {
          await this.blockchainMonitor.stop();
          await this.notificationService.stop();
          await this.databaseManager.close();
          this.logger.info('Server shutdown complete');
          process.exit(0);
        });
      });

      process.on('SIGINT', async () => {
        this.logger.info('Received SIGINT, shutting down gracefully...');
        
        server.close(async () => {
          await this.blockchainMonitor.stop();
          await this.notificationService.stop();
          await this.databaseManager.close();
          this.logger.info('Server shutdown complete');
          process.exit(0);
        });
      });

    } catch (error) {
      this.logger.error('Failed to start server:', error);
      Sentry.captureException(error);
      process.exit(1);
    }
  }
}

// Start the server
if (require.main === module) {
  const server = new LineBotServer();
  server.start().catch((error) => {
    console.error('Failed to start LINE Bot server:', error);
    process.exit(1);
  });
}

export default LineBotServer;