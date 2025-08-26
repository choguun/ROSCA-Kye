'use client';

import React, { useState, useEffect } from 'react';
import { liff } from '@/utils/liff';
import * as Sentry from '@sentry/nextjs';
import type { LIFFContext, LIFFProfile } from '@/utils/contracts/types';

export const useLiffContext = () => {
  const [context, setContext] = useState<LIFFContext | null>(null);
  const [profile, setProfile] = useState<LIFFProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        setLoading(true);
        
        // Check if we're in LINE client
        if (!liff.isInClient()) {
          console.log('Not in LINE client, using demo context');
          setContext({
            type: 'group',
            groupId: 'demo-group-' + Math.random().toString(36).substr(2, 9),
            userId: 'demo-user-' + Math.random().toString(36).substr(2, 9),
            viewType: 'full'
          });
          
          setProfile({
            userId: 'demo-user',
            displayName: 'Demo User',
            pictureUrl: undefined,
            statusMessage: 'Demo mode'
          });
          
          setLoading(false);
          return;
        }

        // Wait for LIFF to be ready
        await liff.ready;
        
        // Get context
        const liffContext = liff.getContext();
        const contextData: LIFFContext = {
          type: liffContext.type as any,
          viewType: liffContext.viewType || 'full'
        };

        if (liffContext.type === 'group' && liffContext.groupId) {
          contextData.groupId = liffContext.groupId;
        }
        
        if (liffContext.type === 'room' && liffContext.roomId) {
          contextData.roomId = liffContext.roomId;
        }

        if (liffContext.userId) {
          contextData.userId = liffContext.userId;
        }

        setContext(contextData);

        // Get user profile
        try {
          const userProfile = await liff.getProfile();
          setProfile({
            userId: userProfile.userId,
            displayName: userProfile.displayName,
            pictureUrl: userProfile.pictureUrl,
            statusMessage: userProfile.statusMessage
          });
        } catch (profileError) {
          console.warn('Could not get LINE profile:', profileError);
          // Profile is not critical, continue without it
        }

        Sentry.addBreadcrumb({
          message: 'LIFF context initialized successfully',
          category: 'liff',
          level: 'info',
          data: { 
            type: contextData.type,
            hasGroupId: !!contextData.groupId,
            hasUserId: !!contextData.userId,
            viewType: contextData.viewType
          }
        });

      } catch (initError) {
        console.error('LIFF initialization error:', initError);
        setError('Failed to initialize LINE integration');
        
        Sentry.captureException(initError, {
          tags: { component: 'useLiffContext', action: 'init' }
        });

        // Fallback to demo context for development
        setContext({
          type: 'group',
          groupId: 'demo-group-fallback',
          userId: 'demo-user-fallback',
          viewType: 'full'
        });
        
        setProfile({
          userId: 'demo-user-fallback',
          displayName: 'Demo User',
          pictureUrl: undefined,
          statusMessage: 'Fallback mode'
        });
      } finally {
        setLoading(false);
      }
    };

    initLiff();
  }, []);

  const shareMessage = async (message: string) => {
    try {
      if (!liff.isInClient()) {
        console.log('Share message (demo):', message);
        return;
      }

      if (liff.isApiAvailable('shareTargetPicker')) {
        await liff.shareTargetPicker([{
          type: 'text',
          text: message
        }]);
      } else if (liff.isApiAvailable('sendMessages')) {
        await liff.sendMessages([{
          type: 'text',
          text: message
        }]);
      } else {
        throw new Error('Sharing not available');
      }

      Sentry.addBreadcrumb({
        message: 'Message shared via LINE',
        category: 'liff',
        level: 'info'
      });
    } catch (shareError) {
      console.error('Share error:', shareError);
      throw shareError;
    }
  };

  const openExternalWindow = (url: string) => {
    try {
      if (liff.isInClient() && liff.isApiAvailable('openWindow')) {
        liff.openWindow({ url, external: true });
      } else {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error opening external window:', error);
      window.open(url, '_blank');
    }
  };

  const closeWindow = () => {
    try {
      if (liff.isInClient() && liff.isApiAvailable('closeWindow')) {
        liff.closeWindow();
      }
    } catch (error) {
      console.error('Error closing LIFF window:', error);
    }
  };

  return {
    context,
    profile, 
    loading,
    error,
    shareMessage,
    openExternalWindow,
    closeWindow,
    isInLineClient: liff.isInClient?.() || false
  };
};