'use client';

import React, { useCallback } from 'react';
import { useKaiaWalletSdk, useKaiaWalletSdkStore } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { getContractAddresses, DEFAULT_CHAIN_ID, logAddressConfiguration } from '@/utils/contracts/addresses';
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
import { KYEGROUP_BYTECODE } from '@/utils/contracts/bytecode';

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

      const account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      // Use circle name as LINE group ID for demo purposes
      const lineGroupId = `group_${circleName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      console.log('Generated LINE group ID:', lineGroupId);

      // Prepare CircleParams matching the smart contract structure
      const params = {
        usdtToken: addresses.MockUSDT,
        yieldAdapter: addresses.SavingsPocket,
        lineGroupIdHash: hashLineGroupId(lineGroupId),
        depositAmount: depositAmountUsdt, // Already in wei format from UI (multiplied by 1e6)
        penaltyBps: penaltyBps.toString(), // 500 = 5% penalty
        roundDuration: (roundDurationDays * 24 * 60 * 60).toString() // Convert days to seconds
      };

      console.log('Circle params:', params);

      // Generate deterministic salt for CREATE2 deployment
      const salt = ethers.keccak256(ethers.toUtf8Bytes(`${circleName}_${Date.now()}`));
      console.log('Generated salt:', salt);

      // Encode the deployCircle function call using ethers Interface
      const factoryInterface = new ethers.Interface(KYE_FACTORY_ABI);
      const deployCircleData = factoryInterface.encodeFunctionData('deployCircle', [
        salt,
        [
          params.usdtToken,
          params.yieldAdapter,
          params.lineGroupIdHash,
          params.depositAmount,
          params.penaltyBps,
          params.roundDuration,
          maxMembers
        ]
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

      // Calculate the deterministic contract address using CREATE2
      console.log('🔧 Calculating CREATE2 address...');
      
      // Get the init code hash (keccak256 of bytecode + constructor args)
      const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'address', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
        [
          params.usdtToken,
          params.yieldAdapter,
          account, // creator
          params.lineGroupIdHash,
          params.depositAmount,
          params.penaltyBps,
          params.roundDuration,
          maxMembers
        ]
      );
      
      const initCode = KYEGROUP_BYTECODE + constructorArgs.slice(2); // Remove 0x prefix from constructor args
      const initCodeHash = ethers.keccak256(initCode);
      
      console.log('Constructor args:', constructorArgs);
      console.log('Init code hash:', initCodeHash);
      
      // Calculate CREATE2 address
      const predictedAddress = ethers.getCreate2Address(
        addresses.KyeFactory, // factory address
        salt, // salt
        initCodeHash // init code hash
      );
      
      console.log('✅ Predicted contract address:', predictedAddress);
      console.log('=== CREATE CIRCLE SUCCESS ===');

      return {
        hash: result as string,
        success: true,
        circleAddress: predictedAddress, // Immediate deterministic address!
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
    try {
      console.log('=== JOIN CIRCLE START ===');
      console.log('Invite code (circle address):', inviteCode);

      Sentry.addBreadcrumb({
        message: 'Joining Kye circle',
        category: 'contract',
        level: 'info',
        data: { inviteCode }
      });

      const account = await getAccount();
      if (!account) {
        throw new Error('Wallet not connected');
      }

      // For demo, use account address as LINE user ID
      const lineUserId = `user_${account.toLowerCase()}`;
      const userIdHash = hashLineUserId(lineUserId);
      console.log('Generated LINE user ID hash:', userIdHash);

      // Encode the join function call
      const groupInterface = new ethers.Interface(KYE_GROUP_ABI);
      const joinCircleData = groupInterface.encodeFunctionData('join', [userIdHash]);

      console.log('✅ Encoded joinCircle call:', joinCircleData);

      // Prepare transaction
      const gasLimit = 500000;
      const gasLimitHex = '0x' + gasLimit.toString(16);

      const tx = {
        from: account,
        to: inviteCode, // Using invite code as circle address for demo
        value: '0x0',
        gas: gasLimitHex,
        data: joinCircleData
      };

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

      console.log('🚀 All validations passed, joining circle...');
      const result = await sendTransaction(tx);
      console.log('✅ Circle join transaction sent:', result);

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

      let userFriendlyMessage = 'Failed to join circle';
      
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
        tags: { component: 'KyeContracts', action: 'joinCircle' },
        extra: { inviteCode, account }
      });

      return {
        hash: '',
        success: false,
        error: userFriendlyMessage
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
      
      // Get provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      
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
        
        // Look for CircleDeployed event or similar
        const factoryInterface = new ethers.Interface(KYE_FACTORY_ABI);
        
        for (const log of receipt.logs) {
          try {
            const parsedLog = factoryInterface.parseLog(log);
            if (parsedLog && parsedLog.name === 'CircleDeployed') {
              const contractAddress = parsedLog.args.circle || parsedLog.args.circleAddress;
              console.log('✅ Found contract address from CircleDeployed event:', contractAddress);
              return contractAddress;
            }
          } catch (parseError) {
            // Log might not be from our factory, continue
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
    
    // Utility
    addresses,
    hashLineGroupId,
    hashLineUserId
  };
};