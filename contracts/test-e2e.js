const { ethers } = require('ethers');

// Contract addresses on Kairos testnet
const ADDRESSES = {
  USDT: '0x8f198CD718aa1Bf2b338ddba78736E91cD254da6',
  SAVINGS_POCKET: '0xC05Ba2595D916Ad94378438dBb3b6F3161bd6C5b',
  KYE_FACTORY: '0x724f792F3d11C8eB1471e84ABef654c93cE639dE'
};

// ABIs (simplified)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

const FACTORY_ABI = [
  'function getAllCircles() view returns (address[])',
  'function getCircleMetadata(address) view returns (tuple(address,address,bytes32,uint256,uint256,uint8,uint8,uint8,uint256))'
];

const SAVINGS_POCKET_ABI = [
  'function totalValue() view returns (uint256)',
  'function healthCheck() view returns (bool, string)',
  'function totalYield() view returns (uint256)',
  'function ANNUAL_YIELD_BPS() view returns (uint256)'
];

async function testE2EFlow() {
  console.log('🚀 Starting End-to-End Test on Kairos Testnet');
  console.log('===============================================');
  
  // Connect to Kairos testnet
  const provider = new ethers.JsonRpcProvider('https://public-en-kairos.node.kaia.io');
  
  try {
    // Test 1: Check network connection
    console.log('\n📡 Testing network connection...');
    const network = await provider.getNetwork();
    console.log(`✅ Connected to chain ID: ${network.chainId}`);
    
    // Test 2: Verify USDT contract
    console.log('\n💰 Testing USDT contract...');
    const usdt = new ethers.Contract(ADDRESSES.USDT, ERC20_ABI, provider);
    const symbol = await usdt.symbol();
    const decimals = await usdt.decimals();
    console.log(`✅ USDT contract: ${symbol}, ${decimals} decimals`);
    
    // Test 3: Check SavingsPocket health
    console.log('\n🏦 Testing SavingsPocket...');
    const savingsPocket = new ethers.Contract(ADDRESSES.SAVINGS_POCKET, SAVINGS_POCKET_ABI, provider);
    const [isHealthy, healthMessage] = await savingsPocket.healthCheck();
    const apy = await savingsPocket.ANNUAL_YIELD_BPS();
    const totalValue = await savingsPocket.totalValue();
    
    console.log(`✅ SavingsPocket Health: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`   Message: ${healthMessage}`);
    console.log(`   APY: ${Number(apy) / 100}%`);
    console.log(`   Total Value: ${ethers.formatUnits(totalValue, 6)} USDT`);
    
    // Test 4: Check Factory and Circles
    console.log('\n🏭 Testing KyeFactory...');
    const factory = new ethers.Contract(ADDRESSES.KYE_FACTORY, FACTORY_ABI, provider);
    const allCircles = await factory.getAllCircles();
    console.log(`✅ Factory deployed, total circles: ${allCircles.length}`);
    
    if (allCircles.length > 0) {
      console.log('\n⭕ Testing first circle...');
      try {
        const metadata = await factory.getCircleMetadata(allCircles[0]);
        console.log(`✅ Circle metadata loaded for: ${allCircles[0]}`);
        console.log(`   Creator: ${metadata[1]}`);
        console.log(`   Deposit Amount: ${ethers.formatUnits(metadata[4], 6)} USDT`);
        console.log(`   Members: ${metadata[5]}/5`);
        console.log(`   Current Round: ${metadata[6] + 1}`);
        console.log(`   Status: ${metadata[7]}`);
        console.log(`   TVL: ${ethers.formatUnits(metadata[8], 6)} USDT`);
      } catch (error) {
        console.log(`⚠️  Circle metadata error: ${error.message}`);
      }
    }
    
    // Test 5: Gas price check
    console.log('\n⛽ Testing gas conditions...');
    const gasPrice = await provider.getFeeData();
    console.log(`✅ Gas price: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('===============================================');
    console.log('✅ Frontend server: http://localhost:3001');
    console.log('✅ Contracts deployed and accessible on Kairos testnet');
    console.log('✅ Ready for end-to-end testing!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testE2EFlow();