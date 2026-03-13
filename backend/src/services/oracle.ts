import { config } from '../config';
import type { OraclePrices } from '../types';

let cachedPrices: OraclePrices = {
  btc: 0,
  eth: 0,
  aleo: 0,
  timestamp: 0,
};

export async function fetchOraclePrices(): Promise<OraclePrices> {
  try {
    const url = `${config.coingeckoUrl}/simple/price?ids=bitcoin,ethereum,aleo&vs_currencies=usd`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json() as Record<string, { usd?: number }>;

    cachedPrices = {
      btc: data.bitcoin?.usd || cachedPrices.btc,
      eth: data.ethereum?.usd || cachedPrices.eth,
      aleo: data.aleo?.usd || cachedPrices.aleo,
      timestamp: Date.now(),
    };

    console.log(`[Oracle] Prices updated: BTC=$${cachedPrices.btc}, ETH=$${cachedPrices.eth}, ALEO=$${cachedPrices.aleo}`);
    return cachedPrices;
  } catch (err) {
    console.error('[Oracle] Failed to fetch prices:', err);
    return cachedPrices;
  }
}

export function getCachedPrices(): OraclePrices {
  return cachedPrices;
}

// ========== Lightning Rounds ==========
// Deterministic 5-minute rounds based on wall clock time.
// Each round starts at the nearest 5-minute boundary (e.g., 15:00, 15:05, 15:10).
// A round is "open" for the first 4 minutes, "locked" in the last 1 minute,
// then resolves by comparing start vs end price.

export interface LightningRound {
  id: string;
  asset: 'BTC' | 'ETH' | 'ALEO';
  startTime: number;
  lockTime: number;
  endTime: number;
  startPrice: number;
  lockPrice: number | null;
  endPrice: number | null;
  status: 'open' | 'locked' | 'resolved';
  result: 'up' | 'down' | null;
}

const ROUND_DURATION = 5 * 60 * 1000; // 5 minutes
const LOCK_BEFORE = 1 * 60 * 1000; // Lock 1 minute before end
const ASSETS: ('BTC' | 'ETH' | 'ALEO')[] = ['BTC', 'ETH', 'ALEO'];

// Price history: timestamp → prices
const priceHistory: { timestamp: number; btc: number; eth: number; aleo: number }[] = [];

export function recordPriceSnapshot(): void {
  const p = getCachedPrices();
  if (p.btc > 0) {
    priceHistory.push({ timestamp: Date.now(), btc: p.btc, eth: p.eth, aleo: p.aleo });
    // Keep last 30 minutes of data
    const cutoff = Date.now() - 30 * 60 * 1000;
    while (priceHistory.length > 0 && priceHistory[0].timestamp < cutoff) {
      priceHistory.shift();
    }
  }
}

function getPriceAtTime(asset: 'BTC' | 'ETH' | 'ALEO', time: number): number | null {
  const key = asset.toLowerCase() as 'btc' | 'eth' | 'aleo';
  // Find closest snapshot to the requested time
  let closest: typeof priceHistory[0] | null = null;
  let minDiff = Infinity;
  for (const snap of priceHistory) {
    const diff = Math.abs(snap.timestamp - time);
    if (diff < minDiff) {
      minDiff = diff;
      closest = snap;
    }
  }
  // Only use if within 2 minutes of the target
  if (!closest || minDiff > 2 * 60 * 1000) return null;
  return closest[key];
}

function getRoundStart(time: number): number {
  return Math.floor(time / ROUND_DURATION) * ROUND_DURATION;
}

export function getLightningRounds(): LightningRound[] {
  const now = Date.now();
  const currentRoundStart = getRoundStart(now);
  const rounds: LightningRound[] = [];

  for (const asset of ASSETS) {
    // Previous round (resolved or resolving)
    const prevStart = currentRoundStart - ROUND_DURATION;
    const prevEnd = currentRoundStart;
    const prevStartPrice = getPriceAtTime(asset, prevStart);
    const prevEndPrice = getPriceAtTime(asset, prevEnd);
    if (prevStartPrice) {
      const resolved = prevEndPrice !== null;
      rounds.push({
        id: `${asset}-${prevStart}`,
        asset,
        startTime: prevStart,
        lockTime: prevEnd - LOCK_BEFORE,
        endTime: prevEnd,
        startPrice: prevStartPrice,
        lockPrice: getPriceAtTime(asset, prevEnd - LOCK_BEFORE),
        endPrice: prevEndPrice,
        status: resolved ? 'resolved' : 'locked',
        result: resolved ? (prevEndPrice > prevStartPrice ? 'up' : 'down') : null,
      });
    }

    // Current round
    const endTime = currentRoundStart + ROUND_DURATION;
    const lockTime = endTime - LOCK_BEFORE;
    const startPrice = getPriceAtTime(asset, currentRoundStart) ?? getCachedPrices()[asset.toLowerCase() as 'btc' | 'eth' | 'aleo'];
    const isLocked = now >= lockTime;

    rounds.push({
      id: `${asset}-${currentRoundStart}`,
      asset,
      startTime: currentRoundStart,
      lockTime,
      endTime,
      startPrice,
      lockPrice: isLocked ? (getPriceAtTime(asset, lockTime) ?? getCachedPrices()[asset.toLowerCase() as 'btc' | 'eth' | 'aleo']) : null,
      endPrice: null,
      status: isLocked ? 'locked' : 'open',
      result: null,
    });

    // Next round (upcoming)
    const nextStart = currentRoundStart + ROUND_DURATION;
    const nextEnd = nextStart + ROUND_DURATION;
    rounds.push({
      id: `${asset}-${nextStart}`,
      asset,
      startTime: nextStart,
      lockTime: nextEnd - LOCK_BEFORE,
      endTime: nextEnd,
      startPrice: getCachedPrices()[asset.toLowerCase() as 'btc' | 'eth' | 'aleo'],
      lockPrice: null,
      endPrice: null,
      status: 'open',
      result: null,
    });
  }

  return rounds;
}
