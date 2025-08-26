"use client";

import React from 'react';
import { useWalletAccountStore } from "@/components/Wallet/Account/auth.hooks";
import styles from './page.module.css';

export default function Circles() {
    const { account } = useWalletAccountStore();

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
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1>🤝 My Savings Circles</h1>
                    <p className={styles.subtitle}>
                        Create, join, and manage your Korean savings circles (Kye)
                    </p>
                </div>

                <div className={styles.actions}>
                    <div className={styles.actionCard}>
                        <div className={styles.actionIcon}>🏛️</div>
                        <h3>Create New Circle</h3>
                        <p>Start a 5-member savings circle with your LINE group</p>
                        <button className={styles.actionButton}>
                            Create Circle
                        </button>
                    </div>

                    <div className={styles.actionCard}>
                        <div className={styles.actionIcon}>🔍</div>
                        <h3>Join Circle</h3>
                        <p>Join existing circles shared by friends</p>
                        <button className={styles.actionButton}>
                            Browse Circles
                        </button>
                    </div>
                </div>

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
                    <h3>📚 How Kye Circles Work</h3>
                    <div className={styles.steps}>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>1</span>
                            <div>
                                <h4>Create or Join</h4>
                                <p>Form a 5-member circle with friends or join existing ones</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>2</span>
                            <div>
                                <h4>Regular Deposits</h4>
                                <p>Each member deposits USDT on scheduled rounds</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>3</span>
                            <div>
                                <h4>Automated Payouts</h4>
                                <p>Smart contracts ensure fair, transparent distributions</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}