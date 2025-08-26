import { Phase } from './abis';

// Contract interface types
export interface CircleParams {
  usdtToken: string;
  yieldAdapter: string;
  lineGroupIdHash: string;
  depositAmount: string;
  penaltyBps: string;
  roundDuration: string;
}

export interface CircleMetadata {
  circleAddress: string;
  creator: string;
  lineGroupIdHash: string;
  createdAt: string;
  depositAmount: string;
  memberCount: number;
  currentRound: number;
  status: Phase;
  totalValueLocked: string;
}

export interface MemberState {
  wallet: string;
  lineUserIdHash: string;
  totalDeposited: string;
  totalReceived: string;
  penaltiesAccrued: string;
  lastActiveRound: string;
  hasDefaulted: boolean;
  reputation: string;
}

export interface RoundState {
  deadline: string;
  beneficiary: string;
  totalDeposited: string;
  yieldAccrued: string;
  isComplete: boolean;
}

// Frontend data models
export interface Circle {
  address: string;
  metadata: CircleMetadata;
  members: string[];
  currentRound: RoundState;
  userMemberState?: MemberState;
  remainingTime?: number;
}

export interface DepositInfo {
  amount: string;
  penalty: string;
  deadline: number;
  canDeposit: boolean;
  reasonIfCannot?: string;
}

// LINE integration types
export interface LIFFContext {
  type: 'group' | 'room' | 'utou' | 'none';
  groupId?: string;
  roomId?: string;
  userId?: string;
  viewType?: string;
}

export interface LIFFProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface InvitationLink {
  url: string;
  code: string;
  circleAddress: string;
  expiresAt: number;
}

// Contract interaction results
export interface TransactionResult {
  hash: string;
  blockNumber?: number;
  success: boolean;
  error?: string;
}

export interface CreateCircleResult extends TransactionResult {
  circleAddress?: string;
}

export interface JoinCircleResult extends TransactionResult {
  memberIndex?: number;
}

// UI State types
export interface AppState {
  user: {
    address?: string;
    lineProfile?: LIFFProfile;
    circles: Circle[];
  };
  currentCircle?: Circle;
  liffContext?: LIFFContext;
  walletConnected: boolean;
  loading: boolean;
  error?: string;
}

export type AppMode = 'loading' | 'dashboard' | 'create' | 'join' | 'deposit' | 'manage';

// Event types
export interface CircleEvent {
  type: 'MemberJoined' | 'DepositMade' | 'PayoutDistributed' | 'PhaseChanged';
  circleAddress: string;
  data: any;
  blockNumber: number;
  timestamp: number;
}