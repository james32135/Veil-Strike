// Lightning Round Manager — creates per-round on-chain markets and settles them
// Each 5-min round per asset gets its own on-chain market.
// Flow: create market → users bet → round ends → flash_settle → winners harvest_winnings (1:1)

import { config } from '../config';
import { getCachedPrices } from './oracle';
import { registerMarket, persistRegistry, getCachedMarkets } from './indexer';
import {
  executeSettleRound,
  executeInitMarket,
  fetchCurrentBlock,
  getResolverAddress,
} from './chain-executor';

const ROUND_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const ROUND_BLOCKS = 60; // ~5 min at ~5s/block
const ASSETS: ('BTC' | 'ETH' | 'ALEO')[] = ['BTC', 'ETH', 'ALEO'];

// Asset terms for dynamic matching
const ASSET_TERMS: Record<string, string[]> = {
  BTC: ['BTC', 'BITCOIN'],
  ETH: ['ETH', 'ETHEREUM'],
  ALEO: ['ALEO'],
};

// Fallback seed IDs (used if no markets found in cache yet)
const SEED_LIGHTNING_FALLBACK: Record<'BTC' | 'ETH' | 'ALEO', string> = {
  BTC: '4996210007700946181946925844129973971689300422125832342620831605415253333389field',
  ETH: '4634458192957872849621597187822568246583922089977590111134549454558548213015field',
  ALEO: '4278173522866567246556560167948434723044021497780470115660873330900641551519field',
};

/** Dynamically resolve the best ALEO lightning market per asset from the market cache.
 *  Prefers smallest-liquidity market (better payouts). Falls back to hardcoded IDs. */
function getSeedLightningId(asset: 'BTC' | 'ETH' | 'ALEO'): string {
  const markets = getCachedMarkets();
  const terms = ASSET_TERMS[asset] || [asset];
  const match = markets
    .filter((m) => m.isLightning && (m.tokenType === 'ALEO' || !m.tokenType) && m.outcomes.length === 2
      && terms.some((t) => m.question.toUpperCase().includes(t)))
    .sort((a, b) => a.totalLiquidity - b.totalLiquidity)[0];
  return match?.id || SEED_LIGHTNING_FALLBACK[asset];
}

// Track active lightning round market IDs per asset
interface ActiveRound {
  marketId: string;
  asset: 'BTC' | 'ETH' | 'ALEO';
  startTime: number;
  endTime: number;
  startPrice: number;
  settled: boolean;
}

const activeRounds = new Map<string, ActiveRound>(); // key: `${asset}-${roundStart}`
const settledRounds: ActiveRound[] = []; // History of settled rounds
const pendingSettle = new Set<string>(); // Prevent double-settle
let settleInProgress = false; // Prevent concurrent settlement (heavy WASM proving blocks event loop)

// Price snapshots for round start/end comparison
const roundPriceSnapshots = new Map<number, { btc: number; eth: number; aleo: number }>();

function getRoundStart(time: number): number {
  return Math.floor(time / ROUND_DURATION_MS) * ROUND_DURATION_MS;
}

function getAssetPrice(asset: 'BTC' | 'ETH' | 'ALEO'): number {
  const prices = getCachedPrices();
  return prices[asset.toLowerCase() as 'btc' | 'eth' | 'aleo'] || 0;
}

/**
 * Record price snapshot at the current round boundary.
 * Called by main cron alongside oracle price fetch.
 */
export function recordRoundPriceSnapshot(): void {
  const now = Date.now();
  const roundStart = getRoundStart(now);
  if (!roundPriceSnapshots.has(roundStart)) {
    const prices = getCachedPrices();
    if (prices.btc > 0) {
      roundPriceSnapshots.set(roundStart, {
        btc: prices.btc,
        eth: prices.eth,
        aleo: prices.aleo,
      });
    }
  }

  // Clean up old snapshots (keep last 2 hours)
  const cutoff = now - 2 * 60 * 60 * 1000;
  for (const [ts] of roundPriceSnapshots) {
    if (ts < cutoff) roundPriceSnapshots.delete(ts);
  }
}

/**
 * Register a lightning round market in the indexer and local tracking.
 * Called when the scanner discovers the market on-chain, or when we create it.
 */
