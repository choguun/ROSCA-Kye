import { DatabaseManager } from '@/database/manager';
import { Logger } from '@/utils/logger';
import { LineUser, UserBehaviorProfile, FinancialCapacity, ResponsePattern } from '@/types';

interface DepositHistory {
  circleAddress: string;
  roundIndex: number;
  amount: string;
  penalty: string;
  timestamp: Date;
  onTime: boolean;
  daysLate: number;
}

interface RiskFactors {
  consistencyScore: number; // 0-1 scale
  defaultRate: number; // 0-1 scale
  financialStressScore: number; // 0-1 scale
  responseScore: number; // 0-1 scale
  networkRiskScore: number; // 0-1 scale
}

export class FinancialIntelligence {
  private logger: Logger;

  constructor(private databaseManager: DatabaseManager) {
    this.logger = new Logger('FinancialIntelligence');
  }

  /**
   * Analyze user's financial capacity and risk level
   */
  async analyzeUserCapacity(lineUserId: string): Promise<UserBehaviorProfile> {
    try {
      const user = await this.databaseManager.getUser(lineUserId);
      if (!user) {
        throw new Error(`User not found: ${lineUserId}`);
      }

      const depositHistory = await this.getUserDepositHistory(lineUserId);
      const riskFactors = await this.calculateRiskFactors(lineUserId, depositHistory);
      const responsePatterns = await this.analyzeResponsePatterns(lineUserId);
      const financialCapacity = this.estimateFinancialCapacity(depositHistory, riskFactors);

      const consistencyScore = this.calculateConsistencyScore(depositHistory);
      const riskLevel = this.assessRiskLevel(riskFactors);

      return {
        lineUserId,
        consistencyScore,
        riskLevel,
        preferredCommunicationTime: await this.calculatePreferredTime(lineUserId),
        responsePatterns,
        financialCapacity,
        lastUpdated: new Date()
      };

    } catch (error) {
      this.logger.error(`Failed to analyze user capacity for ${lineUserId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate user's consistency score based on deposit history
   */
  private calculateConsistencyScore(history: DepositHistory[]): number {
    if (history.length === 0) return 0.5; // Neutral for new users

    const totalDeposits = history.length;
    const onTimeDeposits = history.filter(h => h.onTime).length;
    const baseScore = onTimeDeposits / totalDeposits;

    // Weight recent deposits more heavily (last 10 deposits)
    const recentHistory = history.slice(-10);
    const recentOnTime = recentHistory.filter(h => h.onTime).length;
    const recentScore = recentHistory.length > 0 ? recentOnTime / recentHistory.length : baseScore;

    // Combine base score (40%) and recent score (60%)
    const combinedScore = (baseScore * 0.4) + (recentScore * 0.6);

    // Apply penalty for consecutive late payments
    const penalty = this.calculateConsecutiveLatenessPenalty(history);
    
    return Math.max(0, Math.min(1, combinedScore - penalty));
  }

  /**
   * Calculate penalty for consecutive late payments
   */
  private calculateConsecutiveLatenessPenalty(history: DepositHistory[]): number {
    let consecutiveLate = 0;
    let maxConsecutiveLate = 0;

    // Count consecutive late payments from most recent
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i].onTime) {
        consecutiveLate++;
      } else {
        maxConsecutiveLate = Math.max(maxConsecutiveLate, consecutiveLate);
        consecutiveLate = 0;
      }
    }
    maxConsecutiveLate = Math.max(maxConsecutiveLate, consecutiveLate);

    // Apply exponential penalty for consecutive late payments
    return Math.min(0.3, maxConsecutiveLate * 0.05); // Max 30% penalty
  }

  /**
   * Calculate comprehensive risk factors
   */
  private async calculateRiskFactors(lineUserId: string, history: DepositHistory[]): Promise<RiskFactors> {
    const consistencyScore = this.calculateConsistencyScore(history);
    const defaultRate = this.calculateDefaultRate(history);
    const financialStressScore = await this.detectFinancialStress(lineUserId, history);
    const responseScore = await this.calculateResponseScore(lineUserId);
    const networkRiskScore = await this.calculateNetworkRiskScore(lineUserId);

    return {
      consistencyScore,
      defaultRate,
      financialStressScore,
      responseScore,
      networkRiskScore
    };
  }

  /**
   * Calculate default rate (missed payments / total expected payments)
   */
  private calculateDefaultRate(history: DepositHistory[]): number {
    if (history.length === 0) return 0;

    const missedPayments = history.filter(h => !h.onTime && h.daysLate > 7).length; // More than 7 days late
    return missedPayments / history.length;
  }

  /**
   * Detect financial stress signals
   */
  private async detectFinancialStress(lineUserId: string, history: DepositHistory[]): Promise<number> {
    let stressScore = 0;

    // 1. Increasing penalty payments
    const recentPenalties = history.slice(-5).map(h => parseFloat(h.penalty));
    const oldPenalties = history.slice(0, -5).map(h => parseFloat(h.penalty));
    
    if (recentPenalties.length > 0 && oldPenalties.length > 0) {
      const recentAvg = recentPenalties.reduce((a, b) => a + b, 0) / recentPenalties.length;
      const oldAvg = oldPenalties.reduce((a, b) => a + b, 0) / oldPenalties.length;
      
      if (recentAvg > oldAvg * 1.5) {
        stressScore += 0.2; // Increasing penalties indicate stress
      }
    }

    // 2. Increasing delay in payments
    const recentDelays = history.slice(-5).map(h => h.daysLate);
    const oldDelays = history.slice(0, -5).map(h => h.daysLate);
    
    if (recentDelays.length > 0 && oldDelays.length > 0) {
      const recentAvgDelay = recentDelays.reduce((a, b) => a + b, 0) / recentDelays.length;
      const oldAvgDelay = oldDelays.reduce((a, b) => a + b, 0) / oldDelays.length;
      
      if (recentAvgDelay > oldAvgDelay * 2) {
        stressScore += 0.2; // Increasing delays indicate stress
      }
    }

    // 3. Pattern of last-minute payments
    const lastMinutePayments = history.filter(h => h.onTime && h.daysLate === 0).length;
    const veryLatePayments = history.filter(h => h.daysLate > 0).length;
    
    if (lastMinutePayments > veryLatePayments * 2) {
      stressScore += 0.1; // Consistently last-minute payments
    }

    // 4. Grace period usage frequency
    const gracePeriodUsage = await this.getGracePeriodUsage(lineUserId);
    stressScore += Math.min(0.3, gracePeriodUsage * 0.1);

    return Math.min(1, stressScore);
  }

  /**
   * Calculate user's response rate to notifications
   */
  private async calculateResponseScore(lineUserId: string): Promise<number> {
    // Get notification history and response times
    const notifications = await this.databaseManager.getUserNotificationHistory(lineUserId);
    
    if (notifications.length === 0) return 0.5; // Neutral for new users

    let responseScore = 0;
    let respondedNotifications = 0;

    for (const notification of notifications) {
      if (notification.wasActedUpon) {
        respondedNotifications++;
        
        // Calculate response time score (faster response = higher score)
        const responseTimeHours = (notification.actionTakenAt - notification.sentAt) / (1000 * 60 * 60);
        const timeScore = Math.max(0, 1 - (responseTimeHours / 24)); // Full score if responded within hours
        responseScore += timeScore;
      }
    }

    return respondedNotifications > 0 ? responseScore / respondedNotifications : 0;
  }

  /**
   * Calculate network risk score based on circle members
   */
  private async calculateNetworkRiskScore(lineUserId: string): Promise<number> {
    const userCircles = await this.databaseManager.getUserCircles(lineUserId);
    let totalRiskScore = 0;
    let circleCount = 0;

    for (const circle of userCircles) {
      const members = await this.databaseManager.getCircleMembers(circle.circleAddress);
      let circleRiskScore = 0;

      for (const member of members) {
        if (member.walletAddress !== lineUserId) { // Exclude self
          const memberUser = await this.databaseManager.getUserByWallet(member.walletAddress);
          if (memberUser) {
            const memberHistory = await this.getUserDepositHistory(memberUser.lineUserId);
            const memberDefaultRate = this.calculateDefaultRate(memberHistory);
            circleRiskScore += memberDefaultRate;
          }
        }
      }

      if (members.length > 1) {
        circleRiskScore /= (members.length - 1); // Average excluding self
        totalRiskScore += circleRiskScore;
        circleCount++;
      }
    }

    return circleCount > 0 ? totalRiskScore / circleCount : 0;
  }

  /**
   * Assess overall risk level
   */
  private assessRiskLevel(factors: RiskFactors): 'low' | 'medium' | 'high' {
    // Weighted risk calculation
    const weights = {
      consistencyScore: 0.3, // Inverted (low consistency = high risk)
      defaultRate: 0.25,
      financialStressScore: 0.2,
      responseScore: 0.15, // Inverted (low response = high risk)
      networkRiskScore: 0.1
    };

    const riskScore = 
      (1 - factors.consistencyScore) * weights.consistencyScore +
      factors.defaultRate * weights.defaultRate +
      factors.financialStressScore * weights.financialStressScore +
      (1 - factors.responseScore) * weights.responseScore +
      factors.networkRiskScore * weights.networkRiskScore;

    if (riskScore < 0.3) return 'low';
    if (riskScore < 0.6) return 'medium';
    return 'high';
  }

  /**
   * Estimate user's financial capacity
   */
  private estimateFinancialCapacity(history: DepositHistory[], factors: RiskFactors): FinancialCapacity {
    let recommendations: string[] = [];
    
    // Calculate average deposit amounts
    const avgDeposit = history.length > 0 
      ? history.reduce((sum, h) => sum + parseFloat(h.amount), 0) / history.length
      : 100000000; // Default 100 USDT

    // Calculate recommended range based on history and risk
    const riskMultiplier = factors.consistencyScore > 0.7 ? 1.2 : 
                          factors.consistencyScore > 0.4 ? 1.0 : 0.8;
    
    const minRecommended = Math.floor(avgDeposit * 0.5 * riskMultiplier);
    const maxRecommended = Math.floor(avgDeposit * 1.5 * riskMultiplier);

    // Generate risk factors and suggestions
    const riskFactors: string[] = [];
    
    if (factors.defaultRate > 0.2) {
      riskFactors.push('High default rate');
      recommendations.push('Consider smaller deposit amounts to improve consistency');
    }
    
    if (factors.financialStressScore > 0.5) {
      riskFactors.push('Financial stress indicators detected');
      recommendations.push('Set up automatic reminders 48 hours before deadlines');
    }
    
    if (factors.responseScore < 0.3) {
      riskFactors.push('Low response rate to notifications');
      recommendations.push('Enable all notification types for better circle management');
    }

    if (factors.networkRiskScore > 0.4) {
      riskFactors.push('High-risk circle members detected');
      recommendations.push('Monitor circle performance closely');
    }

    // Add positive recommendations for good users
    if (factors.consistencyScore > 0.8) {
      recommendations.push('Excellent payment history - consider joining premium circles');
    }

    return {
      recommendedDepositRange: {
        min: minRecommended.toString(),
        max: maxRecommended.toString()
      },
      riskFactors,
      suggestions: recommendations
    };
  }

  /**
   * Generate personalized intervention messages
   */
  async generatePersonalizedReminder(lineUserId: string, circleAddress: string): Promise<{
    message: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    tone: 'encouraging' | 'supportive' | 'urgent';
  }> {
    const profile = await this.analyzeUserCapacity(lineUserId);
    const history = await this.getUserDepositHistory(lineUserId);
    
    let tone: 'encouraging' | 'supportive' | 'urgent';
    let urgency: 'low' | 'medium' | 'high' | 'critical';
    
    if (profile.consistencyScore > 0.8) {
      tone = 'encouraging';
      urgency = 'low';
    } else if (profile.consistencyScore > 0.5) {
      tone = 'supportive';  
      urgency = 'medium';
    } else {
      tone = 'urgent';
      urgency = 'high';
    }

    // Escalate urgency based on recent defaults
    const recentDefaults = history.slice(-3).filter(h => !h.onTime).length;
    if (recentDefaults >= 2) {
      urgency = 'critical';
      tone = 'urgent';
    }

    const messages = this.getPersonalizedMessages(profile, tone);
    const message = messages[Math.floor(Math.random() * messages.length)];

    return { message, urgency, tone };
  }

  /**
   * Predict likelihood of default for current round
   */
  async predictDefaultLikelihood(lineUserId: string, circleAddress: string): Promise<{
    likelihood: number; // 0-1 scale
    confidenceLevel: number; // 0-1 scale
    keyFactors: string[];
    recommendedInterventions: string[];
  }> {
    const profile = await this.analyzeUserCapacity(lineUserId);
    const history = await this.getUserDepositHistory(lineUserId);
    
    // Calculate likelihood based on multiple factors
    let likelihood = 0;
    const factors: string[] = [];
    const interventions: string[] = [];

    // Factor 1: Historical consistency
    const consistencyWeight = 0.4;
    likelihood += (1 - profile.consistencyScore) * consistencyWeight;
    if (profile.consistencyScore < 0.5) {
      factors.push(`Low consistency score: ${(profile.consistencyScore * 100).toFixed(1)}%`);
      interventions.push('Send early reminder 72 hours before deadline');
    }

    // Factor 2: Recent trend
    const recentHistory = history.slice(-3);
    const recentDefaults = recentHistory.filter(h => !h.onTime).length;
    if (recentDefaults > 0) {
      const trendWeight = 0.3;
      likelihood += (recentDefaults / recentHistory.length) * trendWeight;
      factors.push(`${recentDefaults} defaults in last 3 payments`);
      interventions.push('Offer grace period or payment plan options');
    }

    // Factor 3: Financial stress indicators
    const stressWeight = 0.2;
    const stressScore = await this.detectFinancialStress(lineUserId, history);
    likelihood += stressScore * stressWeight;
    if (stressScore > 0.5) {
      factors.push('Financial stress indicators detected');
      interventions.push('Provide financial counseling resources');
    }

    // Factor 4: Response patterns
    const responseWeight = 0.1;
    likelihood += (1 - profile.responsePatterns.reduce((avg, p) => avg + p.responseRate, 0) / profile.responsePatterns.length) * responseWeight;
    
    // Calculate confidence based on data availability
    const confidenceLevel = Math.min(1, history.length / 10); // Higher confidence with more data

    return {
      likelihood: Math.min(1, likelihood),
      confidenceLevel,
      keyFactors: factors,
      recommendedInterventions: interventions
    };
  }

  // Helper methods (implementations would be added)
  private async getUserDepositHistory(lineUserId: string): Promise<DepositHistory[]> {
    // Implementation would fetch from database
    return [];
  }

  private async analyzeResponsePatterns(lineUserId: string): Promise<ResponsePattern[]> {
    // Implementation would analyze notification response patterns
    return [];
  }

  private async calculatePreferredTime(lineUserId: string): Promise<string> {
    // Implementation would analyze when user typically responds
    return '09:00:00';
  }

  private async getGracePeriodUsage(lineUserId: string): Promise<number> {
    // Implementation would count grace period requests
    return 0;
  }

  private getPersonalizedMessages(profile: UserBehaviorProfile, tone: string): string[] {
    const messages = {
      encouraging: [
        "You have an excellent payment record! Don't forget your upcoming deposit.",
        "Your consistent payments help make the circle successful for everyone.",
        "Time for another deposit - you're doing great!"
      ],
      supportive: [
        "Friendly reminder: your deposit deadline is approaching.",
        "Need help with your deposit? Let me know if you have questions.",
        "Your circle is counting on you - deposit deadline coming up!"
      ],
      urgent: [
        "URGENT: Deposit deadline approaching. Please act now to avoid penalties.",
        "Important: Late payment fees will apply if not received soon.",
        "Final notice: Your deposit is needed to keep the circle running smoothly."
      ]
    };

    return messages[tone as keyof typeof messages] || messages.supportive;
  }
}