'use client';

import React, { useState, useEffect } from 'react';
import { useKyeContracts } from '@/hooks/useKyeContracts';
import { useWalletAccountStore } from '@/components/Wallet/Account/auth.hooks';
import { liff } from '@/utils/liff';
import * as Sentry from '@sentry/nextjs';
import type { LIFFContext, CreateCircleResult } from '@/utils/contracts/types';
import styles from './CreateCircle.module.css';

interface CreateCircleProps {
  onCircleCreated?: (result: CreateCircleResult) => void;
  onBack?: () => void;
}

export const CreateCircle = ({ onCircleCreated, onBack }: CreateCircleProps) => {
  const [liffContext, setLiffContext] = useState<LIFFContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    depositAmount: '100',
    penaltyBps: 500, // 5%
    roundDurationDays: 30,
    maxMembers: 5
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { account } = useWalletAccountStore();
  const { createCircle, getUsdtBalance } = useKyeContracts();

  // Initialize LIFF and get context
  useEffect(() => {
    const initLiff = async () => {
      try {
        if (!liff.isInClient()) {
          console.log('Not in LINE client, using demo context');
          setLiffContext({
            type: 'group',
            groupId: 'demo-group-id',
            viewType: 'full'
          });
          return;
        }

        await liff.ready;
        const context = liff.getContext();
        
        if (context.type === 'group' && context.groupId) {
          setLiffContext({
            type: 'group',
            groupId: context.groupId,
            viewType: context.viewType || 'full'
          });
          
          Sentry.addBreadcrumb({
            message: 'LIFF context initialized for group',
            category: 'liff',
            level: 'info',
            data: { groupId: context.groupId }
          });
        } else {
          // Not in a group, redirect to personal chat with instructions
          setLiffContext({
            type: context.type as any,
            viewType: context.viewType || 'full'
          });
        }
      } catch (error) {
        console.error('LIFF initialization error:', error);
        Sentry.captureException(error, {
          tags: { component: 'CreateCircle', action: 'liff-init' }
        });
        
        // Fallback to demo context for development
        setLiffContext({
          type: 'group',
          groupId: 'demo-group-id',
          viewType: 'full'
        });
      }
    };

    initLiff();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.depositAmount || parseFloat(formData.depositAmount) < 1) {
      newErrors.depositAmount = 'Deposit amount must be at least 1 USDT';
    }

    if (formData.penaltyBps < 100 || formData.penaltyBps > 2000) {
      newErrors.penaltyBps = 'Penalty must be between 1% and 20%';
    }

    if (formData.roundDurationDays < 7 || formData.roundDurationDays > 90) {
      newErrors.roundDurationDays = 'Round duration must be between 7 and 90 days';
    }

    if (formData.maxMembers < 2 || formData.maxMembers > 5) {
      newErrors.maxMembers = 'Member count must be between 2 and 5';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !liffContext?.groupId || !account) {
      return;
    }

    setLoading(true);
    try {
      Sentry.addBreadcrumb({
        message: 'Creating new Kye circle',
        category: 'circle',
        level: 'info',
        data: { groupId: liffContext.groupId, depositAmount: formData.depositAmount }
      });

      const result = await createCircle(
        liffContext.groupId,
        formData.depositAmount,
        formData.penaltyBps,
        formData.roundDurationDays,
        formData.maxMembers
      );

      if (result.success) {
        // Share to LINE group
        await shareToLineGroup(result.circleAddress!);
        onCircleCreated?.(result);
      } else {
        setErrors({ submit: result.error || 'Failed to create circle' });
      }
    } catch (error) {
      console.error('Circle creation error:', error);
      setErrors({ submit: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const shareToLineGroup = async (circleAddress: string) => {
    if (!liff.isInClient() || !liffContext?.groupId) return;

    try {
      const shareUrl = `${window.location.origin}/?action=join&circle=${circleAddress}`;
      const message = `🎯 New Kye Circle Created!\n\n💰 Deposit: ${formData.depositAmount} USDT\n⏰ Round: ${formData.roundDurationDays} days\n👥 ${formData.maxMembers} members max\n\nJoin now: ${shareUrl}`;

      if (liff.isApiAvailable('shareTargetPicker')) {
        await liff.shareTargetPicker([{
          type: 'text',
          text: message
        }]);
      } else {
        // Fallback to external share
        await liff.sendMessages([{
          type: 'text',
          text: message
        }]);
      }

      Sentry.addBreadcrumb({
        message: 'Circle invitation shared to LINE group',
        category: 'share',
        level: 'info'
      });
    } catch (error) {
      console.error('Sharing error:', error);
      // Non-critical error, don't block the flow
    }
  };

  if (!liffContext) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Initializing LINE context...</p>
      </div>
    );
  }

  if (liffContext.type !== 'group') {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>🔒 Group Required</h2>
          <p>Kye circles can only be created in LINE groups.</p>
          <p>Please open this app from a LINE group chat to create a savings circle.</p>
          {onBack && (
            <button onClick={onBack} className={styles.button}>
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          {onBack && (
            <button onClick={onBack} className={styles.backButton}>
              ← Back
            </button>
          )}
          <h1>Create Kye Circle</h1>
        </div>
        <p className={styles.subtitle}>
          Set up a {formData.maxMembers}-member savings circle for your LINE group
        </p>
      </div>

      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="depositAmount">Monthly Deposit (USDT)</label>
          <input
            id="depositAmount"
            type="number"
            min="1"
            step="0.01"
            value={formData.depositAmount}
            onChange={(e) => setFormData(prev => ({ ...prev, depositAmount: e.target.value }))}
            className={errors.depositAmount ? styles.inputError : ''}
            placeholder="100"
          />
          {errors.depositAmount && (
            <span className={styles.errorText}>{errors.depositAmount}</span>
          )}
          <small className={styles.helpText}>
            Amount each member deposits every round
          </small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="maxMembers">Circle Size (Members)</label>
          <select
            id="maxMembers"
            value={formData.maxMembers}
            onChange={(e) => setFormData(prev => ({ ...prev, maxMembers: parseInt(e.target.value) }))}
            className={errors.maxMembers ? styles.inputError : ''}
          >
            <option value={2}>2 Members (Intimate)</option>
            <option value={3}>3 Members (Small)</option>
            <option value={4}>4 Members (Medium)</option>
            <option value={5}>5 Members (Traditional)</option>
          </select>
          {errors.maxMembers && (
            <span className={styles.errorText}>{errors.maxMembers}</span>
          )}
          <small className={styles.helpText}>
            Choose circle size based on your group preferences
          </small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="penalty">Late Penalty (%)</label>
          <select
            id="penalty"
            value={formData.penaltyBps}
            onChange={(e) => setFormData(prev => ({ ...prev, penaltyBps: parseInt(e.target.value) }))}
            className={errors.penaltyBps ? styles.inputError : ''}
          >
            <option value={100}>1% (Lenient)</option>
            <option value={300}>3% (Moderate)</option>
            <option value={500}>5% (Standard)</option>
            <option value={1000}>10% (Strict)</option>
            <option value={2000}>20% (Maximum)</option>
          </select>
          {errors.penaltyBps && (
            <span className={styles.errorText}>{errors.penaltyBps}</span>
          )}
          <small className={styles.helpText}>
            Penalty for late deposits to maintain fairness
          </small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="duration">Round Duration (days)</label>
          <select
            id="duration"
            value={formData.roundDurationDays}
            onChange={(e) => setFormData(prev => ({ ...prev, roundDurationDays: parseInt(e.target.value) }))}
            className={errors.roundDurationDays ? styles.inputError : ''}
          >
            <option value={7}>7 days (Weekly)</option>
            <option value={14}>14 days (Bi-weekly)</option>
            <option value={30}>30 days (Monthly)</option>
            <option value={60}>60 days (Bi-monthly)</option>
          </select>
          {errors.roundDurationDays && (
            <span className={styles.errorText}>{errors.roundDurationDays}</span>
          )}
          <small className={styles.helpText}>
            How long each round lasts before payout
          </small>
        </div>

        <div className={styles.summary}>
          <h3>Circle Summary</h3>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Pool:</span>
              <span className={styles.summaryValue}>
                {(parseFloat(formData.depositAmount) * formData.maxMembers).toFixed(2)} USDT
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Per Member:</span>
              <span className={styles.summaryValue}>{formData.depositAmount} USDT</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Duration:</span>
              <span className={styles.summaryValue}>
                {formData.maxMembers * formData.roundDurationDays} days total
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Late Fee:</span>
              <span className={styles.summaryValue}>{formData.penaltyBps / 100}%</span>
            </div>
          </div>
        </div>

        {errors.submit && (
          <div className={styles.submitError}>
            {errors.submit}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !account}
          className={styles.submitButton}
        >
          {loading ? (
            <>
              <div className={styles.spinner}></div>
              Creating Circle...
            </>
          ) : !account ? (
            'Connect Wallet First'
          ) : (
            'Create Circle & Share'
          )}
        </button>

        <div className={styles.info}>
          <p>ℹ️ <strong>How Kye Works:</strong></p>
          <ul>
            <li>{formData.maxMembers} members take turns receiving the full pool</li>
            <li>Each round, everyone deposits the agreed amount</li>
            <li>One member receives all deposits ({formData.maxMembers}x their contribution)</li>
            <li>Late deposits incur penalties to maintain fairness</li>
            <li>Yield from SavingsPocket is distributed to all members</li>
          </ul>
        </div>
      </div>
    </div>
  );
};