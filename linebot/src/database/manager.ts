import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Logger } from '@/utils/logger';
import { 
  LineUser, 
  BotCircle, 
  NotificationEvent,
  NotificationStatus,
  BlockchainEvent,
  DatabaseConfig,
  CircleStatus,
  Optional 
} from '@/types';

export class DatabaseManager {
  private db!: Database.Database; // Definite assignment assertion - initialized in initialize()
  private logger: Logger;

  constructor(private config: DatabaseConfig) {
    this.logger = new Logger('DatabaseManager');
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Create database connection
      this.db = new Database(this.config.path);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache

      this.logger.info(`Database initialized at: ${this.config.path}`);

    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    try {
      this.logger.info('Running database migrations...');

      // Create tables
      await this.createTables();

      this.logger.info('Database migrations completed');

    } catch (error) {
      this.logger.error('Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.logger.info('Database connection closed');
    }
  }

  // User Management

  async createOrUpdateUser(user: LineUser): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO line_users (
        line_user_id, display_name, picture_url, wallet_address, language,
        deposit_reminders, payout_alerts, circle_updates, risk_warnings, celebrations,
        reminder_times, created_at, last_activity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.lineUserId,
      user.displayName,
      user.pictureUrl,
      user.walletAddress,
      user.language,
      user.notificationPreferences.depositReminders ? 1 : 0,
      user.notificationPreferences.payoutAlerts ? 1 : 0,
      user.notificationPreferences.circleUpdates ? 1 : 0,
      user.notificationPreferences.riskWarnings ? 1 : 0,
      user.notificationPreferences.celebrations ? 1 : 0,
      JSON.stringify(user.notificationPreferences.reminderTimes),
      user.createdAt.toISOString(),
      user.lastActivity.toISOString()
    );
  }

