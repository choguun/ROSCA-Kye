'use client';

import React from 'react';
import styles from './page.module.css';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('Circles page error:', error);

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.loginPrompt}>
          <h1>⚠️ Something went wrong</h1>
          <div className={styles.errorMessage}>
            <p>The circles page encountered an error:</p>
            <p><strong>{error.message}</strong></p>
          </div>
          <div className={styles.connectPrompt}>
            <button 
              onClick={() => reset()}
              className={styles.actionButton}
              style={{ marginRight: '1rem' }}
            >
              Try Again
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className={styles.actionButton}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}