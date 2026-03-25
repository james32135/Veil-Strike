// Market Pool Manager — maintains a pool of on-chain lightning markets
// Each 5-min round needs its own dedicated market so flash_settle can fairly resolve it.
// Without per-round markets, a persistent market shared across rounds can't pick
// a single winning outcome that's fair for all rounds.

import { getCachedMarkets } from './indexer';

type Asset = 'BTC' | 'ETH' | 'ALEO';
type Token = 'ALEO' | 'USDCX' | 'USAD';

export interface PoolMarket {
  marketId: string;
  asset: Asset;
  tokenType: Token;
  status: 'available' | 'active' | 'settling' | 'settled';
  roundId?: string;       // Set when assigned to a round
  assignedAt?: number;    // Timestamp of assignment
  settledAt?: number;     // Timestamp of settlement
}

// In-memory pool — persisted to disk would be a future enhancement
const pool: PoolMarket[] = [];

// Track which market IDs are already in the pool to avoid duplicates
const knownMarketIds = new Set<string>();

// Track rounds that have bets (notified by frontend)
const roundsWithBets = new Set<string>();

// Asset matching terms for market question text
const ASSET_TERMS: Record<string, string[]> = {
  BTC: ['BTC', 'BITCOIN'],
  ETH: ['ETH', 'ETHEREUM'],
  ALEO: ['ALEO'],
};

/**
 * Initialize the pool from cached market data.
 * Finds existing lightning markets and adds them as 'available'.
 */
export function initMarketPool(): void {
  const markets = getCachedMarkets();

  for (const m of markets) {
    if (!m.isLightning || m.outcomes.length !== 2) continue;
    if (knownMarketIds.has(m.id)) continue;
    // Status must be active (not already resolved/cancelled)
    if (m.status !== 'active') continue;

    const token = (m.tokenType || 'ALEO') as Token;
    let asset: Asset | null = null;
    const q = m.question.toUpperCase();
    for (const [a, terms] of Object.entries(ASSET_TERMS)) {
      if (terms.some((t) => q.includes(t))) {
        asset = a as Asset;
        break;
      }
    }
    if (!asset) continue;

    pool.push({
      marketId: m.id,
      asset,
      tokenType: token,
      status: 'available',
    });
    knownMarketIds.add(m.id);
  }

  console.log(`[MarketPool] Initialized with ${pool.length} available markets`);
  logPoolStatus();
}

/**
 * Get the next available market for a given asset + token type.
 * Marks it as 'active' and assigns it to the round.
 * Returns null if no market is available.
 */
export function getNextMarket(asset: Asset, token: Token, roundId: string): PoolMarket | null {
  const entry = pool.find(
    (m) => m.asset === asset && m.tokenType === token && m.status === 'available'
  );
  if (!entry) {
    console.warn(`[MarketPool] No available market for ${asset}-${token}`);
    return null;
  }

  entry.status = 'active';
  entry.roundId = roundId;
  entry.assignedAt = Date.now();
  return entry;
}

/**
 * Mark a market as 'settling' — flash_settle has been dispatched.
 */
export function markSettling(marketId: string): void {
  const entry = pool.find((m) => m.marketId === marketId);
  if (entry) {
    entry.status = 'settling';
  }
}

/**
 * Mark a market as 'settled' — flash_settle confirmed on-chain.
 */
export function markSettled(marketId: string): void {
  const entry = pool.find((m) => m.marketId === marketId);
  if (entry) {
    entry.status = 'settled';
    entry.settledAt = Date.now();
  }
}

/**
 * Get the on-chain status for a given round's market.
 */
export function getOnChainStatus(roundId: string): 'active' | 'settling' | 'settled' | 'unknown' {
  const entry = pool.find((m) => m.roundId === roundId);
  if (!entry) return 'unknown';
  return entry.status === 'available' ? 'active' : entry.status;
}

/**
 * Get a pool market by its round ID.
 */
export function getMarketForRound(roundId: string): PoolMarket | null {
  return pool.find((m) => m.roundId === roundId) ?? null;
}

/**
 * Notify that a round has bets placed.
 */
export function notifyRoundHasBets(roundId: string): void {
  roundsWithBets.add(roundId);
}

/**
 * Check if a round has any bets.
 */
export function roundHasBets(roundId: string): boolean {
  return roundsWithBets.has(roundId);
}

/**
 * Get pool summary for monitoring/debugging.
 */
export function getPoolStatus(): Record<string, { available: number; active: number; settling: number; settled: number }> {
  const status: Record<string, { available: number; active: number; settling: number; settled: number }> = {};

  for (const m of pool) {
    const key = `${m.asset}-${m.tokenType}`;
    if (!status[key]) status[key] = { available: 0, active: 0, settling: 0, settled: 0 };
    status[key][m.status]++;
  }

  return status;
}

function logPoolStatus(): void {
  const s = getPoolStatus();
  for (const [key, counts] of Object.entries(s)) {
    console.log(`[MarketPool] ${key}: available=${counts.available} active=${counts.active} settling=${counts.settling} settled=${counts.settled}`);
  }
}

/**
 * Clean up old settled markets from the pool (older than 2 hours).
 */
export function cleanupPool(): void {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (let i = pool.length - 1; i >= 0; i--) {
    const m = pool[i];
    if (m.status === 'settled' && m.settledAt && m.settledAt < cutoff) {
      knownMarketIds.delete(m.marketId);
      pool.splice(i, 1);
    }
  }
}
