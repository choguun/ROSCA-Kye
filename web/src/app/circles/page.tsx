"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useWalletAccountStore } from "@/components/Wallet/Account/auth.hooks";
import { useKaiaWalletSdk, useKaiaWalletSdkStore } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { useKyeContracts } from '@/hooks/useKyeContracts';
import { WalletButton } from '@/components/Wallet/Button/WalletButton';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function Circles() {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showJoinForm, setShowJoinForm] = useState(false);
    const [circleName, setCircleName] = useState('');
    const [monthlyAmount, setMonthlyAmount] = useState('');
    const [maxMembers, setMaxMembers] = useState(5);
    const [penaltyBps, setPenaltyBps] = useState(500); // 5%
    const [roundDurationDays, setRoundDurationDays] = useState(30);
    const [inviteCode, setInviteCode] = useState('');
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [myCircles, setMyCircles] = useState<any[]>([]);
    const [selectedCircle, setSelectedCircle] = useState<any>(null);
    const [showCircleDetails, setShowCircleDetails] = useState(false);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [progressData, setProgressData] = useState<any>(null);
    const [loadingProgress, setLoadingProgress] = useState(false);
    const [userIsBeneficiary, setUserIsBeneficiary] = useState(false);
    const [checkingBeneficiary, setCheckingBeneficiary] = useState(false);
    
    // Balance detection states
    const [showBalanceModal, setShowBalanceModal] = useState(false);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [kaiaBalance, setKaiaBalance] = useState('0');
    const [usdtBalance, setUsdtBalance] = useState('0');
    const [balanceChecked, setBalanceChecked] = useState(false);
    const [currentAPY, setCurrentAPY] = useState('5.00');
    const [autoRefreshing, setAutoRefreshing] = useState(false);
    const [membershipDetecting, setMembershipDetecting] = useState(false);

    // Wallet hooks - exactly like profile page
    const { account, setAccount } = useWalletAccountStore();
    const { getAccount, getChainId, getBalance, getErc20TokenBalance } = useKaiaWalletSdk();
    const { sdk } = useKaiaWalletSdkStore();
    const { createCircle, joinCircle, makeDeposit, addresses, getContractAddressFromTx, getSavingsPocketAPY } = useKyeContracts();
    const router = useRouter();

    // Fetch circle data from contract using Kaia Wallet SDK
    const fetchCircleData = useCallback(async (circleAddress) => {
        try {
            console.log('🔍 Fetching REAL circle data for:', circleAddress);
            
            if (!circleAddress || circleAddress === 'pending') {
                console.log('❌ Cannot fetch circle data: invalid address');
                return {
                    depositAmount: 'Pending',
                    memberCount: '?/5',
                    phase: 'Deploying'
                };
            }
            
            const account = await getAccount();
            if (!account || !sdk) {
                console.log('❌ No wallet account or SDK found');
                return {
                    depositAmount: 'No Wallet',
                    memberCount: '?/5',
                    phase: 'No Wallet'
                };
            }
            
            const { ethers } = await import('ethers');
            const { KYE_GROUP_ABI } = await import('@/utils/contracts/abis');
            
            const walletProvider = sdk.getWalletProvider();
            console.log('🔗 Using Kaia Wallet SDK provider:', walletProvider);
            
            const provider = new ethers.BrowserProvider(walletProvider);
            const circleContract = new ethers.Contract(circleAddress, KYE_GROUP_ABI, provider);
            
            console.log('📞 Calling smart contract functions for address:', circleAddress);
            
            const [depositAmount, memberCount, phase, maxMembers] = await Promise.all([
                circleContract.depositAmount().catch((e) => {
                    console.log('❌ Error getting depositAmount:', e.message);
                    return 0n;
                }),
                circleContract.memberCount().catch((e) => {
                    console.log('❌ Error getting memberCount:', e.message);
                    return 0n;
                }),
                circleContract.currentPhase().catch((e) => {
                    console.log('❌ Error getting currentPhase:', e.message);
                    return 0;
                }),
                circleContract.maxMembers().catch((e) => {
                    console.log('❌ Error getting maxMembers from contract:', e.message);
                    console.log('🔧 Will use fallback from localStorage or default to 5');
                    return 5; // Will be overridden by localStorage data if available
                })
            ]);
            
            // Get individual members using the members(index) function
            const members = [];
            const totalMembers = Number(memberCount);
            for (let i = 0; i < totalMembers; i++) {
                try {
                    const memberAddress = await circleContract.members(i);
                    members.push(memberAddress);
                } catch (e) {
                    console.log(`❌ Error getting member ${i}:`, e.message);
                    break;
                }
            }
            
            // Since we don't have a creator() function, we'll assume the first member is the creator
            const creator = members.length > 0 ? members[0] : '0x0';
            
            // Safely handle BigInt deposit amount with bug detection
            const depositAmountUsdt = (() => {
                try {
                    // Handle both BigInt and regular number formats
                    const amountStr = depositAmount.toString();
                    const rawDepositWei = Number(amountStr);
                    
                    // Apply bug detection - if > 1 trillion wei, it's a buggy contract
                    if (rawDepositWei > 1e12) {
                        const result = (rawDepositWei / 1e12).toString();
                        console.log('🔧 fetchCircleData: Detected buggy contract, using 1e12 divisor:', result);
                        return result;
                    } else {
                        const result = (rawDepositWei / 1e6).toString();
                        console.log('🔧 fetchCircleData: Detected correct contract, using 1e6 divisor:', result);
                        return result;
                    }
                } catch (e) {
                    console.warn('Failed to parse deposit amount:', depositAmount, e);
                    return 'Error';
                }
            })();
            
            // Handle member count with creator workaround for unfixed contracts
            let actualMemberCount = members.length;
            const isCreator = creator.toLowerCase() === account.toLowerCase();
            
            if (actualMemberCount === 0 && isCreator) {
                // If contract doesn't have creator auto-membership fix, manually count creator
                actualMemberCount = 1;
                console.log('🔧 CREATOR WORKAROUND: Contract missing creator auto-membership, adjusting count 0→1');
            }
            
            // Check localStorage for actual maxMembers if contract call failed
            let actualMaxMembers = Number(maxMembers);
            if (actualMaxMembers === 5) {
                // Try to get actual maxMembers from localStorage
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        const storedCircles = JSON.parse(localStorage.getItem('recentCircles') || '[]');
                        const matchingCircle = storedCircles.find((c: any) => 
                            c.address?.toLowerCase() === circleAddress.toLowerCase()
                        );
                        if (matchingCircle && matchingCircle.maxMembers) {
                            actualMaxMembers = Number(matchingCircle.maxMembers);
                            console.log(`🔧 Using maxMembers from localStorage: ${actualMaxMembers} (instead of contract default: ${maxMembers})`);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to get maxMembers from localStorage:', e);
                }
            }
            
            const memberCountDisplay = `${actualMemberCount}/${actualMaxMembers}`;
            const phaseNames = ['Setup', 'Commitment', 'Active', 'Settlement', 'Resolved', 'Disputed'];
            const phaseName = phaseNames[Number(phase)] || `Unknown (${phase})`;
            
            // Check membership status with detailed logging
            console.log('🔍 MEMBERSHIP CHECK:');
            console.log('  - Current account (lowercase):', account.toLowerCase());
            console.log('  - Creator from contract (lowercase):', creator.toLowerCase());
            console.log('  - Members array:', members);
            members.forEach((member, index) => {
                console.log(`    [${index}] ${member} (lowercase: ${member.toLowerCase()})`);
                console.log(`    [${index}] Matches current account:`, member.toLowerCase() === account.toLowerCase());
                console.log(`    [${index}] Matches creator:`, member.toLowerCase() === creator.toLowerCase());
            });
            
            // Enhanced membership detection with creator workaround
            const isInMembersArray = members.some(member => member.toLowerCase() === account.toLowerCase());
            const needsCreatorWorkaround = (actualMemberCount === 1 && members.length === 0 && isCreator);
            const isUserMember = isInMembersArray || needsCreatorWorkaround;
            
            console.log('🔧 ENHANCED MEMBERSHIP DETECTION:');
            console.log('  - isInMembersArray:', isInMembersArray);
            console.log('  - needsCreatorWorkaround:', needsCreatorWorkaround);
            console.log('  - actualMemberCount:', actualMemberCount);
            console.log('  - members.length:', members.length);
            console.log('  - isCreator:', isCreator);
            console.log('  - Final isUserMember:', isUserMember);
            
            console.log('🔍 MEMBERSHIP RESULTS:');
            console.log('  - isUserMember:', isUserMember);
            console.log('  - isCreator:', isCreator);
            
            console.log('✅ Got REAL circle data:', {
                depositAmount: depositAmountUsdt,
                memberCount: memberCountDisplay,
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
                memberCount: memberCountDisplay,
                phase: phaseName,
                maxMembers: actualMaxMembers, // Use the corrected maxMembers value
                isJoined: isUserMember, // Creator is also considered "joined" if they're in members array
                isCreator: isCreator
            };
            
        } catch (error) {
            console.error('❌ Error fetching circle data:', error);
            console.error('❌ Error details:', error.message, error.code);
            console.error('❌ Circle address:', circleAddress);
            console.error('❌ Account:', account);
            console.error('❌ SDK available:', !!sdk);
            
            // Provide more specific error messages
            let errorPhase = 'Error';
            let errorAmount = 'Error';
            
            if (error.message && error.message.includes('network')) {
                errorPhase = 'Network Error';
                errorAmount = 'Network Error';
            } else if (error.message && error.message.includes('revert')) {
                errorPhase = 'Contract Error';
                errorAmount = 'Contract Error';
            } else if (error.code === -32603) {
                errorPhase = 'RPC Error';
                errorAmount = 'RPC Error';
            }
            
            return {
                depositAmount: errorAmount,
                memberCount: '?/5', 
                phase: errorPhase,
                maxMembers: 5,
                isJoined: false,
                isCreator: false
            };
        }
    }, [getAccount, sdk]);

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
            }
        };
        
        checkExistingAccount();
    }, [getAccount, setAccount, isMounted]);

    // Load circles from localStorage and fetch real data
    useEffect(() => {
        if (!isMounted || !account) return;
        
        const loadAndUpdateCircles = async () => {
            try {
                const saved = localStorage.getItem('recentCircles');
                if (saved) {
                    const circles = JSON.parse(saved);
                    console.log('Loaded circles from localStorage:', circles);
                    
                    // Update ALL circles with fresh contract data for accurate membership status
                    const updatedCircles = await Promise.all(
                        circles.map(async (circle) => {
                            if (circle.address && circle.address !== 'pending') {
                                console.log('🔍 Auto-updating membership status for circle:', circle.address);
                                try {
                                    const contractData = await fetchCircleData(circle.address);
                                    console.log('✅ Updated membership for circle:', circle.name, 'isCreator:', contractData.isCreator, 'isJoined:', contractData.isJoined);
                                    return {
                                        ...circle,
                                        ...contractData,
                                        needsDataFetch: false // Remove flag after fetching
                                    };
                                } catch (error) {
                                    console.warn('⚠️ Failed to update circle:', circle.address, error);
                                    return circle; // Return original if update fails
                                }
                            }
                            return circle;
                        })
                    );
                    
                    // Save updated data back to localStorage if changed
                    if (JSON.stringify(updatedCircles) !== JSON.stringify(circles)) {
                        console.log('💾 Saving updated circle data to localStorage');
                        localStorage.setItem('recentCircles', JSON.stringify(updatedCircles));
                    }
                    
                    console.log('✅ Setting myCircles state with', updatedCircles.length, 'circles');
                    setMyCircles(updatedCircles);
                } else {
                    setMyCircles([]);
                }
            } catch (error) {
                console.error('Error loading and updating circles:', error);
                setMyCircles([]);
            }
        };
        
        loadAndUpdateCircles();
    }, [isMounted, account, fetchCircleData]);

    // Auto-refresh circle data periodically to catch updates from other members
    useEffect(() => {
        if (!account || myCircles.length === 0) return;
        
        const autoRefreshCircles = async () => {
            console.log('🔄 Auto-refreshing circle data...');
            setAutoRefreshing(true);
            
            try {
                const updatedCircles = await Promise.all(
                myCircles.map(async (circle) => {
                    if (circle.address && circle.address !== 'pending') {
                        try {
                            const realData = await fetchCircleData(circle.address);
                            const updated = {
                                ...circle,
                                ...realData,
                                needsDataFetch: false
                            };
                            
                            // Check if there were any changes
                            const hasChanges = (
                                circle.memberCount !== updated.memberCount ||
                                circle.phase !== updated.phase ||
                                circle.depositAmount !== updated.depositAmount
                            );
                            
                            if (hasChanges) {
                                console.log(`✅ Auto-refresh found changes for ${circle.name}:`, {
                                    oldMemberCount: circle.memberCount,
                                    newMemberCount: updated.memberCount,
                                    oldPhase: circle.phase,
                                    newPhase: updated.phase
                                });
                            }
                            
                            return updated;
                        } catch (error) {
                            console.error(`❌ Auto-refresh error for ${circle.address}:`, error);
                            return circle;
                        }
                    }
                    return circle;
                })
            );
            
                // Update state and localStorage if there are changes
                if (JSON.stringify(updatedCircles) !== JSON.stringify(myCircles)) {
                    console.log('📝 Auto-refresh updating circles with new data');
                    setMyCircles(updatedCircles);
                    localStorage.setItem('recentCircles', JSON.stringify(updatedCircles));
                }
            } catch (error) {
                console.error('❌ Auto-refresh error:', error);
            } finally {
                setAutoRefreshing(false);
            }
        };
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(autoRefreshCircles, 30000);
        
        // Cleanup interval on unmount
        return () => clearInterval(interval);
    }, [account, myCircles, fetchCircleData]);

    // Check token balances when account is connected
    useEffect(() => {
        if (!account || !isMounted || balanceChecked) return;

        const checkBalances = async () => {
            setBalanceLoading(true);
            console.log('=== CHECKING TOKEN BALANCES ===');
            console.log('Account:', account);
            console.log('Contract addresses from useKyeContracts:', addresses);
            console.log('MockUSDT address:', addresses?.MockUSDT);

            try {
                console.log('🔍 Fetching balances using SDK methods...');
                
                // Check Kaia native token balance using SDK
                const kaiaBalanceWei = await getBalance([account, 'latest']);
                const kaiaBalanceEth = (parseInt(kaiaBalanceWei as string, 16) / 1e18).toFixed(4);
                setKaiaBalance(kaiaBalanceEth);
                console.log('✅ Kaia Balance (SDK):', kaiaBalanceEth, 'KAIA');

                // Check USDT balance using SDK
                let usdtBalanceFormatted = '0';
                if (addresses?.MockUSDT) {
                    console.log('🔍 Fetching USDT balance from:', addresses.MockUSDT);
                    const usdtBalanceWei = await getErc20TokenBalance(addresses.MockUSDT, account);
                    usdtBalanceFormatted = (parseInt(usdtBalanceWei as string, 16) / 1e6).toFixed(2); // USDT has 6 decimals
                    console.log('✅ USDT Balance (SDK):', usdtBalanceFormatted, 'USDT');
                } else {
                    console.log('❌ USDT contract address not available from addresses.MockUSDT');
                }
                
                setUsdtBalance(usdtBalanceFormatted);

                // Check if user has ZERO tokens (show modal when balance = 0)
                const kaiaBalance = parseFloat(kaiaBalanceEth);
                const usdtBalance = parseFloat(usdtBalanceFormatted);
                const hasZeroKaia = kaiaBalance === 0;
                const hasZeroUsdt = usdtBalance === 0;

                console.log('🔍 Balance Check Results:');
                console.log('- Kaia Balance:', kaiaBalance, 'KAIA', hasZeroKaia ? '(ZERO - will show modal)' : '(OK)');
                console.log('- USDT Balance:', usdtBalance, 'USDT', hasZeroUsdt ? '(ZERO - will show modal)' : '(OK)');

                if (hasZeroKaia || hasZeroUsdt) {
                    console.log('❌ Zero token balance detected - showing modal');
                    setShowBalanceModal(true);
                } else {
                    console.log('✅ Both tokens have non-zero balance - no modal needed');
                    setShowBalanceModal(false); // Explicitly hide modal if balances are OK
                }

                setBalanceChecked(true);
            } catch (error) {
                console.error('❌ Error checking balances:', error);
                console.error('Full error details:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                });
                
                // Set error balances and show modal since we can't verify tokens
                setKaiaBalance('Error');
                setUsdtBalance('Error');
                setShowBalanceModal(true); // Show modal on error since we can't verify tokens
                setBalanceChecked(true); // Still mark as checked to avoid infinite retries
            } finally {
                setBalanceLoading(false);
            }
        };

        checkBalances();
    }, [account, isMounted, addresses, balanceChecked]);

    // Manual refresh functions for balances and circle data
    const refreshBalances = useCallback(async () => {
        if (!account) return;

        setBalanceLoading(true);
        console.log('🔄 Manually refreshing balances...');
        
        try {
            // Check Kaia native token balance
            const kaiaBalanceWei = await getBalance([account, 'latest']);
            const kaiaBalanceEth = (parseInt(kaiaBalanceWei as string, 16) / 1e18).toFixed(4);
            setKaiaBalance(kaiaBalanceEth);
            console.log('✅ Refreshed Kaia Balance:', kaiaBalanceEth, 'KAIA');

            // Check USDT balance
            if (addresses?.MockUSDT) {
                const usdtBalanceWei = await getErc20TokenBalance(addresses.MockUSDT, account);
                const usdtBalanceFormatted = (parseInt(usdtBalanceWei as string, 16) / 1e6).toFixed(2);
                setUsdtBalance(usdtBalanceFormatted);
                console.log('✅ Refreshed USDT Balance:', usdtBalanceFormatted, 'USDT');

                // // Dispatch custom event to notify other pages (like profile page) to refresh their balances
                // const balanceUpdateEvent = new CustomEvent('balanceUpdated', {
                //     detail: {
                //         kaiaBalance: kaiaBalanceEth,
                //         usdtBalance: usdtBalanceFormatted,
                //         account: account,
                //         timestamp: Date.now()
                //     }
                // });
                // window.dispatchEvent(balanceUpdateEvent);
                // console.log('📡 Balance update event dispatched to other pages');
            }
        } catch (error) {
            console.error('❌ Error refreshing balances:', error);
            setKaiaBalance('Error');
            setUsdtBalance('Error');
        } finally {
            setBalanceLoading(false);
        }
    }, [account, addresses, getBalance, getErc20TokenBalance]);

    const refreshCircleData = useCallback(async (circleAddress: string) => {
        console.log('🔄 Refreshing circle data for:', circleAddress);
        
        try {
            const updatedCircles = myCircles.map(circle => {
                if (circle.address?.toLowerCase() === circleAddress.toLowerCase()) {
                    return {
                        ...circle,
                        needsDataFetch: true, // Mark as needing refresh
                        phase: 'Refreshing...', // Show loading state
                        memberCount: 'Loading...',
                        depositAmount: 'Loading...'
                    };
                }
                return circle;
            });
            setMyCircles(updatedCircles);
            
            console.log('✅ Circle data refresh initiated - will be handled by useEffect');
        } catch (error) {
            console.error('❌ Error refreshing circle data:', error);
        }
    }, [myCircles, setMyCircles]);

    // Fetch current APY from SavingsPocket
    useEffect(() => {
        if (!isMounted || !addresses?.SavingsPocket) return;

        const fetchAPY = async () => {
            try {
                console.log('🔍 Fetching SavingsPocket APY...');
                const apy = await getSavingsPocketAPY();
                setCurrentAPY(apy);
                console.log('✅ Current APY fetched:', apy + '%');
            } catch (error) {
                console.error('❌ Error fetching APY:', error);
                // Keep default 5.00% APY
            }
        };

        fetchAPY();
    }, [isMounted, addresses, getSavingsPocketAPY]);

    // Check for pending contracts and try to get their addresses
    useEffect(() => {
        if (!myCircles.length || !getContractAddressFromTx) return;

        const updatePendingContracts = async () => {
            for (let i = 0; i < myCircles.length; i++) {
                const circle = myCircles[i];
                
                if (circle.address === 'pending' && circle.transactionHash) {
                    console.log(`🔄 Checking pending contract for circle: ${circle.name}`);
                    
                    try {
                        console.log('🔍 Attempting to get contract address for tx:', circle.transactionHash);
                        const contractAddress = await getContractAddressFromTx(circle.transactionHash);
                        
                        if (contractAddress) {
                            console.log('✅ Found contract address:', contractAddress);
                            
                            // Update the circle in state
                            setMyCircles(prevCircles => {
                                const updatedCircles = [...prevCircles];
                                if (updatedCircles[i]) {
                                    updatedCircles[i] = {
                                        ...updatedCircles[i],
                                        address: contractAddress
                                    };
                                }
                                return updatedCircles;
                            });
                            
                            // Update localStorage
                            try {
                                const saved = localStorage.getItem('recentCircles');
                                if (saved) {
                                    const circles = JSON.parse(saved);
                                    if (circles[i]) {
                                        circles[i].address = contractAddress;
                                        localStorage.setItem('recentCircles', JSON.stringify(circles));
                                        console.log('✅ Updated localStorage with contract address');
                                    }
                                }
                            } catch (error) {
                                console.error('Error updating localStorage:', error);
                            }
                            
                            console.log(`✅ Successfully updated contract address for ${circle.name}: ${contractAddress}`);
                            break; // Only update one at a time to avoid overwhelming
                        } else {
                            console.log(`⏳ Contract still pending for ${circle.name}`);
                        }
                    } catch (error) {
                        console.error('Error getting contract address:', error);
                    }
                }
            }
        };

        // Run immediately and then every 30 seconds to check for updates
        updatePendingContracts();
        
        const interval = setInterval(updatePendingContracts, 30000); // Check every 30 seconds
        
        return () => clearInterval(interval);
    }, [myCircles, getContractAddressFromTx]);

    const handleCreateClick = () => {
        setShowCreateForm(true);
        // Scroll to top for better UX
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleJoinClick = () => {
        setShowJoinForm(true);
        // Scroll to top for better UX
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBackToCircles = () => {
        setShowCreateForm(false);
        setShowJoinForm(false);
        setShowCircleDetails(false);
        setSelectedCircle(null);
        setCircleName('');
        setMonthlyAmount('');
        setInviteCode('');
    };

    const handleViewDetails = useCallback(async (circle) => {
        console.log('🔍 Opening circle details with automatic membership detection...');
        
        // First, set the circle and show details immediately
        setSelectedCircle(circle);
        setShowCircleDetails(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Then automatically detect current membership status
        if (circle.address && circle.address !== 'pending') {
            try {
                setMembershipDetecting(true);
                console.log('🔍 Auto-detecting membership for:', circle.address);
                const freshMembershipData = await fetchCircleData(circle.address);
                console.log('✅ Fresh membership data:', freshMembershipData);
                
                // Update the selected circle with fresh membership data
                const updatedCircle = {
                    ...circle,
                    ...freshMembershipData
                };
                
                console.log('📝 Updated circle with membership data:', {
                    name: updatedCircle.name,
                    isJoined: updatedCircle.isJoined,
                    isCreator: updatedCircle.isCreator,
                    memberCount: updatedCircle.memberCount,
                    phase: updatedCircle.phase
                });
                
                setSelectedCircle(updatedCircle);
                
                // Also update the circle in myCircles list for consistency
                setMyCircles(prev => prev.map(c => 
                    c.address?.toLowerCase() === circle.address?.toLowerCase() 
                        ? updatedCircle 
                        : c
                ));
                
            } catch (error) {
                console.error('⚠️ Failed to auto-detect membership:', error);
                // Continue showing details even if membership detection fails
            } finally {
                setMembershipDetecting(false);
            }
        } else {
            console.log('⚠️ Circle address is pending, skipping membership detection');
        }
    }, [fetchCircleData]);

    const handleManageCircle = useCallback(async (circle) => {
        console.log('🔍 Opening circle management with automatic membership detection...');
        
        // First, set the circle and show details immediately
        setSelectedCircle(circle);
        setShowCircleDetails(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Then automatically detect current membership status
        if (circle.address && circle.address !== 'pending') {
            try {
                setMembershipDetecting(true);
                console.log('🔍 Auto-detecting membership for management view:', circle.address);
                const freshMembershipData = await fetchCircleData(circle.address);
                console.log('✅ Fresh management data:', freshMembershipData);
                
                // Update the selected circle with fresh membership data
                const updatedCircle = {
                    ...circle,
                    ...freshMembershipData
                };
                
                setSelectedCircle(updatedCircle);
                
                // Also update the circle in myCircles list for consistency
                setMyCircles(prev => prev.map(c => 
                    c.address?.toLowerCase() === circle.address?.toLowerCase() 
                        ? updatedCircle 
                        : c
                ));
                
            } catch (error) {
                console.error('⚠️ Failed to auto-detect membership for management:', error);
                // Continue showing management even if membership detection fails
            } finally {
                setMembershipDetecting(false);
            }
        } else {
            console.log('⚠️ Circle address is pending, skipping membership detection for management');
        }
    }, [fetchCircleData]);

    const handleRefreshCircle = useCallback(async (circle, circleIndex) => {
        console.log(`🔄 Manual refresh requested for circle:`, circle.address);
        
        // Update circle to show it's being refreshed
        const updatedCircles = [...myCircles];
        updatedCircles[circleIndex] = {
            ...updatedCircles[circleIndex],
            phase: 'Refreshing...',
            memberCount: 'Loading...',
            depositAmount: 'Loading...'
        };
        setMyCircles(updatedCircles);
        
        // Fetch fresh data
        try {
            if (circle.address && circle.address !== 'pending') {
                console.log('🔍 Fetching fresh data for circle:', circle.address);
                const freshData = await fetchCircleData(circle.address);
                console.log('✅ Got fresh data:', freshData);
                
                // Update the specific circle with fresh data
                const finalUpdatedCircles = [...myCircles];
                finalUpdatedCircles[circleIndex] = {
                    ...finalUpdatedCircles[circleIndex],
                    ...freshData
                };
                setMyCircles(finalUpdatedCircles);
                
                // If data was successfully fetched, save to localStorage
                if (!freshData.phase?.includes('Error') && typeof window !== 'undefined' && window.localStorage) {
                    try {
                        const existingCircles = JSON.parse(localStorage.getItem('recentCircles') || '[]');
                        const updatedExisting = existingCircles.map(existing => 
                            existing.address?.toLowerCase() === circle.address?.toLowerCase() 
                                ? { ...existing, ...freshData, needsDataFetch: false }
                                : existing
                        );
                        localStorage.setItem('recentCircles', JSON.stringify(updatedExisting));
                        console.log('✅ Updated localStorage with fresh data');
                    } catch (e) {
                        console.warn('Failed to update localStorage:', e);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Failed to refresh circle data:', error);
            // Revert to error state
            const errorUpdatedCircles = [...myCircles];
            errorUpdatedCircles[circleIndex] = {
                ...errorUpdatedCircles[circleIndex],
                phase: 'Refresh Failed',
                memberCount: '?/5',
                depositAmount: 'Refresh Failed'
            };
            setMyCircles(errorUpdatedCircles);
        }
    }, [myCircles, fetchCircleData]);

    const handleMakeDeposit = useCallback(async (circleAddress) => {
        if (!account) {
            alert('Please connect your wallet first');
            return;
        }

        if (!circleAddress) {
            alert('Invalid circle address');
            return;
        }

        if (!makeDeposit) {
            alert('Deposit functionality not ready. Please refresh the page.');
            return;
        }

        const confirmed = window.confirm(
            'Make a deposit to this circle?\n\n' +
            'This will transfer your monthly amount from your wallet to the circle contract.\n\n' +
            'IMPORTANT: Make sure you have joined this circle first! If you are not a member, the deposit will fail.'
        );

        if (!confirmed) return;

        try {
            console.log('=== MAKE DEPOSIT START ===');
            console.log('Circle address:', circleAddress);
            console.log('Account:', account);

            const result = await makeDeposit(circleAddress);
            
            if (result.success) {
                alert(`✅ Deposit successful!\n\nTransaction Hash: ${result.hash}\n\nYour contribution has been added to the circle.`);
                
                console.log('🔄 Starting post-deposit refresh...');
                
                // Refresh USDT balance to show reduced balance
                await refreshBalances();
                
                // Refresh the circle data to show updated member counts and status
                await refreshCircleData(circleAddress);
                
                console.log('✅ Post-deposit refresh completed');
            } else {
                throw new Error(result.error || 'Failed to make deposit');
            }
            
        } catch (error) {
            console.error('❌ Error making deposit:', error);
            
            let errorMessage = 'Failed to make deposit - Check console for details';
            if (error instanceof Error) {
                // The makeDeposit hook now provides comprehensive error messages
                errorMessage = error.message;
            }
            
            // Show user-friendly error message with helpful tips
            alert(`❌ Deposit Failed\n\n${errorMessage}\n\n💡 Common Solutions:\n• Wait for circle to have enough members (5 total)\n• Check you're not the current beneficiary\n• Verify you haven't deposited this round already\n• Ensure sufficient USDT balance\n• Try refreshing the page and trying again`);
        }
    }, [account, makeDeposit, refreshBalances, refreshCircleData]);

    const handleViewProgress = useCallback(async (circleAddress: string) => {
        console.log('📊 View Progress clicked with data:', {
            account,
            circleAddress,
            selectedCircle,
            selectedCircleAddress: selectedCircle?.address,
            hasWallet: !!account,
            hasCircleAddress: !!circleAddress
        });

        if (!account) {
            alert('❌ Wallet not connected. Please connect your wallet first.');
            return;
        }

        if (!circleAddress || circleAddress === 'pending') {
            console.log('❌ Circle address issue:', { circleAddress, selectedCircle });
            alert('❌ Circle contract address not available. This could mean:\n\n1. Circle is still being deployed\n2. Circle data hasn\'t loaded yet\n3. Invalid circle selected\n\nPlease wait a moment and try refreshing the circle data.');
            return;
        }

        try {
            setLoadingProgress(true);
            console.log('📊 Fetching comprehensive circle progress for:', circleAddress);

            const { ethers } = await import('ethers');
            const { KYE_GROUP_ABI } = await import('@/utils/contracts/abis');
            
            if (!sdk) {
                throw new Error('Wallet SDK not available');
            }

            const walletProvider = sdk.getWalletProvider();
            const provider = new ethers.BrowserProvider(walletProvider);
            const circleContract = new ethers.Contract(circleAddress, KYE_GROUP_ABI, provider);

            // Fetch comprehensive circle data
            console.log('📊 Fetching complete circle data with updated ABI...');
            
            const [
                currentRound,
                maxMembers,
                depositAmount,
                penaltyBps,
                roundDuration,
                phase,
                clubPool,
                totalYieldAccrued,
                members,
                memberCount
            ] = await Promise.all([
                circleContract.currentRound(),
                circleContract.maxMembers(),
                circleContract.depositAmount(),
                circleContract.penaltyBps(),
                circleContract.roundDuration(),
                circleContract.currentPhase(),
                circleContract.clubPool(),
                circleContract.totalYieldAccrued(),
                circleContract.getMembers(),
                circleContract.memberCount()
            ]);

            console.log('✅ Complete circle data fetched successfully:', {
                currentRound: Number(currentRound),
                maxMembers: Number(maxMembers),
                depositAmount: Number(depositAmount),
                penaltyBps: Number(penaltyBps),
                roundDuration: Number(roundDuration),
                phase: Number(phase),
                clubPool: Number(clubPool),
                totalYieldAccrued: Number(totalYieldAccrued),
                memberCount: Number(memberCount),
                membersLength: members.length
            });

            // Get current round details if active
            let currentRoundData = null;
            const memberDeposits = [];
            
            if (Number(currentRound) < Number(maxMembers) && phase >= 2) { // Phase 2+ (Active or later)
                try {
                    currentRoundData = await circleContract.getRoundState(currentRound);
                    console.log('🔄 Current round data:', currentRoundData);
                    
                    // Get deposit status for each member in current round
                    for (let i = 0; i < members.length; i++) {
                        const member = members[i];
                        const depositRecord = await circleContract.getDepositRecord(currentRound, member);
                        const memberState = await circleContract.getMemberState(member);
                        const isCurrentUser = member.toLowerCase() === account.toLowerCase();
                        const isBeneficiary = member.toLowerCase() === currentRoundData.beneficiary.toLowerCase();
                        
                        memberDeposits.push({
                            address: member,
                            isCurrentUser,
                            isBeneficiary,
                            depositAmount: Number(depositRecord.amount),
                            penaltyPaid: Number(depositRecord.penaltyPaid),
                            isOnTime: depositRecord.isOnTime,
                            timestamp: Number(depositRecord.timestamp),
                            hasDeposited: Number(depositRecord.amount) > 0,
                            totalDeposited: Number(memberState.totalDeposited),
                            totalReceived: Number(memberState.totalReceived),
                            penaltiesAccrued: Number(memberState.penaltiesAccrued),
                            gracePeriodsUsed: Number(memberState.gracePeriodsUsed),
                            defaultCount: Number(memberState.defaultCount),
                            hasDefaulted: memberState.hasDefaulted,
                            isActive: memberState.isActive
                        });
                    }
                } catch (error) {
                    console.log('⚠️ Could not fetch current round details:', error);
                }
            }

            // Get user's personal stats
            const userMemberState = await circleContract.getMemberState(account);
            const userStats = {
                totalDeposited: Number(userMemberState.totalDeposited) / 1e6, // Convert from wei to USDT
                totalReceived: Number(userMemberState.totalReceived) / 1e6, // Convert from wei to USDT
                penaltiesAccrued: Number(userMemberState.penaltiesAccrued) / 1e6, // Convert from wei to USDT
                gracePeriodsUsed: Number(userMemberState.gracePeriodsUsed),
                gracePeriodsRemaining: 1 - Number(userMemberState.gracePeriodsUsed),
                defaultCount: Number(userMemberState.defaultCount),
                hasDefaulted: userMemberState.hasDefaulted,
                isActive: userMemberState.isActive,
                isCurrentUser: true
            };

            // Calculate next beneficiary and user's turn
            const userIndex = members.findIndex(m => m.toLowerCase() === account.toLowerCase());
            const nextBeneficiaryIndex = Number(currentRound) < Number(maxMembers) ? Number(currentRound) : -1;
            const userTurnRound = userIndex >= 0 ? userIndex : -1;
            const userHadTurn = userTurnRound >= 0 && userTurnRound < Number(currentRound);
            const userIsNextBeneficiary = nextBeneficiaryIndex === userIndex;

            // Phase names
            const phaseNames = ['Setup', 'Commitment', 'Active', 'Settlement', 'Resolved', 'Disputed'];
            const currentPhase = phaseNames[Number(phase)] || `Unknown (${phase})`;

            const progressInfo = {
                circleAddress,
                currentRound: Number(currentRound),
                maxMembers: Number(maxMembers),
                depositAmount: Number(depositAmount) / 1e6, // Convert from wei to USDT (6 decimals)
                penaltyBps: Number(penaltyBps),
                roundDuration: Number(roundDuration),
                phase: Number(phase),
                currentPhase,
                clubPool: Number(clubPool) / 1e6, // Convert from wei to USDT
                totalYieldAccrued: Number(totalYieldAccrued) / 1e6, // Convert from wei to USDT
                memberCount: Number(memberCount),
                members,
                currentRoundData: currentRoundData ? {
                    deadline: Number(currentRoundData.deadline),
                    beneficiary: currentRoundData.beneficiary,
                    totalDeposited: Number(currentRoundData.totalDeposited) / 1e6, // Convert from wei to USDT
                    yieldAccrued: Number(currentRoundData.yieldAccrued) / 1e6, // Convert from wei to USDT
                    isComplete: currentRoundData.isComplete,
                    requiredDeposits: Number(currentRoundData.requiredDeposits)
                } : null,
                memberDeposits,
                userStats,
                nextBeneficiaryIndex,
                userTurnRound,
                userHadTurn,
                userIsNextBeneficiary,
                completedRounds: Number(currentRound),
                remainingRounds: Math.max(0, Number(maxMembers) - Number(currentRound)),
                isComplete: Number(phase) >= 4 // Resolved phase
            };

            console.log('📊 Complete progress data:', progressInfo);
            setProgressData(progressInfo);
            setShowProgressModal(true);

        } catch (error) {
            console.error('❌ Error fetching progress:', error);
            alert(`Failed to load progress: ${error.message || error}`);
        } finally {
            setLoadingProgress(false);
        }
    }, [account, sdk, selectedCircle]);

    // Check if current user is the beneficiary for the selected circle's current round
    const checkIfUserIsBeneficiary = useCallback(async (circleAddress: string) => {
        if (!account || !circleAddress || circleAddress === 'pending' || !sdk) {
            setUserIsBeneficiary(false);
            return;
        }

        try {
            setCheckingBeneficiary(true);
            console.log('🔍 Checking if user is beneficiary for circle:', circleAddress);
            
            const { ethers } = await import('ethers');
            const { KYE_GROUP_ABI } = await import('@/utils/contracts/abis');
            
            const walletProvider = sdk.getWalletProvider();
            const provider = new ethers.BrowserProvider(walletProvider);
            const circleContract = new ethers.Contract(circleAddress, KYE_GROUP_ABI, provider);

            const [currentRound, maxMembers, currentPhase] = await Promise.all([
                circleContract.currentRound(),
                circleContract.maxMembers(),
                circleContract.currentPhase()
            ]);

            console.log('Beneficiary check - Contract state:', {
                currentRound: Number(currentRound),
                maxMembers: Number(maxMembers),
                currentPhase: Number(currentPhase)
            });

            // Only check beneficiary status if circle is active and has active rounds
            if (Number(currentPhase) === 2 && Number(currentRound) < Number(maxMembers)) { // Phase.Active = 2
                const roundState = await circleContract.getRoundState(currentRound);
                const beneficiaryAddress = roundState.beneficiary.toLowerCase();
                const userAddress = account.toLowerCase();
                const isBeneficiary = beneficiaryAddress === userAddress;

                console.log('Beneficiary check result:', {
                    beneficiaryAddress,
                    userAddress,
                    isBeneficiary
                });

                setUserIsBeneficiary(isBeneficiary);
            } else {
                console.log('Circle not in active phase or no active rounds');
                setUserIsBeneficiary(false);
            }
        } catch (error) {
            console.error('❌ Error checking beneficiary status:', error);
            setUserIsBeneficiary(false);
        } finally {
            setCheckingBeneficiary(false);
        }
    }, [account, sdk]);

    // Check beneficiary status whenever selectedCircle changes
    useEffect(() => {
        if (selectedCircle && selectedCircle.address && selectedCircle.address !== 'pending') {
            console.log('🔍 Selected circle changed, checking beneficiary status for:', selectedCircle.address);
            checkIfUserIsBeneficiary(selectedCircle.address);
        } else {
            setUserIsBeneficiary(false);
        }
    }, [selectedCircle, checkIfUserIsBeneficiary]);

    const fallbackCopyToClipboard = useCallback((text, label) => {
        try {
            // Create a temporary textarea element
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                console.log('✅ Fallback copy successful');
                alert(`${label} copied to clipboard!`);
            } else {
                console.error('❌ Fallback copy failed');
                alert(`❌ Failed to copy ${label}. Please copy manually.`);
            }
        } catch (error) {
            console.error('❌ Fallback copy error:', error);
            alert(`❌ Failed to copy ${label}. Please copy manually:\n\n${text}`);
        }
    }, []);

    const copyToClipboard = useCallback((text, label) => {
        console.log('📋 Copying to clipboard:', label);
        
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    console.log('✅ Clipboard copy successful');
                    alert(`${label} copied to clipboard!`);
                }).catch((err) => {
                    console.error('❌ Clipboard API failed:', err);
                    // Fallback method
                    fallbackCopyToClipboard(text, label);
                });
            } else {
                console.log('⚠️ Clipboard API not available, using fallback');
                fallbackCopyToClipboard(text, label);
            }
        } catch (error) {
            console.error('❌ Error in copyToClipboard:', error);
            fallbackCopyToClipboard(text, label);
        }
    }, [fallbackCopyToClipboard]);

    const handleRedirectToProfile = () => {
        router.push('/profile');
    };

    const handleCloseBalanceModal = () => {
        setShowBalanceModal(false);
    };

    const handleRefreshAddress = async (circle, circleIndex) => {
        if (!circle.transactionHash) return;
        
        console.log('🔄 Manual refresh for contract address:', circle.transactionHash);
        
        try {
            console.log('🔍 Attempting to get contract address for tx:', circle.transactionHash);
            const contractAddress = await getContractAddressFromTx(circle.transactionHash);
            
            if (contractAddress) {
                console.log('✅ Found contract address:', contractAddress);
                
                // Update the circle in state
                setMyCircles(prevCircles => {
                    const updatedCircles = [...prevCircles];
                    if (updatedCircles[circleIndex]) {
                        updatedCircles[circleIndex] = {
                            ...updatedCircles[circleIndex],
                            address: contractAddress
                        };
                    }
                    return updatedCircles;
                });
                
                // Update localStorage
                try {
                    const saved = localStorage.getItem('recentCircles');
                    if (saved) {
                        const circles = JSON.parse(saved);
                        if (circles[circleIndex]) {
                            circles[circleIndex].address = contractAddress;
                            localStorage.setItem('recentCircles', JSON.stringify(circles));
                            console.log('✅ Updated localStorage with contract address');
                        }
                    }
                } catch (error) {
                    console.error('Error updating localStorage:', error);
                }
                
                alert(`✅ Contract address found!\n\n${contractAddress}\n\nYou can now share the invite link.`);
            } else {
                alert('⏳ Contract is still being deployed. Please wait a few more minutes and try again.');
            }
        } catch (error) {
            console.error('Error getting contract address:', error);
            alert('❌ Error checking contract status. Please try again later.');
        }
    };

    const handleShareInviteLink = useCallback((circle) => {
        console.log('🔗 Share invite link clicked for circle:', circle);
        
        try {
            if (!circle.address || circle.address === 'pending') {
                console.log('⏳ Contract address is pending, sharing deployment info');
                
                // For now, share the transaction hash as a reference
                const tempInviteMessage = `🤝 Join our Savings Circle: "${circle.name}"
                
💰 Monthly Amount: ${circle.depositAmount} USDT
👥 Members: ${circle.memberCount}/5
📊 Phase: ${circle.phase}

⏳ Contract Status: Deploying...
📋 Transaction Hash: ${circle.transactionHash}

💡 How to join:
1. Wait for the contract to be fully deployed
2. The creator will share the final contract address
3. Go to the Circles page and click "Join Circle"
4. Enter the contract address when available

Join us in this Korean-style savings group (Kye)! 🇰🇷

⚠️ Note: Contract is still being deployed on Kaia blockchain. Please wait for confirmation.`;

                // Try to use Web Share API first (mobile-friendly)
                if (typeof navigator !== 'undefined' && navigator.share) {
                    console.log('📱 Using native share API...');
                    navigator.share({
                        title: `Join Savings Circle: ${circle.name}`,
                        text: tempInviteMessage,
                        url: window.location.origin + '/circles'
                    }).then(() => {
                        console.log('✅ Share successful');
                    }).catch(err => {
                        console.log('❌ Share failed, falling back to clipboard:', err);
                        copyToClipboard(tempInviteMessage, 'Invite Message (Contract Deploying)');
                    });
                } else {
                    console.log('📋 Using clipboard fallback...');
                    copyToClipboard(tempInviteMessage, 'Invite Message (Contract Deploying)');
                }
                return;
            }

            console.log('✅ Contract address available, sharing full invite');
            
            // Create invite message
            const inviteMessage = `🤝 Join our Savings Circle: "${circle.name}"
            
💰 Monthly Amount: ${circle.depositAmount} USDT
👥 Members: ${circle.memberCount}/5
📊 Phase: ${circle.phase}

📋 Invite Code (Contract Address):
${circle.address}

💡 How to join:
1. Go to the Circles page
2. Click "Join Circle"  
3. Paste the invite code above
4. Complete the joining process

Join us in this Korean-style savings group (Kye)! 🇰🇷`;

            // Try to use Web Share API first (mobile-friendly)
            if (typeof navigator !== 'undefined' && navigator.share) {
                console.log('📱 Using native share API...');
                navigator.share({
                    title: `Join Savings Circle: ${circle.name}`,
                    text: inviteMessage,
                    url: window.location.origin + '/circles'
                }).then(() => {
                    console.log('✅ Share successful');
                }).catch(err => {
                    console.log('❌ Share failed, falling back to clipboard:', err);
                    copyToClipboard(inviteMessage, 'Invite Message');
                });
            } else {
                console.log('📋 Using clipboard fallback...');
                copyToClipboard(inviteMessage, 'Invite Message');
            }
            
        } catch (error) {
            console.error('❌ Error in share invite link:', error);
            alert('❌ Failed to share invite. Please try again.');
        }
    }, [copyToClipboard]);

    const handleViewMembers = async (circle) => {
        console.log('🔍 Fetching real member data for circle:', circle.address);
        
        try {
            if (!circle.address || circle.address === 'pending') {
                const memberInfo = `👥 Circle Members Information (Deploying)

📋 Circle: ${circle.name}
👤 Total Members: Pending deployment...
💰 Monthly Amount: ${circle.depositAmount} USDT

⏳ Contract Status: Deploying...
📋 Transaction Hash: ${circle.transactionHash}

💡 Member list will be available once the contract is deployed.`;
                alert(memberInfo);
                return;
            }
            
            // Fetch real blockchain data
            const currentAccount = await getAccount();
            if (!currentAccount) {
                alert('❌ Please connect your wallet to view member details.');
                return;
            }
            
            const { ethers } = await import('ethers');
            const { KYE_GROUP_ABI } = await import('@/utils/contracts/abis');
            
            const walletProvider = sdk.getWalletProvider();
            const provider = new ethers.BrowserProvider(walletProvider);
            const contract = new ethers.Contract(circle.address, KYE_GROUP_ABI, provider);
            
            console.log('🔍 Fetching members from contract...');
            
            // Get real member data from blockchain
            const [members, creator, depositAmount, maxMembers, phase] = await Promise.all([
                contract.getMembers().catch(() => []),
                contract.creator().catch(() => '0x0'),
                contract.depositAmount().catch(() => 0n),
                contract.maxMembers().catch(() => 5),
                contract.phase().catch(() => 0)
            ]);
            
            console.log('✅ Real member data:', {
                members,
                creator,
                depositAmount: depositAmount.toString(),
                maxMembers: Number(maxMembers),
                phase: Number(phase)
            });
            
            // Format member list
            const membersList = members.map((member, index) => {
                const isCreator = member.toLowerCase() === creator.toLowerCase();
                const isCurrentUser = member.toLowerCase() === currentAccount.toLowerCase();
                
                let role = '';
                if (isCreator) role += ' (Creator)';
                if (isCurrentUser) role += ' (You)';
                
                return `${index + 1}. ${member.slice(0, 6)}...${member.slice(-4)}${role} ✅`;
            }).join('\n');
            
            // Add open slots
            const openSlots = Number(maxMembers) - members.length;
            const openSlotsList = openSlots > 0 ? 
                Array.from({length: openSlots}, (_, i) => 
                    `${members.length + i + 1}. [Open Slot] 🔓`
                ).join('\n') : '';
            
            const phaseNames = ['Setup', 'Active', 'Resolved', 'Cancelled'];
            const phaseName = phaseNames[Number(phase)] || 'Unknown';
            
            // Fix display for both buggy and correct contracts
            const rawDepositWei = Number(depositAmount);
            const depositAmountUsdt = rawDepositWei > 1e12 ? 
                (rawDepositWei / 1e12).toString() : 
                (rawDepositWei / 1e6).toString();
            console.log('🔧 Page display fix:', {
                rawDepositWei, 
                depositAmountUsdt, 
                isBuggy: rawDepositWei > 1e12
            });
            
            const memberInfo = `👥 Circle Members Information (Live Data)

📋 Circle: ${circle.name}
👤 Total Members: ${members.length}/${Number(maxMembers)}
💰 Monthly Amount: ${depositAmountUsdt} USDT
📊 Phase: ${phaseName}

🏗️ Members List (Real Blockchain Data):
${membersList}
${openSlotsList ? '\n' + openSlotsList : ''}

📍 Contract Address: ${circle.address}
🗓️ Created: ${new Date(circle.createdAt).toLocaleDateString()}

💡 To invite more members, share the contract address with them!`;

            alert(memberInfo);
            
        } catch (error) {
            console.error('❌ Error fetching member data:', error);
            
            // Fallback to stored data
            const fallbackInfo = `👥 Circle Members Information (Fallback)

📋 Circle: ${circle.name}
👤 Total Members: ${circle.memberCount || '?'}/${circle.maxMembers || 5}
💰 Monthly Amount: ${circle.depositAmount} USDT

❌ Error fetching live member data from blockchain:
${error.message}

📍 Contract Address: ${circle.address || 'Deploying...'}
🗓️ Created: ${new Date(circle.createdAt).toLocaleDateString()}

💡 Try refreshing or check your network connection.`;
            
            alert(fallbackInfo);
        }
    };

    const handleCircleSettings = (circle) => {
        const settingsInfo = `⚙️ Circle Settings

📋 Circle Name: ${circle.name}
💰 Monthly Amount: ${circle.depositAmount} USDT  
📊 Current Phase: ${circle.phase}
👤 Your Role: ${circle.isCreator ? 'Creator' : 'Member'}
👥 Members: ${circle.memberCount}/5

🔧 Available Actions:
${circle.phase === 'Setup' ? 
    '• Invite more members\n• Modify circle settings\n• Start the circle when ready' : 
    '• View circle progress\n• Monitor member deposits\n• Track payout schedule'}

📍 Contract Details:
• Address: ${circle.address || 'Deploying...'}
• Network: Kaia Kairos Testnet
• Transaction: ${circle.transactionHash}

⚠️ Note: Some settings may require blockchain transactions and gas fees.`;

        alert(settingsInfo);
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

            // FIXED: Pass amount directly - useKyeContracts hook handles conversion properly
            console.log('Amount in USDT:', monthlyAmount);

            // Call the actual smart contract
            const result = await createCircle(circleName, monthlyAmount, penaltyBps, roundDurationDays, maxMembers);
            console.log('✅ Circle created successfully:', result);

            if (result.success) {
                alert(`✅ Circle "${circleName}" created successfully!\n\nTransaction Hash: ${result.hash}\n\nShare this circle with your friends to let them join.`);
                
                // Store created circle for demo persistence  
                try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                        const createdCircle = {
                            name: circleName,
                            depositAmount: monthlyAmount,
                            maxMembers: maxMembers,
                            penaltyBps: penaltyBps,
                            roundDurationDays: roundDurationDays,
                            memberCount: 1,
                            phase: 'Setup',
                            isCreator: true,
                            createdAt: Date.now(),
                            address: result.circleAddress || 'pending',
                            transactionHash: result.hash
                        };
                        
                        const existing = JSON.parse(localStorage.getItem('recentCircles') || '[]');
                        existing.push(createdCircle);
                        localStorage.setItem('recentCircles', JSON.stringify(existing));
                    }
                } catch (e) {
                    console.warn('Failed to save to localStorage:', e);
                }
                
                // Update local circles list
                const newCircle = {
                    name: circleName,
                    depositAmount: monthlyAmount,
                    memberCount: 1,
                    phase: 'Setup',
                    isCreator: true,
                    createdAt: Date.now(),
                    address: result.circleAddress || 'pending',
                    transactionHash: result.hash
                };
                setMyCircles(prev => [...prev, newCircle]);
                
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
                            memberCount: '1/5', // Default, will be updated when we fetch contract data
                            maxMembers: 5, // Will be updated when we fetch contract data
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
                            console.log('✅ Saved joined circle to localStorage');
                            
                            // Update local circles list immediately
                            setMyCircles(prev => [...prev, joinedCircle]);
                            
                            // Automatically fetch fresh data for the joined circle
                            console.log('🔄 Fetching fresh data for joined circle...');
                            setTimeout(async () => {
                                try {
                                    const freshData = await fetchCircleData(inviteCode);
                                    console.log('✅ Fresh data for joined circle:', freshData);
                                    
                                    // Update the circle with fresh data
                                    setMyCircles(prev => prev.map(circle => 
                                        circle.address?.toLowerCase() === inviteCode.toLowerCase()
                                            ? { ...circle, ...freshData, needsDataFetch: false }
                                            : circle
                                    ));
                                    
                                    // Also update localStorage
                                    const updatedExisting = JSON.parse(localStorage.getItem('recentCircles') || '[]');
                                    const finalUpdated = updatedExisting.map(circle =>
                                        circle.address?.toLowerCase() === inviteCode.toLowerCase()
                                            ? { ...circle, ...freshData, needsDataFetch: false }
                                            : circle
                                    );
                                    localStorage.setItem('recentCircles', JSON.stringify(finalUpdated));
                                    
                                } catch (fetchError) {
                                    console.warn('⚠️ Failed to fetch fresh data for joined circle:', fetchError);
                                }
                            }, 3000); // Wait 3 seconds for join transaction to be processed
                            
                        } else {
                            console.log('⚠️ Circle already exists in localStorage, not adding duplicate');
                            
                            // Still refresh the existing circle's data
                            console.log('🔄 Refreshing existing circle data...');
                            setTimeout(async () => {
                                try {
                                    const freshData = await fetchCircleData(inviteCode);
                                    setMyCircles(prev => prev.map(circle => 
                                        circle.address?.toLowerCase() === inviteCode.toLowerCase()
                                            ? { ...circle, ...freshData, isJoined: true, needsDataFetch: false }
                                            : circle
                                    ));
                                } catch (fetchError) {
                                    console.warn('⚠️ Failed to refresh existing circle data:', fetchError);
                                }
                            }, 3000);
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

                {!showCreateForm && !showJoinForm && !showCircleDetails && (
                    <div className={styles.actions}>
                        <div className={styles.actionCard}>
                            <div className={styles.actionIcon}>➕</div>
                            <h3>Create Circle</h3>
                            <p>Start a new savings circle</p>
                            <div className={styles.circleYieldBadge} style={{justifyContent: 'center', margin: '12px 0'}}>
                                <span>💰</span>
                                <span>Earn {currentAPY}% APY on deposits</span>
                            </div>
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
                            <div className={styles.yieldHighlight}>
                                <div className={styles.yieldBadge}>
                                    <span className={styles.yieldIcon}>💰</span>
                                    <span className={styles.yieldText}>Earn {currentAPY}% APY on deposits</span>
                                    <span className={styles.yieldSubtext}>Powered by SavingsPocket</span>
                                </div>
                            </div>
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
                                <label>Circle Size (Members)</label>
                                <select
                                    className={styles.input}
                                    value={maxMembers}
                                    onChange={(e) => setMaxMembers(parseInt(e.target.value))}
                                >
                                    <option value={2}>2 Members (Intimate)</option>
                                    <option value={3}>3 Members (Small)</option>
                                    <option value={4}>4 Members (Medium)</option>
                                    <option value={5}>5 Members (Traditional)</option>
                                </select>
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
                                {monthlyAmount && parseFloat(monthlyAmount) > 0 && (
                                    <div className={styles.yieldPreview}>
                                        <span className={styles.yieldIcon}>📈</span>
                                        <span className={styles.yieldCalculation}>
                                            Potential yearly yield: ~{(parseFloat(monthlyAmount) * maxMembers * parseFloat(currentAPY) / 100).toFixed(2)} USDT
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Late Penalty (%)</label>
                                <select
                                    className={styles.input}
                                    value={penaltyBps}
                                    onChange={(e) => setPenaltyBps(parseInt(e.target.value))}
                                >
                                    <option value={100}>1% (Lenient)</option>
                                    <option value={300}>3% (Moderate)</option>
                                    <option value={500}>5% (Standard)</option>
                                    <option value={1000}>10% (Strict)</option>
                                    <option value={2000}>20% (Maximum)</option>
                                </select>
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Round Duration</label>
                                <select
                                    className={styles.input}
                                    value={roundDurationDays}
                                    onChange={(e) => setRoundDurationDays(parseInt(e.target.value))}
                                >
                                    <option value={7}>7 days (Weekly)</option>
                                    <option value={14}>14 days (Bi-weekly)</option>
                                    <option value={30}>30 days (Monthly)</option>
                                    <option value={60}>60 days (Bi-monthly)</option>
                                </select>
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

                {showCircleDetails && selectedCircle && (
                    <div className={styles.formContainer}>
                        <div className={styles.formHeader}>
                            <button 
                                className={styles.backButton}
                                onClick={handleBackToCircles}
                            >
                                ← Back to Circles
                            </button>
                            <h2>{selectedCircle.isCreator ? 'Manage Circle' : 'Circle Details'}: {selectedCircle.name}</h2>
                        </div>
                        <div className={styles.detailsContainer}>
                            <div className={styles.detailsGrid}>
                                <div className={styles.detailsSection}>
                                    <h3>Circle Information</h3>
                                    <div className={styles.detailsInfo}>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Circle Name:</span>
                                            <span className={styles.detailValue}>{selectedCircle.name}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Monthly Amount:</span>
                                            <span className={styles.detailValue}>{selectedCircle.depositAmount} USDT</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Members:</span>
                                            <span className={styles.detailValue}>{selectedCircle.memberCount}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Phase:</span>
                                            <span className={`${styles.detailValue} ${styles.circlePhase}`}>{selectedCircle.phase}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Your Role:</span>
                                            <span className={styles.detailValue}>
                                                {membershipDetecting ? (
                                                    <span style={{ color: '#f59e0b' }}>🔄 Detecting...</span>
                                                ) : (
                                                    selectedCircle.isCreator ? '👑 Creator (Member #0)' : 
                                                    selectedCircle.isJoined ? '👥 Member' :
                                                    '👁️ Observer'
                                                )}
                                            </span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Created:</span>
                                            <span className={styles.detailValue}>{new Date(selectedCircle.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.detailsSection}>
                                    <h3>Blockchain Details</h3>
                                    <div className={styles.detailsInfo}>
                                        {selectedCircle.address && selectedCircle.address !== 'pending' && (
                                            <div className={styles.detailItem}>
                                                <span className={styles.detailLabel}>Contract Address:</span>
                                                <div className={styles.addressContainer}>
                                                    <span className={styles.address}>{selectedCircle.address}</span>
                                                    <button 
                                                        className={styles.copyButton}
                                                        onClick={() => copyToClipboard(selectedCircle.address, 'Contract Address')}
                                                    >
                                                        📋
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {selectedCircle.transactionHash && (
                                            <div className={styles.detailItem}>
                                                <span className={styles.detailLabel}>Transaction Hash:</span>
                                                <div className={styles.addressContainer}>
                                                    <span className={styles.address}>{selectedCircle.transactionHash}</span>
                                                    <button 
                                                        className={styles.copyButton}
                                                        onClick={() => copyToClipboard(selectedCircle.transactionHash, 'Transaction Hash')}
                                                    >
                                                        📋
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Network:</span>
                                            <span className={styles.detailValue}>Kaia Kairos Testnet</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* {!selectedCircle.isCreator && ( */}
                                <div className={styles.memberSection}>
                                    <h3>Member Actions {membershipDetecting && <span style={{ fontSize: '14px', color: '#f59e0b' }}>🔄 Detecting membership...</span>}</h3>
                                    <div className={styles.memberActions}>
                                        {membershipDetecting ? (
                                            <div style={{ 
                                                padding: '16px', 
                                                textAlign: 'center', 
                                                color: '#f59e0b',
                                                backgroundColor: '#fef3c7',
                                                borderRadius: '8px',
                                                border: '1px solid #f59e0b'
                                            }}>
                                                🔄 Auto-detecting your membership status...
                                                <br />
                                                <small>This will determine the correct actions to show</small>
                                            </div>
                                        ) : !selectedCircle.isJoined && !selectedCircle.isCreator ? (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                <button 
                                                    className={styles.createButton}
                                                    onClick={async () => {
                                                        if (!selectedCircle.address) {
                                                            alert('❌ Invalid circle address');
                                                            return;
                                                        }
                                                        
                                                        console.log('🎯 DIRECT JOIN - Using selected circle address:', selectedCircle.address);
                                                        
                                                        const confirmed = window.confirm(
                                                            `Join this circle?\n\nAddress: ${selectedCircle.address}\n\nThis will send a transaction to join the circle.`
                                                        );
                                                        
                                                        if (!confirmed) return;
                                                        
                                                        try {
                                                            setJoining(true);
                                                            
                                                            // Call joinCircle directly with the selected circle's address
                                                            const result = await joinCircle(selectedCircle.address);
                                                            
                                                            if (result.success) {
                                                                alert(`✅ Successfully joined circle!\n\nTransaction Hash: ${result.hash}\n\nYou are now a member of this circle.`);
                                                                
                                                                // Update the UI to show joined status
                                                                const updatedCircle = {
                                                                    ...selectedCircle,
                                                                    isJoined: true,
                                                                    needsDataFetch: true
                                                                };
                                                                setSelectedCircle(updatedCircle);
                                                                
                                                                // Update myCircles
                                                                const updatedCircles = myCircles.map(circle => 
                                                                    circle.address?.toLowerCase() === selectedCircle.address?.toLowerCase()
                                                                        ? { ...circle, isJoined: true, needsDataFetch: true }
                                                                        : circle
                                                                );
                                                                setMyCircles(updatedCircles);
                                                                
                                                                // Refresh data after 3 seconds
                                                                setTimeout(async () => {
                                                                    try {
                                                                        const freshData = await fetchCircleData(selectedCircle.address);
                                                                        console.log('✅ Fresh data after join:', freshData);
                                                                        
                                                                        setSelectedCircle((prev: any) => ({ ...prev, ...freshData, needsDataFetch: false }));
                                                                        setMyCircles(prev => prev.map(circle => 
                                                                            circle.address?.toLowerCase() === selectedCircle.address?.toLowerCase()
                                                                                ? { ...circle, ...freshData, needsDataFetch: false }
                                                                                : circle
                                                                        ));
                                                                    } catch (fetchError) {
                                                                        console.warn('Failed to refresh data:', fetchError);
                                                                    }
                                                                }, 3000);
                                                                
                                                            } else {
                                                                throw new Error(result.error || 'Join failed');
                                                            }
                                                            
                                                        } catch (error: any) {
                                                            console.error('❌ Join error:', error);
                                                            alert(`❌ Failed to join circle:\n\n${error?.message || error}`);
                                                        } finally {
                                                            setJoining(false);
                                                        }
                                                    }}
                                                    style={{ backgroundColor: '#10b981' }}
                                                    disabled={joining}
                                                >
                                                    {joining ? '⏳ Joining...' : '👥 Join Circle'}
                                                </button>
                                                <button 
                                                    className={styles.viewButton}
                                                    onClick={async () => {
                                                        console.log('🔄 Marking as joined without transaction...');
                                                        
                                                        const updatedCircle = {
                                                            ...selectedCircle,
                                                            isJoined: true,
                                                            needsDataFetch: true
                                                        };
                                                        setSelectedCircle(updatedCircle);
                                                        
                                                        // Also update in myCircles
                                                        const updatedCircles = myCircles.map(circle => 
                                                            circle.address?.toLowerCase() === selectedCircle.address?.toLowerCase()
                                                                ? { ...circle, isJoined: true, needsDataFetch: true }
                                                                : circle
                                                        );
                                                        setMyCircles(updatedCircles);
                                                        
                                                        // Update localStorage
                                                        if (typeof window !== 'undefined' && window.localStorage) {
                                                            try {
                                                                const existing = JSON.parse(localStorage.getItem('recentCircles') || '[]');
                                                                const updated = existing.map((circle: any) => 
                                                                    circle.address?.toLowerCase() === selectedCircle.address?.toLowerCase()
                                                                        ? { ...circle, isJoined: true, needsDataFetch: true }
                                                                        : circle
                                                                );
                                                                localStorage.setItem('recentCircles', JSON.stringify(updated));
                                                            } catch (e) {
                                                                console.warn('Failed to update localStorage:', e);
                                                            }
                                                        }
                                                        
                                                        alert('✅ Marked as joined!\n\nIf you are already a member of this circle, you can now try making a deposit.');
                                                    }}
                                                    style={{ backgroundColor: '#8b5cf6' }}
                                                    title="Skip join transaction if you're already a member"
                                                >
                                                    ⏭️ Already Member
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ 
                                                    padding: '12px', 
                                                    marginBottom: '16px',
                                                    backgroundColor: selectedCircle.isCreator ? '#dcfdf7' : '#dbeafe',
                                                    borderRadius: '8px',
                                                    border: selectedCircle.isCreator ? '1px solid #10b981' : '1px solid #3b82f6'
                                                }}>
                                                    <div style={{ 
                                                        fontSize: '14px', 
                                                        fontWeight: 'bold',
                                                        color: selectedCircle.isCreator ? '#065f46' : '#1e40af',
                                                        marginBottom: '4px'
                                                    }}>
                                                        ✅ Membership Confirmed
                                                    </div>
                                                    <div style={{ 
                                                        fontSize: '13px', 
                                                        color: selectedCircle.isCreator ? '#047857' : '#1d4ed8'
                                                    }}>
                                                        {selectedCircle.isCreator 
                                                            ? '👑 You are the creator of this circle' 
                                                            : '👥 You are a member of this circle'
                                                        }
                                                    </div>
                                                </div>
                                                
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {/* Show appropriate action based on circle phase and beneficiary status */}
                                                    {selectedCircle.phase === 'Active' && userIsBeneficiary && (
                                                        <div style={{ 
                                                            padding: '10px 14px',
                                                            backgroundColor: '#f0f9ff',
                                                            border: '2px solid #0ea5e9',
                                                            borderRadius: '8px',
                                                            fontSize: '13px',
                                                            color: '#0369a1',
                                                            fontWeight: '500'
                                                        }}>
                                                            🎉 You're the recipient this round! Wait for others to deposit, then you'll receive the payout automatically.
                                                        </div>
                                                    )}
                                                    
                                                    {selectedCircle.phase === 'Active' && !userIsBeneficiary && !checkingBeneficiary && (
                                                        <button 
                                                            className={styles.createButton}
                                                            onClick={() => handleMakeDeposit(selectedCircle.address)}
                                                            style={{ backgroundColor: '#10b981' }}
                                                        >
                                                            💰 Make Deposit
                                                        </button>
                                                    )}

                                                    {selectedCircle.phase === 'Active' && checkingBeneficiary && (
                                                        <div style={{ 
                                                            padding: '8px 12px',
                                                            backgroundColor: '#f3f4f6',
                                                            borderRadius: '6px',
                                                            fontSize: '13px',
                                                            color: '#6b7280'
                                                        }}>
                                                            🔍 Checking your role...
                                                        </div>
                                                    )}
                                                    
                                                    {selectedCircle.phase !== 'Active' && (
                                                        <div style={{ 
                                                            padding: '8px 12px',
                                                            backgroundColor: '#f3f4f6',
                                                            borderRadius: '6px',
                                                            fontSize: '13px',
                                                            color: '#6b7280'
                                                        }}>
                                                            💡 Deposits available when circle becomes Active
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <button 
                                            className={styles.inviteButton}
                                            onClick={async () => {
                                                console.log('🔍 Manual membership check...');
                                                console.log('Circle address:', selectedCircle.address);
                                                console.log('Current account:', account);
                                                
                                                // Check if we're querying the right contract
                                                console.log('⚠️ IMPORTANT CONTRACT CHECK:');
                                                console.log('- Selected circle address:', selectedCircle.address);
                                                console.log('- Expected from transaction:', '0xb82b3f83a2e0e3a4cc2ca5f82b4d72237cddc7b0');
                                                console.log('- Addresses match:', selectedCircle.address?.toLowerCase() === '0xb82b3f83a2e0e3a4cc2ca5f82b4d72237cddc7b0');
                                                
                                                const freshData = await fetchCircleData(selectedCircle.address);
                                                console.log('Fresh data:', freshData);
                                                
                                                // Also do a direct contract call to double-check
                                                if (sdk) {
                                                    try {
                                                        const { ethers } = await import('ethers');
                                                        const { KYE_GROUP_ABI } = await import('@/utils/contracts/abis');
                                                        
                                                        const walletProvider = sdk.getWalletProvider();
                                                        const provider = new ethers.BrowserProvider(walletProvider);
                                                        
                                                        // Check both the selected circle AND the transaction address
                                                        const addressesToCheck = [
                                                            selectedCircle.address,
                                                            '0xb82b3f83a2e0e3a4cc2ca5f82b4d72237cddc7b0' // From successful transaction
                                                        ];
                                                        
                                                        for (const addressToCheck of addressesToCheck) {
                                                            if (!addressToCheck) continue;
                                                            
                                                            console.log(`🔍 CHECKING CONTRACT: ${addressToCheck}`);
                                                            const circleContract = new ethers.Contract(addressToCheck, KYE_GROUP_ABI, provider);
                                                            
                                                            const memberCount = await circleContract.memberCount();
                                                            console.log(`- Member count: ${memberCount.toString()}`);
                                                            
                                                            for (let i = 0; i < memberCount; i++) {
                                                                const memberAddr = await circleContract.members(i);
                                                                console.log(`- Member ${i}: ${memberAddr}`);
                                                                console.log(`- Matches account: ${memberAddr.toLowerCase() === account?.toLowerCase()}`);
                                                            }
                                                            console.log('');
                                                        }
                                                    } catch (e) {
                                                        console.error('Direct contract check failed:', e);
                                                    }
                                                }
                                                
                                                alert(`Member Count: ${freshData.memberCount}\nIs Joined: ${freshData.isJoined}\nIs Creator: ${freshData.isCreator}\n\nCheck console for detailed membership info.`);
                                            }}
                                            title="Check current membership status"
                                        >
                                            🔍 Check Membership
                                        </button>
                                        <button 
                                            className={styles.inviteButton}
                                            onClick={() => handleViewProgress(selectedCircle?.address)}
                                            disabled={loadingProgress || !selectedCircle?.address || selectedCircle?.address === 'pending'}
                                            title={
                                                !selectedCircle?.address || selectedCircle?.address === 'pending' 
                                                    ? "Circle contract address not ready yet"
                                                    : "View detailed circle progress and member payment status"
                                            }
                                        >
                                            {loadingProgress ? '🔄 Loading...' : 
                                             !selectedCircle?.address || selectedCircle?.address === 'pending' ? '⏳ Not Ready' :
                                             '📊 View Progress'}
                                        </button>
                                    </div>
                                </div>
                            {/* )} */}
                        </div>
                    </div>
                )}

                <div className={styles.myCircles}>
                    <div className={styles.circlesHeader}>
                        <h2>My Circles {autoRefreshing && <span style={{ fontSize: '14px', color: '#f59e0b' }}>🔄 Auto-refreshing...</span>}</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={refreshBalances}
                                disabled={balanceLoading}
                                style={{
                                    backgroundColor: '#10b981',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    cursor: balanceLoading ? 'not-allowed' : 'pointer',
                                    opacity: balanceLoading ? 0.6 : 1
                                }}
                                title="Refresh wallet balances (KAIA & USDT)"
                            >
                                {balanceLoading ? '🔄' : '💰'} Refresh Balances
                            </button>
                        </div>
                    </div>
                    <div className={styles.circlesList}>
                        {myCircles.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>🎯</div>
                                <h3>No Active Circles</h3>
                                <p>Create or join your first circle</p>
                            </div>
                        ) : (
                            myCircles.map((circle, index) => {
                                // Debug logging for each circle
                                console.log(`🔍 RENDER CIRCLE ${index}:`, {
                                    name: circle.name,
                                    depositAmount: circle.depositAmount,
                                    memberCount: circle.memberCount,
                                    maxMembers: circle.maxMembers,
                                    phase: circle.phase,
                                    isCreator: circle.isCreator,
                                    isJoined: circle.isJoined,
                                    address: circle.address,
                                    needsDataFetch: circle.needsDataFetch
                                });
                                
                                return (
                                <div key={index} className={styles.circleCard}>
                                    <div className={styles.circleHeader}>
                                        <h3>{circle.name}</h3>
                                        <span className={styles.circlePhase}>{circle.phase}</span>
                                        {circle.needsDataFetch && (
                                            <span style={{ fontSize: '12px', color: '#f59e0b', marginLeft: '8px' }}>
                                                📡 Loading...
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.circleDetails}>
                                        {/* <p><strong>Monthly Amount:</strong> {circle.depositAmount} USDT</p>
                                        <p><strong>Members:</strong> {circle.memberCount}</p> */}
                                        {/* <p><strong>Role:</strong> {
                                            circle.isCreator ? '👑 Creator' : 
                                            circle.isJoined ? '👥 Member' :
                                            'Observer'
                                        }</p> */}
                                        {circle.address && circle.address !== 'pending' && (
                                            <p><strong>Address:</strong> <span className={styles.address}>{circle.address}</span></p>
                                        )}
                                        {circle.transactionHash && (
                                            <p><strong>TX Hash:</strong> <span className={styles.address}>{circle.transactionHash}</span></p>
                                        )}
                                        <p><strong>Created:</strong> {new Date(circle.createdAt).toLocaleDateString()}</p>
                                        
                                        <div className={styles.circleYieldBadge}>
                                            <span>💰</span>
                                            <span>Earning {currentAPY}% APY</span>
                                        </div>
                                        
                                        {circle.depositAmount && (
                                            <div className={styles.yieldEarnings}>
                                                <span>📈</span>
                                                <span>
                                                    Est. yearly yield: ~{(() => {
                                                        const depositValue = parseFloat(circle.depositAmount);
                                                        // Fix display for buggy contracts
                                                        const correctedDeposit = depositValue > 1000000 ? depositValue / 1000000 : depositValue;
                                                        return (correctedDeposit * (circle.maxMembers || 5) * parseFloat(currentAPY) / 100).toFixed(2);
                                                    })()} USDT
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.circleActions}>
                                        <button 
                                            className={styles.viewButton}
                                            onClick={() => handleViewDetails(circle)}
                                        >
                                            View Details
                                        </button>
                                        <button
                                            className={styles.viewButton}
                                            onClick={() => copyToClipboard(circle.address, 'Circle Invite Code')}
                                        >
                                            📋 Copy Invite Code
                                        </button>
                                        {(circle.phase?.includes('Error') || circle.depositAmount?.includes('Error')) && (
                                            <button 
                                                className={styles.refreshButton}
                                                onClick={() => handleRefreshCircle(circle, index)}
                                                style={{ 
                                                    backgroundColor: '#f59e0b', 
                                                    color: '#fff',
                                                    border: 'none',
                                                    padding: '8px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.875rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🔄 Retry
                                            </button>
                                        )}
                                        {circle.isCreator && circle.phase === 'Setup' && (
                                            <button 
                                                className={styles.manageButton}
                                                onClick={() => handleManageCircle(circle)}
                                            >
                                                Manage
                                            </button>
                                        )}
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Balance Detection Modal */}
                {showBalanceModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent}>
                            <div className={styles.modalHeader}>
                                <h3>⚠️ Insufficient Token Balance</h3>
                                <button 
                                    className={styles.modalCloseButton}
                                    onClick={handleCloseBalanceModal}
                                >
                                    ×
                                </button>
                            </div>
                            <div className={styles.modalBody}>
                                <p className={styles.modalDescription}>
                                    {(kaiaBalance === 'Error' || usdtBalance === 'Error') ? (
                                        <>
                                            ❌ Unable to check your token balances. This could be due to network issues or wallet connection problems.
                                            Please ensure you're connected to the correct network and try refreshing the page.
                                        </>
                                    ) : (
                                        <>
                                            You need both Kaia (native token) and USDT tokens to create or join savings circles. 
                                            Please get some tokens from the Profile page first.
                                        </>
                                    )}
                                </p>

                                <div className={styles.tokenRequirements}>
                                    <div className={`${styles.tokenItem} ${kaiaBalance === 'Error' ? styles.insufficient : (parseFloat(kaiaBalance) > 0 ? styles.sufficient : styles.insufficient)}`}>
                                        <div className={styles.tokenIcon}>💎</div>
                                        <div className={styles.tokenInfo}>
                                            <div className={styles.tokenName}>Kaia (KAIA)</div>
                                            <div className={styles.tokenPurpose}>For transaction fees</div>
                                            <div className={styles.tokenBalance}>
                                                Balance: {kaiaBalance === 'Error' ? 'Unable to fetch' : `${parseFloat(kaiaBalance).toFixed(4)} KAIA`}
                                            </div>
                                        </div>
                                        <div className={styles.statusIcon}>
                                            {kaiaBalance === 'Error' ? '⚠️' : (parseFloat(kaiaBalance) > 0 ? '✅' : '❌')}
                                        </div>
                                    </div>

                                    <div className={`${styles.tokenItem} ${usdtBalance === 'Error' ? styles.insufficient : (parseFloat(usdtBalance) > 0 ? styles.sufficient : styles.insufficient)}`}>
                                        <div className={styles.tokenIcon}>💵</div>
                                        <div className={styles.tokenInfo}>
                                            <div className={styles.tokenName}>Mock USDT</div>
                                            <div className={styles.tokenPurpose}>For circle deposits</div>
                                            <div className={styles.tokenBalance}>
                                                Balance: {usdtBalance === 'Error' ? 'Unable to fetch' : `${parseFloat(usdtBalance).toFixed(2)} USDT`}
                                            </div>
                                        </div>
                                        <div className={styles.statusIcon}>
                                            {usdtBalance === 'Error' ? '⚠️' : (parseFloat(usdtBalance) > 0 ? '✅' : '❌')}
                                        </div>
                                    </div>
                                </div>

                                <p className={styles.modalInstruction}>
                                    📝 <strong>Requirements:</strong> Both KAIA and USDT tokens are needed to participate in circles
                                </p>
                            </div>
                            <div className={styles.modalFooter}>
                                <button 
                                    className={styles.modalCancelButton}
                                    onClick={handleCloseBalanceModal}
                                >
                                    Continue Anyway
                                </button>
                                <button 
                                    className={styles.modalActionButton}
                                    onClick={handleRedirectToProfile}
                                >
                                    🏦 Go to Profile Page
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress Modal */}
                {showProgressModal && progressData && (
                    <div className={styles.modalOverlay} onClick={() => setShowProgressModal(false)}>
                        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3 style={{ color: '#1f2937', fontSize: '20px', fontWeight: '700' }}>📊 Circle Progress Report</h3>
                                <button 
                                    className={styles.modalCloseButton} 
                                    onClick={() => setShowProgressModal(false)}
                                >
                                    ×
                                </button>
                            </div>
                            
                            <div className={styles.modalBody} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                {/* Circle Status Overview */}
                                <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#ffffff', border: '2px solid #e5e7eb', borderRadius: '12px' }}>
                                    <h4 style={{ margin: '0 0 16px 0', color: '#111827', fontSize: '16px', fontWeight: '600' }}>📈 Circle Status</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px', color: '#374151' }}>
                                        <div><strong style={{ color: '#111827' }}>Phase:</strong> <span style={{ color: progressData.phase >= 4 ? '#059669' : '#d97706', fontWeight: '500' }}>{progressData.currentPhase}</span></div>
                                        <div><strong style={{ color: '#111827' }}>Members:</strong> <span style={{ color: '#374151' }}>{progressData.memberCount}/{progressData.maxMembers}</span></div>
                                        <div><strong style={{ color: '#111827' }}>Round:</strong> <span style={{ color: '#374151' }}>{progressData.completedRounds + 1}/{progressData.maxMembers}</span></div>
                                        <div><strong style={{ color: '#111827' }}>Remaining:</strong> <span style={{ color: '#374151' }}>{progressData.remainingRounds} rounds</span></div>
                                        <div><strong style={{ color: '#111827' }}>Monthly Amount:</strong> <span style={{ color: '#374151' }}>{progressData.depositAmount.toFixed(2)} USDT</span></div>
                                        <div><strong style={{ color: '#111827' }}>Penalty Rate:</strong> <span style={{ color: '#374151' }}>{(progressData.penaltyBps / 100).toFixed(1)}%</span></div>
                                    </div>
                                </div>

                                {/* Personal Stats */}
                                <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#ecfdf5', border: '2px solid #10b981', borderRadius: '12px' }}>
                                    <h4 style={{ margin: '0 0 16px 0', color: '#065f46', fontSize: '16px', fontWeight: '600' }}>👤 Your Stats</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px', color: '#065f46' }}>
                                        <div><strong style={{ color: '#065f46' }}>Total Deposited:</strong> <span>{progressData.userStats.totalDeposited.toFixed(2)} USDT</span></div>
                                        <div><strong style={{ color: '#065f46' }}>Total Received:</strong> <span>{progressData.userStats.totalReceived.toFixed(2)} USDT</span></div>
                                        <div><strong style={{ color: '#065f46' }}>Penalties Paid:</strong> <span>{progressData.userStats.penaltiesAccrued.toFixed(2)} USDT</span></div>
                                        <div><strong style={{ color: '#065f46' }}>Grace Periods:</strong> <span>{progressData.userStats.gracePeriodsUsed}/1 used</span></div>
                                        <div><strong style={{ color: '#065f46' }}>Late Payments:</strong> <span>{progressData.userStats.defaultCount}</span></div>
                                        <div><strong style={{ color: '#065f46' }}>Your Turn Round:</strong> <span>{progressData.userTurnRound >= 0 ? progressData.userTurnRound + 1 : 'N/A'}</span></div>
                                    </div>
                                    
                                    {progressData.userIsNextBeneficiary && (
                                        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#059669', color: 'white', borderRadius: '8px', textAlign: 'center', fontWeight: '500' }}>
                                            🎉 You are the next beneficiary!
                                        </div>
                                    )}
                                    
                                    {progressData.userHadTurn && (
                                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#4b5563', color: 'white', borderRadius: '8px', textAlign: 'center', fontWeight: '500' }}>
                                            ✅ You already received your payout
                                        </div>
                                    )}
                                </div>

                                {/* Current Round Details */}
                                {progressData.currentRoundData && !progressData.isComplete && (
                                    <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '12px' }}>
                                        <h4 style={{ margin: '0 0 16px 0', color: '#92400e', fontSize: '16px', fontWeight: '600' }}>🔄 Current Round {progressData.currentRound + 1}</h4>
                                        <div style={{ marginBottom: '12px', color: '#92400e', fontSize: '14px' }}>
                                            <strong>Beneficiary:</strong> {progressData.currentRoundData.beneficiary.slice(0, 8)}...{progressData.currentRoundData.beneficiary.slice(-6)}
                                            {progressData.currentRoundData.beneficiary.toLowerCase() === account.toLowerCase() && <span style={{ color: '#059669', marginLeft: '8px', fontWeight: '600' }}>(You)</span>}
                                        </div>
                                        <div style={{ marginBottom: '12px', color: '#92400e', fontSize: '14px' }}>
                                            <strong>Deadline:</strong> {new Date(progressData.currentRoundData.deadline * 1000).toLocaleString()}
                                        </div>
                                        <div style={{ marginBottom: '16px', color: '#92400e', fontSize: '14px' }}>
                                            <strong>Collected:</strong> {progressData.currentRoundData.totalDeposited.toFixed(2)} USDT
                                        </div>
                                        
                                        {/* Member Payment Status */}
                                        <div>
                                            <strong style={{ color: '#92400e', fontSize: '14px' }}>Payment Status:</strong>
                                            <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
                                                {progressData.memberDeposits.map((member, index) => (
                                                    <div key={index} style={{ 
                                                        display: 'flex', 
                                                        justifyContent: 'space-between', 
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        backgroundColor: member.isCurrentUser ? '#dcfce7' : member.isBeneficiary ? '#dbeafe' : '#ffffff',
                                                        border: member.isCurrentUser ? '1px solid #059669' : member.isBeneficiary ? '1px solid #3b82f6' : '1px solid #d1d5db',
                                                        borderRadius: '6px',
                                                        fontSize: '13px'
                                                    }}>
                                                        <span style={{ color: '#111827' }}>
                                                            {member.address.slice(0, 6)}...{member.address.slice(-4)}
                                                            {member.isCurrentUser && <span style={{ color: '#059669', fontWeight: '600' }}> (You)</span>}
                                                            {member.isBeneficiary && <span style={{ color: '#3b82f6', fontWeight: '600' }}> (Beneficiary)</span>}
                                                        </span>
                                                        <span style={{ 
                                                            color: member.hasDeposited ? '#059669' : member.isBeneficiary ? '#4b5563' : '#dc2626',
                                                            fontWeight: '500'
                                                        }}>
                                                            {member.isBeneficiary ? '🎯 Receiving' : member.hasDeposited ? '✅ Paid' : '⏳ Pending'}
                                                            {member.penaltyPaid > 0 && <span style={{ color: '#dc2626' }}> (+${(member.penaltyPaid / 1e6).toFixed(2)} penalty)</span>}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Circle Financial Summary */}
                                <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '12px' }}>
                                    <h4 style={{ margin: '0 0 16px 0', color: '#1e40af', fontSize: '16px', fontWeight: '600' }}>💰 Financial Summary</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px', color: '#1e40af' }}>
                                        <div><strong style={{ color: '#1e40af' }}>Club Pool:</strong> <span>{progressData.clubPool.toFixed(2)} USDT</span></div>
                                        <div><strong style={{ color: '#1e40af' }}>Total Yield:</strong> <span>{progressData.totalYieldAccrued.toFixed(2)} USDT</span></div>
                                        <div><strong style={{ color: '#1e40af' }}>Round Duration:</strong> <span>{Math.floor(progressData.roundDuration / 86400)} days</span></div>
                                        <div><strong style={{ color: '#1e40af' }}>Circle Health:</strong> 
                                            <span style={{ color: progressData.memberDeposits?.filter(m => m.hasDefaulted).length > 0 ? '#dc2626' : '#059669', marginLeft: '4px', fontWeight: '500' }}>
                                                {progressData.memberDeposits?.filter(m => !m.hasDefaulted).length || progressData.memberCount}/{progressData.memberCount} Active
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {progressData.isComplete && (
                                    <div style={{ padding: '20px', backgroundColor: '#059669', color: 'white', borderRadius: '12px', textAlign: 'center' }}>
                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600' }}>🎉 Circle Complete!</h4>
                                        <p style={{ margin: '0', fontSize: '14px', opacity: '0.9' }}>All members have received their payouts. Final distribution of penalties and yield will be processed.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}