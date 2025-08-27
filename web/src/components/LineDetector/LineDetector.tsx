"use client";

import React, { useEffect, useState } from 'react';
import styles from './LineDetector.module.css';

export const LineDetector = () => {
    const [showLineModal, setShowLineModal] = useState(false);
    const [isLineApp, setIsLineApp] = useState(true);

    useEffect(() => {
        // Check if running in browser environment
        if (typeof window === 'undefined') return;

        // Get user agent
        const userAgent = window.navigator.userAgent;
        console.log('🔍 User Agent:', userAgent);

        // Check if accessing from LINE app
        const isFromLine = userAgent.includes('Line');
        
        console.log('📱 Is LINE app:', isFromLine);
        setIsLineApp(isFromLine);
        
        // Show modal if not from LINE app
        if (!isFromLine) {
            setShowLineModal(true);
        }
    }, []);

    const handleCloseModal = () => {
        setShowLineModal(false);
    };

    // Don't render anything if it's LINE app
    if (isLineApp || !showLineModal) {
        return null;
    }

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <div className={styles.lineIcon}>
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                            <rect width="48" height="48" rx="12" fill="#06C755"/>
                            <path d="M24 8C15.163 8 8 14.268 8 21.6c0 6.753 5.983 12.4 14.067 13.467.55.117.917-.233.917-.517v-1.817c-3.067.65-3.717-1.467-3.717-1.467-.5-1.267-1.217-1.6-1.217-1.6-.983-.667.083-.65.083-.65 1.083.083 1.65 1.1 1.65 1.1.967 1.633 2.533 1.167 3.15.9.1-.7.383-1.167.7-1.433-2.4-.267-4.917-1.183-4.917-5.3 0-1.167.417-2.117 1.1-2.867-.117-.283-.483-1.4.1-2.9 0 0 .9-.283 2.95 1.083A10.38 10.38 0 0124 17.7c.917.017 1.833.117 2.7.35 2.05-1.367 2.95-1.083 2.95-1.083.583 1.5.217 2.617.1 2.9.683.75 1.1 1.7 1.1 2.867 0 4.133-2.533 5.033-4.95 5.3.4.333.75 1 .75 2.017v2.983c0 .283.367.633.933.517C34.017 34 40 28.353 40 21.6 40 14.268 32.837 8 24 8z" fill="white"/>
                        </svg>
                    </div>
                    <h2>Open in LINE App</h2>
                    <button className={styles.closeButton} onClick={handleCloseModal}>×</button>
                </div>
                
                <div className={styles.modalBody}>
                    <div className={styles.instructionIcon}>📱</div>
                    <h3>This app is designed for LINE</h3>
                    <p className={styles.description}>
                        ROSCA Kye is integrated with LINE for the best experience. 
                        Please open this link in the LINE application to access all features.
                    </p>
                    
                    <div className={styles.steps}>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>1</span>
                            <span>Copy this page URL</span>
                        </div>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>2</span>
                            <span>Open LINE app</span>
                        </div>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>3</span>
                            <span>Paste URL in any chat</span>
                        </div>
                        <div className={styles.step}>
                            <span className={styles.stepNumber}>4</span>
                            <span>Tap the link to open</span>
                        </div>
                    </div>
                    
                    <div className={styles.urlCopy}>
                        <input 
                            type="text" 
                            value={typeof window !== 'undefined' ? window.location.href : ''}
                            readOnly
                            className={styles.urlInput}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button 
                            className={styles.copyButton}
                            onClick={() => {
                                if (typeof window !== 'undefined') {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert('✅ URL copied to clipboard!');
                                }
                            }}
                        >
                            Copy
                        </button>
                    </div>
                </div>
                
                <div className={styles.modalFooter}>
                    <button className={styles.continueButton} onClick={handleCloseModal}>
                        Continue Anyway
                    </button>
                </div>
            </div>
        </div>
    );
};