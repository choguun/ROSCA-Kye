// LINE Flex Message Template Types

export interface DepositReminderData {
  hoursRemaining: number;
  depositAmount: string;
  penalty: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  circleAddress: string;
  roundIndex: number;
  beneficiaryName?: string;
}

export interface CircleStatusData {
  circleName: string;
  circleAddress: string;
  phase: 'setup' | 'active' | 'completed';
  memberCount: number;
  maxMembers: number;
  currentRound: number;
  totalRounds: number;
  nextDeadline?: number;
  totalValueLocked: string;
  userRole: 'creator' | 'member' | 'beneficiary';
  canDeposit: boolean;
}

export interface PayoutNotificationData {
  beneficiaryName: string;
  amount: string;
  roundIndex: number;
  totalRounds: number;
  yieldEarned?: string;
  nextBeneficiary?: string;
  nextDeadline?: number;
}

export interface RiskAlertData {
  riskLevel: 'medium' | 'high' | 'critical';
  issueType: 'missed_deposit' | 'consecutive_defaults' | 'financial_stress';
  recommendedActions: string[];
  supportResources: SupportResource[];
}

export interface SupportResource {
  title: string;
  description: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface CelebrationData {
  eventType: 'circle_complete' | 'perfect_record' | 'milestone';
  title: string;
  description: string;
  achievements?: Achievement[];
  stats?: CircleStats;
}

export interface Achievement {
  icon: string;
  title: string;
  description: string;
}

export interface CircleStats {
  totalSaved: string;
  yieldEarned: string;
  perfectAttendance: boolean;
  completionTime: string;
}

export interface WelcomeMessageData {
  userName: string;
  isNewUser: boolean;
  hasExistingCircles: boolean;
  suggestedActions: SuggestedAction[];
}

export interface SuggestedAction {
  title: string;
  description: string;
  actionType: 'create' | 'join' | 'learn' | 'balance';
  actionUrl?: string;
  actionData?: string;
}

export interface HelpMenuData {
  userLevel: 'beginner' | 'intermediate' | 'advanced';
  commonQuestions: HelpItem[];
  quickActions: QuickAction[];
}

export interface HelpItem {
  question: string;
  answer: string;
  category: 'circles' | 'deposits' | 'technical' | 'account';
}

export interface QuickAction {
  icon: string;
  label: string;
  action: string;
  data?: string;
}

export interface MultiCircleOverviewData {
  totalCircles: number;
  activeCircles: Circle[];
  completedCircles: number;
  totalSavings: string;
  pendingActions: PendingAction[];
}

export interface Circle {
  address: string;
  name: string;
  phase: string;
  memberCount: number;
  nextDeadline?: number;
  userRole: string;
  requiresAction: boolean;
  actionType?: 'deposit' | 'create' | 'join';
}

export interface PendingAction {
  type: 'deposit_due' | 'grace_period' | 'circle_starting';
  circleAddress: string;
  circleName: string;
  deadline?: number;
  urgency: 'low' | 'medium' | 'high';
}

// Color schemes for different urgency levels
export const URGENCY_COLORS = {
  low: {
    primary: '#00B900',
    secondary: '#E8F8E8',
    text: '#333333'
  },
  medium: {
    primary: '#FF9500',
    secondary: '#FFF4E8',
    text: '#333333'
  },
  high: {
    primary: '#FF6B35',
    secondary: '#FFE8E1',
    text: '#333333'
  },
  critical: {
    primary: '#FF3333',
    secondary: '#FFE1E1',
    text: '#FFFFFF'
  }
} as const;

// Status colors for circle phases
export const PHASE_COLORS = {
  setup: {
    primary: '#6C7B7F',
    secondary: '#F0F1F2',
    text: '#333333'
  },
  active: {
    primary: '#00B900',
    secondary: '#E8F8E8', 
    text: '#333333'
  },
  completed: {
    primary: '#4A90E2',
    secondary: '#E8F2FF',
    text: '#333333'
  },
  disputed: {
    primary: '#FF3333',
    secondary: '#FFE1E1',
    text: '#333333'
  }
} as const;

// Icon mappings for different message types
export const MESSAGE_ICONS = {
  deposit_reminder: '💰',
  deposit_confirmed: '✅', 
  payout_executed: '🎉',
  round_started: '🔄',
  penalty_applied: '⚠️',
  circle_completed: '🏆',
  risk_alert: '🚨',
  grace_period: '⏰',
  welcome: '👋',
  help: '❓',
  celebration: '🎊',
  achievement: '🏅'
} as const;

// Template size configurations
export type FlexMessageSize = 'nano' | 'micro' | 'kilo' | 'mega' | 'giga';

export const SIZE_CONFIG = {
  nano: { maxComponents: 3, textSize: 'sm' },
  micro: { maxComponents: 5, textSize: 'md' },
  kilo: { maxComponents: 8, textSize: 'md' },
  mega: { maxComponents: 12, textSize: 'lg' },
  giga: { maxComponents: 20, textSize: 'xl' }
} as const;

// Responsive design breakpoints
export interface ResponsiveConfig {
  mobile: FlexMessageSize;
  tablet: FlexMessageSize;
  desktop: FlexMessageSize;
}

// Animation and interaction hints
export interface InteractionHints {
  hasButtons: boolean;
  hasCarousel: boolean;
  isInteractive: boolean;
  expectedUserAction?: 'tap' | 'swipe' | 'scroll';
}