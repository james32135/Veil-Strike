// ============================================================================
// Veil Strike — Core TypeScript types
// ============================================================================

export interface Market {
  id: string;
  question: string;
  category: string;
  outcomes: string[];
  reserves: number[];
  totalLiquidity: number;
  totalVolume: number;
  tradeCount: number;
  status: 'active' | 'closed' | 'resolved' | 'cancelled' | 'pending_resolution';
  endTime: number;
  createdAt: number;
  isLightning: boolean;
  resolvedOutcome?: number;
  tokenType?: string;
  imageUrl?: string;
  seriesId?: string;
  roundNumber?: number;
  startPrice?: number;
  timeSlot?: string;
  tags?: string[];
}

export interface Series {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  asset: string;
  iconUrl?: string;
  description?: string;
  category: string;
  durationSeconds: number;
  tokenType: string;
  totalVolume: number;
  totalRounds: number;
  isActive: boolean;
  createdAt: number;
  currentRound?: Market;
  pastRounds?: Market[];
  upcomingSlots?: string[];
}

export interface SharePosition {
  marketId: string;
  outcomeIndex: number;
  amount: number;
  costBasis: number;
}

export interface PoolMembership {
  poolId: string;
  depositAmount: number;
  sharePercentage: number;
}

export interface LPReceipt {
  marketId: string;
  lpShares: number;
  depositAmount: number;
  sharePercentage: number;
}

export interface Pool {
  id: string;
  name: string;
  description: string;
  creator: string;
  targetSize: number;
  currentSize: number;
  minEntry: number;
  memberCount: number;
  marketIds: string[];
  status: 'active' | 'settled' | 'cancelled';
  totalPnL: number;
  createdAt: number;
}

export interface OraclePrices {
  btc: number;
  eth: number;
  aleo: number;
  timestamp: number;
}

export interface ProtocolStats {
  totalMarkets: number;
  activeMarkets: number;
  resolvedMarkets: number;
  totalVolume: number;
  totalLiquidity: number;
  totalTrades: number;
  uniqueTraders: number;
  protocolFees: number;
}

export interface LeaderboardEntry {
  address: string;
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  streak: number;
  totalVolume: number;
}

export interface TradeHistoryEntry {
  marketId: string;
  type: 'buy' | 'sell';
  outcome: string;
  amount: number;
  shares: number;
  price: number;
  timestamp: number;
}

export interface ChartDataPoint {
  time: number;
  price: number;
  volume?: number;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'pending';
  title: string;
  message: string;
  timestamp: number;
  link?: string;
  linkLabel?: string;
  /** Current step index (0-based) for multi-step toasts */
  currentStep?: number;
  /** Step labels for multi-step progress */
  steps?: string[];
}

export interface AleoTransaction {
  programId: string;
  functionName: string;
  inputs: string[];
  fee: number;
  privateFee: boolean;
}

export type MarketCategory =
  | 'Crypto'
  | 'Privacy'
  | 'DeFi'
  | 'Governance'
  | 'Whale Watch'
  | 'Geopolitics'
  | 'AI'
  | 'Sports'
  | 'Culture'
  | 'Other';

export type LightningDuration = '5min' | '15min' | '1hr' | '4hr';

export type MarketSortBy = 'volume' | 'liquidity' | 'newest' | 'ending';
