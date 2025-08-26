'use client';

import React, { useState, useEffect } from 'react';
import { useKyeContracts } from '@/hooks/useKyeContracts';
import type { Circle, MemberState } from '@/utils/contracts/types';
import styles from './CircleOverview.module.css';

interface CircleOverviewProps {
  circle: Circle;
  onBack?: () => void;
  onDeposit?: (circleAddress: string) => void;
}

export const CircleOverview = ({ circle, onBack, onDeposit }: CircleOverviewProps) => {
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const { getDepositInfo } = useKyeContracts();

  // Update countdown timer
  useEffect(() => {
    if (!circle.currentRound.deadline) return;

    const updateTimer = () => {
      const deadline = parseInt(circle.currentRound.deadline);
      const now = Date.now();
      const remaining = Math.max(0, deadline - now);
      
      setRemainingTime(remaining);
      
      if (remaining > 0) {
        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        
        if (days > 0) {
          setTimeDisplay(`${days}d ${hours}h`);
        } else if (hours > 0) {
          setTimeDisplay(`${hours}h ${minutes}m`);
        } else {
          setTimeDisplay(`${minutes}m`);
        }
      } else {
        setTimeDisplay('Deadline passed');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [circle.currentRound.deadline]);

  const depositAmountUsdt = parseInt(circle.metadata.depositAmount) / 1e6;
  const totalValueLocked = parseInt(circle.metadata.totalValueLocked) / 1e6;
  const currentDeposited = parseInt(circle.currentRound.totalDeposited) / 1e6;
  const yieldAccrued = parseInt(circle.currentRound.yieldAccrued) / 1e6;
  const progress = Math.min(100, (currentDeposited / (depositAmountUsdt * 5)) * 100);

  const getUrgencyLevel = () => {
    if (remainingTime <= 0) return 'overdue';
    if (remainingTime <= 24 * 60 * 60 * 1000) return 'urgent'; // 1 day
    if (remainingTime <= 7 * 24 * 60 * 60 * 1000) return 'warning'; // 7 days
    return 'normal';
  };

  const urgencyLevel = getUrgencyLevel();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          {onBack && (
            <button onClick={onBack} className={styles.backButton}>
              ← Back
            </button>
          )}
          <h1>Circle Overview</h1>
        </div>
        <div className={styles.circleAddress}>
          {circle.address.substring(0, 6)}...{circle.address.substring(-4)}
        </div>
      </div>

      {/* Status Card */}
      <div className={styles.statusCard}>
        <div className={styles.statusHeader}>
          <div className={styles.roundInfo}>
            <span className={styles.roundLabel}>Round</span>
            <span className={styles.roundNumber}>{circle.metadata.currentRound}/5</span>
          </div>
          <div className={styles.statusBadge} data-status={circle.metadata.status}>
            {circle.metadata.status === 2 ? 'Active' : 'Setup'}
          </div>
        </div>

        <div className={styles.countdown} data-urgency={urgencyLevel}>
          <div className={styles.countdownIcon}>
            {urgencyLevel === 'overdue' ? '❌' : 
             urgencyLevel === 'urgent' ? '⚡' : 
             urgencyLevel === 'warning' ? '⚠️' : '⏰'}
          </div>
          <div className={styles.countdownText}>
            <div className={styles.timeRemaining}>{timeDisplay}</div>
            <div className={styles.timeLabel}>
              {urgencyLevel === 'overdue' ? 'Overdue' : 'remaining'}
            </div>
          </div>
        </div>

        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span>Deposits Progress</span>
            <span>{currentDeposited.toFixed(0)} / {(depositAmountUsdt * 5).toFixed(0)} USDT</span>
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
              data-urgency={urgencyLevel}
            ></div>
          </div>
          <div className={styles.progressInfo}>
            {circle.metadata.memberCount} members • {progress.toFixed(0)}% complete
          </div>
        </div>
      </div>

      {/* Current Round Card */}
      <div className={styles.roundCard}>
        <h3>Current Round Details</h3>
        
        <div className={styles.roundGrid}>
          <div className={styles.roundItem}>
            <div className={styles.roundValue}>{depositAmountUsdt.toFixed(0)} USDT</div>
            <div className={styles.roundLabel}>Deposit Amount</div>
          </div>
          <div className={styles.roundItem}>
            <div className={styles.roundValue}>{(depositAmountUsdt * 5).toFixed(0)} USDT</div>
            <div className={styles.roundLabel}>Total Pool</div>
          </div>
          <div className={styles.roundItem}>
            <div className={styles.roundValue}>{yieldAccrued.toFixed(2)} USDT</div>
            <div className={styles.roundLabel}>Yield Earned</div>
          </div>
          <div className={styles.roundItem}>
            <div className={styles.roundValue}>
              {circle.currentRound.beneficiary ? 
                `${circle.currentRound.beneficiary.substring(0, 6)}...` : 'TBD'}
            </div>
            <div className={styles.roundLabel}>Beneficiary</div>
          </div>
        </div>

        {circle.currentRound.beneficiary && (
          <div className={styles.beneficiaryInfo}>
            <div className={styles.beneficiaryIcon}>🎯</div>
            <div className={styles.beneficiaryText}>
              <strong>This round's beneficiary:</strong> {circle.currentRound.beneficiary}
              <br />
              <small>They will receive the full pool when all deposits are complete</small>
            </div>
          </div>
        )}
      </div>

      {/* Members Card */}
      <div className={styles.membersCard}>
        <h3>Members ({circle.metadata.memberCount}/5)</h3>
        
        <div className={styles.membersList}>
          {circle.members.map((member, index) => (
            <div key={member} className={styles.memberItem}>
              <div className={styles.memberInfo}>
                <div className={styles.memberAvatar}>
                  {index + 1}
                </div>
                <div className={styles.memberDetails}>
                  <div className={styles.memberAddress}>
                    {member.substring(0, 6)}...{member.substring(-4)}
                  </div>
                  <div className={styles.memberStatus}>
                    Member #{index + 1}
                  </div>
                </div>
              </div>
              <div className={styles.memberActions}>
                <span className={styles.depositStatus}>✅</span>
              </div>
            </div>
          ))}
          
          {/* Empty slots */}
          {Array.from({ length: 5 - circle.metadata.memberCount }, (_, index) => (
            <div key={`empty-${index}`} className={styles.memberItem} data-empty="true">
              <div className={styles.memberInfo}>
                <div className={styles.memberAvatar} data-empty="true">
                  {circle.metadata.memberCount + index + 1}
                </div>
                <div className={styles.memberDetails}>
                  <div className={styles.memberAddress}>Open Slot</div>
                  <div className={styles.memberStatus}>Waiting for member</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statistics Card */}
      <div className={styles.statsCard}>
        <h3>Circle Statistics</h3>
        
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{totalValueLocked.toFixed(0)} USDT</div>
            <div className={styles.statLabel}>Total Value Locked</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>
              {new Date(parseInt(circle.metadata.createdAt) * 1000).toLocaleDateString()}
            </div>
            <div className={styles.statLabel}>Created</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>5%</div>
            <div className={styles.statLabel">Late Penalty</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>30d</div>
            <div className={styles.statLabel}>Round Duration</div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      {onDeposit && circle.metadata.status === 2 && !circle.currentRound.isComplete && (
        <button
          onClick={() => onDeposit(circle.address)}
          className={styles.depositButton}
          data-urgency={urgencyLevel}
        >
          {urgencyLevel === 'overdue' ? '🚨 Late Deposit' :
           urgencyLevel === 'urgent' ? '⚡ Urgent Deposit' :
           '💰 Make Deposit'}
        </button>
      )}

      {/* Info Footer */}
      <div className={styles.infoFooter}>
        <div className={styles.infoItem}>
          <span className={styles.infoIcon}>ℹ️</span>
          <span className={styles.infoText}>
            {circle.metadata.status === 2 
              ? 'Circle is active. Make deposits on time to avoid penalties.'
              : 'Circle is setting up. Waiting for all members to join.'
            }
          </span>
        </div>
      </div>
    </div>
  );
};