// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IYieldAdapter.sol";
import "../interfaces/IERC20.sol";
import "../libraries/SafeMath.sol";

contract SavingsPocket is IYieldAdapter {
    using SafeMath for uint256;

    IERC20 public immutable usdtToken;
    address public owner;
    
    uint256 public constant ANNUAL_YIELD_BPS = 500; // 5% APY
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    uint256 public totalDeposited;
    uint256 public totalShares;
    uint256 public lastAccrualTime;
    uint256 public accruedYield;
    uint256 public sponsorFunds;
    
    mapping(address => uint256) public userShares;
    
    event Deposit(address indexed user, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, uint256 shares, uint256 amount);
    event YieldAccrued(uint256 amount);
    event SponsorDeposit(uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner allowed");
        _;
    }

    constructor(address _usdtToken) {
        require(_usdtToken != address(0), "Invalid USDT token address");
        
        usdtToken = IERC20(_usdtToken);
        owner = msg.sender;
        lastAccrualTime = block.timestamp;
    }

    function deposit(uint256 amount) external override returns (uint256 shares) {
        require(amount > 0, "Amount must be positive");
        
        // Accrue yield before deposit
        _accrueYield();
        
        // Calculate shares to mint
        if (totalShares == 0) {
            shares = amount; // 1:1 for first deposit
        } else {
            shares = amount.mul(totalShares).div(totalValue());
        }
        
        require(shares > 0, "No shares minted");
        
        // Transfer USDT
        require(usdtToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // Update state
        userShares[msg.sender] = userShares[msg.sender].add(shares);
        totalShares = totalShares.add(shares);
        totalDeposited = totalDeposited.add(amount);
        
        emit Deposit(msg.sender, amount, shares);
        return shares;
    }

    function withdraw(uint256 shares, address recipient) external override returns (uint256 amount) {
        require(shares > 0, "Shares must be positive");
        require(userShares[msg.sender] >= shares, "Insufficient shares");
        require(recipient != address(0), "Invalid recipient");
        
        // Accrue yield before withdrawal
        _accrueYield();
        
        // Calculate withdrawal amount
        amount = shares.mul(totalValue()).div(totalShares);
        require(amount > 0, "No amount to withdraw");
        
        // Update state
        userShares[msg.sender] = userShares[msg.sender].sub(shares);
        totalShares = totalShares.sub(shares);
        totalDeposited = totalDeposited.sub(amount > totalDeposited ? totalDeposited : amount);
        
        // Transfer USDT
        require(usdtToken.transfer(recipient, amount), "Transfer failed");
        
        emit Withdraw(msg.sender, shares, amount);
        return amount;
    }

    function totalValue() public view override returns (uint256) {
        uint256 currentYield = _calculateYieldSinceLastAccrual();
        return totalDeposited.add(accruedYield).add(currentYield).add(sponsorFunds);
    }

    function expectedAPY() external pure override returns (uint256) {
        return ANNUAL_YIELD_BPS; // 5% in basis points
    }

    function healthCheck() external view override returns (bool isHealthy, string memory reason) {
        uint256 contractBalance = usdtToken.balanceOf(address(this));
        uint256 expectedBalance = totalValue();
        
        if (contractBalance < expectedBalance) {
            return (false, "Insufficient contract balance");
        }
        
        if (block.timestamp.sub(lastAccrualTime) > 7 days) {
            return (false, "Yield not accrued recently");
        }
        
        return (true, "Adapter is healthy");
    }

    function emergencyWithdraw() external override onlyOwner returns (uint256) {
        uint256 balance = usdtToken.balanceOf(address(this));
        if (balance > 0) {
            require(usdtToken.transfer(owner, balance), "Emergency withdrawal failed");
        }
        
        // Reset state
        totalDeposited = 0;
        totalShares = 0;
        accruedYield = 0;
        sponsorFunds = 0;
        
        return balance;
    }

    function _accrueYield() internal {
        uint256 yieldAmount = _calculateYieldSinceLastAccrual();
        
        if (yieldAmount > 0) {
            accruedYield = accruedYield.add(yieldAmount);
            lastAccrualTime = block.timestamp;
            emit YieldAccrued(yieldAmount);
            emit YieldHarvested(yieldAmount);
        }
    }

    function _calculateYieldSinceLastAccrual() internal view returns (uint256) {
        if (totalDeposited == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp.sub(lastAccrualTime);
        uint256 availableFunds = sponsorFunds.add(totalDeposited);
        
        // Calculate yield: principal * rate * time / (seconds_per_year * basis_points)
        uint256 yieldAmount = availableFunds
            .mul(ANNUAL_YIELD_BPS)
            .mul(timeElapsed)
            .div(SECONDS_PER_YEAR)
            .div(10000);
        
        // Cap yield at available sponsor funds
        return yieldAmount > sponsorFunds ? sponsorFunds : yieldAmount;
    }

    // Owner functions for demo/testing
    function addSponsorFunds(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be positive");
        require(usdtToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        sponsorFunds = sponsorFunds.add(amount);
        emit SponsorDeposit(amount);
    }

    function manualYieldAccrual() external {
        _accrueYield();
    }

    // View functions
    function getUserShares(address user) external view returns (uint256) {
        return userShares[user];
    }

    function getUserValue(address user) external view returns (uint256) {
        if (totalShares == 0) {
            return 0;
        }
        return userShares[user].mul(totalValue()).div(totalShares);
    }

    function getYieldRate() external pure returns (uint256) {
        return ANNUAL_YIELD_BPS;
    }

    function getContractBalance() external view returns (uint256) {
        return usdtToken.balanceOf(address(this));
    }

    function getPendingYield() external view returns (uint256) {
        return _calculateYieldSinceLastAccrual();
    }
}