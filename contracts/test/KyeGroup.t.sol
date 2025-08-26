// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/KyeGroup.sol";
import "../src/mocks/MockUSDT.sol";
import "../src/adapters/SavingsPocket.sol";

contract KyeGroupTest is Test {
    KyeGroup public kyeGroup;
    MockUSDT public usdtToken;
    SavingsPocket public savingsPocket;
    
    address public creator = address(0x1);
    address public member1 = address(0x2);
    address public member2 = address(0x3);
    address public member3 = address(0x4);
    address public member4 = address(0x5);
    address public member5 = address(0x6);
    
    bytes32 public constant LINE_GROUP_ID = keccak256("test-line-group");
    bytes32 public constant MEMBER1_LINE_ID = keccak256("member1-line-id");
    bytes32 public constant MEMBER2_LINE_ID = keccak256("member2-line-id");
    bytes32 public constant MEMBER3_LINE_ID = keccak256("member3-line-id");
    bytes32 public constant MEMBER4_LINE_ID = keccak256("member4-line-id");
    bytes32 public constant MEMBER5_LINE_ID = keccak256("member5-line-id");
    
    uint256 public constant DEPOSIT_AMOUNT = 100 * 10**6; // 100 USDT
    uint256 public constant PENALTY_BPS = 500; // 5%
    uint256 public constant ROUND_DURATION = 7 days;
    
    function setUp() public {
        // Deploy mock USDT with 1M supply
        usdtToken = new MockUSDT(1_000_000);
        
        // Deploy SavingsPocket
        savingsPocket = new SavingsPocket(address(usdtToken));
        
        // Deploy KyeGroup
        kyeGroup = new KyeGroup(
            address(usdtToken),
            address(savingsPocket),
            creator,
            LINE_GROUP_ID,
            DEPOSIT_AMOUNT,
            PENALTY_BPS,
            ROUND_DURATION
        );
        
        // Distribute USDT to members
        usdtToken.mint(member1, 10000 * 10**6);
        usdtToken.mint(member2, 10000 * 10**6);
        usdtToken.mint(member3, 10000 * 10**6);
        usdtToken.mint(member4, 10000 * 10**6);
        usdtToken.mint(member5, 10000 * 10**6);
        
        // Approve USDT spending
        vm.prank(member1);
        usdtToken.approve(address(kyeGroup), type(uint256).max);
        vm.prank(member2);
        usdtToken.approve(address(kyeGroup), type(uint256).max);
        vm.prank(member3);
        usdtToken.approve(address(kyeGroup), type(uint256).max);
        vm.prank(member4);
        usdtToken.approve(address(kyeGroup), type(uint256).max);
        vm.prank(member5);
        usdtToken.approve(address(kyeGroup), type(uint256).max);
    }
    
    function testInitialState() public {
        assertEq(uint256(kyeGroup.phase()), uint256(KyeGroup.Phase.Setup));
        assertEq(kyeGroup.depositAmount(), DEPOSIT_AMOUNT);
        assertEq(kyeGroup.penaltyBps(), PENALTY_BPS);
        assertEq(kyeGroup.roundDuration(), ROUND_DURATION);
        assertEq(kyeGroup.currentRound(), 0);
        assertEq(kyeGroup.creator(), creator);
        assertEq(kyeGroup.lineGroupIdHash(), LINE_GROUP_ID);
        
        address[] memory members = kyeGroup.getMembers();
        assertEq(members.length, 0);
    }
    
    function testJoinCircle() public {
        vm.prank(member1);
        kyeGroup.join(MEMBER1_LINE_ID);
        
        address[] memory members = kyeGroup.getMembers();
        assertEq(members.length, 1);
        assertEq(members[0], member1);
        
        KyeGroup.MemberState memory memberState = kyeGroup.getMemberState(member1);
        assertEq(memberState.wallet, member1);
        assertEq(memberState.lineUserIdHash, MEMBER1_LINE_ID);
        assertEq(memberState.totalDeposited, 0);
        assertEq(memberState.totalReceived, 0);
        assertTrue(memberState.isActive);
    }
    
    function testCannotJoinTwice() public {
        vm.prank(member1);
        kyeGroup.join(MEMBER1_LINE_ID);
        
        vm.prank(member1);
        vm.expectRevert("Already a member");
        kyeGroup.join(MEMBER1_LINE_ID);
    }
    
    function testCannotJoinWithInvalidLineId() public {
        vm.prank(member1);
        vm.expectRevert("Invalid LINE user ID hash");
        kyeGroup.join(bytes32(0));
    }
    
    function testAutoStartWhenFull() public {
        // Join 4 members
        vm.prank(member1);
        kyeGroup.join(MEMBER1_LINE_ID);
        vm.prank(member2);
        kyeGroup.join(MEMBER2_LINE_ID);
        vm.prank(member3);
        kyeGroup.join(MEMBER3_LINE_ID);
        vm.prank(member4);
        kyeGroup.join(MEMBER4_LINE_ID);
        
        // Still in Setup phase
        assertEq(uint256(kyeGroup.phase()), uint256(KyeGroup.Phase.Setup));
        
        // Join 5th member - should auto-start
        vm.prank(member5);
        kyeGroup.join(MEMBER5_LINE_ID);
        
        assertEq(uint256(kyeGroup.phase()), uint256(KyeGroup.Phase.Active));
        assertEq(kyeGroup.currentRound(), 0);
        
        // Check first round is initialized
        KyeGroup.RoundState memory round = kyeGroup.getRoundState(0);
        assertEq(round.beneficiary, member1); // First member is beneficiary
        assertGt(round.deadline, block.timestamp);
        assertEq(round.totalDeposited, 0);
        assertFalse(round.isComplete);
    }
    
    function testCannotJoinAfterFull() public {
        _fillCircle();
        
        vm.prank(address(0x7));
        vm.expectRevert("Wrong phase");
        kyeGroup.join(keccak256("extra-member"));
    }
    
    function testDeposit() public {
        _fillCircle();
        
        uint256 initialBalance = usdtToken.balanceOf(member2);
        
        // Member 2 deposits (member 1 is beneficiary, so doesn't deposit)
        vm.prank(member2);
        kyeGroup.deposit();
        
        // Check deposit recorded
        KyeGroup.DepositRecord memory depositRecord = kyeGroup.getDepositRecord(0, member2);
        assertEq(depositRecord.amount, DEPOSIT_AMOUNT);
        assertEq(depositRecord.penaltyPaid, 0); // No penalty on first deposit
        assertTrue(depositRecord.isOnTime);
        
        // Check balance decreased
        assertEq(usdtToken.balanceOf(member2), initialBalance - DEPOSIT_AMOUNT);
        assertEq(usdtToken.balanceOf(address(kyeGroup)), DEPOSIT_AMOUNT);
        
        // Check member state updated
        KyeGroup.MemberState memory memberState = kyeGroup.getMemberState(member2);
        assertEq(memberState.totalDeposited, DEPOSIT_AMOUNT);
    }
    
    function testBeneficiaryCannotDeposit() public {
        _fillCircle();
        
        // Member 1 is beneficiary of round 0
        vm.prank(member1);
        vm.expectRevert("Beneficiary cannot deposit");
        kyeGroup.deposit();
    }
    
    function testCannotDepositTwice() public {
        _fillCircle();
        
        vm.prank(member2);
        kyeGroup.deposit();
        
        vm.prank(member2);
        vm.expectRevert("Already deposited this round");
        kyeGroup.deposit();
    }
    
    function testPenaltyCalculation() public {
        _fillCircle();
        
        // Skip deadline to create default
        vm.warp(block.timestamp + ROUND_DURATION + 1);
        
        // Member 2 deposits late - should have penalty
        vm.prank(member2);
        kyeGroup.deposit();
        
        KyeGroup.DepositRecord memory depositRecord = kyeGroup.getDepositRecord(0, member2);
        uint256 expectedPenalty = (DEPOSIT_AMOUNT * PENALTY_BPS) / 10000;
        assertEq(depositRecord.penaltyPaid, expectedPenalty);
        assertFalse(depositRecord.isOnTime);
        
        // Check penalty went to club pool
        assertEq(kyeGroup.clubPool(), expectedPenalty);
    }
    
    function testGracePeriod() public {
        _fillCircle();
        
        // Member 2 requests grace period
        vm.prank(member2);
        kyeGroup.requestGracePeriod();
        
        // Check grace period used
        KyeGroup.MemberState memory memberState = kyeGroup.getMemberState(member2);
        assertEq(memberState.gracePeriodsUsed, 1);
        
        // Skip past original deadline but within grace period
        vm.warp(block.timestamp + ROUND_DURATION + 12 hours);
        
        // Should still be able to deposit without penalty
        vm.prank(member2);
        kyeGroup.deposit();
        
        KyeGroup.DepositRecord memory depositRecord = kyeGroup.getDepositRecord(0, member2);
        assertEq(depositRecord.penaltyPaid, 0);
        assertTrue(depositRecord.isOnTime);
    }
    
    function testCannotRequestMultipleGracePeriods() public {
        _fillCircle();
        
        vm.prank(member2);
        kyeGroup.requestGracePeriod();
        
        vm.prank(member2);
        vm.expectRevert("No grace periods remaining");
        kyeGroup.requestGracePeriod();
    }
    
    function testPayout() public {
        _fillCircle();
        
        // All members except beneficiary deposit
        vm.prank(member2);
        kyeGroup.deposit();
        vm.prank(member3);
        kyeGroup.deposit();
        vm.prank(member4);
        kyeGroup.deposit();
        
        uint256 initialBalance = usdtToken.balanceOf(member1);
        
        // Last deposit should trigger payout
        vm.prank(member5);
        kyeGroup.deposit();
        
        // Check payout executed
        uint256 expectedPayout = DEPOSIT_AMOUNT * 4; // 4 deposits
        assertEq(usdtToken.balanceOf(member1), initialBalance + expectedPayout);
        
        // Check member state updated
        KyeGroup.MemberState memory memberState = kyeGroup.getMemberState(member1);
        assertEq(memberState.totalReceived, expectedPayout);
        
        // Check round advanced
        assertEq(kyeGroup.currentRound(), 1);
        
        // Check new round started
        KyeGroup.RoundState memory newRound = kyeGroup.getRoundState(1);
        assertEq(newRound.beneficiary, member2); // Second member
        assertGt(newRound.deadline, block.timestamp);
    }
    
    function testCompleteCircle() public {
        _fillCircle();
        
        // Complete all 5 rounds
        for (uint256 round = 0; round < 5; round++) {
            address beneficiary = kyeGroup.getMembers()[round];
            
            // All members except beneficiary deposit
            for (uint256 i = 0; i < 5; i++) {
                address member = kyeGroup.getMembers()[i];
                if (member != beneficiary) {
                    vm.prank(member);
                    kyeGroup.deposit();
                }
            }
        }
        
        // Check circle completed
        assertEq(uint256(kyeGroup.phase()), uint256(KyeGroup.Phase.Resolved));
        assertTrue(kyeGroup.isCircleComplete());
    }
    
    function testEmergencyCancel() public {
        _fillCircle();
        
        // Creator cancels circle
        vm.prank(creator);
        kyeGroup.emergencyCancel("Test cancellation");
        
        assertEq(uint256(kyeGroup.phase()), uint256(KyeGroup.Phase.Disputed));
    }
    
    function testOnlyCreatorCanCancel() public {
        _fillCircle();
        
        vm.prank(member1);
        vm.expectRevert("Only creator allowed");
        kyeGroup.emergencyCancel("Unauthorized cancellation");
    }
    
    // Helper functions
    function _fillCircle() internal {
        vm.prank(member1);
        kyeGroup.join(MEMBER1_LINE_ID);
        vm.prank(member2);
        kyeGroup.join(MEMBER2_LINE_ID);
        vm.prank(member3);
        kyeGroup.join(MEMBER3_LINE_ID);
        vm.prank(member4);
        kyeGroup.join(MEMBER4_LINE_ID);
        vm.prank(member5);
        kyeGroup.join(MEMBER5_LINE_ID);
    }
}