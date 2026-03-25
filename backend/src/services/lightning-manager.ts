// Lightning Round Manager — assigns per-round on-chain markets and tracks results.
// Each 5-min round per asset+token reuses the persistent lightning market for that combo.
// Resolution: AMM sell is the primary exit. Admin can manually flash_settle for batch 1:1 claims.

import { getCachedPrices } from './oracle';
import { registerMarket, getCachedMarkets, persistRegistry } from './indexer';
import { dispatchSettle, dispatchCreateMarket } from './proof-dispatcher';
import { getResolverAddress, fetchCurrentBlock } from './chain-executor';

const ROUND_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const ASSETS: ('BTC' | 'ETH' | 'ALEO')[] = ['BTC', 'ETH', 'ALEO'];
const TOKEN_TYPES: ('ALEO' | 'USDCX' | 'USAD')[] = ['ALEO', 'USDCX', 'USAD'];

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

/** Find the best ACTIVE lightning market for a given asset+token from the market cache.
 *  Skips resolved/cancelled markets so rounds auto-switch to new markets. */
function getSeedLightningId(asset: 'BTC' | 'ETH' | 'ALEO', token: 'ALEO' | 'USDCX' | 'USAD' = 'ALEO'): string | null {
  const markets = getCachedMarkets();
  const terms = ASSET_TERMS[asset] || [asset];
  const match = markets
    .filter((m) => m.isLightning && m.tokenType === token && m.outcomes.length === 2
      && m.status !== 'resolved' && m.status !== 'cancelled'
      && terms.some((t) => m.question.toUpperCase().includes(t)))
    .sort((a, b) => a.totalLiquidity - b.totalLiquidity)[0];
  if (match) return match.id;
  // Fallback seed IDs — only use if not already resolved on-chain
  if (token === 'ALEO') {
    const fallbackId = SEED_LIGHTNING_FALLBACK[asset];
    const fallbackMarket = markets.find((m) => m.id === fallbackId);
    if (!fallbackMarket || (fallbackMarket.status !== 'resolved' && fallbackMarket.status !== 'cancelled')) {
      return fallbackId;
    }
  }
  return null;
}

interface ActiveRound {
  marketId: string;
  asset: 'BTC' | 'ETH' | 'ALEO';
  tokenType: 'ALEO' | 'USDCX' | 'USAD';
  startTime: number;
  endTime: number;
  startPrice: number;
  settled: boolean;
  winningOutcome?: number; // 1 = UP, 2 = DOWN (off-chain result)
  endPrice?: number;
  onChainResolved?: boolean; // true only after admin manually flash_settles
}

// key format: "BTC-ALEO-1747123400000"
const activeRounds = new Map<string, ActiveRound>();
const pendingSettle = new Set<string>();
const settleTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Track rounds that have bets (only settle these to save gas)
const roundsWithBets = new Set<string>();

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
 */
export function recordRoundPriceSnapshot(): void {
  const now = Date.now();
  const roundStart = getRoundStart(now);
  if (!roundPriceSnapshots.has(roundStart)) {
    const prices = getCachedPrices();
    if (prices.btc > 0) {
      roundPriceSnapshots.set(roundStart, { btc: prices.btc, eth: prices.eth, aleo: prices.aleo });
    }
  }
  // Clean up old snapshots (keep last 2 hours)
  const cutoff = now - 2 * 60 * 60 * 1000;
  for (const [ts] of roundPriceSnapshots) {
    if (ts < cutoff) roundPriceSnapshots.delete(ts);
  }
}

/**
 * Assign a persistent market to the current round for each asset+token combo.
 * Same market can serve multiple rounds — reuses existing lightning markets from cache.
 */
export function assignRoundMarkets(): void {
  const now = Date.now();
  const currentRoundStart = getRoundStart(now);
  // Assign for current round and next round
  const starts = [currentRoundStart, currentRoundStart + ROUND_DURATION_MS];

  for (const roundStart of starts) {
    for (const token of TOKEN_TYPES) {
      for (const asset of ASSETS) {
        const key = `${asset}-${token}-${roundStart}`;
        if (activeRounds.has(key)) continue;

        const marketId = getSeedLightningId(asset, token);
        if (!marketId) continue;

        const price = getAssetPrice(asset);
        if (price <= 0) continue;

        const round: ActiveRound = {
          marketId,
          asset,
          tokenType: token,
          startTime: roundStart,
          endTime: roundStart + ROUND_DURATION_MS,
          startPrice: price,
          settled: false,
        };
        activeRounds.set(key, round);

        console.log(`[LightningMgr] Assigned ${key} market=${marketId.slice(0, 20)}... price=$${price}`);
      }
    }
  }
}

/**
 * Schedule result determination for a round when it ends.
 * No longer auto-settles on-chain — just records the outcome.
 */
