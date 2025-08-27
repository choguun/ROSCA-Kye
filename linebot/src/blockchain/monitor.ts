import { ethers } from 'ethers';
import { DatabaseManager } from '@/database/manager';
import { NotificationService } from '@/services/notification.service';
import { Logger } from '@/utils/logger';
import { 
  BlockchainEvent, 
  ContractEventHandler, 
  NetworkConfig,
  KyeGroupEventData,
  KyeFactoryEventData,
  Phase 
} from '@/types';
import * as Sentry from '@sentry/node';

// Import existing contract ABIs from the main project
const KYE_FACTORY_ABI = [
  "event CircleCreated(address indexed creator, address indexed circleAddress, bytes32 indexed lineGroupIdHash, uint256 depositAmount)",
  "event DefaultTokensUpdated(address usdtToken, address yieldAdapter)"
];

const KYE_GROUP_ABI = [
  "event MemberJoined(address indexed member, bytes32 lineUserIdHash)",
  "event RoundStarted(uint256 indexed roundIndex, address indexed beneficiary, uint256 deadline)", 
  "event DepositMade(address indexed member, uint256 indexed roundIndex, uint256 amount, uint256 penalty)",
  "event PayoutExecuted(address indexed beneficiary, uint256 indexed roundIndex, uint256 amount)",
  "event PenaltyCharged(address indexed member, uint256 penalty)",
  "event GracePeriodGranted(address indexed member, uint256 indexed roundIndex)",
  "event YieldDistributed(uint256 amount)",
  "event EmergencyCancel(string reason)",
  "event PhaseChanged(uint8 oldPhase, uint8 newPhase)"
];

