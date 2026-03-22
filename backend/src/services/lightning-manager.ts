// Lightning Round Manager — creates per-round on-chain markets and settles them
// Each 5-min round per asset gets its own on-chain market.
// Flow: create market → users bet → round ends → settle_round → winners collect_winnings (1:1)

import { config } from '../config';
import { getCachedPrices } from './oracle';
import { registerMarket, persistRegistry } from './indexer';
import {
  executeSettleRound,
  fetchCurrentBlock,
  getResolverAddress,
} from './chain-executor';

const ROUND_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const ROUND_BLOCKS = 60; // ~5 min at ~5s/block
const ASSETS: ('BTC' | 'ETH' | 'ALEO')[] = ['BTC', 'ETH', 'ALEO'];

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
 * Settle expired lightning rounds by calling settle_round on-chain.
 * Determines winner by comparing start vs current price.
 */
export async function settleLightningRounds(): Promise<void> {
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

    const txId = await executeSettleRound(round.marketId, winningOutcome);
    if (txId) {
      round.settled = true;
      settledRounds.push(round);
      console.log(`[LightningMgr] Settled ${key} tx=${txId}`);
    }

    pendingSettle.delete(key);
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
