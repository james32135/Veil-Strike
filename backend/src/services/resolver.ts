import { fetchMarketsFromChain, setCachedMarkets } from './indexer';

export async function resolveExpiredMarkets(): Promise<void> {
  // Re-fetch from chain to get the latest on-chain status.
  // Resolution happens on-chain via admin calling resolve_market/finalize_resolution.
  try {
    const markets = await fetchMarketsFromChain();
    setCachedMarkets(markets);
    const resolved = markets.filter((m) => m.status === 'resolved' || m.status === 'pending_resolution').length;
    if (resolved > 0) {
      console.log(`[Resolver] ${resolved} markets resolved/pending_resolution on chain`);
    }
  } catch (err) {
    console.error('[Resolver] Failed to refresh markets:', err);
  }
}
