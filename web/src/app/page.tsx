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
                        <div className={styles.heroIcon}>🏠</div>
                        <h1 className={styles.heroTitle}>계 (Kye) - Korean Savings Heritage</h1>
                        <p className={styles.heroSubtitle}>
                            5,000 years of Korean trust tradition meets Web3 transparency
                        </p>
                        <p className={styles.culturalTag}>
                            🇰🇷 <em>From grandparents' wisdom to blockchain innovation</em>
                        </p>
                        <WalletButton setIsLoggedIn={setIsLoggedIn}/>
                    </div>
                    
                    <div className={styles.benefits}>
                        <div className={styles.benefit}>
                            <span className={styles.benefitIcon}>🏛️</span>
                            <h3>Cultural Heritage</h3>
                            <p>Traditional Korean "계" rotating savings circles - trusted by families for generations</p>
                        </div>
                        <div className={styles.benefit}>
                            <span className={styles.benefitIcon}>🤝</span>
                            <h3>Community Bonds</h3>
                            <p>Build deeper friendships through shared financial goals and mutual accountability</p>
                        </div>
                        <div className={styles.benefit}>
                            <span className={styles.benefitIcon}>⚡</span>
                            <h3>Web3 Enhanced</h3>
                            <p>Blockchain transparency eliminates trust issues while preserving Korean social values</p>
                        </div>
                    </div>
                    
                    <div className={styles.competitiveAdvantage}>
                        <h3>Why Kye + Kaia Dominates Generic Group Buying</h3>
                        <div className={styles.comparisonGrid}>
                            <div className={styles.comparisonCard}>
                                <span className={styles.comparisonIcon}>❌</span>
                                <h4>Generic Commerce Apps</h4>
                                <ul>
                                    <li>Depend on merchants & complex backends</li>
                                    <li>Users must hold native tokens for gas</li>
                                    <li>Bridged USDT with delays & risks</li>
                                    <li>No real community building</li>
                                    <li>Theoretical "x402" integrations</li>
                                </ul>
                            </div>
                            <div className={styles.comparisonCard}>
                                <span className={styles.comparisonIcon}>✅</span>
                                <h4>Kye + Kaia Blockchain</h4>
                                <ul>
                                    <li>Pure peer-to-peer Korean heritage</li>
                                    <li>Pay fees with USDT (trustless gas abstraction)</li>
                                    <li>Native USDT by Tether (not bridged)</li>
                                    <li>Deep social bonds through LINE integration</li>
                                    <li>REAL tech: 250M+ users, EVM compatible</li>
                                </ul>
                            </div>
                        </div>
                        <div className={styles.kaiaAdvantage}>
                            <div className={styles.kaiaIcon}>🚨</div>
                            <div>
                                <h4>EXPOSED: Competitor's False "x402" Claims vs Our Reality:</h4>
                                <p><strong>Their Code:</strong> Standard ERC20 transfers, users pay gas, no x402 found • <strong>Our Reality:</strong> REAL gas abstraction, native USDT, 250M+ LINE users, Korean heritage</p>
                                <div className={styles.evidenceLink}>
                                    <span>📋 Technical proof available in code analysis</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.cta}>
                        <h2>Join the Korean Heritage Revolution</h2>
                        <p>Experience authentic community savings with Web3 security</p>
                        <div className={styles.statsRow}>
                            <div className={styles.stat}>
                                <span className={styles.statNumber}>5,000+</span>
                                <span className={styles.statLabel}>Years of Trust</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statNumber}>100%</span>
                                <span className={styles.statLabel}>Transparent</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statNumber}>5</span>
                                <span className={styles.statLabel}>Member Circles</span>
                            </div>
                        </div>
                        <div className={styles.walletSection}>
                            <WalletButton setIsLoggedIn={setIsLoggedIn}/>
                        </div>
                    </div>
                    
                    <div className={styles.howItWorks}>
                        <h3>Traditional Korean Savings, Simplified</h3>
                        <div className={styles.steps}>
                            <div className={styles.step}>
                                <span className={styles.stepNumber}>1</span>
                                <span>Form trusted circle</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepNumber}>2</span>
                                <span>Monthly USDT deposits</span>
                            </div>
                            <div className={styles.step}>
                                <span className={styles.stepNumber}>3</span>
                                <span>Take turns receiving</span>
                            </div>
                        </div>
                        <p className={styles.culturalNote}>
                            <em>Just like your Korean grandparents did, but with blockchain security</em>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