  async getUser(lineUserId: string): Promise<LineUser | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM line_users WHERE line_user_id = ?
    `);

    const row = stmt.get(lineUserId) as any;
    if (!row) return null;

    return {
      lineUserId: row.line_user_id,
      displayName: row.display_name,
      pictureUrl: row.picture_url,
      walletAddress: row.wallet_address,
      language: row.language,
      notificationPreferences: {
        depositReminders: Boolean(row.deposit_reminders),
        payoutAlerts: Boolean(row.payout_alerts),
        circleUpdates: Boolean(row.circle_updates),
        riskWarnings: Boolean(row.risk_warnings),
        celebrations: Boolean(row.celebrations),
        reminderTimes: JSON.parse(row.reminder_times || '[48,24,6,1]')
      },
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity)
    };
  }

  async getUserByWallet(walletAddress: string): Promise<LineUser | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM line_users WHERE wallet_address = ?
    `);

    const row = stmt.get(walletAddress) as any;
    if (!row) return null;

    return this.getUser(row.line_user_id);
  }

  async updateUserActivity(lineUserId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE line_users SET last_activity = ? WHERE line_user_id = ?
    `);

    stmt.run(new Date().toISOString(), lineUserId);
  }

  async updateUserPreferences(lineUserId: string, preferences: any): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE line_users SET 
        deposit_reminders = ?,
        payout_alerts = ?,
        circle_updates = ?,
        risk_warnings = ?,
        celebrations = ?,
        reminder_times = ?
      WHERE line_user_id = ?
    `);

    stmt.run(
      preferences.depositReminders ? 1 : 0,
      preferences.payoutAlerts ? 1 : 0,
      preferences.circleUpdates ? 1 : 0,
      preferences.riskWarnings ? 1 : 0,
      preferences.celebrations ? 1 : 0,
      JSON.stringify(preferences.reminderTimes),
      lineUserId
    );
  }

  async deactivateUser(lineUserId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE line_users SET wallet_address = NULL, last_activity = ? WHERE line_user_id = ?
    `);

    stmt.run(new Date().toISOString(), lineUserId);
  }

  // Circle Management

  async createCircle(circle: BotCircle): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO bot_circles (
        circle_address, line_group_id, creator_line_id, status, member_count, max_members,
        deposit_amount, current_round, next_deadline, created_at, name, description,
        round_duration_days, penalty_bps, total_value_locked, yield_earned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      circle.circleAddress,
      circle.lineGroupId,
      circle.creatorLineId,
      circle.status,
      circle.memberCount,
      circle.maxMembers,
      circle.depositAmount,
      circle.currentRound,
      circle.nextDeadline?.toISOString(),
      circle.createdAt.toISOString(),
      circle.metadata.name,
      circle.metadata.description,
      circle.metadata.roundDurationDays,
      circle.metadata.penaltyBps,
      circle.metadata.totalValueLocked,
      circle.metadata.yieldEarned
    );
  }

  async getCircle(circleAddress: string): Promise<BotCircle | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM bot_circles WHERE circle_address = ?
    `);

    const row = stmt.get(circleAddress) as any;
    if (!row) return null;

    return {
      circleAddress: row.circle_address,
      lineGroupId: row.line_group_id,
      creatorLineId: row.creator_line_id,
      status: row.status as CircleStatus,
      memberCount: row.member_count,
      maxMembers: row.max_members,
      depositAmount: row.deposit_amount,
      currentRound: row.current_round,
      nextDeadline: row.next_deadline ? new Date(row.next_deadline) : undefined,
      createdAt: new Date(row.created_at),
      metadata: {
        name: row.name,
        description: row.description,
        roundDurationDays: row.round_duration_days,
        penaltyBps: row.penalty_bps,
        totalValueLocked: row.total_value_locked,
        yieldEarned: row.yield_earned
      }
    };
  }

  async getCirclesForGroup(lineGroupId: string): Promise<BotCircle[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM bot_circles WHERE line_group_id = ? ORDER BY created_at DESC
    `);

    const rows = stmt.all(lineGroupId) as any[];
    return rows.map(row => ({
      circleAddress: row.circle_address,
      lineGroupId: row.line_group_id,
      creatorLineId: row.creator_line_id,
      status: row.status as CircleStatus,
      memberCount: row.member_count,
      maxMembers: row.max_members,
      depositAmount: row.deposit_amount,
      currentRound: row.current_round,
      nextDeadline: row.next_deadline ? new Date(row.next_deadline) : undefined,
      createdAt: new Date(row.created_at),
      metadata: {
        name: row.name,
        description: row.description,
        roundDurationDays: row.round_duration_days,
        penaltyBps: row.penalty_bps,
        totalValueLocked: row.total_value_locked,
        yieldEarned: row.yield_earned
      }
    }));
  }

  async getActiveCircles(): Promise<BotCircle[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM bot_circles WHERE status = 'active' ORDER BY created_at DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => ({
      circleAddress: row.circle_address,
      lineGroupId: row.line_group_id,
      creatorLineId: row.creator_line_id,
      status: row.status as CircleStatus,
      memberCount: row.member_count,
      maxMembers: row.max_members,
      depositAmount: row.deposit_amount,
      currentRound: row.current_round,
      nextDeadline: row.next_deadline ? new Date(row.next_deadline) : undefined,
      createdAt: new Date(row.created_at),
      metadata: {
        name: row.name,
        description: row.description,
        roundDurationDays: row.round_duration_days,
        penaltyBps: row.penalty_bps,
        totalValueLocked: row.total_value_locked,
        yieldEarned: row.yield_earned
      }
    }));
  }

  async updateCircleRound(circleAddress: string, roundData: any): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE bot_circles SET 
        current_round = ?,
        next_deadline = ?
      WHERE circle_address = ?
    `);

    stmt.run(
      roundData.roundIndex,
      roundData.deadline.toISOString(),
      circleAddress
    );
  }

  async updateCirclePhase(circleAddress: string, phase: number): Promise<void> {
    const phaseMap = {
      0: 'setup',
      1: 'setup', // commitment
      2: 'active',
      3: 'completed', // settlement
      4: 'completed', // resolved
      5: 'disputed'
    };

    const stmt = this.db.prepare(`
      UPDATE bot_circles SET status = ? WHERE circle_address = ?
    `);

    stmt.run(phaseMap[phase as keyof typeof phaseMap] || 'setup', circleAddress);
  }

  async deactivateGroupCircles(lineGroupId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE bot_circles SET status = 'cancelled' WHERE line_group_id = ? AND status != 'completed'
    `);

    stmt.run(lineGroupId);
  }

  // Circle Member Management

  async addCircleMember(circleAddress: string, member: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO circle_members (
        circle_address, wallet_address, line_user_id_hash, joined_at
      ) VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      circleAddress,
      member.walletAddress,
      member.lineUserIdHash,
      member.joinedAt.toISOString()
    );

    // Update member count
    const countStmt = this.db.prepare(`
      UPDATE bot_circles SET member_count = (
        SELECT COUNT(*) FROM circle_members WHERE circle_address = ?
      ) WHERE circle_address = ?
    `);

    countStmt.run(circleAddress, circleAddress);
  }

  async getCircleMembers(circleAddress: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM circle_members WHERE circle_address = ?
    `);

    const rows = stmt.all(circleAddress) as any[];
    return rows.map(row => ({
      circleAddress: row.circle_address,
      walletAddress: row.wallet_address,
      lineUserIdHash: row.line_user_id_hash,
      joinedAt: new Date(row.joined_at)
    }));
  }

  // Notification Management

  async createNotificationEvent(event: Omit<NotificationEvent, 'id'>): Promise<string> {
    const stmt = this.db.prepare(`
      INSERT INTO notification_queue (
        type, line_user_id, message_content, scheduled_time, status, retry_count,
        circle_address, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `);

    const messageContent = JSON.stringify(event.messageContent);
    const metadata = JSON.stringify(event.metadata || {});
    const now = new Date().toISOString();

    const result = stmt.get(
      event.type,
      event.lineUserId,
      messageContent,
      event.scheduledTime.toISOString(),
      event.status,
      event.retryCount,
      event.circleAddress,
      metadata,
      now
    ) as any;

    return result.id.toString();
  }

  async getPendingNotifications(): Promise<NotificationEvent[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM notification_queue 
      WHERE status = 'pending' AND scheduled_time <= ?
      ORDER BY scheduled_time ASC
      LIMIT 100
    `);

    const rows = stmt.all(new Date().toISOString()) as any[];
    return rows.map(this.mapNotificationEvent);
  }

  async getPendingDepositReminders(): Promise<NotificationEvent[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM notification_queue 
      WHERE status = 'pending' AND type = 'deposit_reminder' AND scheduled_time <= ?
      ORDER BY scheduled_time ASC
    `);

    const rows = stmt.all(new Date().toISOString()) as any[];
    return rows.map(this.mapNotificationEvent);
  }

  async getFailedNotifications(): Promise<NotificationEvent[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM notification_queue 
      WHERE status = 'failed' AND retry_count < 3
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const rows = stmt.all() as any[];
    return rows.map(this.mapNotificationEvent);
  }

  async updateNotificationStatus(id: string, status: NotificationStatus): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE notification_queue SET status = ? WHERE id = ?
    `);

    stmt.run(status, id);
  }

  async incrementNotificationRetry(id: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE notification_queue SET retry_count = retry_count + 1 WHERE id = ?
    `);

    stmt.run(id);
  }

  async cleanupOldNotifications(cutoffDate: Date): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM notification_queue WHERE created_at < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }

  async getNotificationStats(): Promise<any> {
    const totalStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM notification_queue
    `);

    const typeStmt = this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM notification_queue
      WHERE status = 'sent'
      GROUP BY type
    `);

    const recent24hStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM notification_queue
      WHERE status = 'sent' AND created_at > ?
    `);

    const totalStats = totalStmt.get() as any;
    const byType = typeStmt.all() as any[];
    const recent24h = recent24hStmt.get(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as any;

    return {
      totalSent: totalStats.sent || 0,
      totalFailed: totalStats.failed || 0,
      successRate: totalStats.total > 0 ? (totalStats.sent / totalStats.total) * 100 : 0,
      byType: byType.reduce((acc: any, item: any) => {
        acc[item.type] = item.count;
        return acc;
      }, {}),
      recent24h: recent24h.count || 0
    };
  }

  // Blockchain Event Management

  async saveBlockchainEvent(event: BlockchainEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO blockchain_events (
        event_name, contract_address, block_number, transaction_hash, args, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.eventName,
      event.contractAddress,
      event.blockNumber,
      event.transactionHash,
      JSON.stringify(event.args),
      event.timestamp.toISOString()
    );
  }

  async getLastProcessedBlock(): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT MAX(block_number) as last_block FROM blockchain_events
    `);

    const result = stmt.get() as any;
    return result.last_block || 0;
  }

  async updateLastProcessedBlock(blockNumber: number): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO system_state (key, value) VALUES ('last_processed_block', ?)
    `);

    stmt.run(blockNumber.toString());
  }

  // Contract Monitoring

  async addMonitoredContract(contractAddress: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO monitored_contracts (contract_address, added_at)
      VALUES (?, ?)
    `);

    stmt.run(contractAddress, new Date().toISOString());
  }

  async removeMonitoredContract(contractAddress: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM monitored_contracts WHERE contract_address = ?
    `);

    stmt.run(contractAddress);
  }

  async getMonitoredContracts(): Promise<string[]> {
    const stmt = this.db.prepare(`
      SELECT contract_address FROM monitored_contracts
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => row.contract_address);
  }

  // Transaction Recording

  async recordDeposit(circleAddress: string, depositData: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO deposits (
        circle_address, member_address, round_index, amount, penalty,
        timestamp, transaction_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      circleAddress,
      depositData.member,
      depositData.roundIndex,
      depositData.amount,
      depositData.penalty,
      depositData.timestamp.toISOString(),
      depositData.transactionHash
    );
  }

  async recordPayout(circleAddress: string, payoutData: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO payouts (
        circle_address, beneficiary_address, round_index, amount,
        timestamp, transaction_hash
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      circleAddress,
      payoutData.beneficiary,
      payoutData.roundIndex,
      payoutData.amount,
      payoutData.timestamp.toISOString(),
      payoutData.transactionHash
    );
  }

  async recordPenalty(circleAddress: string, penaltyData: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO penalties (
        circle_address, member_address, penalty, timestamp, transaction_hash
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      circleAddress,
      penaltyData.member,
      penaltyData.penalty,
      penaltyData.timestamp.toISOString(),
      penaltyData.transactionHash
    );
  }

  // Statistics

  async getCircleStats(): Promise<any> {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_circles,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_circles,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_circles,
        SUM(CAST(total_value_locked AS INTEGER)) as total_tvl
      FROM bot_circles
    `);

    return stmt.get();
  }

  // Private helper methods

  private mapNotificationEvent(row: any): NotificationEvent {
    return {
      id: row.id.toString(),
      type: row.type,
      lineUserId: row.line_user_id,
      circleAddress: row.circle_address,
      messageContent: JSON.parse(row.message_content),
      scheduledTime: new Date(row.scheduled_time),
      status: row.status,
      retryCount: row.retry_count,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  private async createTables(): Promise<void> {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS line_users (
        line_user_id TEXT PRIMARY KEY,
        display_name TEXT,
        picture_url TEXT,
        wallet_address TEXT UNIQUE,
        language TEXT DEFAULT 'ko',
        deposit_reminders INTEGER DEFAULT 1,
        payout_alerts INTEGER DEFAULT 1,
        circle_updates INTEGER DEFAULT 1,
        risk_warnings INTEGER DEFAULT 1,
        celebrations INTEGER DEFAULT 1,
        reminder_times TEXT DEFAULT '[48,24,6,1]',
        created_at TEXT NOT NULL,
        last_activity TEXT NOT NULL
      )
    `);

    // Circles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bot_circles (
        circle_address TEXT PRIMARY KEY,
        line_group_id TEXT,
        creator_line_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('setup', 'active', 'completed', 'cancelled', 'disputed')),
        member_count INTEGER DEFAULT 0,
        max_members INTEGER DEFAULT 5,
        deposit_amount TEXT NOT NULL,
        current_round INTEGER DEFAULT 0,
        next_deadline TEXT,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        round_duration_days INTEGER DEFAULT 30,
        penalty_bps INTEGER DEFAULT 500,
        total_value_locked TEXT DEFAULT '0',
        yield_earned TEXT DEFAULT '0'
      )
    `);

    // Circle members table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS circle_members (
        circle_address TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        line_user_id_hash TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (circle_address, wallet_address),
        FOREIGN KEY (circle_address) REFERENCES bot_circles (circle_address)
      )
    `);

    // Notification queue table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        line_user_id TEXT NOT NULL,
        circle_address TEXT,
        message_content TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
        retry_count INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
      )
    `);

    // Blockchain events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blockchain_events (
        event_name TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        transaction_hash TEXT NOT NULL,
        args TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        PRIMARY KEY (transaction_hash, event_name, contract_address)
      )
    `);

    // System state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Monitored contracts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monitored_contracts (
        contract_address TEXT PRIMARY KEY,
        added_at TEXT NOT NULL
      )
    `);

    // Deposits table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        circle_address TEXT NOT NULL,
        member_address TEXT NOT NULL,
        round_index INTEGER NOT NULL,
        amount TEXT NOT NULL,
        penalty TEXT DEFAULT '0',
        timestamp TEXT NOT NULL,
        transaction_hash TEXT NOT NULL
      )
    `);

    // Payouts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        circle_address TEXT NOT NULL,
        beneficiary_address TEXT NOT NULL,
        round_index INTEGER NOT NULL,
        amount TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        transaction_hash TEXT NOT NULL
      )
    `);

    // Penalties table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS penalties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        circle_address TEXT NOT NULL,
        member_address TEXT NOT NULL,
        penalty TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        transaction_hash TEXT NOT NULL
      )
    `);

    // Create indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_queue(status)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notification_queue(scheduled_time)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notification_queue(line_user_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_circles_status ON bot_circles(status)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_circles_group ON bot_circles(line_group_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_events_block ON blockchain_events(block_number)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_events_contract ON blockchain_events(contract_address)`);
  }

  // Missing methods for financial intelligence
  async getUserNotificationHistory(lineUserId: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT 
        *,
        CASE WHEN status = 'sent' THEN 1 ELSE 0 END as wasActedUpon,
        CASE 
          WHEN status = 'sent' THEN DATETIME(scheduled_time, '+1 hour') 
          ELSE NULL 
        END as actionTakenAt,
        DATETIME(scheduled_time) as sentAt
      FROM notification_queue 
      WHERE line_user_id = ? 
      ORDER BY scheduled_time DESC 
      LIMIT 50
    `);

    const rows = stmt.all(lineUserId) as any[];
    return rows.map(row => ({
      ...row,
      wasActedUpon: row.wasActedUpon === 1,
      sentAt: row.sentAt ? new Date(row.sentAt).getTime() : null,
      actionTakenAt: row.actionTakenAt ? new Date(row.actionTakenAt).getTime() : null
    }));
  }

  async getUserCircles(lineUserId: string): Promise<BotCircle[]> {
    // Get user's wallet address first
    const user = await this.getUser(lineUserId);
    if (!user?.walletAddress) return [];

    // Get circles where user is a member
    const stmt = this.db.prepare(`
      SELECT bc.*
      FROM bot_circles bc
      JOIN circle_members cm ON bc.circle_address = cm.circle_address
      WHERE cm.wallet_address = ?
      ORDER BY bc.created_at DESC
    `);

    const rows = stmt.all(user.walletAddress) as any[];
    return rows.map(row => ({
      circleAddress: row.circle_address,
      lineGroupId: row.line_group_id,
      creatorLineId: row.creator_line_id,
      status: row.status as CircleStatus,
      memberCount: row.member_count,
      maxMembers: row.max_members,
      depositAmount: row.deposit_amount,
      currentRound: row.current_round,
      nextDeadline: row.next_deadline ? new Date(row.next_deadline) : undefined,
      createdAt: new Date(row.created_at),
      metadata: {
        name: row.name,
        description: row.description,
        roundDurationDays: row.round_duration_days,
        penaltyBps: row.penalty_bps,
        totalValueLocked: row.total_value_locked,
        yieldEarned: row.yield_earned
      }
    }));
  }
}