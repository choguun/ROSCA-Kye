// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/KyeFactory.sol";
import "../src/KyeGroup.sol";
import "../src/mocks/MockUSDT.sol";
import "../src/adapters/SavingsPocket.sol";

contract KyeFactoryTest is Test {
    KyeFactory public factory;
    MockUSDT public usdtToken;
    SavingsPocket public savingsPocket;
    
    address public creator = address(0x1);
    bytes32 public constant LINE_GROUP_ID = keccak256("test-line-group");
    
    uint256 public constant DEPOSIT_AMOUNT = 100 * 10**6; // 100 USDT
    uint256 public constant PENALTY_BPS = 500; // 5%
    uint256 public constant ROUND_DURATION = 7 days;
    
    function setUp() public {
        // Deploy mock USDT
        usdtToken = new MockUSDT(1_000_000);
        
        // Deploy SavingsPocket
        savingsPocket = new SavingsPocket(address(usdtToken));
        
        // Deploy KyeFactory
        factory = new KyeFactory(address(usdtToken), address(savingsPocket));
    }
    
    function testInitialState() public {
        assertEq(factory.owner(), address(this));
        assertEq(factory.defaultUsdtToken(), address(usdtToken));
        assertEq(factory.defaultYieldAdapter(), address(savingsPocket));
        assertEq(factory.circleCount(), 0);
    }
    
    function testDeployCircle() public {
        KyeFactory.CircleParams memory params = KyeFactory.CircleParams({
            usdtToken: address(0), // Use default
            yieldAdapter: address(0), // Use default
            lineGroupIdHash: LINE_GROUP_ID,
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 5
        });
        
        bytes32 salt = keccak256("test-salt");
        
        vm.prank(creator);
        address circleAddress = factory.deployCircle(salt, params);
        
        // Check circle deployed
        assertTrue(circleAddress != address(0));
        
        // Check circle registered
        KyeFactory.CircleMetadata memory metadata = factory.getCircleMetadata(circleAddress);
        assertEq(metadata.circleAddress, circleAddress);
        assertEq(metadata.creator, creator);
        assertEq(metadata.lineGroupIdHash, LINE_GROUP_ID);
        assertEq(metadata.depositAmount, DEPOSIT_AMOUNT);
        assertEq(metadata.memberCount, 0);
        assertEq(uint256(metadata.status), uint256(KyeGroup.Phase.Setup));
        
        // Check factory state updated
        assertEq(factory.circleCount(), 1);
        
        // Check circle in group mapping
        address[] memory groupCircles = factory.getCirclesForGroup(LINE_GROUP_ID);
        assertEq(groupCircles.length, 1);
        assertEq(groupCircles[0], circleAddress);
        
        // Check circle in creator mapping
        address[] memory creatorCircles = factory.getCirclesForCreator(creator);
        assertEq(creatorCircles.length, 1);
        assertEq(creatorCircles[0], circleAddress);
    }
    
    function testPredictCircleAddress() public {
        KyeFactory.CircleParams memory params = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: LINE_GROUP_ID,
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 5
        });
        
        bytes32 salt = keccak256("test-salt");
        
        // Predict address
        vm.prank(creator);
        address predictedAddress = factory.predictCircleAddress(salt, params);
        
        // Deploy circle
        vm.prank(creator);
        address actualAddress = factory.deployCircle(salt, params);
        
        // Should match
        assertEq(predictedAddress, actualAddress);
    }
    
    function testCannotDeployWithInvalidParams() public {
        KyeFactory.CircleParams memory params = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: bytes32(0), // Invalid
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 5
        });
        
        bytes32 salt = keccak256("test-salt");
        
        vm.prank(creator);
        vm.expectRevert("Invalid group ID hash");
        factory.deployCircle(salt, params);
    }
    
    function testCannotDeployWithZeroDeposit() public {
        KyeFactory.CircleParams memory params = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: LINE_GROUP_ID,
            depositAmount: 0, // Invalid
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 5
        });
        
        bytes32 salt = keccak256("test-salt");
        
        vm.prank(creator);
        vm.expectRevert("Deposit amount must be positive");
        factory.deployCircle(salt, params);
    }
    
    function testCannotDeployWithHighPenalty() public {
        KyeFactory.CircleParams memory params = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: LINE_GROUP_ID,
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: 6000, // 60% - too high
            roundDuration: ROUND_DURATION,
            maxMembers: 5
        });
        
        bytes32 salt = keccak256("test-salt");
        
        vm.prank(creator);
        vm.expectRevert("Penalty too high");
        factory.deployCircle(salt, params);
    }
    
    function testCannotDeployWithShortRoundDuration() public {
        KyeFactory.CircleParams memory params = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: LINE_GROUP_ID,
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: 30 minutes, // Too short
            maxMembers: 5
        });
        
        bytes32 salt = keccak256("test-salt");
        
        vm.prank(creator);
        vm.expectRevert("Round duration too short");
        factory.deployCircle(salt, params);
    }
    
    function testUpdateCircleMetadata() public {
        // Deploy circle
        KyeFactory.CircleParams memory params = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: LINE_GROUP_ID,
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 5
        });
        
        bytes32 salt = keccak256("test-salt");
        
        vm.prank(creator);
        address circleAddress = factory.deployCircle(salt, params);
        
        // Initial metadata
        KyeFactory.CircleMetadata memory metadata = factory.getCircleMetadata(circleAddress);
        assertEq(metadata.memberCount, 0);
        
        // Add member to circle
        KyeGroup circle = KyeGroup(circleAddress);
        address member1 = address(0x2);
        
        vm.prank(member1);
        circle.join(keccak256("member1-line-id"));
        
        // Update metadata
        factory.updateCircleMetadata(circleAddress);
        
        // Check updated
        metadata = factory.getCircleMetadata(circleAddress);
        assertEq(metadata.memberCount, 1);
    }
    
    function testGetActiveCircles() public {
        // Deploy multiple circles in different phases
        bytes32 salt1 = keccak256("salt1");
        bytes32 salt2 = keccak256("salt2");
        
        KyeFactory.CircleParams memory params = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: LINE_GROUP_ID,
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 5
        });
        
        vm.startPrank(creator);
        address circle1 = factory.deployCircle(salt1, params);
        
        params.lineGroupIdHash = keccak256("different-group");
        address circle2 = factory.deployCircle(salt2, params);
        vm.stopPrank();
        
        // Fill circle1 to make it active
        KyeGroup kyeGroup1 = KyeGroup(circle1);
        address[] memory members = new address[](5);
        members[0] = address(0x10);
        members[1] = address(0x11);
        members[2] = address(0x12);
        members[3] = address(0x13);
        members[4] = address(0x14);
        
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(members[i]);
            kyeGroup1.join(keccak256(abi.encodePacked("member", i)));
        }
        
        // Check active circles
        address[] memory activeCircles = factory.getActiveCircles();
        assertEq(activeCircles.length, 1);
        assertEq(activeCircles[0], circle1);
    }
    
    function testSetDefaultTokens() public {
        address newUsdt = address(0x100);
        address newAdapter = address(0x101);
        
        factory.setDefaultTokens(newUsdt, newAdapter);
        
        assertEq(factory.defaultUsdtToken(), newUsdt);
        assertEq(factory.defaultYieldAdapter(), newAdapter);
    }
    
    function testOnlyOwnerCanSetDefaultTokens() public {
        vm.prank(address(0x999));
        vm.expectRevert("Only owner allowed");
        factory.setDefaultTokens(address(0x100), address(0x101));
    }
    
    function testValidateCircle() public {
        // Deploy valid circle
        KyeFactory.CircleParams memory params = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: LINE_GROUP_ID,
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 5
        });
        
        bytes32 salt = keccak256("test-salt");
        
        vm.prank(creator);
        address circleAddress = factory.deployCircle(salt, params);
        
        (bool isValid, string memory reason) = factory.validateCircle(circleAddress);
        assertTrue(isValid);
        assertEq(reason, "Circle is valid");
        
        // Test invalid address
        (isValid, reason) = factory.validateCircle(address(0x999));
        assertFalse(isValid);
        assertEq(reason, "Circle not registered");
    }

    function testFlexibleMemberCounts() public {
        // Test 2-member circle
        KyeFactory.CircleParams memory params2 = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: keccak256("2-member-group"),
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 2
        });
        
        vm.prank(creator);
        address circle2 = factory.deployCircle(keccak256("salt-2"), params2);
        KyeGroup kyeGroup2 = KyeGroup(circle2);
        assertEq(kyeGroup2.maxMembers(), 2);

        // Test 3-member circle
        KyeFactory.CircleParams memory params3 = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: keccak256("3-member-group"),
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 3
        });
        
        vm.prank(creator);
        address circle3 = factory.deployCircle(keccak256("salt-3"), params3);
        KyeGroup kyeGroup3 = KyeGroup(circle3);
        assertEq(kyeGroup3.maxMembers(), 3);

        // Test 5-member circle (original)
        KyeFactory.CircleParams memory params5 = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: keccak256("5-member-group"),
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 5
        });
        
        vm.prank(creator);
        address circle5 = factory.deployCircle(keccak256("salt-5"), params5);
        KyeGroup kyeGroup5 = KyeGroup(circle5);
        assertEq(kyeGroup5.maxMembers(), 5);
    }

    function testInvalidMemberCounts() public {
        // Test invalid member count (1)
        KyeFactory.CircleParams memory params1 = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: keccak256("1-member-group"),
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 1
        });
        
        vm.prank(creator);
        vm.expectRevert("Invalid member count");
        factory.deployCircle(keccak256("salt-1"), params1);

        // Test invalid member count (6)
        KyeFactory.CircleParams memory params6 = KyeFactory.CircleParams({
            usdtToken: address(0),
            yieldAdapter: address(0),
            lineGroupIdHash: keccak256("6-member-group"),
            depositAmount: DEPOSIT_AMOUNT,
            penaltyBps: PENALTY_BPS,
            roundDuration: ROUND_DURATION,
            maxMembers: 6
        });
        
        vm.prank(creator);
        vm.expectRevert("Invalid member count");
        factory.deployCircle(keccak256("salt-6"), params6);
    }
}