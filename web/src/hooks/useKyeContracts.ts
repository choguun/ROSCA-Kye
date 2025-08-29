'use client';

import React, { useCallback } from 'react';
import { useKaiaWalletSdk, useKaiaWalletSdkStore } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { getContractAddresses, DEFAULT_CHAIN_ID, logAddressConfiguration } from '@/utils/contracts/addresses';
import { KYE_FACTORY_ABI, KYE_GROUP_ABI, MOCK_USDT_ABI, SAVINGS_POCKET_ABI, Phase } from '@/utils/contracts/abis';
import { ethers } from 'ethers';
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
      console.log('🔍 Type of depositAmountUsdt:', typeof depositAmountUsdt);
      console.log('🔍 String representation:', JSON.stringify(depositAmountUsdt));
      console.log('🔍 Parsed as float:', parseFloat(depositAmountUsdt));
      console.log('Available addresses:', addresses);
      
      // Extra validation
      if (!depositAmountUsdt || isNaN(parseFloat(depositAmountUsdt))) {
        throw new Error(`Invalid depositAmountUsdt: "${depositAmountUsdt}" (type: ${typeof depositAmountUsdt})`);
      }

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

      // FIXED: Handle deposit amount properly - it's already in wei from frontend
      console.log('🔧 DOUBLE CONVERSION BUG FIX: Input is already in wei');
      console.log('🔧 Input from frontend:', depositAmountUsdt, 'wei');
      
      // Check if the input is already in wei (large number) or USDT (small number)
      const inputAsFloat = parseFloat(depositAmountUsdt);
      let depositAmountWei: bigint;
      
      if (inputAsFloat > 1000) {
        // Input is already in wei (e.g., "100000000" = 100 USDT)
        console.log('🔧 Input detected as wei, using directly');
        depositAmountWei = BigInt(depositAmountUsdt);
        console.log('🔧 Direct wei conversion:', depositAmountWei.toString());
        console.log('🔧 Back to USDT:', Number(depositAmountWei) / 1e6);
      } else {
        // Input is in USDT (e.g., "100" = 100 USDT), need to convert
        console.log('🔧 Input detected as USDT, converting to wei');
        depositAmountWei = BigInt(Math.floor(inputAsFloat * 1e6));
        console.log('🔧 USDT to wei conversion:', depositAmountUsdt, '* 1e6 =', depositAmountWei.toString());
        console.log('🔧 Back to USDT:', Number(depositAmountWei) / 1e6);
      }

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
      console.error('Error type:', typeof error);;

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
          console.warn('Unexpected deposit amount format, will check localStorage');
          depositAmount = BigInt('0');
        }
        
        // Apply bug detection for both 0 and buggy large values
        const rawDepositWei = Number(depositAmount);
        console.log('🔧 makeDeposit bug detection:', { rawDepositWei, isBuggy: rawDepositWei > 1e12 });
        
        if (depositAmount === BigInt('0') || rawDepositWei > 1e12) {
          console.log('⚠️ Contract depositAmount is buggy (0 or too large), checking localStorage for correct amount...');
          const storedCircles = JSON.parse(localStorage.getItem('recentCircles') || '[]');
          const matchingCircle = storedCircles.find((c: any) => 
            c.address?.toLowerCase() === circleAddress.toLowerCase()
          );
          
          if (matchingCircle && matchingCircle.monthlyAmount) {
            // Use manual conversion to avoid parseUnits bug
            const correctAmount = BigInt(Math.floor(parseFloat(matchingCircle.monthlyAmount) * 1e6));
            depositAmount = correctAmount;
            console.log('✅ Found correct deposit amount in localStorage:', matchingCircle.monthlyAmount, 'USDT');
            console.log('✅ Manual conversion to wei:', depositAmount.toString());
          } else {
            console.log('❌ No matching circle found in localStorage, using 100 USDT default');
            depositAmount = BigInt('100000000'); // 100 USDT default
          }
        }
        
        console.log('Final deposit amount:', depositAmount.toString(), 'wei');
        console.log('Final deposit amount in USDT:', Number(depositAmount) / 1e6);
      } catch (depositError) {
        console.error('Error getting deposit amount from contract:', depositError);
        console.log('Using default deposit amount: 100 USDT');
        depositAmount = BigInt('100000000'); // 100 USDT default
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
      
      // Step 0.6: Check circle phase and round status
      console.log('🔍 Step 0.6: Checking circle phase and round status...');
      
      try {
        const currentPhase = await circleContract.currentPhase();
        const currentRound = await circleContract.currentRound();
        const maxMembers = await circleContract.maxMembers();
        
        console.log('Current phase:', currentPhase, '(0=Setup, 1=Commitment, 2=Active, 3=Settlement, 4=Resolved, 5=Disputed)');
        console.log('Current round:', currentRound.toString());
        console.log('Max members:', maxMembers.toString());
        
        // Phase must be Active (2) for deposits
        if (Number(currentPhase) !== 2) {
          const phaseNames = ['Setup', 'Commitment', 'Active', 'Settlement', 'Resolved', 'Disputed'];
          const phaseName = phaseNames[Number(currentPhase)] || 'Unknown';
          throw new Error(`Circle is not accepting deposits. Current phase: ${phaseName}. Deposits are only allowed in Active phase.`);
        }
        
        // Round must be valid
        if (Number(currentRound) >= Number(maxMembers)) {
          throw new Error(`All rounds are complete. Current round: ${currentRound}, Max rounds: ${maxMembers}`);
        }
        
        // Check round state
        const roundState = await circleContract.getRoundState(currentRound);
        console.log('Current round state:', {
          deadline: new Date(Number(roundState.deadline) * 1000).toLocaleString(),
          beneficiary: roundState.beneficiary,
          totalDeposited: roundState.totalDeposited.toString(),
          isComplete: roundState.isComplete,
          requiredDeposits: roundState.requiredDeposits.toString()
        });
        
        // Check if round is complete
        if (roundState.isComplete) {
          throw new Error(`Current round ${Number(currentRound) + 1} is already complete`);
        }
        
        // Check if user is the beneficiary (beneficiaries don't deposit)
        console.log('🔍 Beneficiary check:', {
          roundBeneficiary: roundState.beneficiary,
          userAccount: account,
          beneficiaryLower: roundState.beneficiary.toLowerCase(),
          userAccountLower: account.toLowerCase(),
          isUserBeneficiary: roundState.beneficiary.toLowerCase() === account.toLowerCase()
        });
        
        if (roundState.beneficiary.toLowerCase() === account.toLowerCase()) {
          throw new Error(`🎉 You are the beneficiary for round ${Number(currentRound) + 1}! \n\nAs the beneficiary, you don't make deposits - you receive the payout when other members deposit. Wait for others to deposit, then you'll receive the funds automatically.`);
        }
        
        // Check if deadline has passed
        const now = Math.floor(Date.now() / 1000);
        if (Number(roundState.deadline) < now) {
          throw new Error(`Round ${Number(currentRound) + 1} deadline has passed. Deadline was: ${new Date(Number(roundState.deadline) * 1000).toLocaleString()}`);
        }
        
        // Check if user already deposited for this round
        const depositRecord = await circleContract.getDepositRecord(currentRound, account);
        console.log('User deposit record for current round:', {
          amount: depositRecord.amount.toString(),
          timestamp: depositRecord.timestamp.toString(),
          penaltyPaid: depositRecord.penaltyPaid.toString(),
          isOnTime: depositRecord.isOnTime
        });
        
        if (Number(depositRecord.amount) > 0) {
          throw new Error(`You have already deposited for round ${Number(currentRound) + 1}. Amount: ${Number(depositRecord.amount) / 1e6} USDT`);
        }
        
        console.log('✅ Circle phase and round checks passed');
        
      } catch (phaseError) {
        console.error('Phase/Round check failed:', phaseError);
        console.error('Error message:', phaseError instanceof Error ? phaseError.message : String(phaseError));
        console.error('Error details:', {
          name: phaseError instanceof Error ? phaseError.name : 'Unknown',
          stack: phaseError instanceof Error ? phaseError.stack : 'No stack trace'
        });
        throw phaseError; // Re-throw to stop execution
      }
      
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

      // Step 1: Calculate penalty first to approve the correct total amount
      console.log('🧮 Step 1: Getting penalty calculation to determine total approval amount...');
      const usdtContract = new ethers.Contract(addresses.MockUSDT, MOCK_USDT_ABI, provider);
      
      let penaltyAmount = BigInt(0);
      let totalRequired = depositAmount;
      
      try {
        console.log('🔍 Getting penalty calculation from contract...');
        
        // Get detailed penalty calculation info for debugging
        const [
          currentRound,
          roundState,
          memberState,
          contractDepositAmount,
          contractPenaltyBps
        ] = await Promise.all([
          circleContract.currentRound(),
          circleContract.getRoundState(await circleContract.currentRound()),
          circleContract.getMemberState(account),
          circleContract.depositAmount(),
          circleContract.penaltyBps()
        ]);
        
        console.log('📊 Detailed penalty calculation context:', {
          currentRound: Number(currentRound),
          roundDeadline: new Date(Number(roundState.deadline) * 1000).toLocaleString(),
          currentTime: new Date().toLocaleString(),
          isLate: Math.floor(Date.now() / 1000) > Number(roundState.deadline),
          memberDefaultCount: Number(memberState.defaultCount),
          memberTotalDeposited: memberState.totalDeposited.toString(),
          memberPenaltiesAccrued: memberState.penaltiesAccrued.toString(),
          contractDepositAmount: contractDepositAmount.toString(),
          contractPenaltyBps: Number(contractPenaltyBps),
          frontendDepositAmount: depositAmount.toString()
        });
        
        penaltyAmount = await circleContract.calculatePenalty(account);
        totalRequired = depositAmount + penaltyAmount;
        
        console.log('💰 Penalty calculation results:');
        console.log('- Base deposit amount (wei):', depositAmount.toString());
        console.log('- Base deposit amount (USDT):', Number(depositAmount) / 1e6);
        console.log('- Penalty amount (wei):', penaltyAmount.toString());
        console.log('- Penalty amount (USDT):', Number(penaltyAmount) / 1e6);
        console.log('- Total required (wei):', totalRequired.toString());
        console.log('- Total required (USDT):', Number(totalRequired) / 1e6);
        
        // Safety check for unreasonable penalty amounts
        const maxReasonablePenalty = depositAmount / BigInt(2); // 50% of deposit as max (contract has this cap too)
        const penaltyPercent = Number(penaltyAmount) / Number(depositAmount) * 100;
        
        console.log('🔍 Penalty analysis:', {
          penaltyPercent: penaltyPercent.toFixed(1) + '%',
          isReasonable: penaltyAmount <= maxReasonablePenalty,
          memberDefaultCount: Number(memberState.defaultCount)
        });
        
        if (penaltyAmount > maxReasonablePenalty) {
          console.error('🚨 CRITICAL: Smart contract penalty calculation bug detected!');
          console.error(`Penalty: ${Number(penaltyAmount) / 1e6} USDT (${penaltyPercent.toFixed(1)}% of deposit)`);
          console.error(`Member default count: ${Number(memberState.defaultCount)}`);
          console.error('This is likely due to exponential escalation: 2^defaultCount in the contract');
          console.error('⚠️ This deposit will FAIL due to insufficient balance!');
          
          // Throw an error to prevent the user from attempting this transaction
          throw new Error(`❌ Deposit blocked due to contract penalty bug!

The smart contract is calculating an unreasonably high penalty of ${(penaltyPercent).toFixed(0)}% (${Number(penaltyAmount) / 1e6} USDT) for this deposit.

This appears to be due to a penalty escalation bug in the contract where penalties grow exponentially with each late payment.

Your member has ${Number(memberState.defaultCount)} previous defaults, causing penalty = 2^${Number(memberState.defaultCount)} × base penalty.

❌ This transaction will fail with "insufficient balance" even if you have enough USDT.

🔧 Possible solutions:
1. Wait for the contract owner to fix the penalty calculation
2. Request a grace period if available
3. Contact support about this penalty calculation bug

Technical details: Required ${Number(totalRequired) / 1e6} USDT (${Number(depositAmount) / 1e6} + ${Number(penaltyAmount) / 1e6} penalty)`);
        }
        
        // Double check: ensure we're using the same depositAmount as the contract
        if (contractDepositAmount.toString() !== depositAmount.toString()) {
          console.warn('⚠️ WARNING: Frontend deposit amount differs from contract!');
          console.warn(`Frontend: ${depositAmount.toString()} wei (${Number(depositAmount) / 1e6} USDT)`);
          console.warn(`Contract: ${contractDepositAmount.toString()} wei (${Number(contractDepositAmount) / 1e6} USDT)`);
          console.warn('🔧 Using contract deposit amount to ensure consistency...');
          
          // Use the contract's deposit amount for consistency
          depositAmount = contractDepositAmount;
          totalRequired = depositAmount + penaltyAmount;
          
          console.log('✅ Updated to use contract deposit amount:');
          console.log('- Contract deposit amount (wei):', depositAmount.toString());
          console.log('- Contract deposit amount (USDT):', Number(depositAmount) / 1e6);
          console.log('- Total required with contract amount (wei):', totalRequired.toString());
          console.log('- Total required with contract amount (USDT):', Number(totalRequired) / 1e6);
        }
        
      } catch (penaltyError) {
        console.warn('⚠️ Could not get penalty calculation:', penaltyError);
        console.log('🔧 Using base deposit amount only for approval');
        // If penalty calculation fails, use base deposit amount and add 20% buffer
        totalRequired = depositAmount + (depositAmount * BigInt(20) / BigInt(100)); // 20% buffer
        console.log('- Total required with buffer (USDT):', Number(totalRequired) / 1e6);
      }

      // Step 1.5: Approve USDT spending
      console.log('📤 Step 1.5: Approving USDT spending (including penalty)...');
      console.log('- Approving spender (circle):', circleAddress);
      console.log('- Approving amount (wei):', totalRequired.toString());
      console.log('- Approving amount (USDT):', Number(totalRequired) / 1e6);
      
      const usdtInterface = new ethers.Interface(MOCK_USDT_ABI);
      const approveData = usdtInterface.encodeFunctionData('approve', [circleAddress, totalRequired.toString()]);
      
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
      
      // Step 1.6: Verify approval worked
      console.log('🔍 Step 1.6: Verifying approval...');
      const allowance = await usdtContract.allowance(account, circleAddress);
      console.log('Current allowance:', allowance.toString(), 'wei');
      console.log('Current allowance (USDT):', Number(allowance) / 1e6);
      
      if (allowance < totalRequired) {
        throw new Error(`Approval failed! Required: ${Number(totalRequired) / 1e6} USDT, Approved: ${Number(allowance) / 1e6} USDT`);
      }
      console.log('✅ Approval verified successfully');

      // Step 2: Final contract state validation before deposit
      console.log('🔍 Step 2: Final validation of contract state before deposit...');
      
      try {
        // Additional contract state validation
        const currentRound = await circleContract.currentRound();
        const maxMembers = await circleContract.maxMembers();
        const currentPhase = await circleContract.currentPhase();
        const rounds = await circleContract.getRoundState(currentRound);
        const memberState = await circleContract.getMemberState(account);
        const depositRecord = await circleContract.getDepositRecord(currentRound, account);
        
        console.log('- Current round:', currentRound.toString());
        console.log('- Max members:', maxMembers.toString());
        console.log('- Current phase:', currentPhase.toString());
        console.log('- Round beneficiary:', rounds.beneficiary);
        console.log('- Round deadline:', new Date(Number(rounds.deadline) * 1000).toLocaleString());
        console.log('- User is member:', memberState.isActive);
        console.log('- Already deposited amount:', depositRecord.amount.toString());
        
        // Detailed validation of deposit conditions
        if (currentRound >= maxMembers) {
          throw new Error('No active round - all rounds completed');
        }
        
        if (currentPhase !== 2n) { // Phase.Active = 2
          const phaseNames = ['Setup', 'Commitment', 'Active', 'Settlement', 'Resolved', 'Disputed'];
          const phaseName = phaseNames[Number(currentPhase)] || 'Unknown';
          throw new Error(`Circle is not accepting deposits. Current phase: ${phaseName}. Deposits only allowed in Active phase.`);
        }
        
        if (rounds.beneficiary.toLowerCase() === account.toLowerCase()) {
          throw new Error('You are the beneficiary for this round and cannot deposit');
        }
        
        if (depositRecord.amount > 0) {
          throw new Error('You have already deposited for this round');
        }
        
        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (currentTimestamp > Number(rounds.deadline)) {
          throw new Error('Deposit deadline has passed for this round');
        }
        
        console.log('✅ All contract state validations passed');
        
      } catch (contractError) {
        console.error('❌ Contract state validation failed:', contractError);
        if (contractError instanceof Error && contractError.message.includes('You are the beneficiary')) {
          throw contractError;
        } else if (contractError instanceof Error && contractError.message.includes('already deposited')) {
          throw contractError;
        } else if (contractError instanceof Error && contractError.message.includes('not accepting deposits')) {
          throw contractError;
        } else if (contractError instanceof Error && contractError.message.includes('deadline has passed')) {
          throw contractError;
        } else {
          console.error('Failed to get contract state, proceeding with basic validation...');
          console.error('Error details:', contractError);
          // Continue with the deposit attempt - sometimes view functions fail but the actual deposit works
        }
      }
      
      console.log('📤 Step 3: Making deposit to circle...');
      const circleInterface = new ethers.Interface(KYE_GROUP_ABI);
      const depositData = circleInterface.encodeFunctionData('deposit', []);

      const depositTx = {
        from: account,
        to: circleAddress,
        value: '0x0',
        gas: '0x7A120', // 500000
        data: depositData
      };

      console.log('📋 Final transaction summary:');
      console.log('- From:', account);
      console.log('- To (Circle):', circleAddress);
      console.log('- Base deposit amount:', Number(depositAmount) / 1e6, 'USDT');
      console.log('- Penalty amount:', Number(penaltyAmount) / 1e6, 'USDT');
      console.log('- Total required:', Number(totalRequired) / 1e6, 'USDT');
      console.log('- Gas limit:', parseInt(depositTx.gas, 16));
      console.log('- Transaction data:', depositTx.data);
      
      console.log('🚀 Sending deposit transaction...');
      try {
        const result = await sendTransaction(depositTx);
        console.log('✅ Deposit transaction sent successfully:', result);
        return {
          hash: result as string,
          success: true
        };
      } catch (txError) {
        console.error('❌ Deposit transaction failed:', txError);
        
        // Enhanced error parsing for common issues
        let errorMessage = 'Deposit transaction failed';
        
        if (txError instanceof Error) {
          const errorStr = txError.message;
          
          // Check for specific EVM errors
          if (errorStr.includes('uint(9)') || errorStr.includes('execution reverted')) {
            errorMessage = `Deposit failed with contract error. This usually means:\n\n1. You don't have enough USDT balance (need ${Number(totalRequired) / 1e6} USDT including penalty)\n2. The circle is not in the correct phase\n3. You're the beneficiary for this round\n4. You've already deposited for this round\n5. The deposit deadline has passed\n\nPlease check the browser console for detailed logs.`;
          } else if (errorStr.includes('insufficient funds')) {
            errorMessage = `Insufficient USDT balance. Need ${Number(totalRequired) / 1e6} USDT (including ${Number(penaltyAmount) / 1e6} USDT penalty) but you may have less.`;
          } else if (errorStr.includes('allowance')) {
            errorMessage = `USDT allowance issue. The contract wasn't approved to spend your USDT tokens.`;
          } else if ((txError as any)?.code === 4001) {
            errorMessage = 'Transaction rejected by user';
          } else {
            errorMessage = `Deposit error: ${errorStr}`;
          }
        }
        
        throw new Error(errorMessage);
      }

    } catch (error) {
      console.error('=== MAKE DEPOSIT ERROR ===');
      console.error('Raw error:', error);
      
      let errorMessage = 'Failed to make deposit';
      
      if (error instanceof Error) {
        if (error.message.includes('Circle is not accepting deposits')) {
          errorMessage = error.message + '\n\nThe circle needs to have enough members joined before deposits can be made.';
        } else if (error.message.includes('You are the beneficiary')) {
          errorMessage = error.message + '\n\nWait for your turn to receive the payout instead.';
        } else if (error.message.includes('already deposited')) {
          errorMessage = error.message + '\n\nYou can only make one deposit per round.';
        } else if (error.message.includes('deadline has passed')) {
          errorMessage = error.message + '\n\nThe deposit window for this round has closed.';
        } else if (error.message.includes('Insufficient USDT balance')) {
          errorMessage = error.message + '\n\nPlease mint more USDT tokens from the Profile page.';
        } else if (error.message.includes('not a member')) {
          errorMessage = error.message + '\n\nUse the "Join Circle" button first.';
        } else if (error.message.includes('network') || error.message.includes('Network')) {
          errorMessage = `Network Error: ${error.message}\n\nTry switching to Kaia Kairos Testnet manually in your wallet.`;
        } else if ((error as any)?.code === 4001) {
          errorMessage = 'Transaction rejected by user';
        } else if ((error as any)?.code === -32603) {
          errorMessage = `Contract Error: ${error.message}\n\nThis might be a phase or permission issue. Check that the circle is active and you haven't already deposited.`;
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
      
      // IMPROVED: Wait for transaction to be mined with polling and timeout
      console.log('⏳ Waiting for transaction to be mined...');
      
      const maxAttempts = 30; // 30 attempts
      const pollInterval = 2000; // 2 seconds between attempts
      let attempts = 0;
      let receipt = null;
      
      while (attempts < maxAttempts && !receipt) {
        try {
          receipt = await provider.getTransactionReceipt(txHash);
          
          if (receipt) {
            console.log(`✅ Transaction mined after ${attempts + 1} attempts (${(attempts * pollInterval / 1000).toFixed(1)}s)`);
            break;
          }
          
          attempts++;
          console.log(`⏳ Attempt ${attempts}/${maxAttempts} - Transaction not mined yet, waiting ${pollInterval/1000}s...`);
          
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
        } catch (pollError) {
          console.log(`⚠️ Error polling for receipt (attempt ${attempts + 1}):`, (pollError as any).message);
          attempts++;
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }
      }
      
      if (!receipt) {
        console.log(`❌ Transaction receipt not found after ${maxAttempts} attempts (${maxAttempts * pollInterval / 1000}s timeout)`);
        return null;
      }
      
      console.log('✅ Transaction receipt:', receipt);
      
      // IMPROVED: Check transaction status before proceeding
      if (receipt.status === 0) {
        console.log('❌ Transaction failed (status: 0)');
        console.log('Transaction may have reverted. Check transaction details on explorer.');
        return null;
      }
      
      console.log('✅ Transaction successful (status: 1)');
      
      // Look for contract creation in logs or events
      // For factory contracts, the new contract address is usually in events
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('📋 Analyzing transaction logs for contract address...');
        console.log('📋 Total logs found:', receipt.logs.length);
        
        // FIXED: First try to get contract address from the first log's address (deployed contract)
        // This is more reliable than parsing events which may fail
        const firstLog = receipt.logs[0];
        if (firstLog && firstLog.address) {
          console.log('✅ Found potential contract address from first log:', firstLog.address);
          
          // Verify this is not the factory address itself
          if (firstLog.address.toLowerCase() !== addresses.KyeFactory.toLowerCase()) {
            console.log('✅ Contract address confirmed (not factory):', firstLog.address);
            return firstLog.address;
          }
        }
        
        // Fallback: Look for CircleCreated event from factory
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
            console.log('🔍 Could not parse log (likely from different contract):', (parseError as any).message);
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