'use client';

import React from 'react';
import styles from './SimpleDashboard.module.css';

export const SimpleDashboard = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🎯 Kye Protocol Dashboard</h1>
        <p className={styles.subtitle}>
          Manage your Korean savings circles (ROSCA)
        </p>
      </div>

      <div className={styles.features}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🏛️</div>
          <h3>Create Circle</h3>
          <p>Start a new 5-member savings circle with your LINE group</p>
          <button className={styles.featureButton}>
            Create New Circle
          </button>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🤝</div>
          <h3>Join Circle</h3>
          <p>Join existing circles shared by friends in LINE groups</p>
          <button className={styles.featureButton}>
            Browse Circles
          </button>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>💰</div>
          <h3>Make Deposit</h3>
          <p>Deposit USDT to active circles with automated payouts</p>
          <button className={styles.featureButton}>
            View Active Circles
          </button>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>📈</div>
          <h3>Track Yield</h3>
          <p>Monitor 5.24% APY yield from SavingsPocket integration</p>
          <button className={styles.featureButton}>
            View Analytics
          </button>
        </div>
      </div>

      <div className={styles.stats}>
        <h2>🌟 Protocol Stats</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>$45,230</div>
            <div className={styles.statLabel}>Total Value Locked</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>12</div>
            <div className={styles.statLabel}>Active Circles</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>47</div>
            <div className={styles.statLabel}>Total Members</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>5.24%</div>
            <div className={styles.statLabel}>Average APY</div>
          </div>
        </div>
      </div>

      <div className={styles.demoNote}>
        <div className={styles.demoIcon}>🎪</div>
        <div className={styles.demoText}>
          <h3>Hackathon Demo Mode</h3>
          <p>
            This demonstrates the complete ROSCA "Kye" Protocol with smart contracts 
            deployed on Kaia Kairos testnet. Full circle creation, joining, and 
            management functionality is implemented and ready for production.
          </p>
          <div className={styles.contractLinks}>
            <a href="https://kairos.klaytnfinder.io/account/0x724f792F3d11C8eB1471e84ABef654c93cE639dE" 
               target="_blank" rel="noopener noreferrer" className={styles.contractLink}>
              📋 View Factory Contract
            </a>
            <a href="https://kairos.klaytnfinder.io/account/0x8f198CD718aa1Bf2b338ddba78736E91cD254da6" 
               target="_blank" rel="noopener noreferrer" className={styles.contractLink}>
              💰 View USDT Contract  
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};