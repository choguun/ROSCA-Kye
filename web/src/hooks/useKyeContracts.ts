'use client';

import React, { useCallback } from 'react';
import { useKaiaWalletSdk, useKaiaWalletSdkStore } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { getContractAddresses, DEFAULT_CHAIN_ID } from '@/utils/contracts/addresses';
import { KYE_FACTORY_ABI, KYE_GROUP_ABI, MOCK_USDT_ABI, Phase } from '@/utils/contracts/abis';
import { ethers } from 'ethers';
import * as Sentry from '@sentry/nextjs';
import { 
  validateTransactionFormat, 
  debugContractCall, 
  logTransactionAttempt, 
  decodeError32603 
} from '@/utils/debug-transaction';
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
    getErc20TokenBalance,
    validateNetwork: validateWalletNetwork
  } = useKaiaWalletSdk();
  const { sdk } = useKaiaWalletSdkStore();

  const addresses = getContractAddresses(DEFAULT_CHAIN_ID);
  
  console.log('Using contract addresses for chain', DEFAULT_CHAIN_ID, ':', addresses);

  // Use the validateNetwork from wallet SDK (renamed to validateWalletNetwork above)

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
        
        const tx = {
          from: account,
          to: contractAddress,
          value: value || '0',
          gas: '500000', // Conservative gas limit
          // data: encoded function call would go here
        };

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

      const tx = {
        from: account,
        to: addresses.KyeFactory,
        value: '0',
        gas: '2000000',
        // In real implementation, encode deployCircle call with params
      };

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

      const tx = {
        from: account,
        to: circleAddress,
        value: '0',
        gas: '500000',
        // In real implementation, encode joinCircle call with userIdHash
      };

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
      const approveTx = {
        from: account,
        to: addresses.MockUSDT,
        value: '0',
        gas: '100000',
        // Encode approve call
      };

      await sendTransaction(approveTx);

      // Then make deposit
      const depositTx = {
        from: account,
        to: circleAddress,
        value: '0',
        gas: '500000',
        // Encode deposit call
      };

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

  // Add network detection helper
  const detectActualNetwork = useCallback(async () => {
    try {
      const account = await getAccount();
      if (!account) return null;
      
      // Try to detect network by making RPC calls
      // Since we don't have direct chainId access, we'll try contract interactions to detect network
      console.log('Attempting network detection through contract calls...');
      
      // Try each network's USDT contract
      const networks = [
        { chainId: 1001, name: 'Kaia Kairos Testnet', usdtAddress: '0x8f198cd718aa1bf2b338ddba78736e91cd254da6' },
        { chainId: 31337, name: 'Local Anvil', usdtAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3' }
      ];
      
      for (const network of networks) {
        try {
          console.log(`Testing network: ${network.name} (${network.chainId})`);
          await getErc20TokenBalance(network.usdtAddress, account);
          console.log(`✅ Successfully connected to ${network.name}`);
          return network;
        } catch (error) {
          console.log(`❌ ${network.name} not accessible:`, error.message);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Network detection failed:', error);
      return null;
    }
  }, [getAccount, getErc20TokenBalance]);

  // Enhanced JSON-RPC error parser
  const parseJsonRpcError = (error: any): string => {
    console.log('Parsing JSON-RPC error:', error);
    
    // Handle serialized errors from Sentry
    if (error && typeof error === 'object') {
      if (error.code === -32603) {
        return 'JSON-RPC Internal Error (-32603): This usually means you\'re connected to the wrong network or the contract doesn\'t exist.';
      }
      if (error.code === -32602) {
        return 'Invalid RPC Parameters (-32602): The transaction parameters are invalid.';
      }
      if (error.code === -32000) {
        return 'RPC Error (-32000): Transaction would fail or insufficient funds.';
      }
      if (error.message) {
        return error.message;
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'Unknown error occurred';
  };

  // Mint USDT (for testing) - Enhanced with network detection and better error handling
  const mintUsdt = useCallback(async (amount: string) => {
    try {
      console.log('=== MINT USDT START ===');
      console.log('Amount requested:', amount);
      console.log('Available addresses:', addresses);
      console.log('Expected Chain ID:', DEFAULT_CHAIN_ID);
      
      Sentry.addBreadcrumb({
        message: 'Starting USDT mint with network detection',
        category: 'contract',
        level: 'info',
        data: { amount, expectedChainId: DEFAULT_CHAIN_ID }
      });

      const account = await getAccount();
      console.log('Account retrieved:', account);
      
      if (!account) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }

      // Step 1: Detect actual network
      console.log('🔍 Detecting actual network...');
      const detectedNetwork = await detectActualNetwork();
      
      if (!detectedNetwork) {
        throw new Error(
          'Unable to detect network. Please ensure your wallet is connected to either:\n' +
          '• Kaia Kairos Testnet (Chain ID: 1001)\n' +
          '• Local Anvil (Chain ID: 31337)\n\n' +
          'Current configured network: Kaia Kairos Testnet'
        );
      }
      
      console.log(`✅ Detected network: ${detectedNetwork.name} (Chain ID: ${detectedNetwork.chainId})`);
      
      // Use detected network's contract address
      const usdtAddress = detectedNetwork.usdtAddress;
      console.log('Using USDT contract address:', usdtAddress);
      
      // Step 2: Validate contract exists and is accessible
      try {
        console.log('🔍 Verifying contract accessibility...');
        const balance = await getErc20TokenBalance(usdtAddress, account);
        console.log(`✅ Contract accessible. Current balance: ${balance}`);
      } catch (verifyError) {
        console.error('❌ Contract verification failed:', verifyError);
        throw new Error(
          `USDT contract is not accessible on ${detectedNetwork.name}.\n` +
          `Contract address: ${usdtAddress}\n` +
          `Please ensure the contract is deployed or try a different network.`
        );
      }
      
      // Step 3: Create and validate transaction data
      console.log('🔧 Creating transaction data...');
      const usdtInterface = new ethers.Interface(MOCK_USDT_ABI);
      const mintData = usdtInterface.encodeFunctionData('mint', [account, amount]);
      console.log('✅ Transaction data encoded:', mintData);

      // Step 4: Prepare transaction with appropriate gas (SDK expects hex values)
      const gasLimit = detectedNetwork.chainId === 31337 ? 500000 : 800000; // More gas for testnet
      const gasLimitHex = '0x' + gasLimit.toString(16);
      
      const tx = {
        from: account,
        to: usdtAddress,
        value: '0x0', // SDK expects hex format
        gas: gasLimitHex, // SDK expects hex format
        data: mintData
      };

      console.log('📤 Sending transaction...');
      console.log('Transaction details:');
      console.log('- Network:', detectedNetwork.name);
      console.log('- Chain ID:', detectedNetwork.chainId);
      console.log('- From:', account);
      console.log('- To:', usdtAddress);  
      console.log('- Gas (decimal):', gasLimit);
      console.log('- Gas (hex):', gasLimitHex);
      console.log('- Value:', '0x0');
      console.log('- Data:', mintData);
      
      // Step 5: Comprehensive transaction debugging
      console.log('🔍 Running comprehensive transaction debug...');
      
      // Debug contract accessibility
      if (sdk) {
        const walletProvider = sdk.getWalletProvider();
        const contractDebug = await debugContractCall(usdtAddress, walletProvider, account);
        console.log('Contract debug results:', contractDebug);
        
        if (!contractDebug.success) {
          throw new Error(`Contract validation failed: ${JSON.stringify(contractDebug)}`);
        }
      } else {
        console.warn('⚠️  SDK not available, skipping contract debug');
      }
      
      // Validate transaction format
      const validationResult = validateTransactionFormat(tx);
      if (!validationResult.isValid) {
        console.error('❌ Transaction format validation failed:', validationResult.errors);
        throw new Error(`Transaction format errors: ${validationResult.errors.join(', ')}`);
      }
      
      // Log transaction attempt for debugging
      logTransactionAttempt(tx);
      
      console.log('🚀 All validations passed, sending transaction...');
      const result = await sendTransaction(tx);
      console.log('✅ Transaction sent successfully:', result);
      
      Sentry.addBreadcrumb({
        message: 'USDT minted successfully',
        category: 'contract',
        level: 'info',
        data: { 
          transactionHash: result,
          network: detectedNetwork.name,
          chainId: detectedNetwork.chainId
        }
      });

      console.log('=== MINT USDT SUCCESS ===');
      return result;
    } catch (error) {
      console.error('=== MINT USDT ERROR ===');
      console.error('Raw error:', error);
      
      // Enhanced error analysis for -32603
      if (error?.code === -32603) {
        console.error('🔍 DETAILED -32603 ERROR ANALYSIS:');
        const errorAnalysis = decodeError32603(error);
        console.error('Error analysis:', errorAnalysis);
        
        // Additional debugging for -32603
        console.error('🔧 DEBUG RECOMMENDATIONS:');
        console.error('1. Check if wallet is connected to Kaia Kairos Testnet (Chain ID: 1001)');
        console.error('2. Verify contract address is deployed:', usdtAddress);
        console.error('3. Ensure wallet has KAIA for gas fees');
        console.error('4. Check transaction format is valid (all hex values)');
        console.error('5. Try reducing gas limit or increasing it');
        console.error('');
        console.error('Current transaction that failed:');
        console.error(JSON.stringify(tx, null, 2));
      }
      
      // Enhanced JSON-RPC error handling
      const parsedError = parseJsonRpcError(error);
      console.error('Parsed error:', parsedError);
      
      let userFriendlyMessage = 'Failed to mint USDT';
      
      // Handle specific error patterns
      if (parsedError.includes('-32603') || parsedError.includes('Internal Error')) {
        userFriendlyMessage = 
          '❌ Network Error: Your wallet appears to be connected to the wrong network.\n\n' +
          '🔧 To fix this:\n' +
          '1. Switch your wallet to "Kaia Kairos Testnet"\n' +
          '2. Or use a local development network\n\n' +
          '📋 Kaia Kairos Testnet Details:\n' +
          '• Chain ID: 1001\n' +
          '• RPC: https://public-en-kairos.node.kaia.io\n' +
          '• Explorer: https://kairos.kaiascan.io';
      } else if (parsedError.includes('user rejected') || parsedError.includes('denied')) {
        userFriendlyMessage = 'Transaction was cancelled by user';
      } else if (parsedError.includes('insufficient')) {
        userFriendlyMessage = 'Insufficient funds or gas. Please add more KAIA for gas fees.';
      } else if (parsedError.includes('contract') || parsedError.includes('address')) {
        userFriendlyMessage = 'Contract not found on this network. Please switch to Kaia Kairos Testnet.';
      } else {
        userFriendlyMessage = `Transaction failed: ${parsedError}`;
      }
      
      Sentry.captureException(error, {
        tags: { component: 'KyeContracts', action: 'mintUsdt' },
        extra: { 
          amount,
          addresses: addresses,
          expectedChainId: DEFAULT_CHAIN_ID,
          parsedError,
          errorDetails: {
            message: error instanceof Error ? error.message : parsedError,
            name: error instanceof Error ? error.name : 'JSONRPCError',
            code: error?.code || 'unknown',
            data: error?.data || null
          }
        }
      });
      
      // Throw enhanced error with clear messaging
      const enhancedError = new Error(userFriendlyMessage);
      enhancedError.name = 'NetworkMismatchError';
      throw enhancedError;
    }
  }, [getAccount, sendTransaction, addresses, detectActualNetwork, getErc20TokenBalance]);

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