export class BlockchainMonitor {
  private provider: ethers.Provider;
  private logger: Logger;
  private isRunning: boolean = false;
  private eventHandlers: Map<string, ContractEventHandler[]> = new Map();
  private monitoredContracts: Set<string> = new Set();
  private lastProcessedBlock: number = 0;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: {
      rpcUrl: string;
      chainId: number;
      privateKey?: string;
      contracts: {
        usdtAddress: string;
        savingsPocketAddress: string;
        kyeFactoryAddress: string;
      };
    },
    private databaseManager: DatabaseManager,
    private notificationService: NotificationService
  ) {
    this.logger = new Logger('BlockchainMonitor');
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.setupEventHandlers();
  }

  /**
   * Start blockchain monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Blockchain monitor is already running');
      return;
    }

    try {
      this.logger.info('Starting blockchain monitor...');

      // Verify connection
      await this.verifyConnection();

      // Get last processed block from database
      this.lastProcessedBlock = await this.databaseManager.getLastProcessedBlock() || 0;
      if (this.lastProcessedBlock === 0) {
        // Start from current block for new deployments
        this.lastProcessedBlock = await this.provider.getBlockNumber();
        await this.databaseManager.updateLastProcessedBlock(this.lastProcessedBlock);
      }

      // Setup contract monitoring
      await this.setupContractMonitoring();

      // Start event polling
      this.startEventPolling();

      this.isRunning = true;
      this.logger.info(`Blockchain monitor started at block ${this.lastProcessedBlock}`);

      Sentry.addBreadcrumb({
        message: 'Blockchain monitor started',
        category: 'blockchain',
        level: 'info',
        data: { startBlock: this.lastProcessedBlock }
      });

    } catch (error) {
      this.logger.error('Failed to start blockchain monitor:', error);
      throw error;
    }
  }

  /**
   * Stop blockchain monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('Stopping blockchain monitor...');

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.isRunning = false;
    this.logger.info('Blockchain monitor stopped');
  }

  /**
   * Add a contract to monitor
   */
  async addContract(contractAddress: string): Promise<void> {
    if (this.monitoredContracts.has(contractAddress)) {
      this.logger.debug(`Contract already monitored: ${contractAddress}`);
      return;
    }

    this.monitoredContracts.add(contractAddress);
    this.logger.info(`Added contract to monitoring: ${contractAddress}`);

    // Save to database
    await this.databaseManager.addMonitoredContract(contractAddress);
  }

  /**
   * Remove a contract from monitoring
   */
  async removeContract(contractAddress: string): Promise<void> {
    this.monitoredContracts.delete(contractAddress);
    this.logger.info(`Removed contract from monitoring: ${contractAddress}`);

    // Remove from database
    await this.databaseManager.removeMonitoredContract(contractAddress);
  }

  /**
   * Manually sync events (useful for debugging)
   */
  async syncEvents(fromBlock?: number, toBlock?: number): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const startBlock = fromBlock || this.lastProcessedBlock;
      const endBlock = toBlock || currentBlock;

      this.logger.info(`Manually syncing events from block ${startBlock} to ${endBlock}`);

      await this.processBlockRange(startBlock, endBlock);

    } catch (error) {
      this.logger.error('Manual sync failed:', error);
      throw error;
    }
  }

  // Private methods

  private async verifyConnection(): Promise<void> {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      this.logger.info(`Connected to network: ${network.name} (${network.chainId})`);
      this.logger.info(`Current block: ${blockNumber}`);

      if (Number(network.chainId) !== this.config.chainId) {
        throw new Error(`Network mismatch: expected ${this.config.chainId}, got ${network.chainId}`);
      }

    } catch (error) {
      this.logger.error('Failed to verify blockchain connection:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // KyeFactory event handlers
    this.addEventHandler('CircleCreated', {
      eventName: 'CircleCreated',
      handler: async (event: BlockchainEvent) => {
        await this.handleCircleCreated(event);
      }
    });

    // KyeGroup event handlers
    this.addEventHandler('MemberJoined', {
      eventName: 'MemberJoined',
      handler: async (event: BlockchainEvent) => {
        await this.handleMemberJoined(event);
      }
    });

    this.addEventHandler('RoundStarted', {
      eventName: 'RoundStarted',
      handler: async (event: BlockchainEvent) => {
        await this.handleRoundStarted(event);
      }
    });

    this.addEventHandler('DepositMade', {
      eventName: 'DepositMade',
      handler: async (event: BlockchainEvent) => {
        await this.handleDepositMade(event);
      }
    });

    this.addEventHandler('PayoutExecuted', {
      eventName: 'PayoutExecuted',
      handler: async (event: BlockchainEvent) => {
        await this.handlePayoutExecuted(event);
      }
    });

    this.addEventHandler('PenaltyCharged', {
      eventName: 'PenaltyCharged',
      handler: async (event: BlockchainEvent) => {
        await this.handlePenaltyCharged(event);
      }
    });

    this.addEventHandler('PhaseChanged', {
      eventName: 'PhaseChanged',
      handler: async (event: BlockchainEvent) => {
        await this.handlePhaseChanged(event);
      }
    });
  }

  private addEventHandler(eventName: string, handler: ContractEventHandler): void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(handler);
  }

  private async setupContractMonitoring(): Promise<void> {
    // Always monitor the factory contract
    this.monitoredContracts.add(this.config.contracts.kyeFactoryAddress);

    // Load existing monitored contracts from database
    const existingContracts = await this.databaseManager.getMonitoredContracts();
    for (const contractAddress of existingContracts) {
      this.monitoredContracts.add(contractAddress);
    }

    // Load active circles from database and monitor them
    const activeCircles = await this.databaseManager.getActiveCircles();
    for (const circle of activeCircles) {
      this.monitoredContracts.add(circle.circleAddress);
    }

    this.logger.info(`Monitoring ${this.monitoredContracts.size} contracts`);
  }

  private startEventPolling(): void {
    const POLLING_INTERVAL = 30000; // 30 seconds
    const MAX_BLOCK_RANGE = 1000; // Process max 1000 blocks at a time

    this.pollingInterval = setInterval(async () => {
      try {
        const currentBlock = await this.provider.getBlockNumber();
        
        if (currentBlock > this.lastProcessedBlock) {
          const endBlock = Math.min(currentBlock, this.lastProcessedBlock + MAX_BLOCK_RANGE);
          
          await this.processBlockRange(this.lastProcessedBlock + 1, endBlock);
          
          this.lastProcessedBlock = endBlock;
          await this.databaseManager.updateLastProcessedBlock(this.lastProcessedBlock);
        }

      } catch (error) {
        this.logger.error('Event polling error:', error);
        Sentry.captureException(error, {
          tags: { component: 'BlockchainMonitor', action: 'eventPolling' }
        });
      }
    }, POLLING_INTERVAL);
  }

  private async processBlockRange(fromBlock: number, toBlock: number): Promise<void> {
    if (fromBlock > toBlock) return;

    this.logger.debug(`Processing blocks ${fromBlock} to ${toBlock}`);

    try {
      // Process each monitored contract
      for (const contractAddress of this.monitoredContracts) {
        await this.processContractEvents(contractAddress, fromBlock, toBlock);
      }

    } catch (error) {
      this.logger.error(`Failed to process block range ${fromBlock}-${toBlock}:`, error);
      throw error;
    }
  }

  private async processContractEvents(
    contractAddress: string, 
    fromBlock: number, 
    toBlock: number
  ): Promise<void> {
    try {
      // Determine ABI based on contract type
      const abi = contractAddress === this.config.contracts.kyeFactoryAddress 
        ? KYE_FACTORY_ABI 
        : KYE_GROUP_ABI;

      const contract = new ethers.Contract(contractAddress, abi, this.provider);

      // Get all events for this contract in the block range
      const filter = {
        address: contractAddress,
        fromBlock,
        toBlock
      };

      const logs = await this.provider.getLogs(filter);

      // Process each log
      for (const log of logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (!parsedLog) continue;

          const blockchainEvent: BlockchainEvent = {
            eventName: parsedLog.name,
            contractAddress,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            args: this.convertArgsToObject(parsedLog.args),
            timestamp: new Date() // Will be updated with actual block timestamp
          };

          // Get block timestamp
          const block = await this.provider.getBlock(log.blockNumber);
          if (block) {
            blockchainEvent.timestamp = new Date(block.timestamp * 1000);
          }

          // Save event to database
          await this.databaseManager.saveBlockchainEvent(blockchainEvent);

          // Process event
          await this.processEvent(blockchainEvent);

        } catch (parseError) {
          this.logger.warn(`Failed to parse log from ${contractAddress}:`, parseError);
        }
      }

    } catch (error) {
      this.logger.error(`Failed to process events for contract ${contractAddress}:`, error);
      throw error;
    }
  }

  private convertArgsToObject(args: ethers.Result): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (let i = 0; i < args.length; i++) {
      const key = args.getKey(i);
      const value = args[i];
      
      // Convert BigNumber to string
      if (typeof value === 'bigint') {
        result[key] = value.toString();
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  private async processEvent(event: BlockchainEvent): Promise<void> {
    try {
      const handlers = this.eventHandlers.get(event.eventName);
      if (!handlers || handlers.length === 0) {
        this.logger.debug(`No handlers for event: ${event.eventName}`);
        return;
      }

      this.logger.blockchainEvent(event.eventName, event.contractAddress, event.args);

      // Execute all handlers for this event
      for (const handler of handlers) {
        try {
          await handler.handler(event);
        } catch (handlerError) {
          this.logger.error(`Handler failed for ${event.eventName}:`, handlerError);
          Sentry.captureException(handlerError, {
            tags: { 
              component: 'BlockchainMonitor', 
              action: 'eventHandler',
              eventName: event.eventName 
            },
            extra: { event }
          });
        }
      }

      // Notify the notification service
      await this.notificationService.handleBlockchainEvent(event.eventName, {
        contractAddress: event.contractAddress,
        ...event.args
      });

    } catch (error) {
      this.logger.error(`Failed to process event ${event.eventName}:`, error);
    }
  }

  // Event handlers

  private async handleCircleCreated(event: BlockchainEvent): Promise<void> {
    const { creator, circleAddress, lineGroupIdHash, depositAmount } = event.args;

    try {
      // Add new circle to monitoring
      await this.addContract(circleAddress);

      // Create circle record in database
      await this.databaseManager.createCircle({
        circleAddress,
        lineGroupId: undefined, // Will be resolved from hash
        creatorLineId: await this.resolveLineUserId(creator),
        status: 'setup',
        memberCount: 1, // Creator is first member
        maxMembers: 5, // Default, will be updated
        depositAmount,
        currentRound: 0,
        createdAt: event.timestamp,
        metadata: {
          name: `Circle ${circleAddress.slice(-6)}`,
          roundDurationDays: 30,
          penaltyBps: 500,
          totalValueLocked: '0',
          yieldEarned: '0'
        }
      });

      this.logger.info(`New circle created: ${circleAddress}`);

    } catch (error) {
      this.logger.error(`Failed to handle CircleCreated event:`, error);
    }
  }

  private async handleMemberJoined(event: BlockchainEvent): Promise<void> {
    const { member, lineUserIdHash } = event.args;

    try {
      // Update circle member count
      await this.databaseManager.addCircleMember(event.contractAddress, {
        walletAddress: member,
        lineUserIdHash,
        joinedAt: event.timestamp
      });

      this.logger.info(`Member joined circle ${event.contractAddress}: ${member}`);

    } catch (error) {
      this.logger.error('Failed to handle MemberJoined event:', error);
    }
  }

  private async handleRoundStarted(event: BlockchainEvent): Promise<void> {
    const { roundIndex, beneficiary, deadline } = event.args;

    try {
      // Update circle round information
      await this.databaseManager.updateCircleRound(event.contractAddress, {
        roundIndex: parseInt(roundIndex),
        beneficiary,
        deadline: new Date(parseInt(deadline) * 1000),
        startedAt: event.timestamp
      });

      // Schedule deposit reminders
      await this.notificationService.scheduleDepositReminders(
        event.contractAddress,
        new Date(parseInt(deadline) * 1000),
        beneficiary
      );

      this.logger.info(`Round ${roundIndex} started for circle ${event.contractAddress}`);

    } catch (error) {
      this.logger.error('Failed to handle RoundStarted event:', error);
    }
  }

  private async handleDepositMade(event: BlockchainEvent): Promise<void> {
    const { member, roundIndex, amount, penalty } = event.args;

    try {
      // Record deposit
      await this.databaseManager.recordDeposit(event.contractAddress, {
        member,
        roundIndex: parseInt(roundIndex),
        amount,
        penalty,
        timestamp: event.timestamp,
        transactionHash: event.transactionHash
      });

      this.logger.info(`Deposit made by ${member} in round ${roundIndex}`);

    } catch (error) {
      this.logger.error('Failed to handle DepositMade event:', error);
    }
  }

  private async handlePayoutExecuted(event: BlockchainEvent): Promise<void> {
    const { beneficiary, roundIndex, amount } = event.args;

    try {
      // Record payout
      await this.databaseManager.recordPayout(event.contractAddress, {
        beneficiary,
        roundIndex: parseInt(roundIndex),
        amount,
        timestamp: event.timestamp,
        transactionHash: event.transactionHash
      });

      this.logger.info(`Payout executed to ${beneficiary} for round ${roundIndex}`);

    } catch (error) {
      this.logger.error('Failed to handle PayoutExecuted event:', error);
    }
  }

  private async handlePenaltyCharged(event: BlockchainEvent): Promise<void> {
    const { member, penalty } = event.args;

    try {
      // Record penalty
      await this.databaseManager.recordPenalty(event.contractAddress, {
        member,
        penalty,
        timestamp: event.timestamp,
        transactionHash: event.transactionHash
      });

      this.logger.info(`Penalty charged to ${member}: ${penalty}`);

    } catch (error) {
      this.logger.error('Failed to handle PenaltyCharged event:', error);
    }
  }

  private async handlePhaseChanged(event: BlockchainEvent): Promise<void> {
    const { oldPhase, newPhase } = event.args;

    try {
      // Update circle phase
      await this.databaseManager.updateCirclePhase(event.contractAddress, parseInt(newPhase));

      this.logger.info(`Circle ${event.contractAddress} phase changed: ${oldPhase} -> ${newPhase}`);

    } catch (error) {
      this.logger.error('Failed to handle PhaseChanged event:', error);
    }
  }

  // Utility methods
  private async resolveLineUserId(walletAddress: string): Promise<string> {
    // Attempt to resolve wallet address to LINE user ID
    // This will depend on your user management system
    const user = await this.databaseManager.getUserByWallet(walletAddress);
    return user?.lineUserId || `unknown_${walletAddress.slice(-6)}`;
  }
}