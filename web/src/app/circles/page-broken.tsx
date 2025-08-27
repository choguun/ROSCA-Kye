"use client";

import React from 'react';
import { WalletWrapper } from './components/WalletWrapper';
import styles from './page.module.css';

export default function Circles() {
    return (
        <WalletWrapper>
            {(account) => (
                <div className={styles.root}>
                    <div className={styles.container}>
                        <div className={styles.header}>
                            <h1>🤝 Savings Circles</h1>
                            <p className={styles.subtitle}>
                                Create or join Korean savings circles (Kye)
                            </p>
                            <p style={{ fontSize: '0.875rem', color: '#666' }}>
                                Connected: {account}
                            </p>
                        </div>

                        <div className={styles.actions}>
                            <div className={styles.actionCard}>
                                <div className={styles.actionIcon}>➕</div>
                                <h3>Create Circle</h3>
                                <p>Start a new savings circle</p>
                                <button className={styles.actionButton}>
                                    Create
                                </button>
                            </div>

                            <div className={styles.actionCard}>
                                <div className={styles.actionIcon}>🔗</div>
                                <h3>Join Circle</h3>
                                <p>Join an existing circle</p>
                                <button className={styles.actionButton}>
                                    Join
                                </button>
                            </div>
                        </div>

                        <div className={styles.myCircles}>
                            <h2>My Circles</h2>
                            <div className={styles.circlesList}>
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyIcon}>🎯</div>
                                    <h3>No Active Circles</h3>
                                    <p>Create or join your first circle</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </WalletWrapper>
    );
}
                <div className={styles.header}>
                    <h1>🤝 Savings Circles</h1>
                    <p className={styles.subtitle}>
                        Create or join Korean savings circles (Kye)
                    </p>
                </div>

                <div className={styles.actions}>
                    <div className={styles.actionCard}>
                        <div className={styles.actionIcon}>➕</div>
                        <h3>Create Circle</h3>
                        <p>Start a new savings circle</p>
                        <button className={styles.actionButton}>
                            Create
                        </button>
                    </div>

                    <div className={styles.actionCard}>
                        <div className={styles.actionIcon}>🔗</div>
                        <h3>Join Circle</h3>
                        <p>Join an existing circle</p>
                        <button className={styles.actionButton}>
                            Join
                        </button>
                    </div>
                </div>

                <div className={styles.myCircles}>
                    <h2>My Circles</h2>
                    <div className={styles.circlesList}>
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>🎯</div>
                            <h3>No Active Circles</h3>
                            <p>Create or join your first circle</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}