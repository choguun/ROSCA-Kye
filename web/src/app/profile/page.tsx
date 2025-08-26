"use client";

import {useWalletAccountStore} from "@/components/Wallet/Account/auth.hooks";
import {useKaiaWalletSdk} from "@/components/Wallet/Sdk/walletSdk.hooks";
import {useCallback, useEffect, useState} from "react";
import styles from "./page.module.css";

export default function Event () {
    const { account, setAccount } = useWalletAccountStore();
    const { disconnectWallet, getBalance, getErc20TokenBalance } = useKaiaWalletSdk();
    const [kaiaBalance, setKaiaBalance] = useState<string>('0');
    const [usdtBalance, setUsdtBalance] = useState<string>('0');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    
    // Mock USDT contract address on Kairos testnet
    const MOCK_USDT_ADDRESS = '0x8f198CD718aa1Bf2b338ddba78736E91cD254da6';
    const fetchBalances = useCallback(async () => {
        if (!account) return;
        
        try {
            setLoading(true);
            
            // Fetch Kaia native token balance
            const kaiaBalanceWei = await getBalance([account, 'latest']);
            const kaiaBalanceEther = (parseInt(kaiaBalanceWei as string, 16) / 1e18).toFixed(4);
            setKaiaBalance(kaiaBalanceEther);
            
            // Fetch Mock USDT balance
            const usdtBalanceWei = await getErc20TokenBalance(MOCK_USDT_ADDRESS, account);
            const usdtBalanceFormatted = (parseInt(usdtBalanceWei as string, 16) / 1e6).toFixed(2); // USDT has 6 decimals
            setUsdtBalance(usdtBalanceFormatted);
            
        } catch (error) {
            console.error('Error fetching balances:', error);
            setKaiaBalance('Error');
            setUsdtBalance('Error');
        } finally {
            setLoading(false);
        }
    }, [account, getBalance, getErc20TokenBalance, MOCK_USDT_ADDRESS]);
    
    const copyToClipboard = useCallback(async () => {
        if (!account) return;
        
        try {
            await navigator.clipboard.writeText(account);
            setCopied(true);
            
            // Reset copy state after 2 seconds
            setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch (err) {
            console.error('Failed to copy address:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = account;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            setCopied(true);
            setTimeout(() => {
                setCopied(false);
            }, 2000);
        }
    }, [account]);
    
    const onDisconnectButtonClick = useCallback(()=>{
        disconnectWallet().then(()=> {
            setAccount(null);
            setKaiaBalance('0');
            setUsdtBalance('0');
            setCopied(false);
        });
    },[disconnectWallet, setAccount]);
    
    useEffect(() => {
        if (account) {
            fetchBalances();
        }
    }, [account, fetchBalances]);
    return (
        <div className={styles.root}>
            <div className={styles.body}>
                {
                    account ?
                        <>
                            <div className={styles.walletInfo}>
                                <h2>Wallet Profile</h2>
                                <div className={styles.addressSection}>
                                    <p className={styles.addressLabel}><strong>Address:</strong></p>
                                    <div className={styles.addressContainer}>
                                        <span className={styles.addressText}>
                                            {account.slice(0, 8) + '...' + account.slice(-6)}
                                        </span>
                                        <button 
                                            className={styles.copyButton}
                                            onClick={copyToClipboard}
                                            title="Copy full address"
                                        >
                                            {copied ? '✓' : '📋'}
                                        </button>
                                    </div>
                                    {copied && (
                                        <span className={styles.copiedMessage}>Address copied!</span>
                                    )}
                                </div>
                                
                                <div className={styles.balances}>
                                    <h3>Token Balances</h3>
                                    {loading ? (
                                        <p>Loading balances...</p>
                                    ) : (
                                        <>
                                            <div className={styles.balanceItem}>
                                                <span className={styles.tokenName}>💎 KAIA:</span>
                                                <span className={styles.tokenBalance}>{kaiaBalance}</span>
                                            </div>
                                            <div className={styles.balanceItem}>
                                                <span className={styles.tokenName}>💰 Mock USDT:</span>
                                                <span className={styles.tokenBalance}>{usdtBalance}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                <button 
                                    className={styles.refreshButton} 
                                    onClick={fetchBalances}
                                    disabled={loading}
                                >
                                    {loading ? 'Refreshing...' : '🔄 Refresh Balances'}
                                </button>
                                
                                <button className={styles.button} onClick={onDisconnectButtonClick}>
                                    Disconnect Wallet
                                </button>
                            </div>
                        </>
                        : <>
                            <div className={styles.loginPrompt}>
                                <h2>Profile</h2>
                                <p>Please connect your wallet to view your profile and token balances.</p>
                            </div>
                        </>
                }
            </div>
        </div>
    );
}