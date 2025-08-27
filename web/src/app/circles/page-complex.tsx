"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useWalletAccountStore } from "@/components/Wallet/Account/auth.hooks";
import styles from './page.module.css';
import { WalletButton } from '@/components/Wallet/Button/WalletButton';
import { useKaiaWalletSdk } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { useKyeContracts } from '@/hooks/useKyeContracts';
import { useRouter } from 'next/navigation';

export default function Circles() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showJoinForm, setShowJoinForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [circleName, setCircleName] = useState('');
    const [monthlyAmount, setMonthlyAmount] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [myCircles, setMyCircles] = useState<any[]>([]);
    const [loadingCircles, setLoadingCircles] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);
    
    // Store hooks
    const { setAccount, account } = useWalletAccountStore();
    const router = useRouter();
    
    // SDK hooks - must be called unconditionally
    const walletSdk = useKaiaWalletSdk();
    const contracts = useKyeContracts();
    
    // Safely extract methods with fallbacks
    const getAccount = walletSdk?.getAccount;
    const disconnectWallet = walletSdk?.disconnectWallet;
    const getChainId = walletSdk?.getChainId;
    const getBalance = walletSdk?.getBalance;
    const getErc20TokenBalance = walletSdk?.getErc20TokenBalance;
    const createCircle = contracts?.createCircle;
    const joinCircle = contracts?.joinCircle;
    const getCircleDetails = contracts?.getCircleDetails;
    const addresses = contracts?.addresses;
    
    // Balance detection state
    const [kaiaBalance, setKaiaBalance] = useState<string>('0');
    const [usdtBalance, setUsdtBalance] = useState<string>('0');
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [balanceLoading, setBalanceLoading] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        setInitialized(true);
    }, []);

    useEffect(() => {
        if (!isMounted || !initialized || !getAccount) return;
        
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
            }
        };
        
        checkExistingAccount();
    }, [getAccount, setAccount, isMounted, initialized]);
    
    // Check balances and fetch circles when account changes
    useEffect(() => {
        if (account) {
            checkBalances();
            fetchMyCircles();
        }
    }, [account, checkBalances, fetchMyCircles]);

    const handleCreateCircle = () => {
        setShowCreateForm(true);
    };

    const handleJoinCircle = () => {
        setShowJoinForm(true);
    };

    const handleBackToCircles = () => {
        setShowCreateForm(false);
        setShowJoinForm(false);
        // Reset form data
        setCircleName('');
        setMonthlyAmount('');
        setInviteCode('');
    };
    
    const checkBalances = useCallback(async () => {
        if (!account || !getBalance || !getErc20TokenBalance || !addresses?.MockUSDT) {
            setKaiaBalance('0');
            setUsdtBalance('0');
            return;
        }
        
        try {
            console.log('💰 Checking balances for account:', account);
            setBalanceLoading(true);
            setError(null);
            
            // Fetch Kaia native token balance
            const kaiaBalanceWei = await getBalance([account, 'latest']);
            const kaiaBalanceEther = (parseInt(kaiaBalanceWei as string, 16) / 1e18);
            setKaiaBalance(kaiaBalanceEther.toString());
            
            // Fetch Mock USDT balance  
            const usdtBalanceWei = await getErc20TokenBalance(addresses.MockUSDT, account);
            const usdtBalanceFormatted = (parseInt(usdtBalanceWei as string, 16) / 1e6); // USDT has 6 decimals
            setUsdtBalance(usdtBalanceFormatted.toString());
            
            console.log('💰 Balances:', {
                kaia: kaiaBalanceEther,
                usdt: usdtBalanceFormatted
            });
            
            // Show modal if user has insufficient balances
            const hasKaia = kaiaBalanceEther > 0.001; // Need at least 0.001 KAIA for gas
            const hasUsdt = usdtBalanceFormatted > 0; // Need some USDT for deposits
            
            if (!hasKaia || !hasUsdt) {
                console.log('⚠️ Insufficient balances detected, showing modal');
                setShowTokenModal(true);
            }
            
        } catch (error) {
            console.error('❌ Error checking balances:', error);
            setKaiaBalance('Error');
            setUsdtBalance('Error');
            setError('Failed to check balances');
        } finally {
            setBalanceLoading(false);
        }
    }, [account, getBalance, getErc20TokenBalance, addresses?.MockUSDT]);

    const fetchMyCircles = useCallback(async () => {
        if (!account) {
            setMyCircles([]);
            return;
        }
        
        try {
            console.log('🔍 Fetching circles for account:', account);
            setLoadingCircles(true);
            setError(null);
            
            // Get recently created circles from localStorage (demo persistence)
            let recentCircles: any[] = [];
            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    const stored = localStorage.getItem('recentCircles');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        recentCircles = Array.isArray(parsed) ? parsed : [];
                    }
                }
            } catch (e) {
                console.warn('LocalStorage error:', e);
                setError('Failed to load saved circles');
            }
            
            console.log('✅ Found circles:', recentCircles);
            setMyCircles(recentCircles || []);
            
        } catch (error) {
            console.error('❌ Error fetching circles:', error);
            setMyCircles([]);
            setError('Failed to fetch circles');
        } finally {
            setLoadingCircles(false);
        }
    }, [account]);

    const onCreateCircleClick = useCallback(async () => {
        if (!account) {
            alert('Please connect your wallet first');
            return;
        }
        
        if (!createCircle) {
            alert('Contract integration not ready. Please refresh the page.');
            return;
        }
        
        if (!circleName.trim()) {
            alert('Please enter a circle name');
            return;
        }
        
        if (!monthlyAmount || parseFloat(monthlyAmount) <= 0) {
            alert('Please enter a valid monthly amount');
            return;
        }
        
        try {
            setCreating(true);
            
            console.log('🎯 Creating circle:', {
                name: circleName,
                amount: monthlyAmount,
                account
            });
            
            // Network validation
            const currentChainId = await getChainId();
            if (currentChainId.toString() !== process.env.NEXT_PUBLIC_CHAIN_ID) {
                throw new Error(`Wrong network! Current: ${currentChainId}, Expected: ${process.env.NEXT_PUBLIC_CHAIN_ID}`);
            }
            
            // Convert amount to proper format (USDT has 6 decimals)
            const amountInUSDT = (parseFloat(monthlyAmount) * 1e6).toString();
            
            const result = await createCircle(circleName, amountInUSDT);
            
            console.log('✅ Circle created successfully:', result);
            
            alert(`✅ Circle "${circleName}" created successfully!\n\nShare the circle address with your friends to let them join.`);
            
            // Store created circle for demo persistence  
            try {
                if (typeof window !== 'undefined' && localStorage) {
                    const createdCircle = {
                        name: circleName,
                        depositAmount: monthlyAmount,
                        memberCount: 1,
                        phase: 'Setup',
                        isCreator: true,
                        createdAt: Date.now(),
                        address: 'pending-' + Date.now()
                    };
                    
                    const existing = JSON.parse(localStorage.getItem('recentCircles') || '[]');
                    existing.push(createdCircle);
                    localStorage.setItem('recentCircles', JSON.stringify(existing));
                }
            } catch (e) {
                console.warn('Failed to save to localStorage:', e);
            }
            
            // Reset form and go back to main view
            setCircleName('');
            setMonthlyAmount('');
            setShowCreateForm(false);
            
            // Refresh circles list
            setTimeout(() => fetchMyCircles(), 100);
            
        } catch (error) {
            console.error('❌ Error creating circle:', error);
            
            let errorMessage = 'Failed to create circle';
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
            
            alert(errorMessage);
            
        } finally {
            setCreating(false);
        }
    }, [account, circleName, monthlyAmount, createCircle, getChainId]);
    
    const onJoinCircleClick = useCallback(async () => {
        if (!account) {
            alert('Please connect your wallet first');
            return;
        }
        
        if (!joinCircle) {
            alert('Contract integration not ready. Please refresh the page.');
            return;
        }
        
        if (!inviteCode.trim()) {
            alert('Please enter an invite code');
            return;
        }
        
        try {
            setJoining(true);
            
            console.log('🤝 Joining circle:', {
                inviteCode: inviteCode,
                account
            });
            
            // Network validation
            const currentChainId = await getChainId();
            if (currentChainId.toString() !== process.env.NEXT_PUBLIC_CHAIN_ID) {
                throw new Error(`Wrong network! Current: ${currentChainId}, Expected: ${process.env.NEXT_PUBLIC_CHAIN_ID}`);
            }
            
            const result = await joinCircle(inviteCode);
            
            console.log('✅ Joined circle successfully:', result);
            
            alert(`✅ Successfully joined the circle!\n\nWelcome to the savings group.`);
            
            // Reset form and go back to main view
            setInviteCode('');
            setShowJoinForm(false);
            
        } catch (error) {
            console.error('❌ Error joining circle:', error);
            
            let errorMessage = 'Failed to join circle';
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
            
            alert(errorMessage);
            
        } finally {
            setJoining(false);
        }
    }, [account, inviteCode, joinCircle, getChainId]);

    const handleGoToProfile = useCallback(() => {
        setShowTokenModal(false);
        router.push('/profile');
    }, [router]);

    const handleCloseModal = useCallback(() => {
        setShowTokenModal(false);
    }, []);


    // Show loading state during initialization
    if (!isMounted) {
        return (
            <div className={styles.root}>
                <div className={styles.container}>
                    <div className={styles.loginPrompt}>
                        <h1>🤝 Savings Circles</h1>
                        <p>Loading...</p>
                    </div>
                </div>
            </div>
        );
    }
    
    if (!account) {
        return (
            <div className={styles.root}>
                <div className={styles.container}>
                    <div className={styles.loginPrompt}>
                        <h1>🤝 Savings Circles</h1>
                        <p>Connect your wallet to create or join Korean savings circles (Kye)</p>
                        {error && (
                            <div className={styles.errorMessage}>
                                <p>⚠️ {error}</p>
                            </div>
                        )}
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
                    <h1>🤝 Savings Circles</h1>
                    <p className={styles.subtitle}>
                        Create or join Korean savings circles (Kye)
                    </p>
                </div>

                {!showCreateForm && !showJoinForm && (
                    <div className={styles.actions}>
                        <div className={styles.actionCard}>
                            <div className={styles.actionIcon}>➕</div>
                            <h3>Create Circle</h3>
                            <p>Start a new savings circle</p>
                            <button 
                                className={styles.actionButton}
                                onClick={handleCreateCircle}
                            >
                                Create
                            </button>
                        </div>

                        <div className={styles.actionCard}>
                            <div className={styles.actionIcon}>🔗</div>
                            <h3>Join Circle</h3>
                            <p>Join an existing circle</p>
                            <button 
                                className={styles.actionButton}
                                onClick={handleJoinCircle}
                            >
                                Join
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
                            <div className={styles.inputGroup}>
                                <label>Circle Name</label>
                                <input 
                                    type="text" 
                                    placeholder="Enter circle name"
                                    className={styles.input}
                                    value={circleName}
                                    onChange={(e) => setCircleName(e.target.value)}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Monthly Amount (USDT)</label>
                                <input 
                                    type="number" 
                                    placeholder="100"
                                    className={styles.input}
                                    value={monthlyAmount}
                                    onChange={(e) => setMonthlyAmount(e.target.value)}
                                />
                            </div>
                            <button 
                                className={styles.createButton}
                                onClick={onCreateCircleClick}
                                disabled={creating || !circleName.trim() || !monthlyAmount}
                            >
                                {creating ? 'Creating Circle...' : 'Create Circle'}
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
                            <div className={styles.inputGroup}>
                                <label>Invite Code</label>
                                <input 
                                    type="text" 
                                    placeholder="Enter invite code"
                                    className={styles.input}
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value)}
                                />
                            </div>
                            <button 
                                className={styles.joinButton}
                                onClick={onJoinCircleClick}
                                disabled={joining || !inviteCode.trim()}
                            >
                                {joining ? 'Joining Circle...' : 'Join Circle'}
                            </button>
                        </div>
                    </div>
                )}

                <div className={styles.myCircles}>
                    <h2>My Circles</h2>
                    <div className={`${styles.circlesList} ${myCircles.length === 0 && !loadingCircles ? styles.centered : ''}`}>
                        {loadingCircles ? (
                            <div className={styles.loadingState}>
                                <div className={styles.loadingIcon}>⏳</div>
                                <h3>Loading Circles...</h3>
                                <p>Fetching your circles...</p>
                            </div>
                        ) : myCircles.length > 0 ? (
                            myCircles.map((circle, index) => (
                                <div key={`circle-${index}-${circle.address || 'unknown'}`} className={styles.circleCard}>
                                    <div className={styles.circleHeader}>
                                        <h3>{circle.name || 'Unnamed Circle'}</h3>
                                        <span className={`${styles.phasebadge} ${circle.phase ? styles[circle.phase.toLowerCase()] || '' : ''}`}>
                                            {circle.phase || 'Setup'}
                                        </span>
                                    </div>
                                    <div className={styles.circleInfo}>
                                        <div className={styles.infoItem}>
                                            <span className={styles.label}>Monthly Amount:</span>
                                            <span className={styles.value}>{circle.depositAmount || '0'} USDT</span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <span className={styles.label}>Members:</span>
                                            <span className={styles.value}>{circle.memberCount || 1}/5</span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <span className={styles.label}>Role:</span>
                                            <span className={styles.value}>{circle.isCreator ? 'Creator' : 'Member'}</span>
                                        </div>
                                    </div>
                                    <div className={styles.circleActions}>
                                        <button className={styles.viewButton}>
                                            View Details
                                        </button>
                                        {circle.isCreator && circle.phase === 'Setup' && (
                                            <button className={styles.inviteButton}>
                                                Invite Members
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>🎯</div>
                                <h3>No Active Circles</h3>
                                <p>Create or join your first circle</p>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Token Balance Modal */}
                {showTokenModal && (
                    <div className={styles.modalOverlay} onClick={handleCloseModal}>
                        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>⚠️ Insufficient Token Balance</h3>
                                <button className={styles.modalCloseButton} onClick={handleCloseModal}>×</button>
                            </div>
                            <div className={styles.modalBody}>
                                <p className={styles.modalDescription}>
                                    To participate in savings circles, you need both:
                                </p>
                                <div className={styles.tokenRequirements}>
                                    <div className={`${styles.tokenItem} ${parseFloat(kaiaBalance) > 0.001 ? styles.sufficient : styles.insufficient}`}>
                                        <span className={styles.tokenIcon}>💎</span>
                                        <div className={styles.tokenInfo}>
                                            <span className={styles.tokenName}>KAIA (Native Token)</span>
                                            <span className={styles.tokenPurpose}>For transaction gas fees</span>
                                            <span className={styles.tokenBalance}>
                                                Balance: {balanceLoading ? 'Loading...' : `${parseFloat(kaiaBalance).toFixed(4)} KAIA`}
                                            </span>
                                        </div>
                                        {parseFloat(kaiaBalance) > 0.001 ? (
                                            <span className={styles.statusIcon}>✅</span>
                                        ) : (
                                            <span className={styles.statusIcon}>❌</span>
                                        )}
                                    </div>
                                    <div className={`${styles.tokenItem} ${parseFloat(usdtBalance) > 0 ? styles.sufficient : styles.insufficient}`}>
                                        <span className={styles.tokenIcon}>💰</span>
                                        <div className={styles.tokenInfo}>
                                            <span className={styles.tokenName}>Mock USDT</span>
                                            <span className={styles.tokenPurpose}>For circle deposits</span>
                                            <span className={styles.tokenBalance}>
                                                Balance: {balanceLoading ? 'Loading...' : `${parseFloat(usdtBalance).toFixed(2)} USDT`}
                                            </span>
                                        </div>
                                        {parseFloat(usdtBalance) > 0 ? (
                                            <span className={styles.statusIcon}>✅</span>
                                        ) : (
                                            <span className={styles.statusIcon}>❌</span>
                                        )}
                                    </div>
                                </div>
                                <p className={styles.modalInstruction}>
                                    Visit your profile to get free test tokens and check your current balances.
                                </p>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.modalCancelButton} onClick={handleCloseModal}>
                                    Maybe Later
                                </button>
                                <button className={styles.modalActionButton} onClick={handleGoToProfile}>
                                    Go to Profile
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}