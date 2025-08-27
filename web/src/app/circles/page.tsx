"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useWalletAccountStore } from "@/components/Wallet/Account/auth.hooks";
import { useKaiaWalletSdk } from '@/components/Wallet/Sdk/walletSdk.hooks';
import { useKyeContracts } from '@/hooks/useKyeContracts';
import { WalletButton } from '@/components/Wallet/Button/WalletButton';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import styles from './page.module.css';

export default function Circles() {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showJoinForm, setShowJoinForm] = useState(false);
    const [circleName, setCircleName] = useState('');
    const [monthlyAmount, setMonthlyAmount] = useState('');
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

    // Wallet hooks - exactly like profile page
    const { account, setAccount } = useWalletAccountStore();
    const { getAccount, getChainId } = useKaiaWalletSdk();
    const { createCircle, joinCircle, addresses, getContractAddressFromTx } = useKyeContracts();
    const router = useRouter();

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

    // Load circles from localStorage
    useEffect(() => {
        if (!isMounted) return;
        
        try {
            const saved = localStorage.getItem('recentCircles');
            if (saved) {
                const circles = JSON.parse(saved);
                console.log('Loaded circles from localStorage:', circles);
                setMyCircles(circles);
            }
        } catch (error) {
            console.error('Error loading circles from localStorage:', error);
        }
    }, [isMounted]);

    // Check token balances when account is connected
    useEffect(() => {
        if (!account || !isMounted || balanceChecked) return;

        const checkBalances = async () => {
            setBalanceLoading(true);
            console.log('=== CHECKING TOKEN BALANCES ===');
            console.log('Account:', account);

            try {
                // Get provider using the SDK
                const provider = new ethers.BrowserProvider(window.ethereum);
                
                // Check Kaia native token balance
                const kaiaBalanceWei = await provider.getBalance(account);
                const kaiaBalanceEth = ethers.formatEther(kaiaBalanceWei);
                setKaiaBalance(kaiaBalanceEth);
                console.log('Kaia Balance:', kaiaBalanceEth, 'KAIA');

                // Check USDT balance (ERC20 token)
                let usdtBalanceFormatted = '0';
                if (addresses?.usdt) {
                    const usdtContract = new ethers.Contract(
                        addresses.usdt,
                        [
                            'function balanceOf(address owner) view returns (uint256)',
                            'function decimals() view returns (uint8)'
                        ],
                        provider
                    );

                    const usdtBalanceWei = await usdtContract.balanceOf(account);
                    const usdtDecimals = await usdtContract.decimals();
                    usdtBalanceFormatted = ethers.formatUnits(usdtBalanceWei, usdtDecimals);
                    console.log('USDT Balance:', usdtBalanceFormatted, 'USDT');
                } else {
                    console.log('USDT contract address not available');
                }
                
                setUsdtBalance(usdtBalanceFormatted);

                // Check if user has insufficient tokens (needs at least 0.01 KAIA and 1 USDT)
                const hasKaia = parseFloat(kaiaBalanceEth) >= 0.01;
                const hasUsdt = parseFloat(usdtBalanceFormatted) >= 1;

                console.log('Has Kaia (>=0.01):', hasKaia, 'Balance:', kaiaBalanceEth);
                console.log('Has USDT (>=1):', hasUsdt, 'Balance:', usdtBalanceFormatted);

                if (!hasKaia || !hasUsdt) {
                    console.log('❌ Insufficient token balance - showing modal');
                    setShowBalanceModal(true);
                } else {
                    console.log('✅ Sufficient token balance');
                }

                setBalanceChecked(true);
            } catch (error) {
                console.error('❌ Error checking balances:', error);
                // Don't show modal on error - might be network issue
            } finally {
                setBalanceLoading(false);
            }
        };

        checkBalances();
    }, [account, isMounted, addresses, balanceChecked]);

    // Check for pending contracts and try to get their addresses
    useEffect(() => {
        if (!myCircles.length || !getContractAddressFromTx) return;

        const updatePendingContracts = async () => {
            for (let i = 0; i < myCircles.length; i++) {
                const circle = myCircles[i];
                
                if (circle.address === 'pending' && circle.transactionHash) {
                    console.log(`🔄 Checking pending contract for circle: ${circle.name}`);
                    
                    // Try to get the contract address
                    const contractAddress = await updateCircleAddress(circle.transactionHash, i);
                    
                    if (contractAddress) {
                        console.log(`✅ Successfully updated contract address for ${circle.name}: ${contractAddress}`);
                        break; // Only update one at a time to avoid overwhelming
                    } else {
                        console.log(`⏳ Contract still pending for ${circle.name}`);
                    }
                }
            }
        };

        // Run immediately and then every 30 seconds to check for updates
        updatePendingContracts();
        
        const interval = setInterval(updatePendingContracts, 30000); // Check every 30 seconds
        
        return () => clearInterval(interval);
    }, [myCircles, getContractAddressFromTx, updateCircleAddress]);

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

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text).then(() => {
            alert(`${label} copied to clipboard!`);
        }).catch(() => {
            alert('Failed to copy to clipboard');
        });
    };

    const handleRedirectToProfile = () => {
        router.push('/profile');
    };

    const handleCloseBalanceModal = () => {
        setShowBalanceModal(false);
    };

    // Function to update circle address when contract is deployed
    const updateCircleAddress = async (transactionHash: string, circleIndex: number) => {
        try {
            console.log('🔍 Attempting to get contract address for tx:', transactionHash);
            const contractAddress = await getContractAddressFromTx(transactionHash);
            
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
                
                return contractAddress;
            }
        } catch (error) {
            console.error('Error getting contract address:', error);
        }
        
        return null;
    };

    const handleRefreshAddress = async (circle, circleIndex) => {
        if (!circle.transactionHash) return;
        
        console.log('🔄 Manual refresh for contract address:', circle.transactionHash);
        const contractAddress = await updateCircleAddress(circle.transactionHash, circleIndex);
        
        if (contractAddress) {
            alert(`✅ Contract address found!\n\n${contractAddress}\n\nYou can now share the invite link.`);
        } else {
            alert('⏳ Contract is still being deployed. Please wait a few more minutes and try again.');
        }
    };

    const handleShareInviteLink = (circle) => {
        if (!circle.address || circle.address === 'pending') {
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
            if (navigator.share) {
                navigator.share({
                    title: `Join Savings Circle: ${circle.name}`,
                    text: tempInviteMessage,
                    url: window.location.origin + '/circles'
                }).catch(err => {
                    console.log('Share failed:', err);
                    copyToClipboard(tempInviteMessage, 'Invite Message (Contract Deploying)');
                });
            } else {
                copyToClipboard(tempInviteMessage, 'Invite Message (Contract Deploying)');
            }
            return;
        }

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
        if (navigator.share) {
            navigator.share({
                title: `Join Savings Circle: ${circle.name}`,
                text: inviteMessage,
                url: window.location.origin + '/circles'
            }).catch(err => {
                console.log('Share failed:', err);
                // Fallback to clipboard
                copyToClipboard(inviteMessage, 'Invite Message');
            });
        } else {
            // Fallback to clipboard copy
            copyToClipboard(inviteMessage, 'Invite Message');
        }
    };

    const handleViewMembers = (circle) => {
        // For now, show basic member info
        const memberInfo = `👥 Circle Members Information

📋 Circle: ${circle.name}
👤 Total Members: ${circle.memberCount}/5
💰 Monthly Amount: ${circle.depositAmount} USDT

🏗️ Members List:
1. You (Creator) ✅
${circle.memberCount > 1 ? 
    Array.from({length: circle.memberCount - 1}, (_, i) => 
        `${i + 2}. Member ${i + 2} (Joined)`
    ).join('\n') : 
    ''}
${circle.memberCount < 5 ? 
    Array.from({length: 5 - circle.memberCount}, (_, i) => 
        `${circle.memberCount + i + 1}. [Open Slot] 🔓`
    ).join('\n') : 
    ''}

📍 Contract Address: ${circle.address || 'Deploying...'}
🗓️ Created: ${new Date(circle.createdAt).toLocaleDateString()}

💡 To invite more members, share the invite code with them!`;

        alert(memberInfo);
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
                                            <span className={styles.detailValue}>{selectedCircle.isCreator ? 'Creator' : 'Member'}</span>
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
                                        {selectedCircle.address === 'pending' && (
                                            <button 
                                                className={styles.refreshButton}
                                                onClick={() => handleRefreshAddress(selectedCircle, myCircles.findIndex(c => c.transactionHash === selectedCircle.transactionHash))}
                                            >
                                                🔄 Refresh Address
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className={styles.inviteSection}>
                                        <h4>Invite Code</h4>
                                        <p>Share this address with friends to let them join your circle:</p>
                                        <div className={styles.inviteCodeContainer}>
                                            <input 
                                                type="text" 
                                                value={selectedCircle.address || 'Contract deploying...'}
                                                readOnly 
                                                className={styles.inviteCodeInput}
                                            />
                                            <button 
                                                className={styles.copyButton}
                                                onClick={() => copyToClipboard(selectedCircle.address, 'Invite Code')}
                                                disabled={!selectedCircle.address || selectedCircle.address === 'pending'}
                                            >
                                                📋 Copy
                                            </button>
                                        </div>
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
                    <h2>My Circles</h2>
                    <div className={styles.circlesList}>
                        {myCircles.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>🎯</div>
                                <h3>No Active Circles</h3>
                                <p>Create or join your first circle</p>
                            </div>
                        ) : (
                            myCircles.map((circle, index) => (
                                <div key={index} className={styles.circleCard}>
                                    <div className={styles.circleHeader}>
                                        <h3>{circle.name}</h3>
                                        <span className={styles.circlePhase}>{circle.phase}</span>
                                    </div>
                                    <div className={styles.circleDetails}>
                                        <p><strong>Monthly Amount:</strong> {circle.depositAmount} USDT</p>
                                        <p><strong>Members:</strong> {circle.memberCount}/5</p>
                                        <p><strong>Role:</strong> {circle.isCreator ? 'Creator' : 'Member'}</p>
                                        {circle.address && circle.address !== 'pending' && (
                                            <p><strong>Address:</strong> <span className={styles.address}>{circle.address}</span></p>
                                        )}
                                        {circle.transactionHash && (
                                            <p><strong>TX Hash:</strong> <span className={styles.address}>{circle.transactionHash}</span></p>
                                        )}
                                        <p><strong>Created:</strong> {new Date(circle.createdAt).toLocaleDateString()}</p>
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
                                    You need both Kaia (native token) and USDT tokens to create or join savings circles. 
                                    Please get some tokens from the Profile page first.
                                </p>

                                <div className={styles.tokenRequirements}>
                                    <div className={`${styles.tokenItem} ${parseFloat(kaiaBalance) >= 0.01 ? styles.sufficient : styles.insufficient}`}>
                                        <div className={styles.tokenIcon}>💎</div>
                                        <div className={styles.tokenInfo}>
                                            <div className={styles.tokenName}>Kaia (KAIA)</div>
                                            <div className={styles.tokenPurpose}>For transaction fees</div>
                                            <div className={styles.tokenBalance}>
                                                Balance: {parseFloat(kaiaBalance).toFixed(4)} KAIA
                                            </div>
                                        </div>
                                        <div className={styles.statusIcon}>
                                            {parseFloat(kaiaBalance) >= 0.01 ? '✅' : '❌'}
                                        </div>
                                    </div>

                                    <div className={`${styles.tokenItem} ${parseFloat(usdtBalance) >= 1 ? styles.sufficient : styles.insufficient}`}>
                                        <div className={styles.tokenIcon}>💵</div>
                                        <div className={styles.tokenInfo}>
                                            <div className={styles.tokenName}>Mock USDT</div>
                                            <div className={styles.tokenPurpose}>For circle deposits</div>
                                            <div className={styles.tokenBalance}>
                                                Balance: {parseFloat(usdtBalance).toFixed(2)} USDT
                                            </div>
                                        </div>
                                        <div className={styles.statusIcon}>
                                            {parseFloat(usdtBalance) >= 1 ? '✅' : '❌'}
                                        </div>
                                    </div>
                                </div>

                                <p className={styles.modalInstruction}>
                                    📝 <strong>Requirements:</strong> At least 0.01 KAIA + 1 USDT needed to participate in circles
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