function scheduleSettlement(key: string, endTime: number): void {
  if (settleTimers.has(key)) return;
  const delay = Math.max(0, endTime - Date.now() + 2000); // 2s buffer after round ends
  const timer = setTimeout(() => {
    settleTimers.delete(key);
    resolveRoundResult(key);
  }, delay);
  settleTimers.set(key, timer);
  console.log(`[LightningMgr] Scheduled result for ${key} in ${Math.round(delay / 1000)}s`);
}

/**
 * Notify that a user placed a bet on a round.
 * Triggers scheduling of settlement for that round.
 */
export function notifyBet(roundId: string): void {
  roundsWithBets.add(roundId);
  const round = activeRounds.get(roundId);
  if (round && !round.settled && !pendingSettle.has(roundId)) {
    scheduleSettlement(roundId, round.endTime);
  }
}

/**
 * Determine the result for a round (no on-chain settlement).
 * Users exit via AMM sell. Admin can batch-resolve later for 1:1 claims.
 */
function resolveRoundResult(key: string): void {
  const round = activeRounds.get(key);
  if (!round || round.settled) return;
  if (!roundsWithBets.has(key)) {
    console.log(`[LightningMgr] Skipping ${key} — no bets placed`);
    return;
  }

  const endPrice = getAssetPrice(round.asset);
  if (endPrice <= 0) {
    console.log(`[LightningMgr] No price for ${round.asset}, skipping result`);
    return;
  }

  const winningOutcome = endPrice > round.startPrice ? 1 : 2;
  round.settled = true;
  round.winningOutcome = winningOutcome;
  round.endPrice = endPrice;
  console.log(`[LightningMgr] Round ${key}: start=$${round.startPrice} end=$${endPrice} winner=${winningOutcome === 1 ? 'UP' : 'DOWN'} (off-chain only)`);
}

/**
 * Cron-based round result resolution — determines winners for expired rounds.
 * No on-chain settlement: users sell via AMM, admin can manually resolve later.
 */
export async function settleLightningRounds(): Promise<void> {
  const now = Date.now();

  for (const [key, round] of activeRounds) {
    if (round.settled || now < round.endTime) continue;
    if (!roundsWithBets.has(key)) continue;
    resolveRoundResult(key);
  }

  // Clean up old rounds (keep last 2 hours)
  const cutoff = now - 2 * 60 * 60 * 1000;
  for (const [key, round] of activeRounds) {
    if (round.settled && round.endTime < cutoff) {
      activeRounds.delete(key);
    }
  }
}

/**
 * Get the market assignment for a specific oracle round ID.
 * Oracle round IDs are like "BTC-1747123400000" (no token).
 * Returns all token variants for that asset+time.
 */
export function getMarketAssignments(): Map<string, { marketId: string; tokenType: string; onChainStatus: string }> {
  const assignments = new Map<string, { marketId: string; tokenType: string; onChainStatus: string }>();
  for (const [key, round] of activeRounds) {
    let status = 'active';
    if (round.onChainResolved) status = 'settled';
    else if (round.settled) status = 'resolved'; // off-chain result known, not yet on-chain
    assignments.set(key, {
      marketId: round.marketId,
      tokenType: round.tokenType,
      onChainStatus: status,
    });
  }
  return assignments;
}

/**
 * Get all active/recent lightning rounds for the API.
 */
export function getActiveLightningRounds(): Array<{
  id: string;
  marketId: string;
  asset: string;
  tokenType: string;
  startTime: number;
  endTime: number;
  startPrice: number;
  settled: boolean;
  onChainStatus: string;
  winningOutcome?: number;
  onChainResolved?: boolean;
}> {
  const rounds: Array<{
    id: string;
    marketId: string;
    asset: string;
    tokenType: string;
    startTime: number;
    endTime: number;
    startPrice: number;
    settled: boolean;
    onChainStatus: string;
    winningOutcome?: number;
    onChainResolved?: boolean;
  }> = [];

  for (const [key, round] of activeRounds) {
    let status = 'active';
    if (round.onChainResolved) status = 'settled';
    else if (round.settled) status = 'resolved';
    rounds.push({
      id: key,
      marketId: round.marketId,
      asset: round.asset,
      tokenType: round.tokenType,
      startTime: round.startTime,
      endTime: round.endTime,
      startPrice: round.startPrice,
      settled: round.settled,
      onChainStatus: status,
      winningOutcome: round.winningOutcome,
      onChainResolved: round.onChainResolved,
    });
  }

  return rounds.sort((a, b) => b.startTime - a.startTime);
}

/**
 * Initialize on startup — assign markets to current + next round.
 * Replaces initSeedLightningRounds.
 */
export function initSeedLightningRounds(): void {
  assignRoundMarkets();
}

/**
 * Admin manual resolve — calls flash_settle on-chain for a specific market+outcome.
 * Automatically creates a replacement market so rounds continue seamlessly.
 * Returns txId on success, null on failure.
 */
