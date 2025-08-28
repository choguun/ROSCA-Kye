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
    const [myCircles, setMyCircles] = useState([]);
    const [selectedCircle, setSelectedCircle] = useState(null);
    const [showCircleDetails, setShowCircleDetails] = useState(false);
    
    // Balance detection states
    const [showBalanceModal, setShowBalanceModal] = useState(false);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [kaiaBalance, setKaiaBalance] = useState('0');
    const [usdtBalance, setUsdtBalance] = useState('0');
    const [balanceChecked, setBalanceChecked] = useState(false);
    const [currentAPY, setCurrentAPY] = useState('5.00');

    // Wallet hooks - exactly like profile page
    const { account, setAccount } = useWalletAccountStore();
    const { getAccount, getChainId, getBalance, getErc20TokenBalance } = useKaiaWalletSdk();
    const { sdk } = useKaiaWalletSdkStore();
    const { createCircle, joinCircle, addresses, getContractAddressFromTx, getSavingsPocketAPY } = useKyeContracts();
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
            
            const [depositAmount, members, phase, maxMembers, creator] = await Promise.all([
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
                }),
                circleContract.creator().catch((e) => {
                    console.log('❌ Error getting creator:', e.message);
                    return '0x0';
                })
            ]);
            
            const depositAmountUsdt = (Number(depositAmount) / 1e6).toString();
            const memberCount = `${members.length}/${Number(maxMembers)}`;
            const phaseNames = ['Setup', 'Active', 'Resolved', 'Cancelled'];
            const phaseName = phaseNames[Number(phase)] || 'Unknown';
            
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
            
            const isUserMember = members.some(member => member.toLowerCase() === account.toLowerCase());
            const isCreator = creator.toLowerCase() === account.toLowerCase();
            
            console.log('🔍 MEMBERSHIP RESULTS:');
            console.log('  - isUserMember:', isUserMember);
            console.log('  - isCreator:', isCreator);
            
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
                maxMembers: Number(maxMembers),
                isJoined: isUserMember && !isCreator,
                isCreator: isCreator
            };
            
        } catch (error) {
            console.error('❌ Error fetching circle data:', error);
            console.error('❌ Error details:', error.message, error.code);
            
            return {
                depositAmount: 'Error',
                memberCount: '?/5', 
                phase: 'Error'
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
                    
                    // Update circles that need data fetch
                    const updatedCircles = await Promise.all(
                        circles.map(async (circle) => {
                            if (circle.needsDataFetch && circle.address && circle.address !== 'pending') {
                                console.log('🔍 Fetching real data for circle:', circle.address);
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

    const handleViewDetails = (circle) => {
        setSelectedCircle(circle);
        setShowCircleDetails(true);
        // Scroll to top for better UX
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleManageCircle = (circle) => {
        setSelectedCircle(circle);
        setShowCircleDetails(true);
        // Scroll to top for better UX
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

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
            const depositAmountUsdt = (Number(depositAmount) / 1e6).toString();
            
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

            // Convert amount to proper format (USDT has 6 decimals)
            const amountInUSDT = (parseFloat(monthlyAmount) * 1e6).toString();
            console.log('Amount in USDT (wei):', amountInUSDT);

            // Call the actual smart contract
            const result = await createCircle(circleName, amountInUSDT, penaltyBps, roundDurationDays, maxMembers);
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
                            memberCount: '1/5', // Default, will be updated
                            maxMembers: 5,
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
                            
                        } else {
                            console.log('⚠️ Circle already exists in localStorage, not adding duplicate');
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
                                            <span className={styles.detailValue}>{selectedCircle.memberCount}/5</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Phase:</span>
                                            <span className={`${styles.detailValue} ${styles.circlePhase}`}>{selectedCircle.phase}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Your Role:</span>
                                            <span className={styles.detailValue}>{
                                                selectedCircle.isCreator ? '👑 Creator' : 
                                                selectedCircle.isJoined ? '👥 Member' :
                                                'Observer'
                                            }</span>
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

                            {selectedCircle.isCreator && selectedCircle.phase === 'Setup' && (
                                <div className={styles.managementSection}>
                                    <h3>Circle Management</h3>
                                    <div className={styles.managementActions}>
                                        <button 
                                            className={styles.inviteButton}
                                            onClick={() => handleShareInviteLink(selectedCircle)}
                                        >
                                            📤 Share Invite Link
                                        </button>
                                        <button 
                                            className={styles.viewButton}
                                            onClick={() => handleViewMembers(selectedCircle)}
                                        >
                                            👥 View Members
                                        </button>
                                        <button 
                                            className={styles.manageButton}
                                            onClick={() => handleCircleSettings(selectedCircle)}
                                        >
                                            ⚙️ Circle Settings
                                        </button>
                                    </div>
                                    
                                    <div className={styles.inviteSection}>
                                        <h4>Invite Code</h4>
                                        {selectedCircle.address && selectedCircle.address !== 'pending' ? (
                                            <>
                                                <p>Share this address with friends to let them join your circle:</p>
                                                <div className={styles.inviteCodeContainer}>
                                                    <input 
                                                        type="text" 
                                                        value={selectedCircle.address}
                                                        readOnly 
                                                        className={styles.inviteCodeInput}
                                                    />
                                                    <button 
                                                        className={styles.copyButton}
                                                        onClick={() => copyToClipboard(selectedCircle.address, 'Invite Code')}
                                                    >
                                                        📋 Copy
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className={styles.pendingMessage}>
                                                    ⏳ Your circle contract is being deployed on the Kaia blockchain...
                                                </p>
                                                <div className={styles.inviteCodeContainer}>
                                                    <input 
                                                        type="text" 
                                                        value="🔄 Generating invite code..."
                                                        readOnly 
                                                        className={`${styles.inviteCodeInput} ${styles.pending}`}
                                                    />
                                                    <button 
                                                        className={styles.copyButton}
                                                        disabled={true}
                                                    >
                                                        ⏳ Wait
                                                    </button>
                                                </div>
                                                <div className={styles.deploymentStatus}>
                                                    <p><strong>📋 Transaction Hash:</strong></p>
                                                    <div className={styles.inviteCodeContainer}>
                                                        <input 
                                                            type="text" 
                                                            value={selectedCircle.transactionHash}
                                                            readOnly 
                                                            className={styles.inviteCodeInput}
                                                        />
                                                        <button 
                                                            className={styles.copyButton}
                                                            onClick={() => copyToClipboard(selectedCircle.transactionHash, 'Transaction Hash')}
                                                        >
                                                            📋 Copy
                                                        </button>
                                                    </div>
                                                    <p className={styles.helpText}>
                                                        💡 The invite code will appear here once deployment is complete. 
                                                        You can share the transaction hash above for now.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!selectedCircle.isCreator && (
                                <div className={styles.memberSection}>
                                    <h3>Member Actions</h3>
                                    <div className={styles.memberActions}>
                                        <button className={styles.viewButton}>
                                            💰 Make Deposit
                                        </button>
                                        <button className={styles.inviteButton}>
                                            📊 View Progress
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className={styles.myCircles}>
                    <div className={styles.circlesHeader}>
                        <h2>My Circles</h2>
                        <button 
                            className={styles.refreshButton}
                            onClick={async () => {
                                console.log('🔄 Manual refresh clicked - Current circles:', myCircles);
                                
                                // Force refresh all circles with blockchain data
                                const updatedCircles = await Promise.all(
                                    myCircles.map(async (circle) => {
                                        if (circle.address && circle.address !== 'pending') {
                                            console.log(`🔄 Force refreshing circle: ${circle.address}`);
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
                                
                                console.log('✅ Updated circles with real data:', updatedCircles);
                                setMyCircles(updatedCircles);
                                
                                // Save to localStorage
                                localStorage.setItem('recentCircles', JSON.stringify(updatedCircles));
                                alert('✅ Circles refreshed with latest blockchain data!');
                            }}
                            title="Refresh all circles with latest blockchain data"
                        >
                            🔄
                        </button>
                        <button 
                            className={styles.debugButton}
                            onClick={() => {
                                console.log('🔧 DEBUG - Current circles state:', myCircles);
                                console.log('🔧 DEBUG - localStorage data:', JSON.parse(localStorage.getItem('recentCircles') || '[]'));
                                console.log('🔧 DEBUG - Account:', account);
                                alert('Debug info logged to console');
                            }}
                            title="Debug circles data"
                        >
                            🐛
                        </button>
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
                                        <p><strong>Monthly Amount:</strong> {circle.depositAmount} USDT</p>
                                        <p><strong>Members:</strong> {circle.memberCount}/{circle.maxMembers || 5}</p>
                                        <p><strong>Role:</strong> {
                                            circle.isCreator ? '👑 Creator' : 
                                            circle.isJoined ? '👥 Member' :
                                            'Observer'
                                        }</p>
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
                                                    Est. yearly yield: ~{(parseFloat(circle.depositAmount) * (circle.maxMembers || 5) * parseFloat(currentAPY) / 100).toFixed(2)} USDT
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
                            ))
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
            </div>
        </div>
    );
}