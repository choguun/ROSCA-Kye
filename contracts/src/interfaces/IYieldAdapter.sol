// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IYieldAdapter {
    function deposit(uint256 amount) external returns (uint256 shares);
    
    function withdraw(uint256 shares, address recipient) external returns (uint256 amount);
    
    function totalValue() external view returns (uint256);
    
    function expectedAPY() external view returns (uint256);
    
    function healthCheck() external view returns (bool isHealthy, string memory reason);
    
    function emergencyWithdraw() external returns (uint256);
    
    event YieldHarvested(uint256 amount);
    event LossDetected(uint256 amount);
}