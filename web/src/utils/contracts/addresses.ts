// Contract addresses from environment variables
const getContractAddressesFromEnv = () => {
  // Primary addresses from environment variables
  const envAddresses = {
    MockUSDT: process.env.NEXT_PUBLIC_USDT_ADDRESS,
    SavingsPocket: process.env.NEXT_PUBLIC_SAVINGS_POCKET_ADDRESS,
    KyeFactory: process.env.NEXT_PUBLIC_KYE_FACTORY_ADDRESS,
  };

  // Fallback addresses for different networks
  const fallbackAddresses = {
    // Kaia Kairos Testnet (Chain ID: 1001) - Latest deployment with creator auto-membership fix
    1001: {
      MockUSDT: '0xE5349B2c9feC6cc99500D4333244DC79c8f2C943',
      SavingsPocket: '0xCfAbE6786bA807b9f6388fB692d080F3d488Aa99',
      KyeFactory: '0xF0B8a48Ca9549dA069FA8E112c14B743F00D58C3',
    },
    // Local Anvil (Chain ID: 31337) - Updated with fixed contracts
    31337: {
      MockUSDT: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
      SavingsPocket: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
      KyeFactory: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
    }
  };

  return { envAddresses, fallbackAddresses };
};

// Contract addresses on different networks
export const CONTRACT_ADDRESSES = (() => {
  const { envAddresses, fallbackAddresses } = getContractAddressesFromEnv();
  
  // If all environment variables are set, use them for the default chain
  if (envAddresses.MockUSDT && envAddresses.SavingsPocket && envAddresses.KyeFactory) {
    return {
      // Use environment addresses for default chain (1001)
      1001: {
        MockUSDT: envAddresses.MockUSDT,
        SavingsPocket: envAddresses.SavingsPocket,
        KyeFactory: envAddresses.KyeFactory,
      },
      // Keep local development addresses
      31337: fallbackAddresses[31337]
    };
  }
  
  // Otherwise, use fallback addresses
  return fallbackAddresses;
})();

// Get contract addresses for current network
export function getContractAddresses(chainId: number) {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!addresses) {
    throw new Error(`Contract addresses not configured for chain ID ${chainId}`);
  }
  return addresses;
}

// Network configurations
export const NETWORKS = {
  1001: {
    name: 'Kaia Kairos Testnet',
    rpcUrl: 'https://public-en-kairos.node.kaia.io',
    blockExplorer: 'https://kairos.kaiascan.io',
    nativeCurrency: { name: 'KAIA', symbol: 'KAIA', decimals: 18 }
  },
  31337: {
    name: 'Local Network',
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorer: null,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  }
};

export const DEFAULT_CHAIN_ID = 1001; // Kaia Kairos Testnet

// Utility function to check address configuration source
export function getAddressConfigSource() {
  const { envAddresses } = getContractAddressesFromEnv();
  const hasEnvConfig = envAddresses.MockUSDT && envAddresses.SavingsPocket && envAddresses.KyeFactory;
  
  return {
    source: hasEnvConfig ? 'environment' : 'hardcoded',
    envVariables: envAddresses,
    isComplete: hasEnvConfig
  };
}

// Debug function to log current configuration
export function logAddressConfiguration() {
  const config = getAddressConfigSource();
  console.log('📋 Contract Address Configuration:');
  console.log(`- Source: ${config.source}`);
  console.log('- Environment Variables:');
  console.log(`  • NEXT_PUBLIC_USDT_ADDRESS: ${config.envVariables.MockUSDT || 'not set'}`);
  console.log(`  • NEXT_PUBLIC_SAVINGS_POCKET_ADDRESS: ${config.envVariables.SavingsPocket || 'not set'}`);
  console.log(`  • NEXT_PUBLIC_KYE_FACTORY_ADDRESS: ${config.envVariables.KyeFactory || 'not set'}`);
  console.log('- Current Addresses:');
  console.log(`  • MockUSDT: ${CONTRACT_ADDRESSES[DEFAULT_CHAIN_ID]?.MockUSDT}`);
  console.log(`  • SavingsPocket: ${CONTRACT_ADDRESSES[DEFAULT_CHAIN_ID]?.SavingsPocket}`);
  console.log(`  • KyeFactory: ${CONTRACT_ADDRESSES[DEFAULT_CHAIN_ID]?.KyeFactory}`);
}