export function registerLightningRound(
  marketId: string,
  asset: 'BTC' | 'ETH' | 'ALEO',
  roundStart: number,
  startPrice: number,
): void {
  const key = `${asset}-${roundStart}`;
  if (activeRounds.has(key)) return;

  const round: ActiveRound = {
    marketId,
    asset,
    startTime: roundStart,
    endTime: roundStart + ROUND_DURATION_MS,
    startPrice,
    settled: false,
  };
  activeRounds.set(key, round);

  // Register in the indexer so it appears in market listings
  registerMarket(marketId, {
    questionHash: '',
    question: `${asset} Lightning Round ${new Date(roundStart).toISOString().slice(11, 16)}`,
    outcomes: ['Up', 'Down'],
    isLightning: true,
  });

  console.log(`[LightningMgr] Registered round ${key} market=${marketId.slice(0, 20)}...`);
}

/**
 * Settle expired lightning rounds by calling flash_settle on-chain.
 * Determines winner by comparing start vs current price.
 * Only settles ONE round at a time to avoid blocking the Node.js event loop.
 */
export async function settleLightningRounds(): Promise<void> {
  if (settleInProgress) {
    console.log('[LightningMgr] Settlement already in progress, skipping');
    return;
  }

  const resolverAddr = getResolverAddress();
  if (!resolverAddr) return;

  const now = Date.now();
  const currentBlock = await fetchCurrentBlock();
  if (currentBlock === 0) return;

  for (const [key, round] of activeRounds) {
    if (round.settled) continue;
    if (now < round.endTime) continue; // Round not ended yet
    if (pendingSettle.has(key)) continue;

    // Get end price
    const endPrice = getAssetPrice(round.asset);
    if (endPrice <= 0) {
      console.log(`[LightningMgr] No price for ${round.asset}, skipping settle`);
      continue;
    }

    // Determine winner: 1 = Up wins, 2 = Down wins
    const winningOutcome = endPrice > round.startPrice ? 1 : 2;

    console.log(`[LightningMgr] Settling ${key}: start=$${round.startPrice} end=$${endPrice} winner=${winningOutcome === 1 ? 'UP' : 'DOWN'}`);
    pendingSettle.add(key);
    settleInProgress = true;

    try {
      const txId = await executeSettleRound(round.marketId, winningOutcome);
      if (txId) {
        round.settled = true;
        settledRounds.push(round);
        console.log(`[LightningMgr] Settled ${key} tx=${txId}`);
      }
    } finally {
      pendingSettle.delete(key);
      settleInProgress = false;
    }

    // Only settle ONE round per cron tick to avoid blocking the event loop
    break;
  }

  // Clean up old rounds from active map (keep only last 1 hour)
  const cutoff = now - 60 * 60 * 1000;
  for (const [key, round] of activeRounds) {
    if (round.settled && round.endTime < cutoff) {
      activeRounds.delete(key);
    }
  }
}

/**
 * Get all active/recent lightning rounds for the API.
 */
export function getActiveLightningRounds(): Array<{
  id: string;
  marketId: string;
  asset: string;
  startTime: number;
  endTime: number;
  startPrice: number;
  settled: boolean;
}> {
  const rounds: Array<{
    id: string;
    marketId: string;
    asset: string;
    startTime: number;
    endTime: number;
    startPrice: number;
    settled: boolean;
  }> = [];

  for (const [key, round] of activeRounds) {
    rounds.push({
      id: key,
      marketId: round.marketId,
      asset: round.asset,
      startTime: round.startTime,
      endTime: round.endTime,
      startPrice: round.startPrice,
      settled: round.settled,
    });
  }

  return rounds.sort((a, b) => b.startTime - a.startTime);
}

/**
 * Initialize seed lightning markets as active rounds on startup.
 * Uses the NEXT 5-min boundary so they don't look expired immediately on restart.
 */
export function initSeedLightningRounds(): void {
  const now = Date.now();
  const currentRoundStart = getRoundStart(now);
  // If we're more than 30s past the round start, use the next round boundary
  // to avoid immediately trying to settle (which blocks the event loop with proving)
  const roundStart = (now - currentRoundStart > 30_000)
    ? currentRoundStart + ROUND_DURATION_MS
    : currentRoundStart;

  for (const asset of ASSETS) {
    const marketId = getSeedLightningId(asset);
    const price = getAssetPrice(asset);
    if (price <= 0) continue;

    const key = `${asset}-${roundStart}`;
    if (activeRounds.has(key)) continue;

    const round: ActiveRound = {
      marketId,
      asset,
      startTime: roundStart,
      endTime: roundStart + ROUND_DURATION_MS,
      startPrice: price,
      settled: false,
    };
    activeRounds.set(key, round);
    console.log(`[LightningMgr] Seed round ${key} market=${marketId.slice(0, 20)}... price=$${price}`);
  }
}