export async function adminResolveMarket(
  marketId: string,
  winningOutcome: number,
  tokenType?: string,
): Promise<{ txId: string | null; replacementTxId?: string | null; error?: string }> {
  if (winningOutcome !== 1 && winningOutcome !== 2) {
    return { txId: null, error: 'winningOutcome must be 1 (UP) or 2 (DOWN)' };
  }

  // Find which asset this market serves (for replacement creation)
  let resolvedAsset: 'BTC' | 'ETH' | 'ALEO' | null = null;
  let resolvedToken: 'ALEO' | 'USDCX' | 'USAD' = 'ALEO';
  for (const [, round] of activeRounds) {
    if (round.marketId === marketId) {
      resolvedAsset = round.asset;
      resolvedToken = round.tokenType;
      break;
    }
  }

  console.log(`[LightningMgr] Admin resolving market=${marketId.slice(0, 20)}... outcome=${winningOutcome} token=${tokenType || 'ALEO'}`);

  const txId = await dispatchSettle(marketId, winningOutcome, tokenType);

  if (!txId) {
    return { txId: null, error: 'flash_settle dispatch failed' };
  }

  // Mark all rounds using this market as on-chain resolved
  for (const [, round] of activeRounds) {
    if (round.marketId === marketId) {
      round.onChainResolved = true;
    }
  }
  console.log(`[LightningMgr] Admin resolve success tx=${txId}`);

  // Auto-create replacement market in the background
  let replacementTxId: string | null = null;
  if (resolvedAsset) {
    replacementTxId = await createReplacementMarket(resolvedAsset, resolvedToken);
  }

  return { txId, replacementTxId };
}

/**
 * Create a replacement lightning market after resolving the old one.
 * Uses the same question format so getSeedLightningId() will find it.
 */
async function createReplacementMarket(
  asset: 'BTC' | 'ETH' | 'ALEO',
  tokenType: 'ALEO' | 'USDCX' | 'USAD',
): Promise<string | null> {
  const resolver = getResolverAddress();
  if (!resolver) {
    console.error('[LightningMgr] No resolver address, cannot create replacement market');
    return null;
  }

  const question = `${asset} Lightning Round`;
  // Same hash algorithm as frontend CreateLightningForm
  const questionHash = `${BigInt(Array.from(new TextEncoder().encode(question)).reduce((h, b) => h * 31n + BigInt(b), 0n)) % BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001')}field`;

  const currentBlock = await fetchCurrentBlock();
  if (currentBlock <= 0) {
    console.error('[LightningMgr] Cannot fetch block height for replacement market');
    return null;
  }

  const deadline = currentBlock + 1_000_000; // Far future — lightning markets don't use deadline
  const resolutionDeadline = deadline + 2880;
  const initialLiquidity = 5_000_000; // 5 ALEO/USDCX/USAD
  const nonce = `${BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))}field`;

  console.log(`[LightningMgr] Creating replacement ${asset}-${tokenType} market...`);

  const txId = await dispatchCreateMarket(
    questionHash, 1, 2,
    deadline, resolutionDeadline,
    resolver, initialLiquidity, nonce,
    tokenType === 'ALEO' ? undefined : tokenType,
  );

  if (txId) {
    console.log(`[LightningMgr] Replacement market created tx=${txId}. Scanner will index it.`);
    // Pre-register metadata so scanner recognizes it as lightning
    registerMarket(txId, {
      questionHash,
      question,
      outcomes: ['Up', 'Down'],
      isLightning: true,
      tokenType,
    });
    persistRegistry();
  } else {
    console.error(`[LightningMgr] Failed to create replacement ${asset}-${tokenType} market`);
  }

  return txId;
}

/**
 * Get all unique markets currently in use for admin dashboard.
 */
export function getActiveMarkets(): Array<{
  marketId: string;
  asset: string;
  tokenType: string;
  roundCount: number;
  betsCount: number;
  onChainResolved: boolean;
}> {
  const marketMap = new Map<string, { asset: string; tokenType: string; roundCount: number; betsCount: number; onChainResolved: boolean }>();
  for (const [key, round] of activeRounds) {
    const existing = marketMap.get(round.marketId);
    const hasBets = roundsWithBets.has(key);
    if (existing) {
      existing.roundCount++;
      if (hasBets) existing.betsCount++;
      if (round.onChainResolved) existing.onChainResolved = true;
    } else {
      marketMap.set(round.marketId, {
        asset: round.asset,
        tokenType: round.tokenType,
        roundCount: 1,
        betsCount: hasBets ? 1 : 0,
        onChainResolved: round.onChainResolved ?? false,
      });
    }
  }
  return Array.from(marketMap.entries()).map(([marketId, info]) => ({ marketId, ...info }));
}
