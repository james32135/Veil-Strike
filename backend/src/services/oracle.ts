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

async function fetchWithTimeout(url: string, timeoutMs = 10000, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VeilStrike/1.0',
        'Accept': 'application/json',
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** CoinGecko (free, 10-30 req/min) — most reliable for ALEO */
async function fetchFromCoinGecko(): Promise<OraclePrices | null> {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,aleo&vs_currencies=usd';
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

/** Binance via US endpoint (fallback from blocked .com) */
async function fetchFromBinance(): Promise<OraclePrices | null> {
  // Try binance.us first (not geo-blocked), then .com
  const endpoints = [
    'https://api.binance.us/api/v3/ticker/price',
    'https://api.binance.com/api/v3/ticker/price',
  ];
  for (const base of endpoints) {
    try {
      const btcRes = await fetchWithTimeout(`${base}?symbol=BTCUSDT`);
      if (!btcRes.ok) continue;
      const btcData = await btcRes.json() as { price: string };

      const ethRes = await fetchWithTimeout(`${base}?symbol=ETHUSDT`);
      const ethData = ethRes.ok ? (await ethRes.json() as { price: string }) : { price: '0' };

      // ALEO may not exist on Binance
      let aleoPrice = 0;
      try {
        const aleoRes = await fetchWithTimeout(`${base}?symbol=ALEOUSDT`, 5000);
        if (aleoRes.ok) {
          const aleoData = await aleoRes.json() as { price: string };
          aleoPrice = parseFloat(aleoData.price);
        }
      } catch { /* ALEO not listed */ }

      const btc = parseFloat(btcData.price);
      if (!btc || btc <= 0) continue;
      return {
        btc,
        eth: parseFloat(ethData.price) || 0,
        aleo: aleoPrice,
        timestamp: Date.now(),
      };
    } catch { continue; }
  }
  throw new Error('Binance: all endpoints failed');
}

/** CoinCap v3 (free, REST) */
async function fetchFromCoinCap(): Promise<OraclePrices | null> {
  // v2 deprecated, try v3 then v2
  const urls = [
    'https://api.coincap.io/v2/assets?ids=bitcoin,ethereum',
    'https://rest.coincap.io/v3/assets?ids=bitcoin,ethereum',
  ];
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const body = await res.json() as { data: Array<{ id: string; priceUsd: string }> };
      const priceMap: Record<string, number> = {};
      for (const asset of body.data) {
        priceMap[asset.id] = parseFloat(asset.priceUsd);
      }
      if (!priceMap['bitcoin']) continue;
      return {
        btc: priceMap['bitcoin'] || 0,
        eth: priceMap['ethereum'] || 0,
        aleo: 0, // CoinCap doesn't list ALEO
        timestamp: Date.now(),
      };
    } catch { continue; }
  }
  throw new Error('CoinCap: all endpoints failed');
}

