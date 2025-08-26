"use client";

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import styles from "./page.module.css";
import { WalletButton } from "@/components/Wallet/Button/WalletButton";
import { useEffect, useState } from "react";
import { useWalletAccountStore } from "@/components/Wallet/Account/auth.hooks";
import { useKaiaWalletSdk } from "@/components/Wallet/Sdk/walletSdk.hooks";
import { useRouter } from "next/navigation";

export default function Home() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const { setAccount } = useWalletAccountStore();
    const { getAccount, disconnectWallet } = useKaiaWalletSdk();
    const router = useRouter();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;
        
        const checkExistingAccount = async () => {
            try {
                const account = await getAccount();
                if(account) {
                    console.log('Found existing account:', account);
                    setIsLoggedIn(true);
                    setAccount(account);
                }
            } catch (error) {
                console.log('Error checking existing account:', error);
                // SDK might not be initialized yet, that's okay
                // The wallet button will handle the connection when user clicks
            }
        };
        
        checkExistingAccount();
    }, [disconnectWallet, getAccount, setAccount, isMounted]);

    // Redirect to circles page after wallet connection
    useEffect(() => {
        if (isLoggedIn) {
            console.log('Wallet connected - redirecting to circles page');
            router.push('/circles');
        }
    }, [isLoggedIn, router]);

    if (!isMounted) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>Loading...</p>
            </div>
        );
    }

    // Show simple onboarding page
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className={styles.onboarding}>
                    <div className={styles.hero}>
                        <div className={styles.heroIcon}>🤝</div>
                        <h1 className={styles.heroTitle}>Welcome to Kye</h1>
                        <p className={styles.heroSubtitle}>
                            Join Korean savings circles with your LINE friends
                        </p>
                    </div>
                    
                    <div className={styles.benefits}>
                        <div className={styles.benefit}>
                            <span className={styles.benefitIcon}>💰</span>
                            <h3>Save Together</h3>
                            <p>Traditional Korean "계" with blockchain transparency</p>
                        </div>
                        <div className={styles.benefit}>
                            <span className={styles.benefitIcon}>🔒</span>
                            <h3>Secure & Fair</h3>
                            <p>Smart contracts ensure everyone gets their turn</p>
                        </div>
                        <div className={styles.benefit}>
                            <span className={styles.benefitIcon}>📱</span>
                            <h3>LINE Integrated</h3>
                            <p>Share invites and updates in your group chats</p>
                        </div>
                    </div>
                    
                    <div className={styles.cta}>
                        <h2>Ready to start saving?</h2>
                        <p>Connect your wallet to create or join a savings circle</p>
                        <div className={styles.walletSection}>
                            <WalletButton setIsLoggedIn={setIsLoggedIn}/>
                        </div>
                    </div>
                    
                    <div className={styles.howItWorks}>
                        <h3>How it works</h3>
                        <div className={styles.steps}>
                            <div className={styles.step}>
                                <span className={styles.stepNumber}>1</span>
                                <span>Connect wallet</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepNumber}>2</span>
                                <span>Create or join circle</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepNumber}>3</span>
                                <span>Save with friends</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
