'use client';

import React, { useState, useEffect } from 'react';
import { useKyeContracts } from '@/hooks/useKyeContracts';
import { useWalletAccountStore } from '@/components/Wallet/Account/auth.hooks';
import * as Sentry from '@sentry/nextjs';
import type { Circle, DepositInfo } from '@/utils/contracts/types';
import styles from './DepositManager.module.css';

interface DepositManagerProps {
  circleAddress: string;
  onDepositComplete?: () => void;
  onBack?: () => void;
}

export const DepositManager = ({ 
  circleAddress, 
  onDepositComplete, 
  onBack 
}: DepositManagerProps) => {
  const [circle, setCircle] = useState<Circle | null>(null);
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { account } = useWalletAccountStore();
  const { 
    getCircleDetails, 
    getDepositInfo, 
    getUsdtBalance, 
    makeDeposit, 
    mintUsdt 
  } = useKyeContracts();

  // Load circle and deposit information
  useEffect(() => {
    const loadData = async () => {
      if (!circleAddress || !account) return;

      try {
        setLoading(true);
        const [circleData, balance] = await Promise.all([
          getCircleDetails(circleAddress),
          getUsdtBalance()
        ]);
        
        if (!circleData) {
          setError('Circle not found');
          return;
        }

        setCircle(circleData);
        setUsdtBalance(balance);

        // Get deposit info for this user
        const depositData = await getDepositInfo(circleAddress, account);
        setDepositInfo(depositData);

      } catch (err) {
        console.error('Error loading deposit data:', err);
        setError('Failed to load deposit information');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [circleAddress, account, getCircleDetails, getUsdtBalance, getDepositInfo]);

  const handleDeposit = async () => {
    if (!circle || !depositInfo || !account) return;

    setDepositing(true);
    setError(null);

    try {
      Sentry.addBreadcrumb({
        message: 'Making deposit to Kye circle',
        category: 'deposit',
        level: 'info',
        data: { circleAddress, amount: depositInfo.amount }
      });

      const result = await makeDeposit(circleAddress);
      
      if (result.success) {
        Sentry.addBreadcrumb({
          message: 'Deposit successful',
          category: 'deposit',
          level: 'info'
        });
        
        onDepositComplete?.();
      } else {
        setError(result.error || 'Deposit failed');
      }
    } catch (err) {
      console.error('Deposit error:', err);
      setError('An unexpected error occurred');
    } finally {
      setDepositing(false);
    }
  };

  const handleMintUsdt = async () => {
    if (!account || !circle) return;

    try {
      const mintAmount = (parseInt(circle.metadata.depositAmount) * 3).toString(); // Mint 3x the deposit amount
      await mintUsdt(mintAmount);
      
      // Refresh balance
      const newBalance = await getUsdtBalance();
      setUsdtBalance(newBalance);
    } catch (err) {
      console.error('Mint USDT error:', err);
      setError('Failed to mint test USDT');
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading deposit information...</p>
      </div>
    );
  }

  if (error && !circle) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>❌ Error</h2>
          <p>{error}</p>
          {onBack && (
            <button onClick={onBack} className={styles.button}>
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!circle || !depositInfo) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>🔍 Information Not Available</h2>
          <p>Unable to load deposit information for this circle.</p>
          {onBack && (
            <button onClick={onBack} className={styles.button}>
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const depositAmountUsdt = parseInt(depositInfo.amount) / 1e6;
  const penaltyUsdt = parseInt(depositInfo.penalty) / 1e6;
  const totalAmountUsdt = depositAmountUsdt + penaltyUsdt;
  const userBalanceUsdt = parseInt(usdtBalance) / 1e6;
  const canAffordDeposit = userBalanceUsdt >= totalAmountUsdt;
  
  const deadlineDate = new Date(depositInfo.deadline);
  const isOverdue = Date.now() > depositInfo.deadline;
  const timeToDeadline = depositInfo.deadline - Date.now();
  const isUrgent = timeToDeadline <= 24 * 60 * 60 * 1000; // 24 hours

  const getUrgencyLevel = () => {
    if (isOverdue) return 'overdue';
    if (isUrgent) return 'urgent';
    if (timeToDeadline <= 7 * 24 * 60 * 60 * 1000) return 'warning'; // 7 days
    return 'normal';
  };

  const urgencyLevel = getUrgencyLevel();

  const formatTimeRemaining = () => {
    if (isOverdue) return 'Overdue';
    
    const days = Math.floor(timeToDeadline / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeToDeadline % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return 'Less than 1h';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          {onBack && (
            <button onClick={onBack} className={styles.backButton}>
              ← Back
            </button>
          )}
          <h1>Make Deposit</h1>
        </div>
        <p className={styles.subtitle}>
          Round {circle.metadata.currentRound} • Circle Deposit
        </p>
      </div>

      {/* Urgency Alert */}
      <div className={styles.urgencyCard} data-urgency={urgencyLevel}>
        <div className={styles.urgencyIcon}>
          {urgencyLevel === 'overdue' ? '❌' : 
           urgencyLevel === 'urgent' ? '⚡' : 
           urgencyLevel === 'warning' ? '⚠️' : '⏰'}
        </div>
        <div className={styles.urgencyInfo}>
          <div className={styles.urgencyTitle}>
            {urgencyLevel === 'overdue' ? 'Payment Overdue' :
             urgencyLevel === 'urgent' ? 'Urgent: Less than 24h' :
             urgencyLevel === 'warning' ? 'Payment Due Soon' :
             'Payment On Schedule'}
          </div>
          <div className={styles.urgencyText}>
            {isOverdue 
              ? `Due ${deadlineDate.toLocaleDateString()} at ${deadlineDate.toLocaleTimeString()}`
              : `${formatTimeRemaining()} remaining until ${deadlineDate.toLocaleDateString()}`
            }
          </div>
        </div>
      </div>

      {/* Deposit Details */}
      <div className={styles.depositCard}>
        <h3>Deposit Breakdown</h3>
        
        <div className={styles.amountSection}>
          <div className={styles.amountItem}>
            <span className={styles.amountLabel}>Base Deposit:</span>
            <span className={styles.amountValue}>{depositAmountUsdt.toFixed(2)} USDT</span>
          </div>
          
          {penaltyUsdt > 0 && (
            <div className={styles.amountItem} data-penalty="true">
              <span className={styles.amountLabel}>Late Penalty ({isOverdue ? 'Applied' : 'If Late'}):</span>
              <span className={styles.amountValue}>+{penaltyUsdt.toFixed(2)} USDT</span>
            </div>
          )}
          
          <div className={styles.amountSeparator}></div>
          
          <div className={styles.amountItem} data-total="true">
            <span className={styles.amountLabel}>Total Amount:</span>
            <span className={styles.amountValue}>{totalAmountUsdt.toFixed(2)} USDT</span>
          </div>
        </div>

        {penaltyUsdt > 0 && (
          <div className={styles.penaltyExplanation}>
            <div className={styles.penaltyIcon}>⚠️</div>
            <div className={styles.penaltyText}>
              <strong>Late Penalty Applied</strong><br />
              {isOverdue 
                ? 'Your payment is overdue, so a penalty has been added to maintain fairness for other members.'
                : 'This penalty will be applied if you deposit after the deadline.'
              }
            </div>
          </div>
        )}
      </div>

      {/* Balance Check */}
      <div className={styles.balanceCard}>
        <h3>Wallet Balance</h3>
        
        <div className={styles.balanceComparison}>
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Your USDT Balance:</span>
            <span className={styles.balanceValue}>{userBalanceUsdt.toFixed(2)} USDT</span>
          </div>
          
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Required Amount:</span>
            <span className={styles.balanceValue}>{totalAmountUsdt.toFixed(2)} USDT</span>
          </div>
          
          <div className={styles.balanceStatus} data-sufficient={canAffordDeposit}>
            {canAffordDeposit ? (
              <>
                <span className={styles.statusIcon}>✅</span>
                <span className={styles.statusText}>Sufficient balance</span>
              </>
            ) : (
              <>
                <span className={styles.statusIcon}>❌</span>
                <span className={styles.statusText}>
                  Need {(totalAmountUsdt - userBalanceUsdt).toFixed(2)} more USDT
                </span>
              </>
            )}
          </div>
        </div>

        {!canAffordDeposit && (
          <div className={styles.insufficientFunds}>
            <p>You need more USDT to make this deposit.</p>
            <button 
              onClick={handleMintUsdt}
              className={styles.mintButton}
            >
              Get Test USDT
            </button>
          </div>
        )}
      </div>

      {/* Beneficiary Info */}
      {circle.currentRound.beneficiary && (
        <div className={styles.beneficiaryCard}>
          <div className={styles.beneficiaryIcon}>🎯</div>
          <div className={styles.beneficiaryInfo}>
            <div className={styles.beneficiaryTitle}>This Round's Beneficiary</div>
            <div className={styles.beneficiaryAddress}>
              {circle.currentRound.beneficiary.substring(0, 10)}...{circle.currentRound.beneficiary.substring(-6)}
            </div>
            <div className={styles.beneficiaryText}>
              They will receive the full pool when all members deposit
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Deposit Button */}
      <button
        onClick={handleDeposit}
        disabled={depositing || !canAffordDeposit || !depositInfo.canDeposit}
        className={styles.depositButton}
        data-urgency={urgencyLevel}
      >
        {depositing ? (
          <>
            <div className={styles.spinner}></div>
            Processing Deposit...
          </>
        ) : !canAffordDeposit ? (
          'Insufficient USDT Balance'
        ) : !depositInfo.canDeposit ? (
          depositInfo.reasonIfCannot || 'Cannot Deposit'
        ) : urgencyLevel === 'overdue' ? (
          '🚨 Pay Overdue Amount'
        ) : urgencyLevel === 'urgent' ? (
          '⚡ Make Urgent Deposit'
        ) : (
          `💰 Deposit ${totalAmountUsdt.toFixed(2)} USDT`
        )}
      </button>

      {/* Information Footer */}
      <div className={styles.infoFooter}>
        <div className={styles.infoItem}>
          <span className={styles.infoIcon}>ℹ️</span>
          <span className={styles.infoText">
            Your deposit will be combined with others and distributed to this round's beneficiary. 
            You'll receive the full pool when it's your turn.
          </span>
        </div>
        
        {circle.currentRound.yieldAccrued && parseInt(circle.currentRound.yieldAccrued) > 0 && (
          <div className={styles.infoItem}>
            <span className={styles.infoIcon">📈</span>
            <span className={styles.infoText}>
              Bonus: {(parseInt(circle.currentRound.yieldAccrued) / 1e6).toFixed(2)} USDT yield 
              from SavingsPocket will be distributed to all members.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};