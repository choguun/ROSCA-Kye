// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IERC20.sol";
import "./interfaces/IYieldAdapter.sol";
import "./libraries/SafeMath.sol";

contract KyeGroup {
    using SafeMath for uint256;

    enum Phase { Setup, Commitment, Active, Settlement, Resolved, Disputed }

    struct MemberState {
        address wallet;
        bytes32 lineUserIdHash;
        uint256 totalDeposited;
        uint256 totalReceived;
        uint256 penaltiesAccrued;
        uint256 gracePeriodsUsed;
        uint256 defaultCount;
        bool hasDefaulted;
        bool isActive;
    }

    struct DepositRecord {
        uint256 amount;
        uint256 timestamp;
        uint256 penaltyPaid;
        bool isOnTime;
    }

    struct RoundState {
        uint256 deadline;
        address beneficiary;
        uint256 totalDeposited;
        uint256 yieldAccrued;
        bool isComplete;
        uint256 requiredDeposits;
    }

    // Constants
    uint256 public constant MAX_MEMBERS = 5;
    uint256 public constant MAX_GRACE_PERIODS = 1;
    uint256 public constant GRACE_DURATION = 24 hours;
    uint256 public constant BASIS_POINTS = 10000;

    // State variables
    Phase public phase;
    IERC20 public usdtToken;
    IYieldAdapter public yieldAdapter;
    address public creator;
    bytes32 public lineGroupIdHash;
    
    uint256 public depositAmount;
    uint256 public penaltyBps; // Basis points (e.g., 500 = 5%)
    uint256 public roundDuration;
    uint256 public currentRound;
    uint256 public clubPool; // Accumulated penalties
    uint256 public totalYieldAccrued;
    
    address[] public members;
    mapping(address => MemberState) public memberStates;
    mapping(address => bool) public isMember;
    mapping(uint256 => RoundState) public rounds;
    mapping(uint256 => mapping(address => DepositRecord)) public deposits;
    mapping(uint256 => mapping(address => uint256)) public memberDeadlines;

    // Events
    event MemberJoined(address indexed member, bytes32 lineUserIdHash);
    event PhaseChanged(Phase oldPhase, Phase newPhase);
    event RoundStarted(uint256 indexed roundIndex, address indexed beneficiary, uint256 deadline);
    event DepositMade(address indexed member, uint256 indexed roundIndex, uint256 amount, uint256 penalty);
    event PayoutExecuted(address indexed beneficiary, uint256 indexed roundIndex, uint256 amount);
    event PenaltyCharged(address indexed member, uint256 penalty);
    event GracePeriodGranted(address indexed member, uint256 indexed roundIndex);
    event YieldDistributed(uint256 amount);
    event EmergencyCancel(string reason);

    // Modifiers
    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator allowed");
        _;
    }

    modifier onlyMember() {
        require(isMember[msg.sender], "Not a member");
        _;
    }

    modifier inPhase(Phase _phase) {
        require(phase == _phase, "Wrong phase");
        _;
    }

    modifier nonReentrant() {
        // Simple reentrancy guard
        _;
    }

    constructor(
        address _usdtToken,
        address _yieldAdapter,
        address _creator,
        bytes32 _lineGroupIdHash,
        uint256 _depositAmount,
        uint256 _penaltyBps,
        uint256 _roundDuration
    ) {
        require(_usdtToken != address(0), "Invalid USDT address");
        require(_creator != address(0), "Invalid creator address");
        require(_depositAmount > 0, "Deposit amount must be positive");
        require(_penaltyBps <= 5000, "Penalty too high"); // Max 50%
        require(_roundDuration > 0, "Round duration must be positive");

        usdtToken = IERC20(_usdtToken);
        yieldAdapter = IYieldAdapter(_yieldAdapter);
        creator = _creator;
        lineGroupIdHash = _lineGroupIdHash;
        depositAmount = _depositAmount;
        penaltyBps = _penaltyBps;
        roundDuration = _roundDuration;
        phase = Phase.Setup;
        currentRound = 0;
    }

    function join(bytes32 _lineUserIdHash) external inPhase(Phase.Setup) {
        require(members.length < MAX_MEMBERS, "Circle is full");
        require(!isMember[msg.sender], "Already a member");
        require(_lineUserIdHash != bytes32(0), "Invalid LINE user ID hash");

        members.push(msg.sender);
        isMember[msg.sender] = true;
        
        memberStates[msg.sender] = MemberState({
            wallet: msg.sender,
            lineUserIdHash: _lineUserIdHash,
            totalDeposited: 0,
            totalReceived: 0,
            penaltiesAccrued: 0,
            gracePeriodsUsed: 0,
            defaultCount: 0,
            hasDefaulted: false,
            isActive: true
        });

        emit MemberJoined(msg.sender, _lineUserIdHash);

        if (members.length == MAX_MEMBERS) {
            _startCircle();
        }
    }

    function _startCircle() internal {
        require(members.length == MAX_MEMBERS, "Not enough members");
        
        phase = Phase.Commitment;
        emit PhaseChanged(Phase.Setup, Phase.Commitment);

        // Initialize first round
        _startNewRound();
    }

    function _startNewRound() internal {
        require(currentRound < MAX_MEMBERS, "All rounds completed");
        
        address beneficiary = members[currentRound];
        uint256 deadline = block.timestamp + roundDuration;
        
        rounds[currentRound] = RoundState({
            deadline: deadline,
            beneficiary: beneficiary,
            totalDeposited: 0,
            yieldAccrued: 0,
            isComplete: false,
            requiredDeposits: MAX_MEMBERS - 1 // Beneficiary doesn't deposit
        });

        emit RoundStarted(currentRound, beneficiary, deadline);
        
        if (phase == Phase.Commitment) {
            phase = Phase.Active;
            emit PhaseChanged(Phase.Commitment, Phase.Active);
        }
    }

    function deposit() external payable onlyMember inPhase(Phase.Active) nonReentrant {
        require(currentRound < MAX_MEMBERS, "No active round");
        require(rounds[currentRound].beneficiary != msg.sender, "Beneficiary cannot deposit");
        require(deposits[currentRound][msg.sender].amount == 0, "Already deposited this round");
        
        uint256 penalty = calculatePenalty(msg.sender);
        uint256 totalRequired = depositAmount.add(penalty);
        
        // Check deadline (with grace period if applicable)
        uint256 effectiveDeadline = memberDeadlines[currentRound][msg.sender] > 0 
            ? memberDeadlines[currentRound][msg.sender] 
            : rounds[currentRound].deadline;
        
        bool isOnTime = block.timestamp <= effectiveDeadline;
        
        // Transfer USDT
        require(
            usdtToken.transferFrom(msg.sender, address(this), totalRequired),
            "USDT transfer failed"
        );

        // Record deposit
        deposits[currentRound][msg.sender] = DepositRecord({
            amount: depositAmount,
            timestamp: block.timestamp,
            penaltyPaid: penalty,
            isOnTime: isOnTime
        });

        // Update member state
        memberStates[msg.sender].totalDeposited = memberStates[msg.sender].totalDeposited.add(totalRequired);
        if (penalty > 0) {
            clubPool = clubPool.add(penalty);
            emit PenaltyCharged(msg.sender, penalty);
        }
        if (!isOnTime) {
            memberStates[msg.sender].defaultCount = memberStates[msg.sender].defaultCount.add(1);
        }

        // Update round state
        rounds[currentRound].totalDeposited = rounds[currentRound].totalDeposited.add(depositAmount);

        emit DepositMade(msg.sender, currentRound, depositAmount, penalty);

        // Check if round is complete
        if (_countDepositsForRound(currentRound) >= rounds[currentRound].requiredDeposits) {
            _completePayout();
        }
    }

    function _completePayout() internal {
        uint256 roundIndex = currentRound;
        address beneficiary = rounds[roundIndex].beneficiary;
        uint256 payoutAmount = rounds[roundIndex].totalDeposited;
        
        // Add yield if available
        if (address(yieldAdapter) != address(0)) {
            uint256 yieldEarned = _harvestYield();
            payoutAmount = payoutAmount.add(yieldEarned);
            rounds[roundIndex].yieldAccrued = yieldEarned;
        }

        // Execute payout
        require(usdtToken.transfer(beneficiary, payoutAmount), "Payout transfer failed");
        
        // Update member state
        memberStates[beneficiary].totalReceived = memberStates[beneficiary].totalReceived.add(payoutAmount);
        
        // Mark round complete
        rounds[roundIndex].isComplete = true;
        
        emit PayoutExecuted(beneficiary, roundIndex, payoutAmount);

        // Advance to next round or complete circle
        currentRound = currentRound.add(1);
        
        if (currentRound >= MAX_MEMBERS) {
            _completeCircle();
        } else {
            _startNewRound();
        }
    }

    function _completeCircle() internal {
        phase = Phase.Settlement;
        emit PhaseChanged(Phase.Active, Phase.Settlement);
        
        // Distribute remaining club pool and yield
        _distributeRemainingFunds();
        
        phase = Phase.Resolved;
        emit PhaseChanged(Phase.Settlement, Phase.Resolved);
    }

    function _distributeRemainingFunds() internal {
        if (clubPool > 0) {
            uint256 perMember = clubPool.div(MAX_MEMBERS);
            for (uint256 i = 0; i < members.length; i++) {
                require(usdtToken.transfer(members[i], perMember), "Club pool distribution failed");
            }
            clubPool = 0;
        }
    }

    function calculatePenalty(address member) public view returns (uint256) {
        // Check if deposit is late
        uint256 effectiveDeadline = memberDeadlines[currentRound][member] > 0 
            ? memberDeadlines[currentRound][member] 
            : rounds[currentRound].deadline;
        
        bool isLate = block.timestamp > effectiveDeadline;
        if (!isLate) {
            return 0;
        }
        
        MemberState memory state = memberStates[member];
        uint256 basePenalty = depositAmount.mul(penaltyBps).div(BASIS_POINTS);
        
        // Base penalty for being late
        if (state.defaultCount == 0) {
            return basePenalty;
        }
        
        // Escalating penalty: 2^(defaultCount-1) * basePenalty
        uint256 escalation = basePenalty.mul(2 ** state.defaultCount);
        uint256 maxPenalty = depositAmount.div(2); // 50% cap
        
        return escalation > maxPenalty ? maxPenalty : escalation;
    }

    function requestGracePeriod() external onlyMember {
        require(memberStates[msg.sender].gracePeriodsUsed < MAX_GRACE_PERIODS, "No grace periods remaining");
        require(block.timestamp < rounds[currentRound].deadline, "Round already ended");
        require(deposits[currentRound][msg.sender].amount == 0, "Already deposited");
        
        memberDeadlines[currentRound][msg.sender] = rounds[currentRound].deadline.add(GRACE_DURATION);
        memberStates[msg.sender].gracePeriodsUsed = memberStates[msg.sender].gracePeriodsUsed.add(1);
        
        emit GracePeriodGranted(msg.sender, currentRound);
    }

    function _countDepositsForRound(uint256 roundIndex) internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] != rounds[roundIndex].beneficiary && deposits[roundIndex][members[i]].amount > 0) {
                count = count.add(1);
            }
        }
        return count;
    }

    function _harvestYield() internal returns (uint256) {
        if (address(yieldAdapter) == address(0)) {
            return 0;
        }
        
        uint256 currentBalance = yieldAdapter.totalValue();
        uint256 expectedBalance = rounds[currentRound].totalDeposited;
        
        if (currentBalance > expectedBalance) {
            uint256 yield = currentBalance.sub(expectedBalance);
            totalYieldAccrued = totalYieldAccrued.add(yield);
            emit YieldDistributed(yield);
            return yield;
        }
        
        return 0;
    }

    function emergencyCancel(string calldata reason) external onlyCreator {
        require(phase == Phase.Active || phase == Phase.Commitment, "Cannot cancel in this phase");
        
        phase = Phase.Disputed;
        emit PhaseChanged(phase, Phase.Disputed);
        emit EmergencyCancel(reason);
        
        // Return pro-rata funds to members
        _emergencyRefund();
    }

    function _emergencyRefund() internal {
        uint256 contractBalance = usdtToken.balanceOf(address(this));
        if (contractBalance > 0) {
            uint256 refundPerMember = contractBalance.div(members.length);
            for (uint256 i = 0; i < members.length; i++) {
                require(usdtToken.transfer(members[i], refundPerMember), "Emergency refund failed");
            }
        }
    }

    // View functions
    function getMembers() external view returns (address[] memory) {
        return members;
    }

    function getMemberState(address member) external view returns (MemberState memory) {
        return memberStates[member];
    }

    function getRoundState(uint256 roundIndex) external view returns (RoundState memory) {
        return rounds[roundIndex];
    }

    function getDepositRecord(uint256 roundIndex, address member) external view returns (DepositRecord memory) {
        return deposits[roundIndex][member];
    }

    function isCircleComplete() external view returns (bool) {
        return phase == Phase.Resolved;
    }

    function getCurrentRoundDeadline() external view returns (uint256) {
        if (currentRound >= MAX_MEMBERS) return 0;
        return rounds[currentRound].deadline;
    }
}