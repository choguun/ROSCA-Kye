// Essential ABIs for ROSCA Kye contracts

export const KYE_FACTORY_ABI = [
  // Constructor
  {
    type: "constructor",
    inputs: [
      { name: "_defaultUsdtToken", type: "address" },
      { name: "_defaultYieldAdapter", type: "address" }
    ]
  },
  // Core functions
  {
    type: "function",
    name: "deployCircle",
    inputs: [
      { name: "salt", type: "bytes32" },
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "usdtToken", type: "address" },
          { name: "yieldAdapter", type: "address" },
          { name: "lineGroupIdHash", type: "bytes32" },
          { name: "depositAmount", type: "uint256" },
          { name: "penaltyBps", type: "uint256" },
          { name: "roundDuration", type: "uint256" },
          { name: "maxMembers", type: "uint8" }
        ]
      }
    ],
    outputs: [{ name: "circleAddress", type: "address" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getAllCircles",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getCircleMetadata",
    inputs: [{ name: "circleAddress", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "circleAddress", type: "address" },
          { name: "creator", type: "address" },
          { name: "lineGroupIdHash", type: "bytes32" },
          { name: "createdAt", type: "uint256" },
          { name: "depositAmount", type: "uint256" },
          { name: "memberCount", type: "uint8" },
          { name: "currentRound", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "totalValueLocked", type: "uint256" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getCirclesForGroup",
    inputs: [{ name: "lineGroupIdHash", type: "bytes32" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view"
  },
  // Events
  {
    type: "event",
    name: "CircleCreated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "circleAddress", type: "address", indexed: true },
      { name: "lineGroupIdHash", type: "bytes32", indexed: true },
      { name: "depositAmount", type: "uint256", indexed: false }
    ]
  }
] as const;

export const KYE_GROUP_ABI = [
  // Constructor
  {
    type: "constructor",
    inputs: [
      { name: "_usdtToken", type: "address" },
      { name: "_yieldAdapter", type: "address" },
      { name: "_creator", type: "address" },
      { name: "_lineGroupIdHash", type: "bytes32" },
      { name: "_depositAmount", type: "uint256" },
      { name: "_penaltyBps", type: "uint256" },
      { name: "_roundDuration", type: "uint256" },
      { name: "_maxMembers", type: "uint256" }
    ]
  },
  // View functions
  {
    type: "function",
    name: "maxMembers",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "currentPhase",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "currentRound",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "depositAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "members",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "memberCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "memberStates",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "wallet", type: "address" },
      { name: "lineUserIdHash", type: "bytes32" },
      { name: "totalDeposited", type: "uint256" },
      { name: "totalReceived", type: "uint256" },
      { name: "penaltiesAccrued", type: "uint256" },
      { name: "lastActiveRound", type: "uint256" },
      { name: "hasDefaulted", type: "bool" },
      { name: "reputation", type: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "rounds",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "deadline", type: "uint256" },
      { name: "beneficiary", type: "address" },
      { name: "totalDeposited", type: "uint256" },
      { name: "yieldAccrued", type: "uint256" },
      { name: "isComplete", type: "bool" }
    ],
    stateMutability: "view"
  },
  // Core actions
  {
    type: "function",
    name: "join",
    inputs: [{ name: "_lineUserIdHash", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "calculatePenalty",
    inputs: [
      { name: "member", type: "address" },
      { name: "roundIndex", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getRemainingTime",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  // Events
  {
    type: "event",
    name: "MemberJoined",
    inputs: [
      { name: "member", type: "address", indexed: true },
      { name: "lineUserIdHash", type: "bytes32", indexed: true },
      { name: "memberIndex", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "DepositMade",
    inputs: [
      { name: "member", type: "address", indexed: true },
      { name: "round", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "penalty", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "PayoutDistributed",
    inputs: [
      { name: "beneficiary", type: "address", indexed: true },
      { name: "round", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "PhaseChanged",
    inputs: [
      { name: "from", type: "uint8", indexed: false },
      { name: "to", type: "uint8", indexed: false }
    ]
  }
] as const;

export const MOCK_USDT_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const;

export const SAVINGS_POCKET_ABI = [
  // View functions
  {
    type: "function",
    name: "expectedAPY",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "totalValue",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getUserShares",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getUserValue",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getPendingYield",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getYieldRate",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "healthCheck",
    inputs: [],
    outputs: [
      { name: "isHealthy", type: "bool" },
      { name: "reason", type: "string" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "totalDeposited",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "sponsorFunds",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  // Core functions
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "recipient", type: "address" }
    ],
    outputs: [{ name: "amount", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "manualYieldAccrual",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const;

// Enums matching contract definitions
export enum Phase {
  Setup = 0,
  Commitment = 1,
  Active = 2,
  Settlement = 3,
  Resolved = 4,
  Disputed = 5
}

export const PHASE_NAMES = {
  [Phase.Setup]: 'Setup',
  [Phase.Commitment]: 'Commitment', 
  [Phase.Active]: 'Active',
  [Phase.Settlement]: 'Settlement',
  [Phase.Resolved]: 'Resolved',
  [Phase.Disputed]: 'Disputed'
} as const;