/** CryptoCompare — only fetch BTC & ETH (ALEO not supported) */
async function fetchFromCryptoCompare(): Promise<OraclePrices | null> {
  const url = 'https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH&tsyms=USD';
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CryptoCompare HTTP ${res.status}`);
  const data = await res.json() as Record<string, { USD?: number }>;
  if (!data.BTC?.USD) throw new Error('CryptoCompare: missing BTC price');
  return {
    btc: data.BTC.USD,
    eth: data.ETH?.USD || 0,
    aleo: 0, // Not supported
    timestamp: Date.now(),
  };
}

/** KuCoin (free, no key, good availability) */
async function fetchFromKuCoin(): Promise<OraclePrices | null> {
  const btcRes = await fetchWithTimeout('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=BTC-USDT');
  if (!btcRes.ok) throw new Error(`KuCoin HTTP ${btcRes.status}`);
  const btcBody = await btcRes.json() as { data: { price: string } };
  const btc = parseFloat(btcBody.data?.price);
  if (!btc || btc <= 0) throw new Error('KuCoin: missing BTC price');

  const ethRes = await fetchWithTimeout('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=ETH-USDT');
  const ethBody = ethRes.ok ? (await ethRes.json() as { data: { price: string } }) : { data: { price: '0' } };

  let aleoPrice = 0;
  try {
    const aleoRes = await fetchWithTimeout('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=ALEO-USDT', 5000);
    if (aleoRes.ok) {
      const aleoBody = await aleoRes.json() as { data: { price: string } };
      aleoPrice = parseFloat(aleoBody.data?.price) || 0;
    }
  } catch { /* ALEO not listed */ }

  return {
    btc,
    eth: parseFloat(ethBody.data?.price) || 0,
    aleo: aleoPrice,
    timestamp: Date.now(),
  };
}

/** OKX (free, no key, global) */
async function fetchFromOKX(): Promise<OraclePrices | null> {
  const url = 'https://www.okx.com/api/v5/market/tickers?instType=SPOT';
  const res = await fetchWithTimeout(url, 10000);
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
  const body = await res.json() as { data: Array<{ instId: string; last: string }> };
  const priceMap: Record<string, number> = {};
  for (const t of body.data) {
    if (t.instId === 'BTC-USDT') priceMap['btc'] = parseFloat(t.last);
    if (t.instId === 'ETH-USDT') priceMap['eth'] = parseFloat(t.last);
    if (t.instId === 'ALEO-USDT') priceMap['aleo'] = parseFloat(t.last);
  }
  if (!priceMap['btc']) throw new Error('OKX: missing BTC price');
  return {
    btc: priceMap['btc'],
    eth: priceMap['eth'] || 0,
    aleo: priceMap['aleo'] || 0,
    timestamp: Date.now(),
  };
}

/** Gate.io (free, no key, lists ALEO) */
async function fetchFromGateIO(): Promise<OraclePrices | null> {
  const btcRes = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=BTC_USDT');
  if (!btcRes.ok) throw new Error(`Gate.io HTTP ${btcRes.status}`);
  const btcData = await btcRes.json() as Array<{ last: string }>;
  const btc = parseFloat(btcData[0]?.last);
  if (!btc || btc <= 0) throw new Error('Gate.io: missing BTC price');

  const ethRes = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=ETH_USDT');
  const ethData = ethRes.ok ? (await ethRes.json() as Array<{ last: string }>) : [{ last: '0' }];

  let aleoPrice = 0;
  try {
    const aleoRes = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=ALEO_USDT', 5000);
    if (aleoRes.ok) {
      const aleoData = await aleoRes.json() as Array<{ last: string }>;
      aleoPrice = parseFloat(aleoData[0]?.last) || 0;
    }
  } catch { /* ALEO not listed */ }

  return {
    btc,
    eth: parseFloat(ethData[0]?.last) || 0,
    aleo: aleoPrice,
    timestamp: Date.now(),
  };
}

// Ordered: exchanges with ALEO first, then major exchanges, then aggregators
const PRICE_SOURCES: { name: string; fn: () => Promise<OraclePrices | null> }[] = [
  { name: 'CoinGecko', fn: fetchFromCoinGecko },
  { name: 'OKX', fn: fetchFromOKX },
  { name: 'KuCoin', fn: fetchFromKuCoin },
  { name: 'Gate.io', fn: fetchFromGateIO },
  { name: 'Binance', fn: fetchFromBinance },
  { name: 'CoinCap', fn: fetchFromCoinCap },
  { name: 'CryptoCompare', fn: fetchFromCryptoCompare },
];

// Dedicated ALEO price sources (many exchanges don't list ALEO)
const ALEO_SOURCES: { name: string; fn: () => Promise<number> }[] = [
  {
    name: 'CoinGecko-ALEO',
    fn: async () => {
      const res = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=aleo&vs_currencies=usd');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { aleo?: { usd?: number } };
      if (!data.aleo?.usd) throw new Error('no price');
      return data.aleo.usd;
    },
  },
  {
    name: 'Gate.io-ALEO',
    fn: async () => {
      const res = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=ALEO_USDT', 5000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Array<{ last: string }>;
      const p = parseFloat(data[0]?.last);
      if (!p || p <= 0) throw new Error('no price');
      return p;
    },
  },
  {
    name: 'MEXC-ALEO',
    fn: async () => {
      const res = await fetchWithTimeout('https://api.mexc.com/api/v3/ticker/price?symbol=ALEOUSDT', 5000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { price: string };
      const p = parseFloat(data.price);
      if (!p || p <= 0) throw new Error('no price');
      return p;
    },
  },
  {
    name: 'HTX-ALEO',
    fn: async () => {
      const res = await fetchWithTimeout('https://api.huobi.pro/market/detail/merged?symbol=aleousdt', 5000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { tick?: { close: number } };
      const p = data.tick?.close;
      if (!p || p <= 0) throw new Error('no price');
      return p;
    },
  },
];

async function fetchAleoPrice(): Promise<number> {
  for (const source of ALEO_SOURCES) {
    try {
      const price = await source.fn();
      if (price > 0) {
        console.log(`[Oracle] ALEO price via ${source.name}: $${price}`);
        return price;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Oracle] ${source.name} failed: ${msg}`);
    }
  }
  return 0;
}

// ─── Main fetch with fallback chain ─────────────────────────────────────────

export async function fetchOraclePrices(): Promise<OraclePrices> {
  for (const source of PRICE_SOURCES) {
    try {
      const prices = await source.fn();
      if (prices && prices.btc > 0) {
        // If main source doesn't have ALEO, fetch it separately
        if (prices.aleo === 0 || prices.aleo === undefined) {
          prices.aleo = await fetchAleoPrice();
          // Still 0? Use last known value
          if (prices.aleo === 0 && cachedPrices.aleo > 0) {
            prices.aleo = cachedPrices.aleo;
          }
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
    // Keep last 2 hours of data (so older lightning rounds can still resolve bets)
    const cutoff = Date.now() - 120 * 60 * 1000;
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
    // Previous rounds (resolved) — keep 12 rounds (1 hour) so client bets can resolve
    for (let offset = 12; offset >= 1; offset--) {
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
