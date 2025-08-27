"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useWalletAccountStore } from "@/components/Wallet/Account/auth.hooks";
import { useKaiaWalletSdk, useKaiaWalletSdkStore } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { useKyeContracts } from '@/hooks/useKyeContracts';
import { WalletButton } from '@/components/Wallet/Button/WalletButton';
import styles from './page.module.css';

export default function CirclesClient() {
    console.log('🔴 CirclesClient component function called');
    
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showJoinForm, setShowJoinForm] = useState(false);
    const [circleName, setCircleName] = useState('');
    const [monthlyAmount, setMonthlyAmount] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [myCircles, setMyCircles] = useState(() => {
        console.log('🔴 myCircles initial state function called');
        return [];
    });
    
    // Add debugging for state changes
    useEffect(() => {
        console.log('🔍 myCircles state changed:', myCircles);
        console.log('🔍 myCircles length:', myCircles.length);
    }, [myCircles]);

    // Wallet hooks - exactly like profile page
    const { account, setAccount } = useWalletAccountStore();
    const { getAccount, getChainId } = useKaiaWalletSdk();
    const { sdk } = useKaiaWalletSdkStore();
    const { createCircle, joinCircle, addresses, getContractAddressFromTx } = useKyeContracts();

    useEffect(() => {
        console.log('🚀 Component mounting...');
        setIsMounted(true);
        console.log('🚀 Component mounted, isMounted set to true');
    }, []);

    useEffect(() => {
        console.log('🔍 checkExistingAccount useEffect triggered, isMounted:', isMounted);
        
        if (!isMounted) {
            console.log('🔍 Not mounted yet, returning early');
            return;
        }
        
        const checkExistingAccount = async () => {
            try {
                console.log('🔍 Getting account...');
                const account = await getAccount();
                console.log('🔍 Got account:', account);
                
                if(account) {
                    console.log('✅ Found existing account:', account);
                    setIsLoggedIn(true);
                    setAccount(account);
                    console.log('🔍 About to load user circles...');
                    await loadUserCircles();
                    console.log('🔍 Finished loading user circles');
                }
            } catch (error) {
                console.log('❌ Error checking existing account:', error);
                // SDK might not be initialized yet, that's okay
            }
        };
        
        checkExistingAccount();
    }, [getAccount, setAccount, isMounted]); // Removed loadUserCircles from dependencies

    // Fetch circle data from contract using Kaia Wallet SDK
    const fetchCircleData = useCallback(async (circleAddress) => {
        try {
            console.log('🔍 Fetching REAL circle data for:', circleAddress);
            
            // Check if we have a valid address
            if (!circleAddress || circleAddress === 'pending') {
                console.log('❌ Cannot fetch circle data: invalid address');
                return {
                    depositAmount: 'Pending',
                    memberCount: '?/5',
                    phase: 'Deploying'
                };
            }
            
            // Get the wallet provider from SDK
            const account = await getAccount();
            if (!account) {
                console.log('❌ No wallet account found');
                return {
                    depositAmount: 'No Wallet',
                    memberCount: '?/5',
                    phase: 'No Wallet'
                };
            }
            
            const { ethers } = await import('ethers');
            const { KYE_GROUP_ABI } = await import('@/utils/contracts/abis');
            
            // Check if SDK is available
            if (!sdk) {
                console.log('❌ SDK not available');
                return {
                    depositAmount: 'SDK Error',
                    memberCount: '?/5',
                    phase: 'SDK Error'
                };
            }
            
            // Use the Kaia Wallet SDK provider
            const walletProvider = sdk.getWalletProvider();
            console.log('🔗 Using Kaia Wallet SDK provider:', walletProvider);
            
            const provider = new ethers.BrowserProvider(walletProvider);
            const circleContract = new ethers.Contract(circleAddress, KYE_GROUP_ABI, provider);
            
            console.log('📞 Calling smart contract functions for address:', circleAddress);
            
            // Call multiple contract methods in parallel
            const [depositAmount, members, phase, maxMembers] = await Promise.all([
                circleContract.depositAmount().catch((e) => {
                    console.log('❌ Error getting depositAmount:', e.message);
                    return 0n;
                }),
                circleContract.getMembers().catch((e) => {
                    console.log('❌ Error getting members:', e.message);
                    return [];
                }),
                circleContract.phase().catch((e) => {
                    console.log('❌ Error getting phase:', e.message);
                    return 0;
                }),
                circleContract.maxMembers().catch((e) => {
                    console.log('❌ Error getting maxMembers:', e.message);
                    return 5;
                })
            ]);
            
            // Convert values
            const depositAmountUsdt = (Number(depositAmount) / 1e6).toString(); // Convert from 6 decimals
            const memberCount = `${members.length}/${Number(maxMembers)}`;
            const phaseNames = ['Setup', 'Active', 'Resolved', 'Cancelled'];
            const phaseName = phaseNames[Number(phase)] || 'Unknown';
            
            console.log('✅ Got REAL circle data:', {
                depositAmount: depositAmountUsdt,
                memberCount,
                phase: phaseName,
                members: members.length,
                rawDepositAmount: depositAmount.toString(),
                membersArray: members
            });
            
            return {
                depositAmount: depositAmountUsdt,
                memberCount,
                phase: phaseName
            };
            
        } catch (error) {
            console.error('❌ Error fetching circle data:', error);
            console.error('❌ Error details:', error.message, error.code);
            
            // Return fallback data on error
            return {
                depositAmount: 'Error',
                memberCount: '?/5', 
                phase: 'Error'
            };
        }
    }, [getAccount, sdk]);

    // Resolve pending contract addresses from transaction hashes
    const resolvePendingContracts = useCallback(async () => {
        console.log('🔍 Checking for pending contracts to resolve...');
        
        const updatedCircles = await Promise.all(
            myCircles.map(async (circle) => {
                if (circle.address === 'pending' && circle.transactionHash) {
                    console.log('🔍 Attempting to get contract address for tx:', circle.transactionHash);
                    const contractAddress = await getContractAddressFromTx(circle.transactionHash);
                    
                    if (contractAddress) {
                        console.log('✅ Resolved contract address:', contractAddress);
                        return {
                            ...circle,
                            address: contractAddress,
                            needsDataFetch: true // Update with real data
                        };
                    } else {
                        console.log('⏳ Contract still pending for', circle.name);
                        return circle;
                    }
                }
                return circle;
            })
        );
        
        // Update state and localStorage if any changes were made
        const hasChanges = JSON.stringify(updatedCircles) !== JSON.stringify(myCircles);
        if (hasChanges) {
            console.log('📝 Updating circles with resolved addresses');
            setMyCircles(updatedCircles);
            
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('recentCircles', JSON.stringify(updatedCircles));
            }
        }
        
        return hasChanges;
    }, [myCircles, getContractAddressFromTx]);

    // Load user's circles from localStorage
    const loadUserCircles = useCallback(async () => {
        try {
            console.log('🔄 loadUserCircles called');
            if (typeof window !== 'undefined' && window.localStorage) {
                const recentCircles = JSON.parse(localStorage.getItem('recentCircles') || '[]');
                console.log('📦 Raw circles from localStorage:', recentCircles.length, 'circles');
                console.log('📦 Circle details:', recentCircles);
                
                // Update circles that need data fetch
                const updatedCircles = await Promise.all(
                    recentCircles.map(async (circle) => {
                        if (circle.needsDataFetch && circle.address && circle.address !== 'pending') {
                            console.log('🔍 Fetching data for circle:', circle.address);
                            const contractData = await fetchCircleData(circle.address);
                            return {
                                ...circle,
                                ...contractData,
                                needsDataFetch: false // Remove flag after fetching
                            };
                        }
                        return circle;
                    })
                );
                
                // Save updated data back to localStorage if changed
                if (JSON.stringify(updatedCircles) !== JSON.stringify(recentCircles)) {
                    console.log('💾 Saving updated circle data to localStorage');
                    localStorage.setItem('recentCircles', JSON.stringify(updatedCircles));
                }
                
                console.log('✅ Setting myCircles state with', updatedCircles.length, 'circles');
                console.log('✅ Updated circles:', updatedCircles);
                setMyCircles(updatedCircles);
            } else {
                console.log('❌ localStorage not available');
                setMyCircles([]);
            }
        } catch (error) {
            console.error('❌ Error loading circles:', error);
            setMyCircles([]);
        }
    }, [fetchCircleData]);

    const handleCreateClick = () => {
        setShowCreateForm(true);
    };

    const handleJoinClick = () => {
        setShowJoinForm(true);
    };

    const handleBackToCircles = () => {
        setShowCreateForm(false);
        setShowJoinForm(false);
        setCircleName('');
        setMonthlyAmount('');
        setInviteCode('');
    };

    const handleCreateSubmit = useCallback(async () => {
        if (!account) {
            alert('Please connect your wallet first');
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

        if (!createCircle) {
            alert('Contract integration not ready. Please refresh the page.');
            return;
        }

        setCreating(true);
        try {
            console.log('=== CREATE CIRCLE START ===');
            console.log('Circle name:', circleName);
            console.log('Monthly amount:', monthlyAmount);
            console.log('Account:', account);

            // Network validation
            const currentChainId = await getChainId();
            if (currentChainId.toString() !== process.env.NEXT_PUBLIC_CHAIN_ID) {
                throw new Error(`Wrong network! Current: ${currentChainId}, Expected: ${process.env.NEXT_PUBLIC_CHAIN_ID}`);
            }

            // Convert amount to proper format (USDT has 6 decimals)
            const amountInUSDT = (parseFloat(monthlyAmount) * 1e6).toString();
            console.log('Amount in USDT (wei):', amountInUSDT);

            // Call the actual smart contract
            const result = await createCircle(circleName, amountInUSDT);
            console.log('✅ Circle created successfully:', result);

            if (result.success) {
                alert(`✅ Circle "${circleName}" created successfully!\n\nTransaction Hash: ${result.hash}\n\nShare this circle with your friends to let them join.`);
                
                // Store created circle for demo persistence  
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        const createdCircle = {
                            name: circleName,
                            depositAmount: monthlyAmount,
                            memberCount: "1/5", // Initial count, will be updated by fetchCircleData
                            phase: 'Setup',
                            isCreator: true,
                            isJoined: false, // Explicitly set to false for creators
                            createdAt: Date.now(),
                            address: result.circleAddress || 'pending',
                            transactionHash: result.hash,
                            needsDataFetch: true // Flag to fetch real data
                        };
                        
                        const existing = JSON.parse(localStorage.getItem('recentCircles') || '[]');
                        existing.push(createdCircle);
                        localStorage.setItem('recentCircles', JSON.stringify(existing));
                        console.log('✅ Saved created circle to localStorage, refreshing display...');
                        
                        console.log('🎯 BEFORE setMyCircles - Current myCircles:', myCircles);
                        console.log('🎯 Circle to add:', createdCircle);
                        
                        // Immediate state update for responsiveness
                        setMyCircles(prev => {
                            console.log('🎯 Inside setMyCircles - prev:', prev);
                            const updated = [...prev, createdCircle];
                            console.log('🎯 Inside setMyCircles - updated:', updated);
                            return updated;
                        });
                        
                        console.log('🎯 AFTER setMyCircles called');
                        
                        // Then async refresh for complete data
                        await loadUserCircles(); // Refresh the display
                        console.log('🎯 AFTER loadUserCircles called');
                    }
                } catch (e) {
                    console.warn('Failed to save to localStorage:', e);
                }
                
                // Reset form
                setCircleName('');
                setMonthlyAmount('');
                setShowCreateForm(false);
            } else {
                throw new Error(result.error || 'Failed to create circle');
            }
            
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

    const handleJoinSubmit = useCallback(async () => {
        if (!account) {
            alert('Please connect your wallet first');
            return;
        }

        if (!inviteCode.trim()) {
            alert('Please enter an invite code');
            return;
        }

        if (!joinCircle) {
            alert('Contract integration not ready. Please refresh the page.');
            return;
        }

        setJoining(true);
        try {
            console.log('=== JOIN CIRCLE START ===');
            console.log('Invite code (circle address):', inviteCode);
            console.log('Account:', account);

            // Network validation
            const currentChainId = await getChainId();
            if (currentChainId.toString() !== process.env.NEXT_PUBLIC_CHAIN_ID) {
                throw new Error(`Wrong network! Current: ${currentChainId}, Expected: ${process.env.NEXT_PUBLIC_CHAIN_ID}`);
            }

            // Call the actual smart contract
            const result = await joinCircle(inviteCode);
            console.log('✅ Joined circle successfully:', result);

            if (result.success) {
                alert(`✅ Successfully joined the circle!\n\nTransaction Hash: ${result.hash}\n\nWelcome to the savings group.`);
                
                // Store joined circle for demo persistence
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        const joinedCircle = {
                            name: `Circle ${inviteCode.slice(0, 8)}...`, // Short name from address
                            depositAmount: 'Fetching...', // Will be updated when we fetch data
                            memberCount: 'Fetching...', // Will be updated when we fetch data
                            phase: 'Active',
                            isCreator: false,
                            isJoined: true,
                            joinedAt: Date.now(),
                            address: inviteCode,
                            transactionHash: result.hash,
                            needsDataFetch: true // Flag to indicate we need to fetch contract data
                        };
                        
                        const existing = JSON.parse(localStorage.getItem('recentCircles') || '[]');
                        // Check if already exists to avoid duplicates
                        const alreadyExists = existing.some(circle => circle.address.toLowerCase() === inviteCode.toLowerCase());
                        if (!alreadyExists) {
                            existing.push(joinedCircle);
                            localStorage.setItem('recentCircles', JSON.stringify(existing));
                            console.log('✅ Saved joined circle to localStorage, refreshing display...');
                            
                            console.log('🎯 JOIN - BEFORE setMyCircles - Current myCircles:', myCircles);
                            console.log('🎯 JOIN - Circle to add:', joinedCircle);
                            
                            // Immediate state update for responsiveness
                            setMyCircles(prev => {
                                console.log('🎯 JOIN - Inside setMyCircles - prev:', prev);
                                const updated = [...prev, joinedCircle];
                                console.log('🎯 JOIN - Inside setMyCircles - updated:', updated);
                                return updated;
                            });
                            
                            console.log('🎯 JOIN - AFTER setMyCircles called');
                            
                            // Then async refresh for complete data
                            await loadUserCircles();
                            console.log('🎯 JOIN - AFTER loadUserCircles called'); 
                        } else {
                            console.log('⚠️  Circle already exists, not adding duplicate');
                        }
                    }
                } catch (e) {
                    console.warn('Failed to save joined circle to localStorage:', e);
                }
                
                // Reset form
                setInviteCode('');
                setShowJoinForm(false);
            } else {
                throw new Error(result.error || 'Failed to join circle');
            }
            
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
                    <p style={{ fontSize: '0.875rem', color: '#666' }}>
                        Connected: {account}
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
                                onClick={handleCreateClick}
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
                                onClick={handleJoinClick}
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
                                onClick={handleCreateSubmit}
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
                                onClick={handleJoinSubmit}
                                disabled={joining || !inviteCode.trim()}
                            >
                                {joining ? 'Joining Circle...' : 'Join Circle'}
                            </button>
                        </div>
                    </div>
                )}

                <div className={styles.myCircles}>
                    <div className={styles.circlesHeader}>
                        <h2>My Circles</h2>
                        <button 
                            className={styles.refreshButton}
                            onClick={loadUserCircles}
                            title="Refresh circle data"
                        >
                            🔄
                        </button>
                        <button 
                            className={styles.debugButton}
                            onClick={() => {
                                console.log('🔧 Current myCircles state:', myCircles);
                                console.log('🔧 localStorage data:', JSON.parse(localStorage.getItem('recentCircles') || '[]'));
                            }}
                            title="Debug circles data"
                        >
                            🐛
                        </button>
                        <button 
                            className={styles.clearButton}
                            onClick={() => {
                                localStorage.removeItem('recentCircles');
                                setMyCircles([]);
                                console.log('🧹 Cleared all circles');
                            }}
                            title="Clear all circles"
                        >
                            🧹
                        </button>
                        <button 
                            className={styles.testButton}
                            onClick={() => {
                                console.log('🧪 Adding test circle...');
                                const testCircle = {
                                    name: 'Test Circle',
                                    depositAmount: '100',
                                    memberCount: '1/5',
                                    phase: 'Test',
                                    isCreator: true,
                                    isJoined: false,
                                    address: '0x123test',
                                    transactionHash: '0xtest'
                                };
                                
                                console.log('🧪 Before setMyCircles - current:', myCircles);
                                setMyCircles(prev => {
                                    console.log('🧪 Inside setMyCircles - prev:', prev);
                                    const updated = [...prev, testCircle];
                                    console.log('🧪 Inside setMyCircles - updated:', updated);
                                    return updated;
                                });
                                console.log('🧪 After setMyCircles called');
                            }}
                            title="Add test circle"
                        >
                            🧪
                        </button>
                        <button 
                            className={styles.forceRefreshButton}
                            onClick={async () => {
                                console.log('🔄 Force refreshing all circle data from blockchain...');
                                
                                // First resolve any pending contracts
                                const resolvedAny = await resolvePendingContracts();
                                if (resolvedAny) {
                                    console.log('✅ Resolved some pending contracts');
                                }
                                
                                // Then fetch real data for all non-pending circles
                                const updatedCircles = await Promise.all(
                                    myCircles.map(async (circle) => {
                                        if (circle.address && circle.address !== 'pending') {
                                            console.log(`🔄 Fetching data for circle: ${circle.address}`);
                                            const realData = await fetchCircleData(circle.address);
                                            return {
                                                ...circle,
                                                ...realData,
                                                needsDataFetch: false
                                            };
                                        }
                                        return circle;
                                    })
                                );
                                
                                setMyCircles(updatedCircles);
                                
                                // Also update localStorage
                                if (typeof window !== 'undefined' && window.localStorage) {
                                    localStorage.setItem('recentCircles', JSON.stringify(updatedCircles));
                                }
                                
                                console.log('🔄 Force refresh complete!');
                            }}
                            title="Force refresh from blockchain"
                        >
                            ⚡
                        </button>
                        <button 
                            className={styles.resolveButton}
                            onClick={async () => {
                                console.log('🔍 Manually resolving pending contracts...');
                                const resolvedAny = await resolvePendingContracts();
                                
                                if (resolvedAny) {
                                    alert('✅ Resolved some pending contracts! They now have real addresses.');
                                    // Auto-refresh to get real data
                                    await loadUserCircles();
                                } else {
                                    alert('ℹ️ No pending contracts found or they are still being mined.');
                                }
                            }}
                            title="Resolve pending contract addresses"
                        >
                            🔗
                        </button>
                    </div>
                    <div className={styles.circlesList}>
                        {(() => {
                            console.log('🔍 RENDER - myCircles.length:', myCircles.length);
                            console.log('🔍 RENDER - myCircles:', myCircles);
                            return null;
                        })()}
                        
                        {myCircles.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>🎯</div>
                                <h3>No Active Circles</h3>
                                <p>Create or join your first circle</p>
                                {(() => {
                                    console.log('🔍 RENDER - Showing empty state');
                                    return null;
                                })()}
                            </div>
                        ) : (
                            myCircles.map((circle, index) => {
                                console.log(`🔍 Rendering circle ${index}:`, {
                                    name: circle.name,
                                    isCreator: circle.isCreator,
                                    isJoined: circle.isJoined,
                                    address: circle.address
                                });
                                
                                // Determine role with explicit logic
                                let roleDisplay = '📝 Unknown';
                                if (circle.isCreator === true) {
                                    roleDisplay = '👑 Creator';
                                } else if (circle.isJoined === true) {
                                    roleDisplay = '👥 Member'; 
                                } else if (circle.isCreator === false && circle.isJoined === false) {
                                    roleDisplay = '📝 Created'; // Fallback for created circles
                                }
                                
                                console.log(`🔍 Role for circle ${index}: ${roleDisplay} (isCreator: ${circle.isCreator}, isJoined: ${circle.isJoined})`);
                                
                                return (
                                <div key={index} className={styles.circleCard}>
                                    <div className={styles.circleHeader}>
                                        <h3>{circle.name}</h3>
                                        <div className={styles.circleRole}>
                                            {roleDisplay}
                                        </div>
                                    </div>
                                    <div className={styles.circleDetails}>
                                        <p><strong>Monthly Amount:</strong> {circle.depositAmount} USDT</p>
                                        <p><strong>Members:</strong> {circle.memberCount}</p>
                                        <p><strong>Phase:</strong> {circle.phase}</p>
                                        <p><strong>Address:</strong> {circle.address && circle.address !== 'pending' ? 
                                            `${circle.address.slice(0, 10)}...${circle.address.slice(-8)}` : 
                                            'Deploying...'
                                        }</p>
                                        {circle.needsDataFetch && (
                                            <p style={{ color: '#f59e0b', fontSize: '12px', fontStyle: 'italic' }}>
                                                Loading circle data...
                                            </p>
                                        )}
                                    </div>
                                    <div className={styles.circleActions}>
                                        <button 
                                            className={styles.viewButton}
                                            onClick={() => {
                                                // Navigate to circle details or manage circle
                                                alert(`Circle Management coming soon!\n\nAddress: ${circle.address}\nTransaction: ${circle.transactionHash}`);
                                            }}
                                        >
                                            View Details
                                        </button>
                                        {circle.address && circle.address !== 'pending' && (
                                            <button 
                                                className={styles.shareButton}
                                                onClick={() => {
                                                    const inviteLink = `${window.location.origin}/circles?action=join&circle=${circle.address}`;
                                                    if (navigator.share) {
                                                        navigator.share({
                                                            title: `Join my savings circle: ${circle.name}`,
                                                            text: `I've created a savings circle "${circle.name}". Join us!`,
                                                            url: inviteLink,
                                                        });
                                                    } else {
                                                        navigator.clipboard.writeText(inviteLink);
                                                        alert('Invite link copied to clipboard!');
                                                    }
                                                }}
                                            >
                                                Share
                                            </button>
                                        )}
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}