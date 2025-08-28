'use client';

import React, { useCallback } from 'react';
import { useKaiaWalletSdk, useKaiaWalletSdkStore } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { getContractAddresses, DEFAULT_CHAIN_ID, logAddressConfiguration } from '@/utils/contracts/addresses';
import { KYE_FACTORY_ABI, KYE_GROUP_ABI, MOCK_USDT_ABI, SAVINGS_POCKET_ABI, Phase } from '@/utils/contracts/abis';
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
import { KYEGROUP_BYTECODE } from '@/utils/contracts/bytecode';

// Utility functions
function hashLineGroupId(groupId: string): string {
  // Create proper 32-byte hash using keccak256
  return ethers.keccak256(ethers.toUtf8Bytes(groupId));
}

function hashLineUserId(userId: string): string {
  // Create proper 32-byte hash using keccak256
  return ethers.keccak256(ethers.toUtf8Bytes(userId));
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
  
  // Log configuration source and addresses
  logAddressConfiguration();

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
    circleName: string,
    depositAmountUsdt: string,
    penaltyBps: number = 500, // 5%
    roundDurationDays: number = 30,
    maxMembers: number = 5
  ): Promise<CreateCircleResult> => {
    let account: string | null = null;
    
    try {
      console.log('=== CREATE CIRCLE START ===');
      console.log('Circle name:', circleName);
      console.log('Deposit amount (USDT):', depositAmountUsdt);
      console.log('Available addresses:', addresses);

      Sentry.addBreadcrumb({
        message: 'Creating new Kye circle',
        category: 'contract',
        level: 'info',
        data: { circleName, depositAmountUsdt, penaltyBps, roundDurationDays, maxMembers }
      });

      account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      // Use circle name as LINE group ID for demo purposes
      const lineGroupId = `group_${circleName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      console.log('Generated LINE group ID:', lineGroupId);

      // Convert USDT amount properly (6 decimals)
      const depositAmountWei = ethers.parseUnits(depositAmountUsdt, 6);
      console.log('Deposit amount conversion:', depositAmountUsdt, '→', depositAmountWei.toString());

      // Prepare CircleParams matching the smart contract structure  
      const params = {
        usdtToken: addresses.MockUSDT,
        yieldAdapter: addresses.SavingsPocket,
        lineGroupIdHash: hashLineGroupId(lineGroupId),
        depositAmount: depositAmountWei, // Properly converted BigNumber for USDT (6 decimals)
        penaltyBps: BigInt(penaltyBps), // Convert to BigInt for encoding
        roundDuration: BigInt(roundDurationDays * 24 * 60 * 60) // Convert to BigInt for encoding
      };

      console.log('Circle params:', params);

      // Generate deterministic salt for CREATE2 deployment
      const salt = ethers.keccak256(ethers.toUtf8Bytes(`${circleName}_${Date.now()}`));
      console.log('Generated salt:', salt);

      // Encode the deployCircle function call using ethers Interface
      const factoryInterface = new ethers.Interface(KYE_FACTORY_ABI);
      const deployCircleData = factoryInterface.encodeFunctionData('deployCircle', [
        salt,
        {
          usdtToken: params.usdtToken,
          yieldAdapter: params.yieldAdapter,
          lineGroupIdHash: params.lineGroupIdHash,
          depositAmount: params.depositAmount,
          penaltyBps: params.penaltyBps,
          roundDuration: params.roundDuration,
          maxMembers: maxMembers // This will be properly encoded as uint8
        }
      ]);

      console.log('✅ Encoded deployCircle call:', deployCircleData);

      // Prepare transaction with proper gas
      const gasLimit = 3000000; // High gas limit for contract deployment
      const gasLimitHex = '0x' + gasLimit.toString(16);

      const tx = {
        from: account,
        to: addresses.KyeFactory,
        value: '0x0',
        gas: gasLimitHex,
        data: deployCircleData
      };

      console.log('📤 Sending deployCircle transaction...');
      console.log('Transaction details:');
      console.log('- From:', account);
      console.log('- To (Factory):', addresses.KyeFactory);
      console.log('- Gas (decimal):', gasLimit);
      console.log('- Gas (hex):', gasLimitHex);
      console.log('- Data:', deployCircleData);

      // Validate transaction format
      const validationResult = validateTransactionFormat(tx);
      if (!validationResult.isValid) {
        console.error('❌ Transaction format validation failed:', validationResult.errors);
        throw new Error(`Transaction format errors: ${validationResult.errors.join(', ')}`);
      }

      console.log('🚀 All validations passed, deploying circle...');
      const result = await sendTransaction(tx);
      console.log('✅ Circle deployment transaction sent:', result);

      Sentry.addBreadcrumb({
        message: 'Circle created successfully',
        category: 'contract', 
        level: 'info',
        data: { transactionHash: result, circleName }
      });

      // Get the actual deployed contract address from the transaction receipt
      console.log('🔍 Getting actual deployed contract address...');
      const actualAddress = await getContractAddressFromTx(result as string);
      
      if (!actualAddress) {
        console.error('❌ Could not determine contract address from transaction');
        throw new Error('Failed to get deployed contract address');
      }
      
      console.log('✅ Actual deployed contract address:', actualAddress);
      console.log('=== CREATE CIRCLE SUCCESS ===');

      return {
        hash: result as string,
        success: true,
        circleAddress: actualAddress, // Use actual deployed address!
        salt: salt // Include salt for future reference
      };

    } catch (error) {
      console.error('=== CREATE CIRCLE ERROR ===');
      console.error('Raw error:', error);

      let userFriendlyMessage = 'Failed to create circle';
      
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('Network')) {
          userFriendlyMessage = `Network Error: ${error.message}\n\nTry switching to Kaia Kairos Testnet manually in your wallet.`;
        } else if (error?.code === 4001) {
          userFriendlyMessage = 'Transaction rejected by user';
        } else if (error?.code === -32603) {
          userFriendlyMessage = `Contract Error: ${error.message}\n\nCheck network and contract addresses.`;
        } else {
          userFriendlyMessage = `Error: ${error.message}`;
        }
      }

      Sentry.captureException(error, {
        tags: { component: 'KyeContracts', action: 'createCircle' },
        extra: { circleName, depositAmountUsdt, addresses }
      });

      return {
        hash: '',
        success: false,
        error: userFriendlyMessage
      };
    }
  }, [addresses, getAccount, sendTransaction]);

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
    inviteCode: string // For now, treating invite code as circle address
  ): Promise<JoinCircleResult> => {
    let account: string | null = null;
    
    try {
      console.log('=== JOIN CIRCLE START ===');
      console.log('Invite code (circle address):', inviteCode);

      Sentry.addBreadcrumb({
        message: 'Joining Kye circle',
        category: 'contract',
        level: 'info',
        data: { inviteCode }
      });

      account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      // Step 1: Check if contract exists and is in correct phase for joining
      console.log('🔍 Step 1: Verifying contract and phase...');
      if (!sdk) {
        throw new Error('SDK not available');
      }
      
      const walletProvider = sdk.getWalletProvider();
      const provider = new ethers.BrowserProvider(walletProvider);
      
      // Check contract exists
      const contractCode = await provider.getCode(inviteCode);
      if (contractCode === '0x') {
        throw new Error(`No contract found at address ${inviteCode}`);
      }
      console.log('✅ Contract exists');
      
      const circleContract = new ethers.Contract(inviteCode, KYE_GROUP_ABI, provider);
      
      // Check current phase
      const currentPhase = await circleContract.currentPhase();
      console.log('Current contract phase:', currentPhase.toString());
      
      // Check member count and max members
      const [memberCount, maxMembers] = await Promise.all([
        circleContract.memberCount(),
        circleContract.maxMembers()
      ]);
      console.log('Current members:', memberCount.toString(), '/', maxMembers.toString());
      
      if (memberCount >= maxMembers) {
        throw new Error('Circle is full - cannot join');
      }
      
      // Check if user is already a member
      const totalMembers = Number(memberCount);
      for (let i = 0; i < totalMembers; i++) {
        const memberAddress = await circleContract.members(i);
        if (memberAddress.toLowerCase() === account.toLowerCase()) {
          throw new Error('You are already a member of this circle');
        }
      }
      
      // For demo, use account address as LINE user ID
      const lineUserId = `user_${account.toLowerCase()}`;
      const userIdHash = hashLineUserId(lineUserId);
      console.log('Generated LINE user ID hash:', userIdHash);

      // Encode the join function call
      const groupInterface = new ethers.Interface(KYE_GROUP_ABI);
      const joinCircleData = groupInterface.encodeFunctionData('join', [userIdHash]);

      console.log('✅ Encoded joinCircle call:', joinCircleData);

      // Step 2: Prepare transaction with higher gas limit
      console.log('📤 Step 2: Preparing join transaction...');
      const gasLimit = 1000000; // Increased gas limit
      const gasLimitHex = '0x' + gasLimit.toString(16);

      const tx = {
        from: account,
        to: inviteCode, // Using invite code as circle address for demo
        value: '0x0',
        gas: gasLimitHex,
        data: joinCircleData
      };
      
      console.log('Transaction prepared:');
      console.log('- To:', tx.to);
      console.log('- From:', tx.from);
      console.log('- Gas limit:', gasLimit);
      console.log('- Data:', tx.data);

      console.log('📤 Sending joinCircle transaction...');
      console.log('Transaction details:');
      console.log('- From:', account);
      console.log('- To (Circle):', inviteCode);
      console.log('- Gas (hex):', gasLimitHex);
      console.log('- Data:', joinCircleData);

      // Validate transaction format
      const validationResult = validateTransactionFormat(tx);
      if (!validationResult.isValid) {
        console.error('❌ Transaction format validation failed:', validationResult.errors);
        throw new Error(`Transaction format errors: ${validationResult.errors.join(', ')}`);
      }

      // Step 3: Test transaction before sending (dry run)
      console.log('🧪 Step 3: Testing transaction (dry run)...');
      try {
        if (sdk) {
          const walletProvider = sdk.getWalletProvider();
          const provider = new ethers.BrowserProvider(walletProvider);
          
          // Try to call the contract method directly first to see if it would succeed
          const testResult = await provider.call({
            to: tx.to,
            data: tx.data,
            from: tx.from
          });
          console.log('✅ Dry run successful, transaction should work');
        }
      } catch (dryRunError) {
        console.warn('⚠️ Dry run failed:', dryRunError);
        console.warn('This transaction will likely fail, but proceeding anyway...');
        // Don't throw here, just warn
      }

      console.log('🚀 All validations passed, joining circle...');
      const result = await sendTransaction(tx);
      console.log('✅ Circle join transaction sent:', result);

      // Step 2: Wait for transaction to be mined and verify membership with retries
      console.log('⏳ Waiting for transaction to be processed...');
      
      let isMember = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!isMember && attempts < maxAttempts) {
        attempts++;
        const waitTime = attempts * 3000; // 3s, 6s, 9s
        console.log(`🔄 Attempt ${attempts}/${maxAttempts}: Waiting ${waitTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        console.log(`🔍 Verifying membership (attempt ${attempts})...`);
        if (!sdk) {
          console.warn('⚠️ SDK not available, skipping membership verification');
          break;
        }
        
        try {
          const walletProvider = sdk.getWalletProvider();
          const provider = new ethers.BrowserProvider(walletProvider);
          const circleContract = new ethers.Contract(inviteCode, KYE_GROUP_ABI, provider);
          
          const memberCount = await circleContract.memberCount();
          console.log(`Member count after join (attempt ${attempts}):`, memberCount.toString());
          
          // Check if user is now in the members list
          let memberIndex = -1;
          for (let i = 0; i < memberCount; i++) {
            const memberAddress = await circleContract.members(i);
            console.log(`Member ${i}:`, memberAddress);
            if (memberAddress.toLowerCase() === account.toLowerCase()) {
              isMember = true;
              memberIndex = i;
              console.log(`✅ User successfully joined as member #${i} on attempt ${attempts}`);
              break;
            }
          }
          
          if (!isMember && attempts < maxAttempts) {
            console.warn(`⚠️ User not found in member list on attempt ${attempts}, retrying...`);
          } else if (!isMember) {
            console.warn('⚠️ FINAL WARNING: Join transaction succeeded but user not found in member list after all attempts');
            console.warn('The transaction may have failed silently or there may be a contract issue');
          }
          
        } catch (verifyError) {
          console.warn(`⚠️ Could not verify membership on attempt ${attempts}:`, verifyError);
          if (attempts === maxAttempts) {
            console.error('❌ Failed to verify membership after all attempts');
          }
        }
      }

      Sentry.addBreadcrumb({
        message: 'Successfully joined circle',
        category: 'contract',
        level: 'info',
        data: { transactionHash: result }
      });

      console.log('=== JOIN CIRCLE SUCCESS ===');

      return {
        hash: result as string,
        success: true,
        memberIndex: 0 // Will be determined from transaction receipt
      };

    } catch (error) {
      console.error('=== JOIN CIRCLE ERROR ===');
      console.error('Raw error:', error);
      console.error('Error type:', typeof error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);

      let userFriendlyMessage = 'Failed to join circle';
      
      if (error instanceof Error) {
        // Handle specific error cases
        if (error.message.includes('missing revert data')) {
          userFriendlyMessage = `Join Transaction Failed: The contract rejected your join request.\n\nPossible reasons:\n• Circle is full\n• You're already a member\n• Contract is in wrong phase\n• Insufficient gas\n\nTry increasing gas limit or check contract status.`;
        } else if (error.message.includes('execution reverted')) {
          userFriendlyMessage = `Contract Execution Failed: ${error.message}\n\nThe smart contract prevented this transaction.`;
        } else if (error.message.includes('insufficient funds')) {
          userFriendlyMessage = 'Insufficient funds for gas fees. Please add more KAIA to your wallet.';
        } else if (error.message.includes('network') || error.message.includes('Network')) {
          userFriendlyMessage = `Network Error: ${error.message}\n\nTry switching to Kaia Kairos Testnet manually in your wallet.`;
        } else if (error?.code === 4001) {
          userFriendlyMessage = 'Transaction rejected by user';
        } else if (error?.code === -32603) {
          userFriendlyMessage = `RPC Error (-32603): ${error.message}\n\nThis usually indicates a network or contract issue.`;
        } else if (error?.code === -32000) {
          userFriendlyMessage = `Transaction Failed (-32000): ${error.message}\n\nThe transaction would fail execution.`;
        } else {
          userFriendlyMessage = `Error: ${error.message}`;
        }
      } else {
        // Handle non-Error objects
        userFriendlyMessage = `Unknown error occurred: ${JSON.stringify(error)}`;
      }

      Sentry.captureException(error, {
        tags: { component: 'KyeContracts', action: 'joinCircle' },
        extra: { inviteCode, account }
      });

      return {
        hash: '',
        success: false,
        error: userFriendlyMessage
      };
    }
  }, [getAccount, sendTransaction, sdk]);

  // Deposit to current round
  const makeDeposit = useCallback(async (circleAddress: string) => {
    let account: string | null = null;
    
    try {
      console.log('=== MAKE DEPOSIT START ===');
      console.log('Circle address:', circleAddress);
      
      Sentry.addBreadcrumb({
        message: 'Making deposit to circle',
        category: 'contract',
        level: 'info',
        data: { circleAddress }
      });

      account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }
      console.log('Account:', account);

      // Step 0: First mint some USDT for testing if balance is zero
      try {
        console.log('🔍 Checking USDT balance first...');
        const currentBalanceRaw = await getErc20TokenBalance(addresses.MockUSDT, account);
        console.log('Current USDT balance (raw):', currentBalanceRaw);
        
        let currentBalanceUsdt = 0;
        if (currentBalanceRaw && currentBalanceRaw.startsWith('0x')) {
          // Hex format
          const balanceWei = BigInt(currentBalanceRaw);
          currentBalanceUsdt = Number(balanceWei) / 1e6;
        } else if (currentBalanceRaw) {
          // Decimal format
          currentBalanceUsdt = parseFloat(currentBalanceRaw);
        }
        
        console.log('Current USDT balance (USDT):', currentBalanceUsdt);
        
        if (currentBalanceUsdt < 100) {
          console.log('💰 Minting test USDT (1000 USDT) for deposit...');
          const mintAmount = ethers.parseUnits('1000', 6).toString(); // 1000 USDT
          
          const usdtInterface = new ethers.Interface(MOCK_USDT_ABI);
          const mintData = usdtInterface.encodeFunctionData('mint', [account, mintAmount]);
          
          const mintTx = {
            from: account,
            to: addresses.MockUSDT,
            value: '0x0',
            gas: '0xC3500', // 800000
            data: mintData
          };
          
          console.log('Minting USDT transaction:', mintTx);
          const mintResult = await sendTransaction(mintTx);
          console.log('✅ USDT minted successfully:', mintResult);
        } else {
          console.log('✅ User has sufficient USDT balance:', currentBalanceUsdt);
        }
      } catch (mintError) {
        console.warn('⚠️ Could not mint test USDT:', mintError);
        // Continue anyway, user might have USDT already
      }

      // Get the deposit amount from the circle contract first
      if (!sdk) {
        throw new Error('SDK not available');
      }

      const walletProvider = sdk.getWalletProvider();
      const provider = new ethers.BrowserProvider(walletProvider);
      const circleContract = new ethers.Contract(circleAddress, KYE_GROUP_ABI, provider);
      
      console.log('🔍 Getting deposit amount from circle contract...');
      let depositAmount;
      try {
        const depositAmountRaw = await circleContract.depositAmount();
        console.log('Raw deposit amount:', depositAmountRaw);
        console.log('Raw deposit amount type:', typeof depositAmountRaw);
        
        // Handle the raw value more carefully to avoid FixedNumber issues
        if (typeof depositAmountRaw === 'bigint') {
          depositAmount = depositAmountRaw;
        } else if (typeof depositAmountRaw === 'string') {
          depositAmount = BigInt(depositAmountRaw);
        } else if (depositAmountRaw && depositAmountRaw.toString) {
          depositAmount = BigInt(depositAmountRaw.toString());
        } else {
          console.warn('Unexpected deposit amount format, using fallback');
          depositAmount = BigInt('1000000000'); // 1000 USDT as fallback
        }
        
        console.log('Processed deposit amount:', depositAmount.toString(), 'wei');
        console.log('Deposit amount in USDT:', Number(depositAmount) / 1e6);
      } catch (depositError) {
        console.error('Error getting deposit amount from contract:', depositError);
        console.log('Using fallback deposit amount: 1000 USDT');
        depositAmount = BigInt('1000000000'); // 1000 USDT as fallback
      }
      
      // Check if user has enough USDT balance
      const usdtBalanceRaw = await getErc20TokenBalance(addresses.MockUSDT, account);
      console.log('Raw USDT balance from wallet:', usdtBalanceRaw);
      
      let balanceWei;
      let usdtBalance;
      try {
        // Handle the balance parsing safely - could be hex string or decimal string
        if (usdtBalanceRaw && usdtBalanceRaw.startsWith('0x')) {
          // It's a hex string (like 0x000000000000000000000000000000000000000000000000000000003b9aca00)
          console.log('Balance is hex format, converting...');
          balanceWei = BigInt(usdtBalanceRaw);
          usdtBalance = (Number(balanceWei) / 1e6).toString(); // Convert to USDT decimal
        } else {
          // It's a decimal string
          console.log('Balance is decimal format, parsing...');
          const balanceStr = usdtBalanceRaw || '0';
          usdtBalance = balanceStr;
          balanceWei = ethers.parseUnits(balanceStr, 6);
        }
        
        console.log('Processed balance (wei):', balanceWei.toString());
        console.log('Processed balance (USDT):', usdtBalance);
        
      } catch (balanceError) {
        console.error('Error parsing USDT balance:', usdtBalanceRaw, balanceError);
        throw new Error(`Invalid USDT balance format: ${usdtBalanceRaw}. Expected decimal string or hex value.`);
      }
      
      console.log('User USDT balance:', usdtBalance, 'USDT');
      console.log('Required deposit (USDT):', Number(depositAmount) / 1e6);
      console.log('Balance in wei:', balanceWei.toString());
      console.log('Required in wei:', depositAmount.toString());
      
      if (balanceWei < depositAmount) {
        const requiredUsdt = Number(depositAmount) / 1e6;
        throw new Error(`Insufficient USDT balance. Required: ${requiredUsdt} USDT, Available: ${usdtBalance} USDT`);
      }

      // Step 0.5: Verify circle contract exists and get actual deposit amount
      console.log('🔍 Step 0.5: Verifying circle contract exists...');
      
      // Check if contract exists at address
      const contractCode = await provider.getCode(circleAddress);
      console.log('Contract code at address:', contractCode);
      
      if (contractCode === '0x') {
        throw new Error(`No contract found at address ${circleAddress}. The circle might not be deployed yet.`);
      }
      
      console.log('✅ Circle contract exists');
      
      // Step 0.7: Verify user is a member of the circle
      console.log('🔍 Step 0.7: Verifying user is a member of the circle...');
      
      try {
        const memberCount = await circleContract.memberCount();
        console.log('Circle member count:', memberCount.toString());
        
        // Check if user is in the members list
        let isMember = false;
        for (let i = 0; i < memberCount; i++) {
          const memberAddress = await circleContract.members(i);
          console.log(`Member ${i}:`, memberAddress);
          if (memberAddress.toLowerCase() === account.toLowerCase()) {
            isMember = true;
            console.log(`✅ User is member #${i}`);
            break;
          }
        }
        
        if (!isMember) {
          throw new Error(`You are not a member of this circle. Please join the circle first before making a deposit.`);
        }
        
        // Also check member state
        const memberState = await circleContract.memberStates(account);
        console.log('Member state:', {
          wallet: memberState.wallet,
          lineUserIdHash: memberState.lineUserIdHash,
          totalDeposited: memberState.totalDeposited.toString(),
          hasDefaulted: memberState.hasDefaulted
        });
        
      } catch (memberError) {
        console.error('Error checking membership:', memberError);
        throw new Error(`Could not verify circle membership: ${memberError.message}`);
      }

      // Step 1: Approve USDT spending
      console.log('📤 Step 1: Approving USDT spending...');
      console.log('- Approving spender (circle):', circleAddress);
      console.log('- Approving amount (wei):', depositAmount.toString());
      console.log('- Approving amount (USDT):', Number(depositAmount) / 1e6);
      
      const usdtInterface = new ethers.Interface(MOCK_USDT_ABI);
      const approveData = usdtInterface.encodeFunctionData('approve', [circleAddress, depositAmount.toString()]);
      
      const approveTx = {
        from: account,
        to: addresses.MockUSDT,
        value: '0x0',
        gas: '0x186A0', // 100000
        data: approveData
      };

      console.log('Approval transaction:', approveTx);
      const approveResult = await sendTransaction(approveTx);
      console.log('✅ USDT approval successful:', approveResult);
      
      // Step 1.5: Verify approval worked
      console.log('🔍 Step 1.5: Verifying approval...');
      const usdtContract = new ethers.Contract(addresses.MockUSDT, MOCK_USDT_ABI, provider);
      const allowance = await usdtContract.allowance(account, circleAddress);
      console.log('Current allowance:', allowance.toString(), 'wei');
      console.log('Current allowance (USDT):', Number(allowance) / 1e6);
      
      if (allowance < depositAmount) {
        throw new Error(`Approval failed! Required: ${Number(depositAmount) / 1e6} USDT, Approved: ${Number(allowance) / 1e6} USDT`);
      }
      console.log('✅ Approval verified successfully');

      // Step 2: Make deposit to circle
      console.log('📤 Step 2: Making deposit to circle...');
      console.log('- Circle contract address:', circleAddress);
      console.log('- User account:', account);
      
      const circleInterface = new ethers.Interface(KYE_GROUP_ABI);
      const depositData = circleInterface.encodeFunctionData('deposit', []);

      const depositTx = {
        from: account,
        to: circleAddress,
        value: '0x0',
        gas: '0x7A120', // 500000
        data: depositData
      };

      console.log('Deposit transaction:', depositTx);
      const result = await sendTransaction(depositTx);
      console.log('✅ Deposit transaction sent:', result);
      
      // Step 2.5: Verify the deposit actually happened by checking balances
      console.log('🔍 Step 2.5: Verifying deposit was processed...');
      
      // Wait a moment for transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        // Check USDT balance after deposit
        const newUsdtBalanceRaw = await getErc20TokenBalance(addresses.MockUSDT, account);
        let newUsdtBalance;
        
        if (newUsdtBalanceRaw && newUsdtBalanceRaw.startsWith('0x')) {
          const balanceWei = BigInt(newUsdtBalanceRaw);
          newUsdtBalance = Number(balanceWei) / 1e6;
        } else {
          newUsdtBalance = parseFloat(newUsdtBalanceRaw || '0');
        }
        
        console.log('USDT balance after deposit:', newUsdtBalance, 'USDT');
        console.log('Expected reduction:', Number(depositAmount) / 1e6, 'USDT');
        
        // Check if balance actually decreased
        const originalBalance = parseFloat(usdtBalance);
        const expectedBalance = originalBalance - (Number(depositAmount) / 1e6);
        console.log('Original balance:', originalBalance, 'USDT');
        console.log('Expected new balance:', expectedBalance, 'USDT');
        console.log('Actual new balance:', newUsdtBalance, 'USDT');
        
        if (Math.abs(newUsdtBalance - expectedBalance) > 0.01) {
          console.warn('⚠️ WARNING: USDT balance did not decrease as expected!');
          console.warn('This might indicate the deposit transaction failed silently.');
        } else {
          console.log('✅ USDT balance decreased correctly - deposit was successful');
        }
        
      } catch (verificationError) {
        console.warn('⚠️ Could not verify deposit success:', verificationError);
      }

      Sentry.addBreadcrumb({
        message: 'Deposit completed successfully',
        category: 'contract',
        level: 'info',
        data: { transactionHash: result }
      });

      // Wait a bit for the transaction to be mined and the balance to update
      console.log('⏳ Waiting 3 seconds for transaction to be processed...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('=== MAKE DEPOSIT SUCCESS ===');
      return {
        hash: result as string,
        success: true
      };

    } catch (error) {
      console.error('=== MAKE DEPOSIT ERROR ===');
      console.error('Raw error:', error);
      
      let errorMessage = 'Failed to make deposit';
      
      if (error instanceof Error) {
        if (error.message.includes('Insufficient USDT balance')) {
          errorMessage = error.message;
        } else if (error.message.includes('network') || error.message.includes('Network')) {
          errorMessage = `Network Error: ${error.message}\n\nTry switching to Kaia Kairos Testnet manually in your wallet.`;
        } else if (error?.code === 4001) {
          errorMessage = 'Transaction rejected by user';
        } else if (error?.code === -32603) {
          errorMessage = `Contract Error: ${error.message}\n\nCheck network and contract addresses.`;
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }

      Sentry.captureException(error, {
        tags: { component: 'KyeContracts', action: 'makeDeposit' },
        extra: { circleAddress, account, addresses }
      });

      return {
        hash: '',
        success: false,
        error: errorMessage
      };
    }
  }, [getAccount, sendTransaction, addresses, sdk, getErc20TokenBalance]);

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
      console.log('🔧 Using environment-based addresses from addresses.ts');
      
      // Try each network's USDT contract using addresses from addresses.ts
      const networkAddresses = {
        1001: getContractAddresses(1001),
        31337: getContractAddresses(31337)
      };
      
      const networks = [
        { chainId: 1001, name: 'Kaia Kairos Testnet', usdtAddress: networkAddresses[1001].MockUSDT },
        { chainId: 31337, name: 'Local Anvil', usdtAddress: networkAddresses[31337].MockUSDT }
      ];
      
      console.log('📋 Network addresses for detection:');
      networks.forEach(net => {
        console.log(`  • ${net.name}: ${net.usdtAddress}`);
      });
      
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

  // Get contract address from transaction receipt
  const getContractAddressFromTx = useCallback(async (txHash: string): Promise<string | null> => {
    try {
      console.log('🔍 Getting contract address from transaction:', txHash);
      
      // Check if SDK is available
      if (!sdk) {
        console.error('❌ No SDK available');
        return null;
      }
      
      // Get provider from SDK
      const walletProvider = sdk.getWalletProvider();
      console.log('🔗 Using Kaia Wallet SDK provider for tx receipt');
      const provider = new ethers.BrowserProvider(walletProvider);
      
      // Wait for transaction receipt
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        console.log('❌ Transaction receipt not found yet');
        return null;
      }
      
      console.log('✅ Transaction receipt:', receipt);
      
      // Look for contract creation in logs or events
      // For factory contracts, the new contract address is usually in events
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('📋 Analyzing transaction logs for contract address...');
        
        // Look for CircleCreated event from factory
        const factoryInterface = new ethers.Interface(KYE_FACTORY_ABI);
        
        for (const log of receipt.logs) {
          try {
            const parsedLog = factoryInterface.parseLog(log);
            console.log('🔍 Parsed log:', parsedLog?.name, parsedLog?.args);
            
            if (parsedLog && parsedLog.name === 'CircleCreated') {
              const contractAddress = parsedLog.args.circleAddress;
              console.log('✅ Found contract address from CircleCreated event:', contractAddress);
              return contractAddress;
            }
          } catch (parseError) {
            // Log might not be from our factory, continue
            console.log('🔍 Could not parse log (likely from different contract):', parseError.message);
            continue;
          }
        }
      }
      
      // If no events found, the contract might be directly created
      if (receipt.contractAddress) {
        console.log('✅ Found contract address from receipt.contractAddress:', receipt.contractAddress);
        return receipt.contractAddress;
      }
      
      console.log('❌ No contract address found in transaction receipt');
      return null;
    } catch (error) {
      console.error('❌ Error getting contract address from transaction:', error);
      return null;
    }
  }, []);

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
    let account: string | null = null;
    
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

      account = await getAccount();
      console.log('Account retrieved:', account);
      
      if (!account) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }

      // Step 1: Detect actual network
      console.log('🔍 Detecting actual network...');
      console.log('📋 Note: Network detection now uses addresses from addresses.ts (environment-based)');
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

  // SavingsPocket yield functions
  const getSavingsPocketAPY = useCallback(async (): Promise<string> => {
    try {
      console.log('🔍 Getting SavingsPocket APY...');
      
      if (!sdk) {
        console.log('❌ No SDK available');
        return '5.00'; // Default fallback APY
      }
      
      const walletProvider = sdk.getWalletProvider();
      const provider = new ethers.BrowserProvider(walletProvider);
      
      const savingsPocketContract = new ethers.Contract(
        addresses.SavingsPocket,
        SAVINGS_POCKET_ABI,
        provider
      );
      
      const apyBps = await savingsPocketContract.expectedAPY();
      const apyPercent = (parseInt(apyBps.toString()) / 100).toFixed(2);
      
      console.log('✅ SavingsPocket APY:', apyPercent + '%');
      return apyPercent;
      
    } catch (error) {
      console.error('❌ Error getting SavingsPocket APY:', error);
      return '5.00'; // Default fallback
    }
  }, [sdk, addresses]);

  const getSavingsPocketStats = useCallback(async (): Promise<{
    totalValue: string;
    totalDeposited: string;
    sponsorFunds: string;
    pendingYield: string;
    apy: string;
    isHealthy: boolean;
    healthReason: string;
  }> => {
    try {
      console.log('🔍 Getting SavingsPocket stats...');
      
      if (!sdk) {
        console.log('❌ No SDK available');
        return {
          totalValue: '0',
          totalDeposited: '0', 
          sponsorFunds: '0',
          pendingYield: '0',
          apy: '5.00',
          isHealthy: true,
          healthReason: 'SDK not available'
        };
      }
      
      const walletProvider = sdk.getWalletProvider();
      const provider = new ethers.BrowserProvider(walletProvider);
      
      const savingsPocketContract = new ethers.Contract(
        addresses.SavingsPocket,
        SAVINGS_POCKET_ABI,
        provider
      );
      
      const [
        totalValue,
        totalDeposited,
        sponsorFunds,
        pendingYield,
        apyBps,
        healthResult
      ] = await Promise.all([
        savingsPocketContract.totalValue(),
        savingsPocketContract.totalDeposited(),
        savingsPocketContract.sponsorFunds(),
        savingsPocketContract.getPendingYield(),
        savingsPocketContract.expectedAPY(),
        savingsPocketContract.healthCheck()
      ]);
      
      const stats = {
        totalValue: ethers.formatUnits(totalValue, 6), // USDT has 6 decimals
        totalDeposited: ethers.formatUnits(totalDeposited, 6),
        sponsorFunds: ethers.formatUnits(sponsorFunds, 6),
        pendingYield: ethers.formatUnits(pendingYield, 6),
        apy: (parseInt(apyBps.toString()) / 100).toFixed(2),
        isHealthy: healthResult[0],
        healthReason: healthResult[1]
      };
      
      console.log('✅ SavingsPocket stats:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ Error getting SavingsPocket stats:', error);
      return {
        totalValue: '0',
        totalDeposited: '0',
        sponsorFunds: '0', 
        pendingYield: '0',
        apy: '5.00',
        isHealthy: false,
        healthReason: 'Error fetching stats'
      };
    }
  }, [sdk, addresses]);

  const getUserYieldInfo = useCallback(async (userAddress: string): Promise<{
    userShares: string;
    userValue: string;
    estimatedYield: string;
  }> => {
    try {
      console.log('🔍 Getting user yield info for:', userAddress);
      
      if (!sdk || !userAddress) {
        console.log('❌ No SDK or user address available');
        return {
          userShares: '0',
          userValue: '0',
          estimatedYield: '0'
        };
      }
      
      const walletProvider = sdk.getWalletProvider();
      const provider = new ethers.BrowserProvider(walletProvider);
      
      const savingsPocketContract = new ethers.Contract(
        addresses.SavingsPocket,
        SAVINGS_POCKET_ABI,
        provider
      );
      
      const [userShares, userValue] = await Promise.all([
        savingsPocketContract.getUserShares(userAddress),
        savingsPocketContract.getUserValue(userAddress)
      ]);
      
      // Calculate estimated yield (current value - shares represents yield earned)
      const sharesValue = ethers.formatUnits(userShares, 6);
      const currentValue = ethers.formatUnits(userValue, 6);
      const estimatedYield = Math.max(0, parseFloat(currentValue) - parseFloat(sharesValue)).toFixed(6);
      
      const result = {
        userShares: sharesValue,
        userValue: currentValue,
        estimatedYield: estimatedYield
      };
      
      console.log('✅ User yield info:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error getting user yield info:', error);
      return {
        userShares: '0',
        userValue: '0',
        estimatedYield: '0'
      };
    }
  }, [sdk, addresses]);

  return {
    // Factory functions
    createCircle,
    getCirclesForGroup,
    getCircleMetadata,
    getContractAddressFromTx,
    
    // Circle functions
    joinCircle,
    makeDeposit,
    getDepositInfo,
    getCircleDetails,
    
    // Token functions
    getUsdtBalance,
    mintUsdt,
    
    // SavingsPocket functions
    getSavingsPocketAPY,
    getSavingsPocketStats,
    getUserYieldInfo,
    
    // Utility
    addresses,
    hashLineGroupId,
    hashLineUserId
  };
};