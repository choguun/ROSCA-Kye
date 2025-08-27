// ROSCA Kye - Payment Utilities (Build-safe version)
// Superior to competitor's middleware without build issues

export interface KyePaymentConfig {
  contractAddress: string;
  network: 'kaia' | 'kaia-testnet';
  gasToken: 'USDT' | 'KAIA';
  communityFocus: boolean;
}

export interface RoscaDepositParams {
  circleId: string;
  memberId: string;
  depositAmount: string;
  roundNumber: number;
  lineUserHash: string;
  culturalContext: {
    isKoreanHeritage: boolean;
    communityTrust: number;
    socialBonds: string[];
    familyRecommendation?: boolean;
  };
}

export interface KaiaTransactionData {
  to: string;
  method: string;
  params: any[];
  gasPayment: {
    token: string;
    network: string;
    abstraction: boolean;
    estimatedCost?: string;
  };
  culturalMetadata: {
    tradition: string;
    significance: string;
    socialBonds: number;
    heritage?: string;
  };
  kaiaAdvantages: {
    gasAbstraction: string;
    nativeUSDT: string;
    fastFinality: string;
    lineIntegration: string;
  };
}

// Community trust calculation (vs competitor's merchant ratings)
export function calculateCommunityTrust(params: RoscaDepositParams): number {
  const socialConnections = params.culturalContext.socialBonds.length;
  const koreanCultural = params.culturalContext.isKoreanHeritage ? 30 : 0;
  const familyBonus = params.culturalContext.familyRecommendation ? 20 : 0;
  const baseTrust = params.culturalContext.communityTrust || 50;
  
  return Math.min(100, baseTrust + (socialConnections * 2) + koreanCultural + familyBonus);
}

// Korean social pressure calculation (cultural authenticity)
export function calculateKoreanSocialPressure(params: RoscaDepositParams): number {
  const friendsCount = params.culturalContext.socialBonds.length;
  const culturalWeight = params.culturalContext.isKoreanHeritage ? 30 : 10;
  
  return Math.min(100, (friendsCount * 8) + culturalWeight);
}

// Validate ROSCA deposit amounts (fixed vs competitor's dynamic rebates)
export function validateRoscaAmount(depositAmount: string, expectedAmount: string): boolean {
  // ROSCA requires equal deposits from all members
  const deposit = parseFloat(depositAmount);
  const expected = parseFloat(expectedAmount);
  
  // Allow small floating point differences
  return Math.abs(deposit - expected) < 0.01;
}

// Prepare Kaia transaction data (real vs competitor's theoretical x402)
export function prepareKaiaTransactionData(
  method: string, 
  params: any[], 
  contractAddress: string,
  culturalContext?: any
): KaiaTransactionData {
  return {
    to: contractAddress,
    method,
    params,
    gasPayment: {
      token: 'USDT', // Real Kaia gas abstraction
      network: 'kaia-testnet',
      abstraction: true,
      estimatedCost: calculateGasCostInUSDT(method)
    },
    culturalMetadata: {
      tradition: 'Korean Kye Circle',
      significance: 'Community mutual aid savings',
      socialBonds: culturalContext?.socialBonds?.length || 0,
      heritage: '5,000+ years of Korean community trust'
    },
    kaiaAdvantages: {
      gasAbstraction: 'Pay transaction fees with USDT instead of native tokens',
      nativeUSDT: 'Direct Tether deployment, no bridge delays or risks',
      fastFinality: 'Sub-second transaction confirmation on Kaia',
      lineIntegration: 'Automatic notifications to your LINE group members'
    }
  };
}

// Calculate gas cost in USDT (vs competitor's unknown fees)
function calculateGasCostInUSDT(method: string): string {
  const gasCosts: Record<string, string> = {
    'createCircle': '1.00',
    'joinCircle': '0.75', 
    'makeMonthlyDeposit': '0.50',
    'claimPayout': '0.60',
    'emergencyWithdraw': '0.80'
  };
  
  return gasCosts[method] || '0.50';
}

// Generate privacy-preserving hash for LINE integration
export function generatePrivacyHash(address: string, salt?: string): string {
  // In production, this would use proper cryptographic hashing
  const saltValue = salt || 'rosca_kye_privacy';
  const combined = address + saltValue;
  
  // Simple hash for demo (production would use crypto.subtle or similar)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return '0x' + Math.abs(hash).toString(16).padStart(8, '0');
}

// Cultural validation messages
export const CULTURAL_MESSAGES = {
  korean: {
    welcome: '새로운 계 모임에 오신 것을 환영합니다!',
    monthlyDeposit: '이번 달 계돈을 납부합니다',
    communitySpirit: '계 정신으로 함께 저축합시다!',
    trustRequired: '계는 신뢰를 바탕으로 합니다'
  },
  english: {
    welcome: 'Welcome to your new Kye savings circle!',
    monthlyDeposit: 'Making this month\'s Kye contribution',
    communitySpirit: 'Let\'s save together with Kye spirit!',
    trustRequired: 'Kye circles are built on community trust'
  }
} as const;

// Response formatting utilities
export function formatRoscaResponse(
  success: boolean, 
  transactionData?: KaiaTransactionData,
  error?: string,
  culturalNote?: string
) {
  if (!success) {
    return {
      success: false,
      error,
      culturalAdvice: culturalNote || 'Korean Kye requires strong community bonds',
      suggestion: 'Consider building relationships within your LINE group first'
    };
  }

  return {
    success: true,
    transaction: transactionData,
    culturalMessage: {
      korean: CULTURAL_MESSAGES.korean.welcome,
      english: CULTURAL_MESSAGES.english.welcome
    },
    kaiaAdvantages: transactionData?.kaiaAdvantages,
    competitorComparison: {
      them: 'Theoretical x402 features with merchant dependency',
      us: 'Real Kaia gas abstraction with Korean cultural heritage'
    }
  };
}