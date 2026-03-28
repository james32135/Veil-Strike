// Strike Round Manager — tracks lightning/strike-round markets for admin resolution.
// Markets are created with durations (24h, 48h, 7d, 30d). Admin manually resolves via flash_settle.
// Oracle provides start price at creation and end price at resolution for UP/DOWN determination.

import { getCachedPrices } from './oracle';
import { registerMarket, getCachedMarkets, persistRegistry } from './indexer';
import { dispatchSettle, dispatchCreateMarket } from './proof-dispatcher';
import { getResolverAddress, fetchCurrentBlock } from './chain-executor';

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
  winningOutcome?: number; // 1 = UP, 2 = DOWN
  endPrice?: number;
  onChainResolved?: boolean;
}

const activeRounds = new Map<string, ActiveRound>();

function getAssetPrice(asset: 'BTC' | 'ETH' | 'ALEO'): number {
  const prices = getCachedPrices();
  return prices[asset.toLowerCase() as 'btc' | 'eth' | 'aleo'] || 0;
}

/**
 * Register a strike round market for tracking.
 * Called when a new strike round market is indexed from chain.
 */
export function registerStrikeRound(marketId: string, asset: 'BTC' | 'ETH' | 'ALEO', tokenType: 'ALEO' | 'USDCX' | 'USAD', startPrice: number, endTime: number): void {
  const key = `${asset}-${tokenType}-${marketId.slice(0, 16)}`;
  if (activeRounds.has(key)) return;
  activeRounds.set(key, {
    marketId,
    asset,
    tokenType,
    startTime: Date.now(),
    endTime,
    startPrice,
    settled: false,
  });
  console.log(`[StrikeRoundMgr] Registered ${key} price=$${startPrice}`);
}

/**
 * Get the market assignment data for API responses.
 */
export function getMarketAssignments(): Map<string, { marketId: string; tokenType: string; onChainStatus: string }> {
  const assignments = new Map<string, { marketId: string; tokenType: string; onChainStatus: string }>();
  for (const [key, round] of activeRounds) {
    let status = 'active';
    if (round.onChainResolved) status = 'settled';
    else if (round.settled) status = 'resolved';
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
 * Initialize on startup — seed active rounds from existing lightning markets in cache.
 */
export function initSeedLightningRounds(): void {
  const markets = getCachedMarkets();
  for (const market of markets) {
    if (!market.isLightning || market.status === 'resolved' || market.status === 'cancelled') continue;
    const q = market.question.toUpperCase();
    let asset: 'BTC' | 'ETH' | 'ALEO' | null = null;
    if (q.includes('BTC') || q.includes('BITCOIN')) asset = 'BTC';
    else if (q.includes('ETH') || q.includes('ETHEREUM')) asset = 'ETH';
    else if (q.includes('ALEO')) asset = 'ALEO';
    if (!asset) continue;

    const token = (market.tokenType || 'ALEO') as 'ALEO' | 'USDCX' | 'USAD';
    const key = `${asset}-${token}-${market.id.slice(0, 16)}`;
    if (activeRounds.has(key)) continue;

    const price = getAssetPrice(asset);
    activeRounds.set(key, {
      marketId: market.id,
      asset,
      tokenType: token,
      startTime: market.createdAt || Date.now(),
      endTime: market.endTime || Date.now() + 86400000,
      startPrice: price > 0 ? price : 0,
      settled: false,
    });
  }
  console.log(`[StrikeRoundMgr] Seeded ${activeRounds.size} active rounds`);
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

  console.log(`[StrikeRoundMgr] Admin resolving market=${marketId.slice(0, 20)}... outcome=${winningOutcome} token=${tokenType || 'ALEO'}`);

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
  console.log(`[StrikeRoundMgr] Admin resolve success tx=${txId}`);

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

  const question = `${asset} Strike Round`;
  // Same hash algorithm as frontend CreateLightningForm
  const questionHash = `${BigInt(Array.from(new TextEncoder().encode(question)).reduce((h, b) => h * 31n + BigInt(b), 0n)) % BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001')}field`;

  const currentBlock = await fetchCurrentBlock();
  if (currentBlock <= 0) {
    console.error('[LightningMgr] Cannot fetch block height for replacement market');
    return null;
  }

  const ACTUAL_BLOCK_TIME_S = 5;
  const deadline = currentBlock + Math.ceil(15 * 60 / ACTUAL_BLOCK_TIME_S) + 30;
  const resolutionDeadline = deadline + 2880;
  const initialLiquidity = 5_000_000; // 5 ALEO/USDCX/USAD
  const nonce = `${BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))}field`;

  console.log(`[StrikeRoundMgr] Creating replacement ${asset}-${tokenType} market...`);

  const txId = await dispatchCreateMarket(
    questionHash, 1, 2,
    deadline, resolutionDeadline,
    resolver, initialLiquidity, nonce,
    tokenType === 'ALEO' ? undefined : tokenType,
  );

  if (txId) {
    console.log(`[StrikeRoundMgr] Replacement market created tx=${txId}. Scanner will index it.`);
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
    console.error(`[StrikeRoundMgr] Failed to create replacement ${asset}-${tokenType} market`);
  }

  return txId;
}

/**
 * Create a replacement lightning market for a given resolved marketId.
 * Called by the admin route after wallet-based flash_settle.
 * Determines asset from the market's question text in the registry.
 */
export async function adminCreateReplacement(
  marketId: string,
  tokenType: 'ALEO' | 'USDCX' | 'USAD' = 'ALEO',
): Promise<string | null> {
  // Determine asset from active rounds or market cache
  let asset: 'BTC' | 'ETH' | 'ALEO' | null = null;

  // Check active rounds first
  for (const [, round] of activeRounds) {
    if (round.marketId === marketId) {
      asset = round.asset;
      break;
    }
  }

  // Fallback: check market cache
  if (!asset) {
    const markets = getCachedMarkets();
    const market = markets.find((m) => m.id === marketId);
    if (market) {
      const q = market.question.toUpperCase();
      if (q.includes('BTC') || q.includes('BITCOIN')) asset = 'BTC';
      else if (q.includes('ETH') || q.includes('ETHEREUM')) asset = 'ETH';
      else if (q.includes('ALEO')) asset = 'ALEO';
    }
  }

  if (!asset) {
    console.error(`[StrikeRoundMgr] Cannot determine asset for market ${marketId.slice(0, 20)}...`);
    return null;
  }

  // Mark rounds using this market as on-chain resolved
  for (const [, round] of activeRounds) {
    if (round.marketId === marketId) {
      round.onChainResolved = true;
    }
  }

  return createReplacementMarket(asset, tokenType);
}

/**
 * Get all unique markets currently in use for admin dashboard.
 */
export function getActiveMarkets(): Array<{
  marketId: string;
  asset: string;
  tokenType: string;
  roundCount: number;
  onChainResolved: boolean;
}> {
  const marketMap = new Map<string, { asset: string; tokenType: string; roundCount: number; onChainResolved: boolean }>();
  for (const [key, round] of activeRounds) {
    const existing = marketMap.get(round.marketId);
    if (existing) {
      existing.roundCount++;
      if (round.onChainResolved) existing.onChainResolved = true;
    } else {
      marketMap.set(round.marketId, {
        asset: round.asset,
        tokenType: round.tokenType,
        roundCount: 1,
        onChainResolved: round.onChainResolved ?? false,
      });
    }
  }
  return Array.from(marketMap.entries()).map(([marketId, info]) => ({ marketId, ...info }));
}
