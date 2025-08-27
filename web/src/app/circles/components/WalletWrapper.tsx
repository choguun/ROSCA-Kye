"use client";

import React, { useEffect, useState } from 'react';
import { useWalletAccountStore } from "@/components/Wallet/Account/auth.hooks";
import { WalletButton } from '@/components/Wallet/Button/WalletButton';
import styles from '../page.module.css';

interface WalletWrapperProps {
  children: (account: string | null) => React.ReactNode;
}

export function WalletWrapper({ children }: WalletWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Always call hooks - use state to determine when to use them
  const { account } = useWalletAccountStore();
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className={styles.root}>
        <div className={styles.container}>
          <div className={styles.loginPrompt}>
            <h1>🤝 Savings Circles</h1>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className={styles.root}>
        <div className={styles.container}>
          <div className={styles.loginPrompt}>
            <h1>🤝 Savings Circles</h1>
            <p>Connect your wallet to create or join Korean savings circles (Kye)</p>
            <div className={styles.connectPrompt}>
              <p>Please connect your wallet from the Dashboard to access circle features.</p>
            </div>
            <WalletButton setIsLoggedIn={setIsLoggedIn}/>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(account)}</>;
}