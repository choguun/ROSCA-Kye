'use client'

import { create } from 'zustand/react';
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {DappPortalSDKType, default as DappPortalSDK} from "@/utils/dapp-portal-sdk";
import {liff} from "@/utils/liff";
import * as Sentry from "@sentry/nextjs";

type KaiaWalletSdkState = {
    sdk: DappPortalSDKType | null;
    setSdk: (sdk: DappPortalSDKType| null) => void;
};

export const useKaiaWalletSdkStore = create<KaiaWalletSdkState>((set) => ({
    sdk: null,
    setSdk: (sdk) => set({ sdk }),
}));

export const initializeKaiaWalletSdk = async () => {
    const debugHelper = (typeof window !== 'undefined' && (window as any).__ERUDA_DEBUG__) || null;
    
    try {
        if (debugHelper) {
            debugHelper.group('SDK_INITIALIZATION', () => {
                debugHelper.log('SDK_INIT_START', {
                    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
                    clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
                    timestamp: new Date().toISOString()
                });
            });
        } else {
            console.log('🚀 Starting DappPortal SDK initialization...');
        }
        
        Sentry.addBreadcrumb({
            message: 'Starting DappPortal SDK initialization',
            category: 'wallet',
            level: 'info',
            data: {
                    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
                    clientId: process.env.NEXT_PUBLIC_CLIENT_ID
            }
        });
        
        const sdk = await DappPortalSDK.init({
            clientId: process.env.NEXT_PUBLIC_CLIENT_ID as string,
            chainId: process.env.NEXT_PUBLIC_CHAIN_ID as string,
        });
        
        if (debugHelper) {
            debugHelper.success('SDK_INIT_SUCCESS', {
                sdk: 'DappPortalSDK initialized',
                chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log('✅ DappPortal SDK initialized successfully');
        }
        
        Sentry.addBreadcrumb({
            message: 'DappPortal SDK initialized successfully',
            category: 'wallet',
            level: 'info'
        });
        
        return sdk as DappPortalSDKType;
    } catch (error) {
        if (debugHelper) {
            debugHelper.error('SDK_INIT_FAILED', {
                error,
                errorMessage: error?.message,
                errorStack: error?.stack,
                config: {
                    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
                    clientId: process.env.NEXT_PUBLIC_CLIENT_ID
                }
            });
        } else {
            console.error('❌ DappPortal SDK initialization failed:', error);
        }
        
        Sentry.captureException(error instanceof Error ? error : new Error('SDK initialization failed'), {
            tags: {
                component: 'WalletSDK',
                action: 'initializeKaiaWalletSdk'
            },
            extra: {
                originalError: error,
                chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
                clientId: process.env.NEXT_PUBLIC_CLIENT_ID
            }
        });
        
        return null;
    }
};

export const useKaiaWalletSecurity = () => {
    const { setSdk } = useKaiaWalletSdkStore();
    
    return useQuery({
        queryKey: ['wallet', 'sdk'],
        queryFn: async () => {
            console.log('🔄 Starting wallet security initialization...');
            
            Sentry.addBreadcrumb({
                message: 'Starting LIFF initialization',
                category: 'liff',
                level: 'info'
            });
            
            // Initialize LIFF
            await liff.init({
                liffId: process.env.NEXT_PUBLIC_LIFF_ID as string,
            });
            
            console.log('✅ LIFF initialized successfully');
            
            Sentry.addBreadcrumb({
                message: 'LIFF initialized, starting SDK',
                category: 'wallet',
                level: 'info'
            });
            
            // Initialize SDK
            const sdk = await initializeKaiaWalletSdk();
            setSdk(sdk);
            
            console.log('🎉 Wallet security initialization complete!');
            
            return true;
        },
        throwOnError: true,
    });
};

// export type Block = 'latest' | 'earliest';

export type Transaction = {
    from: string;      // Wallet address 
    to: string;        // Contract/recipient address
    value: string;     // Value in hex format (e.g., '0x0')
    gas: string;       // Gas limit in hex format (e.g., '0x7A120')
    data?: string;     // Optional encoded function call data for smart contracts
}

export const useKaiaWalletSdk = () => {
    const { sdk } = useKaiaWalletSdkStore();
    
    if (!sdk) {
        throw new Error('KaiaWalletSdk is not initialized');
    }

    const walletProvider = sdk.getWalletProvider();

    const getAccount = useCallback(async () => {
        try {
            const addresses = await walletProvider.request({ method: 'kaia_accounts' }) as string[];
            return addresses[0];
        } catch (error) {
            Sentry.captureException(error instanceof Error ? error : new Error('Failed to get account'), {
                tags: { component: 'WalletSDK', action: 'getAccount' },
                extra: { originalError: error }
            });
            throw error;
        }
    }, [walletProvider]);

    const requestAccount = useCallback(async () => {
        try {
            const addresses = await walletProvider.request({ method: 'kaia_requestAccounts' }) as string[];
            return addresses[0];
        } catch (error) {
            Sentry.captureException(error instanceof Error ? error : new Error('Failed to request account'), {
                tags: { component: 'WalletSDK', action: 'requestAccount' },
                extra: { originalError: error }
            });
            throw error;
        }
    }, [walletProvider]);

    const connectAndSign = useCallback(
      async (msg: string) => {
          try {
              const [account, signature] = await walletProvider.request({
                  method: 'kaia_connectAndSign',
                  params: [msg],
              }) as string[];
              
              Sentry.addBreadcrumb({
                  message: 'Wallet connect and sign successful',
                  category: 'wallet',
                  level: 'info'
              });
              
              return [account, signature];
          } catch (error) {
              Sentry.captureException(error instanceof Error ? error : new Error('Failed to connect and sign'), {
                  tags: { component: 'WalletSDK', action: 'connectAndSign' },
                  extra: { originalError: error, message: msg }
              });
              throw error;
          }
      },
      [walletProvider]
    );

    const getBalance = useCallback(async(params: [account:string,blockNumberOrHash:'latest'|'earliest']) => {
        return await walletProvider.request({ method: 'kaia_getBalance', params: params });
    }, [walletProvider]);

    const disconnectWallet = useCallback(async () => {
        await walletProvider.disconnectWallet();
        window.location.reload();
    }, [walletProvider]);

    const sendTransaction = useCallback(async(transaction: Transaction) => {
        try {
            // According to SDK docs, kaia_sendTransaction expects params: [transaction]
            const result = await walletProvider.request({ 
                method: 'kaia_sendTransaction', 
                params: [transaction] 
            });
            
            Sentry.addBreadcrumb({
                message: 'Transaction sent successfully',
                category: 'wallet',
                level: 'info',
                data: { 
                    transactionHash: result,
                    from: transaction.from,
                    to: transaction.to
                }
            });
            
            return result;
        } catch (error) {
            Sentry.captureException(error instanceof Error ? error : new Error('Transaction failed'), {
                tags: { component: 'WalletSDK', action: 'sendTransaction' },
                extra: { 
                    originalError: error,
                    transaction: {
                        from: transaction.from,
                        to: transaction.to,
                        value: transaction.value,
                        gas: transaction.gas,
                        hasData: !!transaction.data
                    }
                }
            });
            throw error;
        }
    }, [walletProvider]);

    const getErc20TokenBalance = useCallback(async(contractAddress: string, account: string) => {
        return await walletProvider.getErc20TokenBalance(contractAddress, account);
    }, [walletProvider]);

    // Get current chain ID from wallet
    const getChainId = useCallback(async() => {
        const debugHelper = (typeof window !== 'undefined' && (window as any).__ERUDA_DEBUG__) || null;
        
        try {
            const chainId = await walletProvider.request({ method: 'eth_chainId' });
            const decimalChainId = parseInt(chainId, 16);
            
            if (debugHelper) {
                debugHelper.log('CHAIN_ID_REQUEST', {
                    hexChainId: chainId,
                    decimalChainId,
                    expectedChainId: process.env.NEXT_PUBLIC_CHAIN_ID,
                    match: decimalChainId.toString() === process.env.NEXT_PUBLIC_CHAIN_ID
                });
            } else {
                console.log('Current wallet chain ID (hex):', chainId);
                console.log('Current wallet chain ID (decimal):', decimalChainId);
            }
            
            return decimalChainId;
        } catch (error) {
            if (debugHelper) {
                debugHelper.error('CHAIN_ID_ERROR', {
                    error,
                    errorMessage: error?.message,
                    method: 'eth_chainId'
                });
            } else {
                console.error('Error getting chain ID:', error);
            }
            throw error;
        }
    }, [walletProvider]);

    // DappPortal SDK does not support programmatic network switching
    // Users must manually switch their wallet to the correct network

    // Validate user is on correct network with detailed instructions
    const validateNetwork = useCallback(async() => {
        try {
            const currentChainId = await getChainId();
            const expectedChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1001');
            
            console.log('Network validation:');
            console.log('- Expected Chain ID:', expectedChainId);
            console.log('- Current Chain ID:', currentChainId);
            
            if (currentChainId !== expectedChainId) {
                const networkNames = {
                    1: 'Ethereum Mainnet',
                    137: 'Polygon',
                    56: 'BSC',
                    1001: 'Kaia Kairos Testnet',
                    31337: 'Local Development'
                };
                
                const currentNetworkName = networkNames[currentChainId] || `Unknown Network (${currentChainId})`;
                
                throw new Error(
                    `❌ Wrong Network Detected\n\n` +
                    `Your wallet is connected to: ${currentNetworkName} (Chain ID: ${currentChainId})\n` +
                    `This app requires: Kaia Kairos Testnet (Chain ID: ${expectedChainId})\n\n` +
                    `🔧 Please manually switch your wallet to Kaia Kairos Testnet:\n\n` +
                    `• Network Name: Kaia Kairos Testnet\n` +
                    `• Chain ID: 1001\n` +
                    `• RPC URL: https://public-en-kairos.node.kaia.io\n` +
                    `• Currency Symbol: KAIA\n` +
                    `• Block Explorer: https://kairos.kaiascan.io\n\n` +
                    `After switching, refresh this page to continue.`
                );
            }
            
            console.log('✅ Network validation passed - connected to Kaia Kairos Testnet');
            return true;
        } catch (error) {
            console.error('❌ Network validation failed:', error);
            throw error;
        }
    }, [getChainId]);
    
    return {
        getAccount,
        requestAccount,
        connectAndSign,
        disconnectWallet,
        getBalance,
        sendTransaction,
        getErc20TokenBalance,
        getChainId,
        validateNetwork
    };
};