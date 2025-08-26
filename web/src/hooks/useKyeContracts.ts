'use client';

import React, { useCallback } from 'react';
import { useKaiaWalletSdk } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { getContractAddresses, DEFAULT_CHAIN_ID } from '@/utils/contracts/addresses';
import { KYE_FACTORY_ABI, KYE_GROUP_ABI, MOCK_USDT_ABI, Phase } from '@/utils/contracts/abis';
import * as Sentry from '@sentry/nextjs';
import type { 
  CircleParams, 
  CircleMetadata, 
  Circle, 
  MemberState, 
  RoundState,
  CreateCircleResult,
  JoinCircleResult,
  DepositInfo 
} from '@/utils/contracts/types';

// Utility functions
function hashLineGroupId(groupId: string): string {
  // Simple hash for demo - in production use proper crypto
  return `0x${Buffer.from(groupId).toString('hex').padStart(64, '0')}`;
}

function hashLineUserId(userId: string): string {
  // Simple hash for demo - in production use proper crypto  
  return `0x${Buffer.from(userId).toString('hex').padStart(64, '0')}`;
}

export const useKyeContracts = () => {
  const { 
    getAccount, 
    sendTransaction, 
    getBalance, 
    getErc20TokenBalance 
  } = useKaiaWalletSdk();

  const addresses = getContractAddresses(DEFAULT_CHAIN_ID);

  // Create contract call helper
  const callContract = useCallback(async (
    contractAddress: string,
    abi: any[],
    method: string,
    params: any[] = [],
    value?: string
  ) => {
    try {
      Sentry.addBreadcrumb({
        message: `Calling contract method: ${method}`,
        category: 'contract',
        level: 'info',
        data: { contractAddress, method, paramsCount: params.length }
      });

      const account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      // For view functions, we'll use a read-only call
      // For state-changing functions, we'll use sendTransaction
      const isViewFunction = abi.find(f => f.name === method)?.stateMutability === 'view';
      
      if (isViewFunction) {
        // This would typically be a read-only call to the RPC
        // For now, we'll mock the response
        console.log(`Read-only call to ${method} on ${contractAddress}`);
        return null; // Placeholder
      } else {
        // Encode function call
        const functionSignature = `${method}(${abi.find(f => f.name === method)?.inputs.map((i: any) => i.type).join(',')})`;
        
        const tx = [{
          from: account,
          to: contractAddress,
          value: value || '0',
          gas: '500000', // Conservative gas limit
          // data: encoded function call would go here
        }];

        const result = await sendTransaction(tx);
        return result;
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { 
          component: 'KyeContracts', 
          action: method,
          contract: contractAddress 
        },
        extra: { method, params }
      });
      throw error;
    }
  }, [getAccount, sendTransaction]);

  // Factory contract interactions
  const createCircle = useCallback(async (
    lineGroupId: string,
    depositAmountUsdt: string,
    penaltyBps: number = 500, // 5%
    roundDurationDays: number = 30
  ): Promise<CreateCircleResult> => {
    try {
      Sentry.addBreadcrumb({
        message: 'Creating new Kye circle',
        category: 'contract',
        level: 'info',
        data: { depositAmountUsdt, penaltyBps, roundDurationDays }
      });

      const account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const params: CircleParams = {
        usdtToken: addresses.MockUSDT,
        yieldAdapter: addresses.SavingsPocket,
        lineGroupIdHash: hashLineGroupId(lineGroupId),
        depositAmount: (parseFloat(depositAmountUsdt) * 1e6).toString(), // USDT has 6 decimals
        penaltyBps: (penaltyBps * 100).toString(), // Convert to basis points
        roundDuration: (roundDurationDays * 24 * 60 * 60).toString() // Convert to seconds
      };

      // Generate salt for CREATE2 deployment
      const salt = `0x${Math.random().toString(16).substr(2, 64)}`;

      const tx = [{
        from: account,
        to: addresses.KyeFactory,
        value: '0',
        gas: '2000000',
        // In real implementation, encode deployCircle call with params
      }];

      const result = await sendTransaction(tx);
      
      // In real implementation, extract circle address from transaction logs
      const mockCircleAddress = '0x' + Math.random().toString(16).substr(2, 40);

      Sentry.addBreadcrumb({
        message: 'Circle created successfully',
        category: 'contract', 
        level: 'info',
        data: { circleAddress: mockCircleAddress }
      });

      return {
        hash: result as string,
        success: true,
        circleAddress: mockCircleAddress
      };

    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'KyeContracts', action: 'createCircle' },
        extra: { lineGroupId, depositAmountUsdt }
      });

      return {
        hash: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [callContract, addresses, getAccount, sendTransaction]);

  // Get circles for a LINE group
  const getCirclesForGroup = useCallback(async (lineGroupId: string): Promise<string[]> => {
    try {
      const groupIdHash = hashLineGroupId(lineGroupId);
      
      // This would call getCirclesForGroup on the factory contract
      // For now, return mock data
      const mockCircles = [
        '0x' + Math.random().toString(16).substr(2, 40),
        '0x' + Math.random().toString(16).substr(2, 40)
      ];

      return mockCircles;
    } catch (error) {
      console.error('Error getting circles for group:', error);
      return [];
    }
  }, []);

  // Get circle metadata
  const getCircleMetadata = useCallback(async (circleAddress: string): Promise<CircleMetadata | null> => {
    try {
      // This would call getCircleMetadata on the factory contract
      // For now, return mock data
      const mockMetadata: CircleMetadata = {
        circleAddress,
        creator: '0x' + Math.random().toString(16).substr(2, 40),
        lineGroupIdHash: '0x' + Math.random().toString(16).substr(2, 64),
        createdAt: Date.now().toString(),
        depositAmount: '100000000', // 100 USDT with 6 decimals
        memberCount: 3,
        currentRound: 1,
        status: Phase.Active,
        totalValueLocked: '300000000' // 300 USDT
      };

      return mockMetadata;
    } catch (error) {
      console.error('Error getting circle metadata:', error);
      return null;
    }
  }, []);

  // Circle contract interactions
  const joinCircle = useCallback(async (
    circleAddress: string,
    lineUserId: string
  ): Promise<JoinCircleResult> => {
    try {
      Sentry.addBreadcrumb({
        message: 'Joining Kye circle',
        category: 'contract',
        level: 'info',
        data: { circleAddress }
      });

      const account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const userIdHash = hashLineUserId(lineUserId);

      const tx = [{
        from: account,
        to: circleAddress,
        value: '0',
        gas: '500000',
        // In real implementation, encode joinCircle call with userIdHash
      }];

      const result = await sendTransaction(tx);

      Sentry.addBreadcrumb({
        message: 'Successfully joined circle',
        category: 'contract',
        level: 'info'
      });

      return {
        hash: result as string,
        success: true,
        memberIndex: Math.floor(Math.random() * 5) // Mock member index
      };

    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'KyeContracts', action: 'joinCircle' },
        extra: { circleAddress }
      });

      return {
        hash: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [getAccount, sendTransaction]);

  // Deposit to current round
  const makeDeposit = useCallback(async (circleAddress: string) => {
    try {
      const account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      // First approve USDT spending
      const approveTx = [{
        from: account,
        to: addresses.MockUSDT,
        value: '0',
        gas: '100000',
        // Encode approve call
      }];

      await sendTransaction(approveTx);

      // Then make deposit
      const depositTx = [{
        from: account,
        to: circleAddress,
        value: '0',
        gas: '500000',
        // Encode deposit call
      }];

      const result = await sendTransaction(depositTx);

      return {
        hash: result as string,
        success: true
      };

    } catch (error) {
      return {
        hash: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [getAccount, sendTransaction, addresses]);

  // Get deposit info for current round
  const getDepositInfo = useCallback(async (
    circleAddress: string,
    userAddress: string
  ): Promise<DepositInfo> => {
    try {
      // This would call various view functions on the circle contract
      // For now, return mock data
      const mockDepositInfo: DepositInfo = {
        amount: '100000000', // 100 USDT
        penalty: '0', // No penalty if on time
        deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
        canDeposit: true
      };

      return mockDepositInfo;
    } catch (error) {
      return {
        amount: '0',
        penalty: '0',
        deadline: 0,
        canDeposit: false,
        reasonIfCannot: 'Error loading deposit info'
      };
    }
  }, []);

  // Get circle details with all information
  const getCircleDetails = useCallback(async (circleAddress: string): Promise<Circle | null> => {
    try {
      const metadata = await getCircleMetadata(circleAddress);
      if (!metadata) return null;

      // Mock data for demonstration
      const mockCircle: Circle = {
        address: circleAddress,
        metadata,
        members: [
          '0x' + Math.random().toString(16).substr(2, 40),
          '0x' + Math.random().toString(16).substr(2, 40),
          '0x' + Math.random().toString(16).substr(2, 40)
        ],
        currentRound: {
          deadline: (Date.now() + 7 * 24 * 60 * 60 * 1000).toString(),
          beneficiary: '0x' + Math.random().toString(16).substr(2, 40),
          totalDeposited: '200000000', // 200 USDT
          yieldAccrued: '1000000', // 1 USDT yield
          isComplete: false
        },
        remainingTime: 7 * 24 * 60 * 60 // 7 days in seconds
      };

      return mockCircle;
    } catch (error) {
      console.error('Error getting circle details:', error);
      return null;
    }
  }, [getCircleMetadata]);

  // Get user's USDT balance
  const getUsdtBalance = useCallback(async (): Promise<string> => {
    try {
      const account = await getAccount();
      if (!account) return '0';

      const balance = await getErc20TokenBalance(addresses.MockUSDT, account);
      return balance || '0';
    } catch (error) {
      console.error('Error getting USDT balance:', error);
      return '0';
    }
  }, [getAccount, getErc20TokenBalance, addresses]);

  // Mint USDT (for testing)
  const mintUsdt = useCallback(async (amount: string) => {
    try {
      const account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const tx = [{
        from: account,
        to: addresses.MockUSDT,
        value: '0',
        gas: '200000',
        // Encode mint call
      }];

      const result = await sendTransaction(tx);
      return result;
    } catch (error) {
      console.error('Error minting USDT:', error);
      throw error;
    }
  }, [getAccount, sendTransaction, addresses]);

  return {
    // Factory functions
    createCircle,
    getCirclesForGroup,
    getCircleMetadata,
    
    // Circle functions
    joinCircle,
    makeDeposit,
    getDepositInfo,
    getCircleDetails,
    
    // Token functions
    getUsdtBalance,
    mintUsdt,
    
    // Utility
    addresses,
    hashLineGroupId,
    hashLineUserId
  };
};