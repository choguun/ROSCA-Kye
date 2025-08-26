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
    try {
        console.log('🚀 Starting DappPortal SDK initialization...');
        
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
            chainId: process.env.NEXT_PUBLIC_CHAIN_ID as string, // Use simple string format for Kaia Kairos testnet
        });
        
        console.log('✅ DappPortal SDK initialized successfully');
        
        Sentry.addBreadcrumb({
            message: 'DappPortal SDK initialized successfully',
            category: 'wallet',
            level: 'info'
        });
        
        return sdk as DappPortalSDKType;
    } catch (error) {
        console.error('❌ DappPortal SDK initialization failed:', error);
        
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
    from: string;
    to: string;
    value: string;
    gas: string;
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

    const sendTransaction = useCallback(async(params: Transaction[]) => {
        return await walletProvider.request({ method: 'kaia_sendTransaction', params: params });
    }, [walletProvider]);

    const getErc20TokenBalance = useCallback(async(contractAddress: string, account: string) => {
        return await walletProvider.getErc20TokenBalance(contractAddress, account);
    }, [walletProvider]);
    
    return {
        getAccount,
        requestAccount,
        connectAndSign,
        disconnectWallet,
        getBalance,
        sendTransaction,
        getErc20TokenBalance
    };
};