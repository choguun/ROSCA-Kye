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
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedCircle, setSelectedCircle] = useState(null);
    const [circleDetails, setCircleDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    // Add debugging for state changes
    useEffect(() => {
        console.log('🔍 myCircles state changed:', myCircles);
        console.log('🔍 myCircles length:', myCircles.length);
    }, [myCircles]);
    
    useEffect(() => {
        console.log('💰 monthlyAmount changed:', monthlyAmount);
        console.log('💰 Type:', typeof monthlyAmount);
        console.log('💰 Length:', monthlyAmount.length);
    }, [monthlyAmount]);

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
            
            // Convert values with bug detection
            const rawDepositWei = Number(depositAmount);
            console.log('🔧 DISPLAY CONVERSION:', {
                rawDepositWei,
                normalConversion: rawDepositWei / 1e6,
                buggyContractDetected: rawDepositWei > 1e12 // More than 1 million USDT = buggy
            });
            
            // Fix display for both old buggy contracts and new fixed contracts
            let depositAmountUsdt;
            if (rawDepositWei > 1e12) {
                // This is a buggy contract - divide by extra 1e6 to fix display
                depositAmountUsdt = (rawDepositWei / 1e12).toString();
                console.log('🔧 Detected buggy contract, using 1e12 divisor:', depositAmountUsdt);
            } else {
                // This is a correctly deployed contract
                depositAmountUsdt = (rawDepositWei / 1e6).toString();
                console.log('🔧 Detected correct contract, using 1e6 divisor:', depositAmountUsdt);
            }
            const memberCount = `${members.length}/${Number(maxMembers)}`;
            const phaseNames = ['Setup', 'Active', 'Resolved', 'Cancelled'];
            const phaseName = phaseNames[Number(phase)] || 'Unknown';
            
            // Check membership status
            const isUserMember = members.some(member => member.toLowerCase() === account.toLowerCase());
            const isCreator = members.length > 0 && members[0].toLowerCase() === account.toLowerCase();
            
            console.log('✅ Got REAL circle data:', {
                depositAmount: depositAmountUsdt,
                memberCount,
                phase: phaseName,
                members: members.length,
                rawDepositAmount: depositAmount.toString(),
                membersArray: members,
                isUserMember,
                isCreator,
                currentAccount: account
            });
            
            return {
                depositAmount: depositAmountUsdt,
                memberCount,
                phase: phaseName,
                isJoined: isUserMember && !isCreator, // Member but not creator
                isCreator: isCreator // First member is creator
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

    // Fetch comprehensive circle details for modal display
    const fetchCircleDetails = useCallback(async (circle) => {
        try {
            console.log('🔍 Fetching comprehensive details for circle:', circle.address);
            setLoadingDetails(true);
            
            if (!circle.address || circle.address === 'pending') {
                console.log('❌ Cannot fetch details: invalid address');
                return null;
            }
            
            const account = await getAccount();
            if (!account || !sdk) {
                console.log('❌ No wallet account or SDK found');
                return null;
            }
            
            const { ethers } = await import('ethers');
            const { KYE_GROUP_ABI } = await import('@/utils/contracts/abis');
            
            const walletProvider = sdk.getWalletProvider();
            const provider = new ethers.BrowserProvider(walletProvider);
            const circleContract = new ethers.Contract(circle.address, KYE_GROUP_ABI, provider);
            
            // Fetch comprehensive contract data with detailed logging
            console.log('🔍 DETAILED FETCH - Contract address:', circle.address);
            console.log('🔍 DETAILED FETCH - Current account:', account);
            
            const [
                depositAmount,
                members,
                phase,
                maxMembers,
                roundDuration,
                penaltyBps,
                currentRound,
                roundCount,
                creator,
                creationTime
            ] = await Promise.all([
                circleContract.depositAmount().catch((e) => { console.log('❌ depositAmount error:', e); return 0n; }),
                circleContract.getMembers().catch((e) => { console.log('❌ getMembers error:', e); return []; }),
                circleContract.phase().catch((e) => { console.log('❌ phase error:', e); return 0; }),
                circleContract.maxMembers().catch((e) => { console.log('❌ maxMembers error:', e); return 5; }),
                circleContract.roundDuration().catch((e) => { console.log('❌ roundDuration error:', e); return 0n; }),
                circleContract.penaltyBps().catch((e) => { console.log('❌ penaltyBps error:', e); return 0n; }),
                circleContract.currentRound().catch((e) => { console.log('❌ currentRound error:', e); return 0n; }),
                circleContract.roundCount().catch((e) => { console.log('❌ roundCount error:', e); return 0n; }),
                circleContract.creator().catch((e) => { console.log('❌ creator error:', e); return '0x0'; }),
                circleContract.creationTime().catch((e) => { console.log('❌ creationTime error:', e); return 0n; })
            ]);
            
            console.log('🔍 DETAILED FETCH - Raw contract responses:');
            console.log('  - depositAmount:', depositAmount.toString());
            console.log('  - members (raw):', members);
            console.log('  - members length:', members.length);
            console.log('  - phase:', phase.toString());
            console.log('  - creator:', creator);
            console.log('  - currentAccount:', account);
            
            // Convert and format values with bug detection
            const rawDepositWei = Number(depositAmount);
            let depositAmountUsdt;
            if (rawDepositWei > 1e12) {
                // Buggy contract - divide by 1e12 
                depositAmountUsdt = (rawDepositWei / 1e12).toString();
                console.log('🔧 Modal: Detected buggy contract, using 1e12 divisor:', depositAmountUsdt);
            } else {
                // Correct contract - divide by 1e6
                depositAmountUsdt = (rawDepositWei / 1e6).toString();
                console.log('🔧 Modal: Detected correct contract, using 1e6 divisor:', depositAmountUsdt);
            }
            const phaseNames = ['Setup', 'Active', 'Resolved', 'Cancelled'];
            const phaseName = phaseNames[Number(phase)] || 'Unknown';
            // Check membership status with detailed logging
            console.log('🔍 MEMBERSHIP CHECK:');
            console.log('  - Current account (lowercase):', account.toLowerCase());
            console.log('  - Creator (lowercase):', creator.toLowerCase());
            console.log('  - Members array:');
            members.forEach((member, index) => {
                console.log(`    [${index}] ${member} (lowercase: ${member.toLowerCase()})`);
                console.log(`    [${index}] Matches current account:`, member.toLowerCase() === account.toLowerCase());
                console.log(`    [${index}] Matches creator:`, member.toLowerCase() === creator.toLowerCase());
            });
            
            const isUserMember = members.some(m => m.toLowerCase() === account.toLowerCase());
            const isCreator = creator.toLowerCase() === account.toLowerCase();
            const memberIndex = members.findIndex(m => m.toLowerCase() === account.toLowerCase());
            
            console.log('🔍 MEMBERSHIP RESULTS:');
            console.log('  - isUserMember:', isUserMember);
            console.log('  - isCreator:', isCreator);
            console.log('  - memberIndex:', memberIndex);
            
            // Calculate round information
            const roundDurationHours = Number(roundDuration) / 3600; // Convert seconds to hours
            const creationTimestamp = Number(creationTime) * 1000; // Convert to milliseconds
            const currentRoundNum = Number(currentRound);
            const totalRounds = Number(roundCount);
            
            // Get current beneficiary if active
            let currentBeneficiary = null;
            if (phaseName === 'Active' && currentRoundNum > 0 && currentRoundNum <= members.length) {
                currentBeneficiary = members[currentRoundNum - 1];
            }
            
            const details = {
                // Basic info
                name: circle.name,
                address: circle.address,
                transactionHash: circle.transactionHash,
                phase: phaseName,
                
                // Financial info
                depositAmount: depositAmountUsdt,
                totalPool: (rawDepositWei > 1e12 ? 
                    (rawDepositWei * members.length / 1e12).toString() : 
                    (rawDepositWei * members.length / 1e6).toString()),
                penaltyRate: (Number(penaltyBps) / 100).toString(), // Convert basis points to percentage
                
                // Membership info
                members: members,
                memberCount: members.length,
                maxMembers: Number(maxMembers),
                isUserMember,
                isCreator,
                memberIndex,
                creator,
                
                // Round info
                currentRound: currentRoundNum,
                totalRounds,
                roundDurationHours,
                currentBeneficiary,
                creationTime: creationTimestamp,
                
                // Calculated fields
                isActive: phaseName === 'Active',
                isSetup: phaseName === 'Setup',
                isResolved: phaseName === 'Resolved',
                isCancelled: phaseName === 'Cancelled',
                userRole: isCreator ? 'Creator' : isUserMember ? 'Member' : 'Observer'
            };
            
            console.log('✅ Comprehensive circle details:', details);
            return details;
            
        } catch (error) {
            console.error('❌ Error fetching circle details:', error);
            return null;
        } finally {
            setLoadingDetails(false);
        }
    }, [getAccount, sdk]);

    // Auto-refresh circles to catch member updates from other wallets
    useEffect(() => {
        if (!account || myCircles.length === 0) return;
        
        const autoRefreshMemberCounts = async () => {
            console.log('🔄 Auto-refreshing member counts...');
            
            let hasUpdates = false;
            const updatedCircles = await Promise.all(
                myCircles.map(async (circle) => {
                    if (circle.address && circle.address !== 'pending') {
                        try {
                            const realData = await fetchCircleData(circle.address);
                            
                            // Check for member count changes
                            if (circle.memberCount !== realData.memberCount) {
                                console.log(`🆕 Member count updated for ${circle.name}: ${circle.memberCount} → ${realData.memberCount}`);
                                hasUpdates = true;
                            }
                            
                            return {
                                ...circle,
                                ...realData,
                                needsDataFetch: false
                            };
                        } catch (error) {
                            console.error(`❌ Auto-refresh error for ${circle.address}:`, error);
                            return circle;
                        }
                    }
                    return circle;
                })
            );
            
            if (hasUpdates) {
                console.log('📝 Updating circles with new member counts');
                setMyCircles(updatedCircles);
                
                // Update localStorage
                try {
                    localStorage.setItem('recentCircles', JSON.stringify(updatedCircles));
                } catch (e) {
                    console.warn('Failed to update localStorage:', e);
                }
            }
        };
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(autoRefreshMemberCounts, 30000);
        
        return () => clearInterval(interval);
    }, [account, myCircles, fetchCircleData]);

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
            console.log('🔍 Type of monthlyAmount:', typeof monthlyAmount);
            console.log('🔍 Length of monthlyAmount:', monthlyAmount.length);
            console.log('🔍 JSON stringify:', JSON.stringify(monthlyAmount));
            console.log('🔍 Parsed as float:', parseFloat(monthlyAmount));
            console.log('Account:', account);

            // Network validation
            const currentChainId = await getChainId();
            if (currentChainId.toString() !== process.env.NEXT_PUBLIC_CHAIN_ID) {
                throw new Error(`Wrong network! Current: ${currentChainId}, Expected: ${process.env.NEXT_PUBLIC_CHAIN_ID}`);
            }

            // Pass amount as string - useKyeContracts will handle USDT conversion (6 decimals)
            console.log('Amount in USDT:', monthlyAmount);

            // Call the actual smart contract
            const result = await createCircle(circleName, monthlyAmount);
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

    // Handle view details modal
    const handleViewDetails = useCallback(async (circle) => {
        console.log('🔍 Opening details for circle:', circle.address);
        setSelectedCircle(circle);
        setShowDetailsModal(true);
        
        // Fetch comprehensive details
        const details = await fetchCircleDetails(circle);
        setCircleDetails(details);
    }, [fetchCircleDetails]);

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
                        <button 
                            className={styles.testButton}
                            onClick={async () => {
                                console.log('🧪 MANUAL CONTRACT CHECK - Starting debug...');
                                if (myCircles.length > 0) {
                                    const circle = myCircles[0];
                                    console.log('🧪 Testing circle:', circle.address);
                                    
                                    if (!circle.address || circle.address === 'pending') {
                                        console.log('❌ Cannot check: invalid address');
                                        return;
                                    }
                                    
                                    try {
                                        const account = await getAccount();
                                        const { ethers } = await import('ethers');
                                        const { KYE_GROUP_ABI } = await import('@/utils/contracts/abis');
                                        
                                        const walletProvider = sdk.getWalletProvider();
                                        const provider = new ethers.BrowserProvider(walletProvider);
                                        const contract = new ethers.Contract(circle.address, KYE_GROUP_ABI, provider);
                                        
                                        console.log('🧪 RAW CONTRACT CALL RESULTS:');
                                        const members = await contract.getMembers();
                                        const creator = await contract.creator();
                                        const phase = await contract.phase();
                                        
                                        console.log('  - Contract address:', circle.address);
                                        console.log('  - Current account:', account);
                                        console.log('  - Members from contract:', members);
                                        console.log('  - Creator from contract:', creator);
                                        console.log('  - Phase from contract:', phase.toString());
                                        
                                        alert(`Debug results logged to console.\n\nContract: ${circle.address}\nMembers: ${members.length}\nCreator: ${creator}\nYour account: ${account}`);
                                    } catch (error) {
                                        console.error('🧪 Manual contract check error:', error);
                                        alert('Error checking contract: ' + error.message);
                                    }
                                } else {
                                    alert('No circles to test');
                                }
                            }}
                            title="Manual contract data check"
                        >
                            🧪
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
                                            onClick={() => handleViewDetails(circle)}
                                            disabled={!circle.address || circle.address === 'pending'}
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

            {/* Circle Details Modal */}
            {showDetailsModal && selectedCircle && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>🔍 Circle Details</h3>
                            <button 
                                className={styles.modalCloseButton}
                                onClick={() => {
                                    setShowDetailsModal(false);
                                    setSelectedCircle(null);
                                    setCircleDetails(null);
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            {loadingDetails ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                                    <p>Loading comprehensive circle data...</p>
                                </div>
                            ) : circleDetails ? (
                                <div>
                                    {/* Basic Information */}
                                    <div style={{ marginBottom: '24px', padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
                                        <h4 style={{ margin: '0 0 16px 0', color: '#111827', borderBottom: '2px solid #00B900', paddingBottom: '8px' }}>
                                            📊 Basic Information
                                        </h4>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Circle Name:</span>
                                                <span style={{ color: '#111827', fontSize: '14px', fontWeight: '600' }}>{circleDetails.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Status:</span>
                                                <span className={`${styles.phasebadge} ${styles[circleDetails.phase.toLowerCase()]}`}>
                                                    {circleDetails.phase}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Your Role:</span>
                                                <span style={{ color: '#00B900', fontSize: '14px', fontWeight: '600' }}>
                                                    {circleDetails.userRole}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Contract Address:</span>
                                                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#374151' }}>
                                                    {circleDetails.address.slice(0, 10)}...{circleDetails.address.slice(-8)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Information */}
                                    <div style={{ marginBottom: '24px', padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                        <h4 style={{ margin: '0 0 16px 0', color: '#111827', borderBottom: '2px solid #00B900', paddingBottom: '8px' }}>
                                            💰 Financial Details
                                        </h4>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Monthly Deposit:</span>
                                                <span style={{ color: '#111827', fontSize: '14px', fontWeight: '600' }}>
                                                    {circleDetails.depositAmount} USDT
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Total Pool Value:</span>
                                                <span style={{ color: '#111827', fontSize: '14px', fontWeight: '600' }}>
                                                    {circleDetails.totalPool} USDT
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Penalty Rate:</span>
                                                <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600' }}>
                                                    {circleDetails.penaltyRate}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Membership Information */}
                                    <div style={{ marginBottom: '24px', padding: '20px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #f59e0b' }}>
                                        <h4 style={{ margin: '0 0 16px 0', color: '#111827', borderBottom: '2px solid #00B900', paddingBottom: '8px' }}>
                                            👥 Members ({circleDetails.memberCount}/{circleDetails.maxMembers})
                                        </h4>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            {circleDetails.members.map((member, index) => (
                                                <div key={index} style={{ 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between',
                                                    padding: '8px 12px',
                                                    background: 'white',
                                                    borderRadius: '8px',
                                                    border: member.toLowerCase() === circleDetails.creator.toLowerCase() ? '2px solid #00B900' : '1px solid #e5e7eb'
                                                }}>
                                                    <span style={{ color: '#6b7280', fontSize: '14px' }}>
                                                        Member {index + 1}: 
                                                        {member.toLowerCase() === circleDetails.creator.toLowerCase() && ' (Creator)'}
                                                        {index === circleDetails.memberIndex && ' (You)'}
                                                    </span>
                                                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#374151' }}>
                                                        {member.slice(0, 6)}...{member.slice(-4)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Round Information */}
                                    <div style={{ marginBottom: '24px', padding: '20px', background: '#e0e7ff', borderRadius: '12px', border: '1px solid #6366f1' }}>
                                        <h4 style={{ margin: '0 0 16px 0', color: '#111827', borderBottom: '2px solid #00B900', paddingBottom: '8px' }}>
                                            🔄 Round Progress
                                        </h4>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Current Round:</span>
                                                <span style={{ color: '#111827', fontSize: '14px', fontWeight: '600' }}>
                                                    {circleDetails.currentRound} / {circleDetails.totalRounds || circleDetails.memberCount}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Round Duration:</span>
                                                <span style={{ color: '#111827', fontSize: '14px', fontWeight: '600' }}>
                                                    {circleDetails.roundDurationHours} hours
                                                </span>
                                            </div>
                                            {circleDetails.currentBeneficiary && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: '#6b7280', fontSize: '14px' }}>Current Beneficiary:</span>
                                                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#374151' }}>
                                                        {circleDetails.currentBeneficiary.slice(0, 6)}...{circleDetails.currentBeneficiary.slice(-4)}
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Created:</span>
                                                <span style={{ color: '#111827', fontSize: '14px', fontWeight: '600' }}>
                                                    {new Date(circleDetails.creationTime).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contract Information */}
                                    <div style={{ padding: '20px', background: '#f3f4f6', borderRadius: '12px', border: '1px solid #d1d5db' }}>
                                        <h4 style={{ margin: '0 0 16px 0', color: '#111827', borderBottom: '2px solid #00B900', paddingBottom: '8px' }}>
                                            📋 Contract Details
                                        </h4>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#6b7280', fontSize: '14px' }}>Transaction Hash:</span>
                                                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#374151' }}>
                                                    {circleDetails.transactionHash?.slice(0, 10)}...{circleDetails.transactionHash?.slice(-8)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
                                    <p>Failed to load circle details. Please try again.</p>
                                </div>
                            )}
                        </div>
                        <div className={styles.modalFooter}>
                            <button 
                                className={styles.modalCancelButton}
                                onClick={() => {
                                    setShowDetailsModal(false);
                                    setSelectedCircle(null);
                                    setCircleDetails(null);
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}