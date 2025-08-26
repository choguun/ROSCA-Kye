'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreateCircle } from './CreateCircle';
import { JoinCircle } from './JoinCircle';
import { CircleOverview } from './CircleOverview';
import { DepositManager } from './DepositManager';
import { useKyeContracts } from '@/hooks/useKyeContracts';
import { useLiffContext } from '@/hooks/useLiffContext';
import { useWalletAccountStore } from '@/components/Wallet/Account/auth.hooks';
import { WalletButton } from '@/components/Wallet/Button/WalletButton';
import * as Sentry from '@sentry/nextjs';
import type { Circle, AppMode } from '@/utils/contracts/types';
import styles from './Dashboard.module.css';

export const Dashboard = () => {
  const searchParams = useSearchParams();
  const { context, profile, loading: liffLoading } = useLiffContext();
  const { account } = useWalletAccountStore();
  const { getCirclesForGroup, getCircleDetails } = useKyeContracts();

  const [mode, setMode] = useState<AppMode>('loading');
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);

  // Determine initial mode from URL params and LIFF context
  useEffect(() => {
    if (liffLoading || !context) return;

    const action = searchParams?.get('action');
    const circleAddress = searchParams?.get('circle');

    if (action === 'create') {
      setMode('create');
    } else if (action === 'join' && circleAddress) {
      setMode('join');
    } else if (action === 'deposit' && circleAddress) {
      setMode('deposit');
    } else {
      setMode('dashboard');
    }

    setLoading(false);
  }, [liffLoading, context, searchParams]);

  // Load user's circles when wallet is connected and we're in dashboard mode
  useEffect(() => {
    if (!account || mode !== 'dashboard' || !context?.groupId) return;

    const loadCircles = async () => {
      try {
        Sentry.addBreadcrumb({
          message: 'Loading circles for group',
          category: 'dashboard',
          level: 'info',
          data: { groupId: context.groupId }
        });

        const circleAddresses = await getCirclesForGroup(context.groupId);
        const circleDetails = await Promise.all(
          circleAddresses.map(addr => getCircleDetails(addr))
        );

        const validCircles = circleDetails.filter(circle => circle !== null) as Circle[];
        setCircles(validCircles);
        
        if (validCircles.length > 0 && !selectedCircle) {
          setSelectedCircle(validCircles[0]);
        }
      } catch (error) {
        console.error('Error loading circles:', error);
        Sentry.captureException(error, {
          tags: { component: 'Dashboard', action: 'loadCircles' }
        });
      }
    };

    loadCircles();
  }, [account, mode, context?.groupId, getCirclesForGroup, getCircleDetails, selectedCircle]);

  const handleCircleCreated = (result: any) => {
    if (result.success) {
      setMode('dashboard');
      // Reload circles to show the new one
      window.location.reload();
    }
  };

  const handleCircleJoined = (result: any) => {
    if (result.success) {
      setMode('dashboard');
      // Reload to refresh the circle data
      window.location.reload();
    }
  };

  const handleDepositComplete = () => {
    setMode('dashboard');
    // Reload to refresh the circle data
    window.location.reload();
  };

  if (loading || liffLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading Kye...</p>
      </div>
    );
  }

  // Show wallet connection if not connected
  if (!account) {
    return (
      <div className={styles.container}>
        <div className={styles.welcome}>
          <div className={styles.logo}>🎯</div>
          <h1>Welcome to Kye</h1>
          <p>Korean rotating savings circles on blockchain</p>
          
          {profile && (
            <div className={styles.profile}>
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
                  {context?.type === 'group' && (
                    <div className={styles.contextInfo}>
                      📱 LINE Group Context
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className={styles.walletSection}>
            <p>Connect your wallet to start saving with friends</p>
            <WalletButton setIsLoggedIn={setIsWalletConnecting} />
          </div>

          <div className={styles.features}>
            <div className={styles.featureGrid}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>💰</div>
                <div className={styles.featureTitle}>Save Together</div>
                <div className={styles.featureDesc}>Pool funds with 5 friends</div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🔄</div>
                <div className={styles.featureTitle}>Take Turns</div>
                <div className={styles.featureDesc}>Each member gets the full pot</div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>📈</div>
                <div className={styles.featureTitle}>Earn Yield</div>
                <div className={styles.featureDesc">Generate returns while saving</div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>⚡</div>
                <div className={styles.featureTitle}>Automated</div>
                <div className={styles.featureDesc}>Smart contracts handle everything</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Route to appropriate component based on mode
  switch (mode) {
    case 'create':
      return (
        <CreateCircle
          onCircleCreated={handleCircleCreated}
          onBack={() => setMode('dashboard')}
        />
      );

    case 'join':
      return (
        <JoinCircle
          circleAddress={searchParams?.get('circle') || ''}
          inviteCode={searchParams?.get('invite') || ''}
          onJoinComplete={handleCircleJoined}
          onBack={() => setMode('dashboard')}
        />
      );

    case 'deposit':
      return (
        <DepositManager
          circleAddress={searchParams?.get('circle') || ''}
          onDepositComplete={handleDepositComplete}
          onBack={() => setMode('dashboard')}
        />
      );

    case 'manage':
      return (
        <CircleOverview
          circle={selectedCircle!}
          onBack={() => setMode('dashboard')}
          onDeposit={(circleAddress) => {
            const params = new URLSearchParams();
            params.set('action', 'deposit');
            params.set('circle', circleAddress);
            window.history.pushState({}, '', `?${params.toString()}`);
            setMode('deposit');
          }}
        />
      );

    default: // dashboard
      return (
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <div className={styles.headerLeft}>
                <h1>Your Kye Circles</h1>
                {context?.type === 'group' && (
                  <p className={styles.groupInfo}>📱 {context.groupId?.substring(0, 12)}...</p>
                )}
              </div>
              <div className={styles.headerRight}>
                <a href="/analytics" className={styles.analyticsLink}>
                  📊 Analytics
                </a>
                {profile && (
                  <div className={styles.headerProfile}>
                    {profile.pictureUrl && (
                      <img 
                        src={profile.pictureUrl} 
                        alt={profile.displayName}
                        className={styles.headerProfilePicture}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {circles.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎯</div>
              <h2>No Circles Yet</h2>
              <p>Start your first savings circle with your LINE group</p>
              
              {context?.type === 'group' ? (
                <button
                  onClick={() => setMode('create')}
                  className={styles.createButton}
                >
                  Create First Circle
                </button>
              ) : (
                <div className={styles.noGroup}>
                  <p>⚠️ Please open this app from a LINE group to create circles</p>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.circlesList}>
              {circles.map((circle) => (
                <div
                  key={circle.address}
                  className={styles.circleCard}
                  onClick={() => {
                    setSelectedCircle(circle);
                    setMode('manage');
                  }}
                >
                  <div className={styles.circleHeader}>
                    <div className={styles.circleStatus}>
                      <span className={styles.statusDot} data-status={circle.metadata.status}></span>
                      <span className={styles.statusText}>
                        {circle.metadata.status === 2 ? 'Active' : 'Setup'}
                      </span>
                    </div>
                    <div className={styles.circleRound}>
                      Round {circle.metadata.currentRound}/5
                    </div>
                  </div>

                  <div className={styles.circleAmount}>
                    {(parseInt(circle.metadata.depositAmount) / 1e6).toFixed(0)} USDT
                    <span className={styles.amountLabel}>per round</span>
                  </div>

                  <div className={styles.circleMeta}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Members:</span>
                      <span className={styles.metaValue}>{circle.metadata.memberCount}/5</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>TVL:</span>
                      <span className={styles.metaValue}>
                        {(parseInt(circle.metadata.totalValueLocked) / 1e6).toFixed(0)} USDT
                      </span>
                    </div>
                  </div>

                  {circle.remainingTime && circle.remainingTime > 0 && (
                    <div className={styles.countdown}>
                      <span className={styles.countdownIcon}>⏰</span>
                      {Math.ceil(circle.remainingTime / (24 * 60 * 60))} days left
                    </div>
                  )}
                </div>
              ))}

              {context?.type === 'group' && circles.length < 3 && (
                <div
                  className={styles.createCard}
                  onClick={() => setMode('create')}
                >
                  <div className={styles.createIcon}>+</div>
                  <div className={styles.createText}>Create New Circle</div>
                </div>
              )}
            </div>
          )}
        </div>
      );
  }
};