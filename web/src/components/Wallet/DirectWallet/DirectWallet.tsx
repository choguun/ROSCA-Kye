'use client';

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import styles from '../Button/WalletButton.module.css';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface DirectWalletProps {
  setIsLoggedIn: (logged: boolean) => void;
  onAccountChange: (account: string) => void;
}

export const DirectWallet = ({ setIsLoggedIn, onAccountChange }: DirectWalletProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Check if MetaMask is installed
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to connect.');
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      const account = accounts[0];

      // Check if we're on Kaia Kairos testnet
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (chainId !== '0x3e9') { // 1001 in hex
        try {
          // Try to switch to Kaia Kairos
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x3e9' }],
          });
        } catch (switchError: any) {
          // If chain doesn't exist, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x3e9',
                  chainName: 'Kaia Kairos Testnet',
                  rpcUrls: ['https://public-en-kairos.node.kaia.io'],
                  nativeCurrency: {
                    name: 'KAIA',
                    symbol: 'KAIA',
                    decimals: 18,
                  },
                  blockExplorerUrls: ['https://kairos.klaytnfinder.io/'],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }

      // Success!
      onAccountChange(account);
      setIsLoggedIn(true);
      
      console.log('✅ Wallet connected:', account);

      // Listen for account changes
      window.ethereum.on('accountsChanged', (newAccounts: string[]) => {
        if (newAccounts.length === 0) {
          setIsLoggedIn(false);
          onAccountChange('');
        } else {
          onAccountChange(newAccounts[0]);
        }
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', (newChainId: string) => {
        if (newChainId !== '0x3e9') {
          setError('Please switch to Kaia Kairos testnet');
        } else {
          setError(null);
        }
      });

    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [setIsLoggedIn, onAccountChange]);

  const getProvider = useCallback(() => {
    if (!window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  const getSigner = useCallback(async () => {
    const provider = getProvider();
    if (!provider) throw new Error('No wallet provider found');
    return await provider.getSigner();
  }, [getProvider]);

  return (
    <div>
      <button 
        className={styles.root} 
        onClick={connectWallet}
        disabled={isConnecting}
      >
        <div className={styles.icon}>🦊</div>
        <p className={styles.description}>
          {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
        </p>
      </button>
      
      {error && (
        <div style={{ 
          color: '#dc3545', 
          fontSize: '14px', 
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#f8d7da',
          borderRadius: '4px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

// Export helper functions for other components to use
export const useDirectWallet = () => {
  const getProvider = useCallback(() => {
    if (!window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  const getSigner = useCallback(async () => {
    const provider = getProvider();
    if (!provider) throw new Error('No wallet provider found');
    return await provider.getSigner();
  }, [getProvider]);

  const getAccount = useCallback(async () => {
    if (!window.ethereum) return null;
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts[0] || null;
  }, []);

  const sendTransaction = useCallback(async (transaction: any) => {
    const signer = await getSigner();
    return await signer.sendTransaction(transaction);
  }, [getSigner]);

  return {
    getProvider,
    getSigner,
    getAccount,
    sendTransaction,
  };
};