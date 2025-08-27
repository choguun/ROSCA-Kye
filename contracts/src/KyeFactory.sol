// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./KyeGroup.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IYieldAdapter.sol";

contract KyeFactory {
    struct CircleParams {
        address usdtToken;
        address yieldAdapter;
        bytes32 lineGroupIdHash;
        uint256 depositAmount;
        uint256 penaltyBps;
        uint256 roundDuration;
        uint8 maxMembers;
    }

    struct CircleMetadata {
        address circleAddress;
        address creator;
        bytes32 lineGroupIdHash;
        uint256 createdAt;
        uint256 depositAmount;
        uint8 memberCount;
        uint8 currentRound;
        KyeGroup.Phase status;
        uint256 totalValueLocked;
    }

    // State variables
    address public owner;
    address public defaultUsdtToken;
    address public defaultYieldAdapter;
    
    uint256 public circleCount;
    mapping(address => CircleMetadata) public circleRegistry;
    mapping(bytes32 => address[]) public groupCircles;
    mapping(address => address[]) public creatorCircles;
    address[] public allCircles;

    // Events
    event CircleCreated(
        address indexed creator,
        address indexed circleAddress,
        bytes32 indexed lineGroupIdHash,
        uint256 depositAmount
    );
    event DefaultTokensUpdated(address usdtToken, address yieldAdapter);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner allowed");
        _;
    }

    constructor(address _defaultUsdtToken, address _defaultYieldAdapter) {
        require(_defaultUsdtToken != address(0), "Invalid USDT token address");
        
        owner = msg.sender;
        defaultUsdtToken = _defaultUsdtToken;
        defaultYieldAdapter = _defaultYieldAdapter;
    }

    function deployCircle(
        bytes32 salt,
        CircleParams memory params
    ) external returns (address circleAddress) {
        // Validate parameters
        require(params.lineGroupIdHash != bytes32(0), "Invalid group ID hash");
        require(params.depositAmount > 0, "Deposit amount must be positive");
        require(params.penaltyBps <= 5000, "Penalty too high"); // Max 50%
        require(params.roundDuration >= 1 hours, "Round duration too short");
        require(params.maxMembers >= 2 && params.maxMembers <= 5, "Invalid member count");

        // Use defaults if not specified
        address usdtToken = params.usdtToken != address(0) ? params.usdtToken : defaultUsdtToken;
        address yieldAdapter = params.yieldAdapter != address(0) ? params.yieldAdapter : defaultYieldAdapter;

        // Deploy with CREATE2 for deterministic addresses
        bytes memory bytecode = abi.encodePacked(
            type(KyeGroup).creationCode,
            abi.encode(
                usdtToken,
                yieldAdapter,
                msg.sender,
                params.lineGroupIdHash,
                params.depositAmount,
                params.penaltyBps,
                params.roundDuration,
                uint256(params.maxMembers)
            )
        );

        assembly {
            circleAddress := create2(
                0, // value
                add(bytecode, 0x20), // bytecode
                mload(bytecode), // bytecode length
                salt // salt
            )
        }

        require(circleAddress != address(0), "Circle deployment failed");

        // Register the circle
        _registerCircle(circleAddress, params);

        emit CircleCreated(msg.sender, circleAddress, params.lineGroupIdHash, params.depositAmount);

        return circleAddress;
    }

    function _registerCircle(address circleAddress, CircleParams memory params) internal {
        circleRegistry[circleAddress] = CircleMetadata({
            circleAddress: circleAddress,
            creator: msg.sender,
            lineGroupIdHash: params.lineGroupIdHash,
            createdAt: block.timestamp,
            depositAmount: params.depositAmount,
            memberCount: 0,
            currentRound: 0,
            status: KyeGroup.Phase.Setup,
            totalValueLocked: 0
        });

        groupCircles[params.lineGroupIdHash].push(circleAddress);
        creatorCircles[msg.sender].push(circleAddress);
        allCircles.push(circleAddress);
        
        circleCount++;
    }

    function predictCircleAddress(
        bytes32 salt,
        CircleParams memory params
    ) external view returns (address) {
        address usdtToken = params.usdtToken != address(0) ? params.usdtToken : defaultUsdtToken;
        address yieldAdapter = params.yieldAdapter != address(0) ? params.yieldAdapter : defaultYieldAdapter;

        bytes32 bytecodeHash = keccak256(abi.encodePacked(
            type(KyeGroup).creationCode,
            abi.encode(
                usdtToken,
                yieldAdapter,
                msg.sender,
                params.lineGroupIdHash,
                params.depositAmount,
                params.penaltyBps,
                params.roundDuration,
                uint256(params.maxMembers)
            )
        ));

        return address(uint160(uint(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            bytecodeHash
        )))));
    }

    function updateCircleMetadata(address circleAddress) external {
        require(circleRegistry[circleAddress].circleAddress != address(0), "Circle not found");
        
        KyeGroup circle = KyeGroup(circleAddress);
        CircleMetadata storage metadata = circleRegistry[circleAddress];
        
        metadata.memberCount = uint8(circle.getMembers().length);
        metadata.currentRound = uint8(circle.currentRound());
        metadata.status = circle.phase();
        
        // Calculate TVL
        IERC20 usdtToken = circle.usdtToken();
        metadata.totalValueLocked = usdtToken.balanceOf(circleAddress);
    }

    function getCirclesForGroup(bytes32 lineGroupIdHash) external view returns (address[] memory) {
        return groupCircles[lineGroupIdHash];
    }

    function getCirclesForCreator(address creator) external view returns (address[] memory) {
        return creatorCircles[creator];
    }

    function getAllCircles() external view returns (address[] memory) {
        return allCircles;
    }

    function getActiveCircles() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Count active circles
        for (uint256 i = 0; i < allCircles.length; i++) {
            KyeGroup circle = KyeGroup(allCircles[i]);
            if (circle.phase() == KyeGroup.Phase.Active) {
                activeCount++;
            }
        }
        
        // Populate active circles array
        address[] memory activeCircles = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allCircles.length; i++) {
            KyeGroup circle = KyeGroup(allCircles[i]);
            if (circle.phase() == KyeGroup.Phase.Active) {
                activeCircles[index] = allCircles[i];
                index++;
            }
        }
        
        return activeCircles;
    }

    function getCircleMetadata(address circleAddress) external view returns (CircleMetadata memory) {
        return circleRegistry[circleAddress];
    }

    function getTotalValueLocked() external view returns (uint256) {
        uint256 totalTVL = 0;
        
        for (uint256 i = 0; i < allCircles.length; i++) {
            IERC20 usdtToken = KyeGroup(allCircles[i]).usdtToken();
            totalTVL += usdtToken.balanceOf(allCircles[i]);
        }
        
        return totalTVL;
    }

    function setDefaultTokens(address _usdtToken, address _yieldAdapter) external onlyOwner {
        require(_usdtToken != address(0), "Invalid USDT token address");
        
        defaultUsdtToken = _usdtToken;
        defaultYieldAdapter = _yieldAdapter;
        
        emit DefaultTokensUpdated(_usdtToken, _yieldAdapter);
    }

    function validateCircle(address circleAddress) external view returns (bool isValid, string memory reason) {
        if (circleRegistry[circleAddress].circleAddress == address(0)) {
            return (false, "Circle not registered");
        }
        
        KyeGroup circle = KyeGroup(circleAddress);
        
        try circle.phase() returns (KyeGroup.Phase phase) {
            if (phase == KyeGroup.Phase.Disputed) {
                return (false, "Circle is disputed");
            }
            return (true, "Circle is valid");
        } catch {
            return (false, "Circle contract error");
        }
    }
}