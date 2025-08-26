// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";

contract MockUSDT is IERC20 {
    string public name = "Mock USDT";
    string public symbol = "mUSDT";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    constructor(uint256 _initialSupply) {
        totalSupply = _initialSupply * 10**decimals;
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        require(to != address(0), "Invalid recipient");
        
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        require(to != address(0), "Invalid recipient");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
    
    // Utility functions for testing
    function mint(address to, uint256 amount) external {
        require(to != address(0), "Invalid recipient");
        
        totalSupply += amount;
        balanceOf[to] += amount;
        
        emit Transfer(address(0), to, amount);
    }
    
    function burn(address from, uint256 amount) external {
        require(balanceOf[from] >= amount, "Insufficient balance");
        
        totalSupply -= amount;
        balanceOf[from] -= amount;
        
        emit Transfer(from, address(0), amount);
    }
}