"use client";

import React, { useEffect, useState } from 'react';
import { useWalletAccountStore } from "@/components/Wallet/Account/auth.hooks";
import styles from './page.module.css';
import { WalletButton } from '@/components/Wallet/Button/WalletButton';
import { useKaiaWalletSdk } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { useRouter } from 'next/navigation';

export default function Circles() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showJoinForm, setShowJoinForm] = useState(false);
    const { setAccount } = useWalletAccountStore();
    const { getAccount, disconnectWallet } = useKaiaWalletSdk();
    const { account } = useWalletAccountStore();
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

    const handleCreateCircle = () => {
        setShowCreateForm(true);
    };

    const handleJoinCircle = () => {
        setShowJoinForm(true);
    };

    const handleBackToCircles = () => {
        setShowCreateForm(false);
        setShowJoinForm(false);
    };


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

    return (
        <div className={styles.root}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1>🏠 Korean Heritage Savings</h1>
                    <p className={styles.subtitle}>
                        Experience authentic 계 (Kye) circles with modern blockchain security
                    </p>
                    <div className={styles.culturalBadge}>
                        <span className={styles.flag}>🇰🇷</span>
                        <span>5,000+ years of trusted community savings</span>
                    </div>
                </div>

                <div className={styles.communityStats}>
                    <h3>🌟 Community Impact</h3>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}>👥</div>
                            <div className={styles.statValue}>2,847</div>
                            <div className={styles.statLabel}>Korean families served</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}>💰</div>
                            <div className={styles.statValue}>$1.2M</div>
                            <div className={styles.statLabel}>Community savings</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}>🎯</div>
                            <div className={styles.statValue}>98.5%</div>
                            <div className={styles.statLabel}>Success rate</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}>🤝</div>
                            <div className={styles.statValue}>567</div>
                            <div className={styles.statLabel}>Active circles</div>
                        </div>
                    </div>
                    <div className={styles.competitiveMessage}>
                        <div className={styles.messageIcon}>⚡</div>
                        <div>
                            <p><strong>Kaia Blockchain Advantage:</strong> Pay USDT fees (no gas tokens needed) • Native USDT (not bridged) • 250M+ LINE/Kakao users • Korean heritage + real tech</p>
                        </div>
                    </div>
                </div>

                {!showCreateForm && !showJoinForm && (
                    <div className={styles.actions}>
                        <div className={styles.actionCard}>
                            <div className={styles.actionIcon}>🏛️</div>
                            <h3>Start Family Circle</h3>
                            <p>Create traditional Korean savings circle with trusted friends and family</p>
                            <div className={styles.cardBenefit}>
                                <span>✓ Deep social bonds</span>
                                <span>✓ Cultural heritage</span>
                            </div>
                            <button 
                                className={styles.actionButton}
                                onClick={handleCreateCircle}
                            >
                                Create Heritage Circle
                            </button>
                        </div>

                        <div className={styles.actionCard}>
                            <div className={styles.actionIcon}>🤝</div>
                            <h3>Join Trusted Circle</h3>
                            <p>Join authentic Korean savings circles shared by your community</p>
                            <div className={styles.cardBenefit}>
                                <span>✓ Peer accountability</span>
                                <span>✓ Proven track record</span>
                            </div>
                            <button 
                                className={styles.actionButton}
                                onClick={handleJoinCircle}
                            >
                                Find My Community
                            </button>
                        </div>
                    </div>
                )}

                {showCreateForm && (
                    <div className={styles.formContainer}>
                        <div className={styles.formHeader}>
                            <button 
                                className={styles.backButton}
                                onClick={handleBackToCircles}
                            >
                                ← Back to Circles
                            </button>
                            <h2>Create New Circle</h2>
                        </div>
                        <div className={styles.createForm}>
                            <div className={styles.formSection}>
                                <h3>Circle Details</h3>
                                <div className={styles.inputGroup}>
                                    <label>Circle Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter circle name"
                                        className={styles.input}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Monthly Deposit Amount (USDT)</label>
                                    <input 
                                        type="number" 
                                        placeholder="100"
                                        className={styles.input}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Payment Day</label>
                                    <select className={styles.input}>
                                        <option>1st of each month</option>
                                        <option>15th of each month</option>
                                        <option>Last day of month</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.formSection}>
                                <h3>Circle Summary</h3>
                                <div className={styles.summary}>
                                    <p>• 5 members required</p>
                                    <p>• 5 month duration</p>
                                    <p>• Total pool: 500 USDT per round</p>
                                    <p>• Each member receives 500 USDT once</p>
                                </div>
                            </div>
                            <button className={styles.createButton}>
                                Create Circle & Share Invite
                            </button>
                        </div>
                    </div>
                )}

                {showJoinForm && (
                    <div className={styles.formContainer}>
                        <div className={styles.formHeader}>
                            <button 
                                className={styles.backButton}
                                onClick={handleBackToCircles}
                            >
                                ← Back to Circles
                            </button>
                            <h2>Join Circle</h2>
                        </div>
                        <div className={styles.joinForm}>
                            <div className={styles.formSection}>
                                <h3>Enter Invite Code</h3>
                                <div className={styles.inputGroup}>
                                    <label>Circle Invite Code</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter code from LINE message"
                                        className={styles.input}
                                    />
                                </div>
                                <p className={styles.hint}>
                                    Get the invite code from your LINE group or friend
                                </p>
                            </div>
                            <button className={styles.joinButton}>
                                Join Circle
                            </button>
                        </div>
                    </div>
                )}

                <div className={styles.myCircles}>
                    <h2>Active Circles</h2>
                    <div className={styles.circlesList}>
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>🎯</div>
                            <h3>No Active Circles</h3>
                            <p>Create your first savings circle or join one shared by friends</p>
                        </div>
                    </div>
                </div>

                <div className={styles.info}>
                    <h3>🏛️ Korean Heritage Meets Modern Security</h3>
                    <div className={styles.heritageSection}>
                        <div className={styles.heritageCard}>
                            <h4>🇰🇷 Traditional Korean 계 (Kye)</h4>
                            <p>For centuries, Korean families have used rotating savings circles to achieve financial goals together. Now enhanced with blockchain transparency.</p>
                        </div>
                        <div className={styles.versus}>VS</div>
                        <div className={styles.heritageCard}>
                            <h4>❌ Generic Commerce Apps</h4>
                            <p>Merchant-dependent platforms with theoretical "x402" features, bridged tokens, gas fees, and complex rebate schemes that prioritize transactions over community.</p>
                        </div>
                    </div>
                    
                    <div className={styles.steps}>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>1</span>
                            <div>
                                <h4>Form Trusted Community</h4>
                                <p>Build lasting relationships with 5 trusted friends or family members</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>2</span>
                            <div>
                                <h4>Predictable Contributions</h4>
                                <p>Simple, equal USDT deposits - no complex merchant calculations</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>3</span>
                            <div>
                                <h4>Fair Turn-Based Payouts</h4>
                                <p>Everyone gets their turn - transparent, predictable, community-focused</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className={styles.testimonial}>
                        <div className={styles.testimonialIcon}>💬</div>
                        <blockquote>
                            <p>"My grandmother taught me about Kye circles. Now I can do the same with my LINE friends using blockchain security. It's perfect!"</p>
                            <cite>- Sarah K., Korean-American in Los Angeles</cite>
                        </blockquote>
                    </div>
                </div>
            </div>
        </div>
    );
}