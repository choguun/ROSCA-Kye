// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/KyeFactory.sol";
import "../src/mocks/MockUSDT.sol";
import "../src/adapters/SavingsPocket.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Mock USDT with 10M supply for testnet
        MockUSDT usdt = new MockUSDT(10_000_000);
        console.log("MockUSDT deployed at:", address(usdt));

        // Deploy SavingsPocket yield adapter
        SavingsPocket savingsPocket = new SavingsPocket(address(usdt));
        console.log("SavingsPocket deployed at:", address(savingsPocket));

        // DISABLED: Don't add sponsor funds - causes yield calculation bug
        // uint256 sponsorAmount = 1000 * 10**6;
        // usdt.mint(msg.sender, sponsorAmount);
        // usdt.approve(address(savingsPocket), sponsorAmount);
        // savingsPocket.addSponsorFunds(sponsorAmount);
        // console.log("Added sponsor funds:", sponsorAmount);

        // Deploy KyeFactory - DISABLED YIELD ADAPTER to fix sponsor funds bug
        KyeFactory factory = new KyeFactory(address(usdt), address(0));
        console.log("KyeFactory deployed at:", address(factory));

        vm.stopBroadcast();

        // Log all addresses for frontend integration
        console.log("\n=== Deployment Summary ===");
        console.log("USDT Token:", address(usdt));
        console.log("SavingsPocket:", address(savingsPocket));
        console.log("KyeFactory:", address(factory));
        console.log("Deployer:", msg.sender);
        
        // Generate .env entries
        console.log("\n=== Environment Variables ===");
        console.log("NEXT_PUBLIC_USDT_ADDRESS=", address(usdt));
        console.log("NEXT_PUBLIC_SAVINGS_POCKET_ADDRESS=", address(savingsPocket));
        console.log("NEXT_PUBLIC_KYE_FACTORY_ADDRESS=", address(factory));
        console.log("NEXT_PUBLIC_CHAIN_ID=1001");
    }
}

contract DeployMainnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // For mainnet, use real USDT address on Kaia
        // address usdtAddress = 0x....; // Real USDT on Kaia mainnet
        
        // For now, still use mock for Kairos testnet
        MockUSDT usdt = new MockUSDT(10_000_000);
        console.log("MockUSDT deployed at:", address(usdt));

        // Deploy SavingsPocket yield adapter
        SavingsPocket savingsPocket = new SavingsPocket(address(usdt));
        console.log("SavingsPocket deployed at:", address(savingsPocket));

        // Deploy KyeFactory
        KyeFactory factory = new KyeFactory(address(usdt), address(savingsPocket));
        console.log("KyeFactory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}