import { config } from '../config';
import type { OraclePrices } from '../types';

let cachedPrices: OraclePrices = {
  btc: 0,
  eth: 0,
  aleo: 0,
  timestamp: 0,
};

// Track which source last succeeded for logging
let lastSource = 'none';

// ─── Price Source Adapters ───────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** CoinGecko (free, 10-30 req/min) */
async function fetchFromCoinGecko(): Promise<OraclePrices | null> {
  const url = `${config.coingeckoUrl}/simple/price?ids=bitcoin,ethereum,aleo&vs_currencies=usd`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json() as Record<string, { usd?: number }>;
  if (!data.bitcoin?.usd) throw new Error('CoinGecko: missing BTC price');
  return {
    btc: data.bitcoin.usd,
    eth: data.ethereum?.usd || 0,
    aleo: data.aleo?.usd || 0,
    timestamp: Date.now(),
  };
}

/** Binance (free, no key, high rate limit) */
async function fetchFromBinance(): Promise<OraclePrices | null> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'ALEOUSDT'];
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(symbols)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const data = await res.json() as Array<{ symbol: string; price: string }>;
  const priceMap: Record<string, number> = {};
  for (const item of data) {
    priceMap[item.symbol] = parseFloat(item.price);
  }
  if (!priceMap['BTCUSDT']) throw new Error('Binance: missing BTC price');
  return {
    btc: priceMap['BTCUSDT'] || 0,
    eth: priceMap['ETHUSDT'] || 0,
    aleo: priceMap['ALEOUSDT'] || 0,
    timestamp: Date.now(),
  };
}

/** CoinCap v2 (free, 200 req/min, no key) */
async function fetchFromCoinCap(): Promise<OraclePrices | null> {
  const url = 'https://api.coincap.io/v2/assets?ids=bitcoin,ethereum,aleo';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CoinCap HTTP ${res.status}`);
  const body = await res.json() as { data: Array<{ id: string; priceUsd: string }> };
  const priceMap: Record<string, number> = {};
  for (const asset of body.data) {
    priceMap[asset.id] = parseFloat(asset.priceUsd);
  }
  if (!priceMap['bitcoin']) throw new Error('CoinCap: missing BTC price');
  return {
    btc: priceMap['bitcoin'] || 0,
    eth: priceMap['ethereum'] || 0,
    aleo: priceMap['aleo'] || 0,
    timestamp: Date.now(),
  };
}

/** CryptoCompare (free, 100k calls/month, no key needed for basic) */
async function fetchFromCryptoCompare(): Promise<OraclePrices | null> {
  const url = 'https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH,ALEO&tsyms=USD';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CryptoCompare HTTP ${res.status}`);
  const data = await res.json() as Record<string, { USD?: number }>;
  if (!data.BTC?.USD) throw new Error('CryptoCompare: missing BTC price');
  return {
    btc: data.BTC?.USD || 0,
    eth: data.ETH?.USD || 0,
    aleo: data.ALEO?.USD || 0,
    timestamp: Date.now(),
  };
}

// Ordered by reliability & rate limits (Binance first — most generous)
const PRICE_SOURCES: { name: string; fn: () => Promise<OraclePrices | null> }[] = [
  { name: 'Binance', fn: fetchFromBinance },
  { name: 'CoinCap', fn: fetchFromCoinCap },
  { name: 'CryptoCompare', fn: fetchFromCryptoCompare },
  { name: 'CoinGecko', fn: fetchFromCoinGecko },
];

// ─── Main fetch with fallback chain ─────────────────────────────────────────

export async function fetchOraclePrices(): Promise<OraclePrices> {
  for (const source of PRICE_SOURCES) {
    try {
      const prices = await source.fn();
      if (prices && prices.btc > 0) {
        // If a source doesn't list ALEO, keep the last known value
        if (prices.aleo === 0 && cachedPrices.aleo > 0) {
          prices.aleo = cachedPrices.aleo;
        }
        cachedPrices = prices;
        if (lastSource !== source.name) {
          console.log(`[Oracle] Source switched to ${source.name}`);
          lastSource = source.name;
        }
        console.log(`[Oracle] Prices via ${source.name}: BTC=$${prices.btc}, ETH=$${prices.eth}, ALEO=$${prices.aleo}`);
        return cachedPrices;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Oracle] ${source.name} failed: ${msg}`);
    }
  }

  // All sources failed — return stale cache
  console.error('[Oracle] All price sources failed, using stale cache');
  return cachedPrices;
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
    // Two previous rounds (resolved) — ensures bets resolve even if polling was slow
    for (let offset = 2; offset >= 1; offset--) {
      const prevStart = currentRoundStart - ROUND_DURATION * offset;
      const prevEnd = prevStart + ROUND_DURATION;
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
