import { getCachedMarkets, setCachedMarkets } from './indexer';
import type { MarketInfo } from '../types';

export async function resolveExpiredMarkets(): Promise<void> {
  const markets = getCachedMarkets();
  const now = Date.now();
  let updated = false;

  const resolved = markets.map((market) => {
    if (market.status === 'active' && market.endTime <= now) {
      updated = true;
      console.log(`[Resolver] Market ${market.id} expired, marking as resolved`);
      return {
        ...market,
        status: 'resolved' as const,
        resolvedOutcome: market.reserves[0] > market.reserves[1] ? 0 : 1,
      };
    }
    return market;
  });

  if (updated) {
    setCachedMarkets(resolved);
  }
}
