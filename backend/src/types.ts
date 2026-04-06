export interface OraclePrices {
  btc: number;
  eth: number;
  aleo: number;
  timestamp: number;
}

export interface MarketInfo {
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

export interface SeriesInfo {
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
  currentRound?: MarketInfo;
  pastRounds?: MarketInfo[];
  upcomingSlots?: string[];
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
