"use client";

import {useWalletAccountStore} from "@/components/Wallet/Account/auth.hooks";
import {useKaiaWalletSdk} from "@/components/Wallet/Sdk/walletSdk.hooks";
import {useKyeContracts} from "@/hooks/useKyeContracts";
import {WalletButton} from "@/components/Wallet/Button/WalletButton";
import {useCallback, useEffect, useState} from "react";
import * as Sentry from "@sentry/nextjs";
import styles from "./page.module.css";

export default function Event () {
    const { account, setAccount } = useWalletAccountStore();
    const { 
        disconnectWallet, 
        getBalance, 
        getErc20TokenBalance, 
        getAccount,
        getChainId,
        validateNetwork
    } = useKaiaWalletSdk();
    const { mintUsdt } = useKyeContracts();
    const [kaiaBalance, setKaiaBalance] = useState<string>('0');
    const [usdtBalance, setUsdtBalance] = useState<string>('0');
    const [loading, setLoading] = useState(false);
    const [minting, setMinting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

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
    
    // Mock USDT contract address from contract addresses utility
    const { addresses } = useKyeContracts();
    const MOCK_USDT_ADDRESS = addresses.MockUSDT;
    const fetchBalances = useCallback(async () => {
        if (!account) return;
        
        try {
            setLoading(true);
            console.log('🔄 [Profile] Fetching balances for account:', account);
            console.log('🔄 [Profile] USDT Address:', MOCK_USDT_ADDRESS);
            
            // Fetch Kaia native token balance
            const kaiaBalanceWei = await getBalance([account, 'latest']);
            const kaiaBalanceEther = (parseInt(kaiaBalanceWei as string, 16) / 1e18).toFixed(4);
            setKaiaBalance(kaiaBalanceEther);
            console.log('✅ [Profile] Kaia Balance updated:', kaiaBalanceEther, 'KAIA');
            
            // Fetch Mock USDT balance - check if address is available
            if (MOCK_USDT_ADDRESS) {
                const usdtBalanceWei = await getErc20TokenBalance(MOCK_USDT_ADDRESS, account);
                const usdtBalanceFormatted = (parseInt(usdtBalanceWei as string, 16) / 1e6).toFixed(2); // USDT has 6 decimals
                setUsdtBalance(usdtBalanceFormatted);
                console.log('✅ [Profile] USDT Balance updated:', usdtBalanceFormatted, 'USDT');
            } else {
                console.log('⚠️ [Profile] USDT Address not available yet, skipping USDT balance fetch');
                setUsdtBalance('Loading...');
            }
            
        } catch (error) {
            console.error('❌ [Profile] Error fetching balances:', error);
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

    // Enhanced network detection with chain ID validation
    const [networkStatus, setNetworkStatus] = useState(null);
    const [networkChecking, setNetworkChecking] = useState(false);
    
    const checkNetworkStatus = useCallback(async () => {
        if (!account) {
            alert('Please connect your wallet first');
            return;
        }
        
        try {
            setNetworkChecking(true);
            console.log('🔍 Checking network status with chain ID detection...');
            
            // Get current chain ID from wallet
            const currentChainId = await getChainId();
            const expectedChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1001');
            
            let statusMessage = '';
            
            console.log('Network Status Check:');
            console.log('- Expected Chain ID:', expectedChainId, '(Kaia Kairos Testnet)');
            console.log('- Current Chain ID:', currentChainId);
            
            if (currentChainId === expectedChainId) {
                statusMessage = 
                    `✅ Perfect! You're connected to the correct network!\n\n` +
                    `🌐 Network: Kaia Kairos Testnet\n` +
                    `🔗 Chain ID: ${currentChainId}\n` +
                    `🚀 Ready to mint USDT!\n\n` +
                    `DappPortalSDK Config: ✅ Matches\n` +
                    `Wallet Network: ✅ Matches`;
            } else {
                const networkNames = {
                    1: 'Ethereum Mainnet',
                    137: 'Polygon',
                    56: 'BSC',
                    1001: 'Kaia Kairos Testnet',
                    31337: 'Local Development'
                };
                
                const currentNetworkName = networkNames[currentChainId] || `Unknown Network (${currentChainId})`;
                
                statusMessage = 
                    `❌ Network Mismatch Found!\n\n` +
                    `🔧 Expected: Kaia Kairos Testnet (Chain ID: ${expectedChainId})\n` +
                    `⚠️ Current: ${currentNetworkName} (Chain ID: ${currentChainId})\n\n` +
                    `💡 Solution: Click "📋 Show Network Setup Guide" for step-by-step instructions!`;
            }
            
            setNetworkStatus(statusMessage);
            alert(statusMessage);
            
        } catch (error) {
            const errorMsg = `❌ Network check failed: ${error.message}`;
            setNetworkStatus(errorMsg);
            alert(errorMsg);
            console.error('Network check error:', error);
        } finally {
            setNetworkChecking(false);
        }
    }, [account, getChainId]);

    // Validate and instruct user to manually switch network
    const showNetworkInstructions = useCallback(async () => {
        if (!account) {
            alert('Please connect your wallet first');
            return;
        }
        
        try {
            console.log('🔍 Validating current network...');
            
            // This will throw an error with detailed instructions if network is wrong
            await validateNetwork();
            
            // If we get here, network is correct
            alert(
                '✅ Perfect! You\'re already connected to Kaia Kairos Testnet!\n\n' +
                '🚀 You can safely mint USDT and use all DApp features.\n' +
                '🔄 Refreshing balances...'
            );
            
            // Refresh balances since network is correct
            setTimeout(() => {
                fetchBalances();
            }, 1000);
            
        } catch (error) {
            console.log('Network validation failed, showing instructions:', error.message);
            // The error message from validateNetwork already contains detailed instructions
            alert(error.message);
        }
    }, [account, validateNetwork, fetchBalances]);

    // Test Sentry logging
    const testSentryLogging = useCallback(() => {
        console.log('🔍 Testing Sentry integration...');
        
        // Test breadcrumb
        Sentry.addBreadcrumb({
            message: 'Manual Sentry test triggered',
            category: 'test',
            level: 'info',
            data: {
                timestamp: new Date().toISOString(),
                userAction: 'test_button_click'
            }
        });
        
        // Test info message
        Sentry.captureMessage('Sentry test message from profile page', 'info');
        
        // Test warning
        Sentry.captureMessage('Sentry test warning - this is expected', 'warning');
        
        // Test error
        Sentry.captureException(new Error('Test error for Sentry - this is intentional'), {
            tags: {
                component: 'Profile',
                action: 'test_sentry'
            },
            extra: {
                testData: 'This is a test error to verify Sentry integration',
                timestamp: Date.now()
            }
        });
        
        alert('Sentry test events sent! Check your Sentry dashboard.');
        console.log('✅ Sentry test events sent');
    }, []);

    const onMintUsdtClick = useCallback(async () => {
        if (!account) return;
        
        const debugHelper = (window as any).__ERUDA_DEBUG__;
        
        try {
            setMinting(true);
            
            if (debugHelper) {
                debugHelper.group('USDT MINT PROCESS', () => {
                    debugHelper.log('MINT_START', {
                        account,
                        timestamp: new Date().toISOString(),
                        environment: {
                            NODE_ENV: process.env.NODE_ENV,
                            NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
                            NEXT_PUBLIC_CLIENT_ID: process.env.NEXT_PUBLIC_CLIENT_ID
                        }
                    });
                });
            } else {
                console.log('🟡 ERUDA DEBUG: Starting USDT mint process...');
                console.log('🟡 ERUDA DEBUG: Account:', account);
            }
            
            // Add manual Sentry event for mint start
            Sentry.addBreadcrumb({
                message: 'User initiated USDT mint from profile page',
                category: 'user_action',
                level: 'info',
                data: {
                    account: account,
                    timestamp: new Date().toISOString()
                }
            });
            
            // Network validation with enhanced debugging
            let currentChainId;
            try {
                currentChainId = await getChainId();
                
                if (debugHelper) {
                    debugHelper.log('NETWORK_CHECK', {
                        currentChainId,
                        expectedChainId: process.env.NEXT_PUBLIC_CHAIN_ID,
                        networkStatus: currentChainId.toString() === process.env.NEXT_PUBLIC_CHAIN_ID ? 'MATCH' : 'MISMATCH'
                    });
                }
                
                if (currentChainId.toString() !== process.env.NEXT_PUBLIC_CHAIN_ID) {
                    throw new Error(`Wrong network! Current: ${currentChainId}, Expected: ${process.env.NEXT_PUBLIC_CHAIN_ID}`);
                }
            } catch (networkError) {
                if (debugHelper) {
                    debugHelper.error('NETWORK_VALIDATION_FAILED', {
                        error: networkError,
                        currentChainId,
                        expectedChainId: process.env.NEXT_PUBLIC_CHAIN_ID
                    });
                }
                throw new Error(`Network error: ${networkError.message}`);
            }
            
            // Mint process with comprehensive logging
            const mintAmount = (1000 * 1e6).toString();
            
            if (debugHelper) {
                debugHelper.log('MINT_PARAMS', {
                    mintAmount,
                    mintAmountFormatted: '1000 USDT',
                    decimals: 6,
                    account
                });
            }
            
            const result = await mintUsdt(mintAmount);
            
            if (debugHelper) {
                debugHelper.success('MINT_SUCCESS', {
                    result,
                    transactionDetails: {
                        amount: mintAmount,
                        account,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            
            // Add success breadcrumb
            Sentry.addBreadcrumb({
                message: 'USDT mint completed successfully from profile page',
                category: 'user_action',
                level: 'info',
                data: {
                    transactionResult: result,
                    amount: mintAmount
                }
            });
            
            alert('✅ USDT minted successfully! Check Eruda console for transaction details.');
            
            // Refresh balances after minting
            setTimeout(() => {
                if (debugHelper) {
                    debugHelper.log('BALANCE_REFRESH', 'Refreshing balances after successful mint');
                }
                fetchBalances();
            }, 3000);
            
        } catch (error) {
            const errorDetails = {
                error,
                errorMessage: error?.message,
                errorStack: error?.stack,
                errorCode: error?.code,
                errorData: error?.data,
                account,
                timestamp: new Date().toISOString(),
                userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
                url: typeof window !== 'undefined' ? window.location.href : 'unknown'
            };
            
            if (debugHelper) {
                debugHelper.group('MINT ERROR ANALYSIS', () => {
                    debugHelper.error('MINT_FAILED', errorDetails);
                    
                    // Additional error context
                    debugHelper.error('ERROR_CLASSIFICATION', {
                        isNetworkError: error?.message?.includes('network') || error?.message?.includes('Network'),
                        isContractError: error?.code === -32603,
                        isUserRejected: error?.code === 4001,
                        isInsufficientFunds: error?.message?.includes('insufficient'),
                        errorType: error?.constructor?.name || 'Unknown'
                    });
                });
            } else {
                console.error('🔴 ERUDA DEBUG: MINT ERROR DETAILS:', errorDetails);
            }
            
            // Enhanced Sentry error capture
            Sentry.captureException(error, {
                tags: {
                    component: 'Profile',
                    action: 'mint_usdt_button',
                    location: 'profile_page',
                    errorCode: error?.code || 'unknown',
                    errorType: error?.constructor?.name || 'Unknown'
                },
                extra: {
                    ...errorDetails,
                    attemptedAmount: (1000 * 1e6).toString(),
                    errorContext: 'Profile page mint button click'
                }
            });
            
            // User-friendly error message with debugging guidance
            let errorMessage = 'Failed to mint USDT - Check Eruda console for details';
            if (error instanceof Error) {
                if (error.message.includes('network') || error.message.includes('Network')) {
                    errorMessage = `Network Error: ${error.message}\n\nTry switching to Kaia Kairos Testnet manually in your wallet.`;
                } else if (error?.code === 4001) {
                    errorMessage = 'Transaction rejected by user';
                } else if (error?.code === -32603) {
                    errorMessage = `Contract Error: ${error.message}\n\nCheck network and contract addresses.`;
                } else {
                    errorMessage = `Error: ${error.message}`;
                }
            }
            
            alert(`${errorMessage}\n\n🔧 For detailed debugging:\n1. Open Eruda console (bottom right floating button)\n2. Check the 'Console' tab for full error details\n3. Review 'Network' tab for API calls`);
            
        } finally {
            setMinting(false);
        }
    }, [account, mintUsdt, fetchBalances, getChainId]);
    
    useEffect(() => {
        if (account) {
            fetchBalances();
        }
    }, [account, fetchBalances]);

    // Auto-refresh when addresses become available
    useEffect(() => {
        if (account && addresses?.MockUSDT) {
            console.log('🔄 [Profile] Addresses loaded, refreshing balances...');
            fetchBalances();
        }
    }, [account, addresses, fetchBalances]);

    // Listen for balance update events from other pages (like circles page)
    useEffect(() => {
        if (!account) return;

        const handleBalanceUpdate = (event: any) => {
            const { detail } = event;
            console.log('📡 [Profile] Received balance update event:', detail);
            
            // If the event is for the current account, update our state directly
            if (detail.account === account) {
                setKaiaBalance(detail.kaiaBalance);
                setUsdtBalance(detail.usdtBalance);
                console.log('✅ [Profile] Balance updated from event:', {
                    kaia: detail.kaiaBalance,
                    usdt: detail.usdtBalance
                });
            }
        };

        window.addEventListener('balanceUpdated', handleBalanceUpdate);
        console.log('📡 [Profile] Balance update event listener registered');

        return () => {
            window.removeEventListener('balanceUpdated', handleBalanceUpdate);
            console.log('📡 [Profile] Balance update event listener removed');
        };
    }, [account]);
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
                                    <div className={styles.networkInfo}>
                                        <p>📡 <strong>Network:</strong> Kaia Kairos Testnet (Chain ID: 1001)</p>
                                    </div>
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
                                                <span className={styles.tokenBalance}>
                                                    {Number(usdtBalance).toLocaleString('en-US', {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                <div className={styles.buttonGroup}>
                                    <button 
                                        className={styles.refreshButton} 
                                        onClick={fetchBalances}
                                        disabled={loading}
                                    >
                                        {loading ? 'Refreshing...' : '🔄 Refresh Balances'}
                                    </button>
                                    
                                    <button 
                                        className={styles.mintButton} 
                                        onClick={onMintUsdtClick}
                                        disabled={minting || loading}
                                    >
                                        {minting ? 'Minting...' : '💰 Mint 1,000 USDT'}
                                    </button>

                                    <button 
                                        className={styles.faucetButton} 
                                        onClick={() => window.open('https://www.kaia.io/faucet', '_blank')}
                                    >
                                        🚰 Get KAIA Tokens
                                    </button>

                                </div>
                                
                                <button className={styles.button} onClick={onDisconnectButtonClick}>
                                    Disconnect Wallet
                                </button>
                            </div>
                        </>
                        : <>
                            <div className={styles.loginPrompt}>
                                <h2>Profile</h2>
                                <p>Please connect your wallet to view your profile and token balances.</p>
                                <WalletButton setIsLoggedIn={setIsLoggedIn}/>
                            </div>
                        </>
                }
            </div>
        </div>
    );
}