'use client';

import React, { useState, useEffect } from 'react';
import { useKyeContracts } from '@/hooks/useKyeContracts';
import { useLiffContext } from '@/hooks/useLiffContext';
import { useWalletAccountStore } from '@/components/Wallet/Account/auth.hooks';
import * as Sentry from '@sentry/nextjs';
import type { Circle, JoinCircleResult } from '@/utils/contracts/types';
import styles from './JoinCircle.module.css';

interface JoinCircleProps {
  circleAddress: string;
  inviteCode?: string;
  onJoinComplete?: (result: JoinCircleResult) => void;
  onBack?: () => void;
}

export const JoinCircle = ({ 
  circleAddress, 
  inviteCode, 
  onJoinComplete, 
  onBack 
}: JoinCircleProps) => {
  const [circle, setCircle] = useState<Circle | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string>('0');

  const { profile } = useLiffContext();
  const { account } = useWalletAccountStore();
  const { getCircleDetails, joinCircle, getUsdtBalance, mintUsdt } = useKyeContracts();

  // Load circle details
  useEffect(() => {
    const loadCircle = async () => {
      if (!circleAddress) {
        setError('Invalid circle address');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const circleData = await getCircleDetails(circleAddress);
        
        if (!circleData) {
          setError('Circle not found');
          return;
        }

        setCircle(circleData);

        // Load user's USDT balance if wallet is connected
        if (account) {
          const balance = await getUsdtBalance();
          setUsdtBalance(balance);
        }
      } catch (err) {
        console.error('Error loading circle:', err);
        setError('Failed to load circle details');
      } finally {
        setLoading(false);
      }
    };

    loadCircle();
  }, [circleAddress, account, getCircleDetails, getUsdtBalance]);

  const handleJoin = async () => {
    if (!circle || !profile?.userId || !account) return;

    setJoining(true);
    setError(null);

    try {
      Sentry.addBreadcrumb({
        message: 'Attempting to join Kye circle',
        category: 'circle',
        level: 'info',
        data: { circleAddress, userId: profile.userId }
      });

      const result = await joinCircle(circleAddress, profile.userId);
      
      if (result.success) {
        await shareJoinSuccess();
        onJoinComplete?.(result);
      } else {
        setError(result.error || 'Failed to join circle');
      }
    } catch (err) {
      console.error('Join error:', err);
      setError('An unexpected error occurred');
    } finally {
      setJoining(false);
    }
  };

  const shareJoinSuccess = async () => {
    try {
      // This would share success message to LINE group
      console.log('User joined circle successfully');
    } catch (err) {
      // Non-critical error
      console.warn('Could not share join success:', err);
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
        <p>Loading circle...</p>
      </div>
    );
  }

  if (error) {
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

  if (!circle) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>🔍 Circle Not Found</h2>
          <p>The requested circle could not be found.</p>
          {onBack && (
            <button onClick={onBack} className={styles.button}>
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const depositAmountUsdt = parseInt(circle.metadata.depositAmount) / 1e6;
  const userBalance = parseInt(usdtBalance) / 1e6;
  const canAffordDeposit = userBalance >= depositAmountUsdt;
  const circleIsFull = circle.metadata.memberCount >= 5;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          {onBack && (
            <button onClick={onBack} className={styles.backButton}>
              ← Back
            </button>
          )}
          <h1>Join Kye Circle</h1>
        </div>
        <p className={styles.subtitle}>
          Review details and join this savings circle
        </p>
      </div>

      <div className={styles.circleInfo}>
        <div className={styles.circleHeader}>
          <div className={styles.circleStatus}>
            <span className={styles.statusDot} data-status={circle.metadata.status}></span>
            <span className={styles.statusText}>
              {circle.metadata.status === 2 ? 'Active' : 'Setting Up'}
            </span>
          </div>
          <div className={styles.memberCount}>
            {circle.metadata.memberCount}/5 members
          </div>
        </div>

        <div className={styles.amountSection}>
          <div className={styles.mainAmount}>
            {depositAmountUsdt} USDT
            <span className={styles.amountLabel}>per round</span>
          </div>
          <div className={styles.totalPool}>
            Total pool: {(depositAmountUsdt * 5).toFixed(0)} USDT
          </div>
        </div>

        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Round Duration</span>
            <span className={styles.detailValue}>30 days</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Late Penalty</span>
            <span className={styles.detailValue}>5%</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Current Round</span>
            <span className={styles.detailValue}>{circle.metadata.currentRound}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Total Value Locked</span>
            <span className={styles.detailValue}>
              {(parseInt(circle.metadata.totalValueLocked) / 1e6).toFixed(0)} USDT
            </span>
          </div>
        </div>
      </div>

      {profile && (
        <div className={styles.profileSection}>
          <h3>Your LINE Profile</h3>
          <div className={styles.profileInfo}>
            {profile.pictureUrl && (
              <img 
                src={profile.pictureUrl} 
                alt={profile.displayName}
                className={styles.profilePicture}
              />
            )}
            <div>
              <div className={styles.displayName}>{profile.displayName}</div>
              <div className={styles.userId}>ID: {profile.userId.substring(0, 12)}...</div>
            </div>
          </div>
        </div>
      )}

      {account && (
        <div className={styles.walletSection}>
          <h3>Your Wallet</h3>
          <div className={styles.balanceInfo}>
            <div className={styles.balanceItem}>
              <span className={styles.balanceLabel}>USDT Balance:</span>
              <span className={styles.balanceValue}>
                {userBalance.toFixed(2)} USDT
              </span>
            </div>
            <div className={styles.balanceItem}>
              <span className={styles.balanceLabel}>Required Deposit:</span>
              <span className={styles.balanceValue}>
                {depositAmountUsdt.toFixed(2)} USDT
              </span>
            </div>
          </div>

          {!canAffordDeposit && (
            <div className={styles.insufficientFunds}>
              <p>⚠️ Insufficient USDT balance</p>
              <button 
                onClick={handleMintUsdt}
                className={styles.mintButton}
              >
                Get Test USDT
              </button>
            </div>
          )}
        </div>
      )}

      <div className={styles.warnings}>
        {circleIsFull && (
          <div className={styles.warning}>
            ⚠️ This circle is full (5/5 members)
          </div>
        )}
        
        {!canAffordDeposit && (
          <div className={styles.warning}>
            ⚠️ You need {depositAmountUsdt.toFixed(2)} USDT to join
          </div>
        )}
      </div>

      {error && (
        <div className={styles.joinError}>
          {error}
        </div>
      )}

      <button
        onClick={handleJoin}
        disabled={joining || !account || circleIsFull || !canAffordDeposit}
        className={styles.joinButton}
      >
        {joining ? (
          <>
            <div className={styles.spinner}></div>
            Joining Circle...
          </>
        ) : !account ? (
          'Connect Wallet First'
        ) : circleIsFull ? (
          'Circle is Full'
        ) : !canAffordDeposit ? (
          'Insufficient Balance'
        ) : (
          'Join Circle'
        )}
      </button>

      <div className={styles.info}>
        <p>ℹ️ <strong>By joining you agree to:</strong></p>
        <ul>
          <li>Deposit {depositAmountUsdt} USDT every round on time</li>
          <li>Wait your turn to receive the full pool</li>
          <li>Pay penalties for late deposits</li>
          <li>Complete all 5 rounds of the circle</li>
        </ul>
      </div>
    </div>
  );
};