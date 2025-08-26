// Contract addresses on different networks
export const CONTRACT_ADDRESSES = {
  // Kaia Kairos Testnet (Chain ID: 1001)
  1001: {
    MockUSDT: '0x8f198cd718aa1bf2b338ddba78736e91cd254da6',
    SavingsPocket: '0xc05ba2595d916ad94378438dbb3b6f3161bd6c5b',
    KyeFactory: '0x724f792f3d11c8eb1471e84abef654c93ce639de',
  },
  // Local Anvil (Chain ID: 31337)
  31337: {
    MockUSDT: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
    SavingsPocket: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
    KyeFactory: '0x5fc8d32690cc91d4c39d9d3abcbd16989f875707',
  }
};

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