// ============================================================================
// Veil Strike — Application constants
// ============================================================================

export const PROGRAM_ID = 'veil_strike_v1.aleo';

export const ALEO_TESTNET_API = 'https://api.explorer.provable.com/v1/testnet';

export const API_BASE = '/api';

export const PRECISION = 1_000_000;

export const FEES = {
  PROTOCOL: 0.005,   // 0.5%
  CREATOR: 0.005,    // 0.5%
  LP: 0.01,          // 1.0%
  TOTAL: 0.02,       // 2.0%
} as const;

export const MIN_LIQUIDITY = 1_000_000; // 1 ALEO in microcredits
export const MIN_TRADE = 1_000;         // 0.001 ALEO

export const STATUS_MAP: Record<number, string> = {
  1: 'active',
  2: 'closed',
  3: 'resolved',
  4: 'finalized',
  5: 'cancelled',
  6: 'disputed',
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
  INITIALIZE: 'initialize',
  CREATE_MARKET: 'create_market',
  BUY_SHARES: 'buy_shares',
  SELL_SHARES: 'sell_shares',
  ADD_LIQUIDITY: 'add_liquidity',
  CLOSE_MARKET: 'close_market',
  RESOLVE_MARKET: 'resolve_market',
  FINALIZE_RESOLUTION: 'finalize_resolution',
  CANCEL_MARKET: 'cancel_market',
  DISPUTE: 'dispute_resolution',
  CLAIM_DISPUTE_BOND: 'claim_dispute_bond',
  REDEEM: 'redeem_shares',
  CLAIM_REFUND: 'claim_refund',
  WITHDRAW_LP: 'withdraw_lp',
  WITHDRAW_CREATOR_FEES: 'withdraw_creator_fees',
  WITHDRAW_PROTOCOL_FEES: 'withdraw_protocol_fees',
  CREATE_MARKET_USDCX: 'create_market_usdcx',
  BUY_SHARES_USDCX: 'buy_shares_usdcx',
  REDEEM_USDCX: 'redeem_shares_usdcx',
  ADD_LIQUIDITY_USDCX: 'add_liquidity_usdcx',
} as const;
