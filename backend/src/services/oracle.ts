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
