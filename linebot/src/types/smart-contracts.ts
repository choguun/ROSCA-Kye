// Smart Contract Integration Types (Compatible with existing ROSCA-Kye contracts)

// Re-export existing contract types from main project
export interface KyeFactoryContract {
  address: string;
  abi: any[];
}

export interface KyeGroupContract {
  address: string;
  abi: any[];
}

export interface MockUSDTContract {
  address: string;
  abi: any[];
}

// Contract Event Types
export interface KyeGroupEventData {
  // MemberJoined event
  MemberJoined: {
    member: string;
    lineUserIdHash: string;
  };
  
  // RoundStarted event  
  RoundStarted: {
    roundIndex: number;
    beneficiary: string;
    deadline: number;
  };
  
  // DepositMade event
  DepositMade: {
    member: string;
    roundIndex: number;
    amount: string;
    penalty: string;
  };
  
  // PayoutExecuted event
  PayoutExecuted: {
    beneficiary: string;
    roundIndex: number;
    amount: string;
  };
  
  // PenaltyCharged event
  PenaltyCharged: {
    member: string;
    penalty: string;
  };
  
  // GracePeriodGranted event
  GracePeriodGranted: {
    member: string;
    roundIndex: number;
  };
  
  // YieldDistributed event
  YieldDistributed: {
    amount: string;
  };
  
  // EmergencyCancel event
  EmergencyCancel: {
    reason: string;
  };
  
  // PhaseChanged event
  PhaseChanged: {
    oldPhase: Phase;
    newPhase: Phase;
  };
}

export interface KyeFactoryEventData {
  // CircleCreated event
  CircleCreated: {
    creator: string;
    circleAddress: string;
    lineGroupIdHash: string;
    depositAmount: string;
  };
  
  // DefaultTokensUpdated event
  DefaultTokensUpdated: {
    usdtToken: string;
    yieldAdapter: string;
  };
}

// Contract State Types
export enum Phase {
  Setup = 0,
  Commitment = 1,
  Active = 2,
  Settlement = 3,
  Resolved = 4,
  Disputed = 5
}

export interface MemberState {
  wallet: string;
  lineUserIdHash: string;
  totalDeposited: string;
  totalReceived: string;
  penaltiesAccrued: string;
  gracePeriodsUsed: number;
  defaultCount: number;
  hasDefaulted: boolean;
  isActive: boolean;
}

export interface RoundState {
  deadline: number;
  beneficiary: string;
  totalDeposited: string;
  yieldAccrued: string;
  isComplete: boolean;
  requiredDeposits: number;
}

export interface DepositRecord {
  amount: string;
  timestamp: number;
  penaltyPaid: string;
  isOnTime: boolean;
}

export interface CircleParams {
  usdtToken: string;
  yieldAdapter: string;
  lineGroupIdHash: string;
  depositAmount: string;
  penaltyBps: string;
  roundDuration: string;
  maxMembers: number;
}

export interface CircleMetadataOnChain {
  circleAddress: string;
  creator: string;
  lineGroupIdHash: string;
  createdAt: number;
  depositAmount: string;
  memberCount: number;
  currentRound: number;
  status: Phase;
  totalValueLocked: string;
}

// Contract Interaction Types
export interface ContractCall {
  contractAddress: string;
  functionName: string;
  args: any[];
  value?: string;
  gasLimit?: string;
}

export interface ContractCallResult {
  success: boolean;
  transactionHash?: string;
  result?: any;
  error?: string;
  gasUsed?: string;
}

export interface EventFilter {
  contractAddress: string;
  eventName: string;
  fromBlock: number;
  toBlock: number | 'latest';
  topics?: (string | null)[];
}

export interface EventLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
}

// Contract Deployment Types
export interface DeploymentConfig {
  usdtToken?: string;
  yieldAdapter?: string;
  lineGroupIdHash: string;
  depositAmount: string;
  penaltyBps: number;
  roundDurationDays: number;
  maxMembers: number;
}

export interface DeploymentResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  error?: string;
  gasUsed?: string;
}

// Network Configuration
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl?: string;
  contracts: {
    usdtAddress: string;
    savingsPocketAddress: string;
    kyeFactoryAddress: string;
  };
}

// Transaction Types
export interface Transaction {
  from: string;
  to: string;
  value: string;
  data: string;
  gas: string;
  gasPrice?: string;
  nonce?: number;
}

export interface TransactionReceipt {
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: number;
  from: string;
  to: string;
  gasUsed: string;
  status: number;
  logs: EventLog[];
  contractAddress?: string;
}

// Error Types
export interface ContractError {
  code: string;
  message: string;
  data?: any;
}

export interface RevertReason {
  signature: string;
  name: string;
  args: any[];
}

// Constants matching the smart contracts
export const CONTRACT_CONSTANTS = {
  MAX_MEMBERS: 5,
  MIN_MEMBERS: 2,
  MAX_GRACE_PERIODS: 1,
  GRACE_DURATION: 24 * 60 * 60, // 24 hours in seconds
  BASIS_POINTS: 10000,
  MAX_PENALTY_BPS: 5000, // 50%
  MIN_ROUND_DURATION: 60 * 60, // 1 hour in seconds
} as const;

// Event monitoring configuration
export interface EventMonitorConfig {
  contracts: string[];
  events: string[];
  fromBlock: number;
  pollingInterval: number;
  maxBlockRange: number;
  retryAttempts: number;
  retryDelay: number;
}

// Integration with existing web app types
export interface WebAppIntegration {
  baseUrl: string;
  liffUrl: string;
  endpoints: {
    createCircle: string;
    joinCircle: string;
    deposit: string;
    status: string;
  };
}