// ============================================================================
// Veil Strike — Application constants
// ============================================================================

export const PROGRAM_ID = 'veil_strike_v5.aleo';

export const ALEO_TESTNET_API = 'https://api.explorer.provable.com/v1/testnet';

export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export const PRECISION = 1_000_000;

export const FEES = {
  PROTOCOL: 0.005,   // 0.5%
  CREATOR: 0.005,    // 0.5%
  LP: 0.01,          // 1.0%
  TOTAL: 0.02,       // 2.0%
} as const;

export const MIN_LIQUIDITY = 1_000_000; // 1 ALEO in microcredits
export const MIN_TRADE = 10_000;        // 0.01 ALEO

export const STATUS_MAP: Record<number, string> = {
  1: 'active',
  2: 'closed',
  3: 'resolved',
  4: 'cancelled',
  5: 'pending_resolution',
};

export const CATEGORY_MAP: Record<number, string> = {
  1: 'Crypto',
  2: 'Crypto',
  3: 'Sports',
  4: 'Politics',
  5: 'Science',
  6: 'Entertainment',
  7: 'Other',
};

export const TOKEN_TYPES: Record<number, string> = {
  0: 'ALEO',
  1: 'USDCX',
  2: 'USAD',
};

export const LIGHTNING_DURATIONS = [
  { label: '5 Min', seconds: 300, blocks: 20 },
  { label: '15 Min', seconds: 900, blocks: 60 },
  { label: '1 Hour', seconds: 3600, blocks: 240 },
  { label: '4 Hours', seconds: 14400, blocks: 960 },
] as const;

export const CATEGORIES: string[] = [
  'All',
  'Crypto',
  'Sports',
  'Politics',
  'Science',
  'Entertainment',
  'Other',
];

export const CHART_COLORS = {
  teal: '#00D4B8',
  green: '#22C55E',
  red: '#EF4444',
  gray: '#6B7280',
  darkBg: '#06080F',
  cardBg: '#111822',
  borderColor: '#1C2333',
} as const;

export const TRANSITIONS = {
  CREATE_MARKET: 'init_market',
  BUY_SHARES_PRIVATE: 'purchase_position',
  SELL_SHARES: 'liquidate_position',
  ADD_LIQUIDITY: 'provide_liquidity',
  CLOSE_MARKET: 'seal_market',
  RESOLVE_MARKET: 'judge_market',
  FINALIZE_RESOLUTION: 'confirm_verdict',
  CANCEL_MARKET: 'abort_market',
  DISPUTE: 'challenge_verdict',
  CLAIM_DISPUTE_BOND: 'reclaim_bond',
  REDEEM: 'collect_winnings',
  CLAIM_REFUND: 'collect_refund',
  WITHDRAW_LP: 'exit_pool',
  CLAIM_LP_REFUND: 'exit_pool_refund',
  WITHDRAW_CREATOR_FEES: 'claim_creator_rewards',
  CREATE_MARKET_USDCX: 'init_market_stablecoin',
  BUY_SHARES_USDCX: 'purchase_position_stablecoin',
  SELL_SHARES_USDCX: 'liquidate_position_stablecoin',
  ADD_LIQUIDITY_USDCX: 'provide_liquidity_stablecoin',
  REDEEM_USDCX: 'collect_winnings_stablecoin',
  CLAIM_REFUND_USDCX: 'collect_refund_stablecoin',
  WITHDRAW_LP_USDCX: 'exit_pool_stablecoin',
  CLAIM_LP_REFUND_USDCX: 'exit_pool_refund_stablecoin',
  WITHDRAW_FEES_USDCX: 'claim_rewards_stablecoin',
  SETTLE_ROUND: 'settle_round',
} as const;
