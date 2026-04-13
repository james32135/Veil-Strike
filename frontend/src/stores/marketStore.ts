import { create } from 'zustand';
import type { Market, MarketSortBy } from '@/types';
import { fetchRealMarkets } from '@/utils/marketApi';
import { subscribeSSE } from '@/utils/sse';
import type { TokenFilter } from '@/components/market/MarketFilters';

interface MarketState {
  markets: Market[];
  loading: boolean;
  selectedCategory: string;
  sortBy: MarketSortBy;
  searchQuery: string;
  selectedToken: TokenFilter;
  fetchMarkets: () => Promise<void>;
  optimisticBetUpdate: (marketId: string, outcomeIndex: number, amount: number, shares: number, mode: 'buy' | 'sell') => void;
  setCategory: (category: string) => void;
  setSortBy: (sortBy: MarketSortBy) => void;
  setSearchQuery: (query: string) => void;
  setSelectedToken: (token: TokenFilter) => void;
  getFilteredMarkets: () => Market[];
}

// SSE subscription singleton — set up once
let sseInitialized = false;

/**
 * Merge fresh market data with previous cache.
 * Keeps active/pending markets that were in the old set but missing from
 * the new set (Aleo API flakiness can drop markets from partial responses).
 */
function mergeMarkets(prev: Market[], fresh: Market[]): Market[] {
  if (prev.length === 0) return fresh;
  if (fresh.length === 0) return prev;
  const freshIds = new Set(fresh.map((m) => m.id));
  const preserved = prev.filter(
    (m) => !freshIds.has(m.id) && (m.status === 'active' || m.status === 'pending_resolution'),
  );
  return [...fresh, ...preserved];
}

export const useMarketStore = create<MarketState>((set, get) => ({
  markets: [],
  loading: false,
  selectedCategory: 'All',
  sortBy: 'volume',
  searchQuery: '',
  selectedToken: 'All',

  fetchMarkets: async () => {
    // Only show loading spinner on first fetch; background polls are silent
    const isFirstLoad = get().markets.length === 0;
    if (isFirstLoad) set({ loading: true });
    try {
      const fresh = await fetchRealMarkets();
      // Merge: never drop active/pending markets that the backend omitted
      // (Aleo API can return partial results under load)
      const prev = get().markets;
      const merged = mergeMarkets(prev, fresh);
      set({ markets: merged, loading: false });
    } catch {
      if (isFirstLoad) set({ loading: false });
    }

    // Subscribe to SSE for real-time updates (once)
    if (!sseInitialized) {
      sseInitialized = true;
      subscribeSSE('markets', (data) => {
        if (Array.isArray(data)) {
          const prev = get().markets;
          const merged = mergeMarkets(prev, data as Market[]);
          set({ markets: merged });
        }
      });
    }
  },

  optimisticBetUpdate: (marketId, outcomeIndex, amount, shares, mode) => {
    const prev = get().markets;
    const updated = prev.map((m) => {
      if (m.id !== marketId) return m;
      const newReserves = [...m.reserves];
      if (mode === 'buy') {
        // After buy: outcome reserve decreases by shares, others increase by net amount
        const feeAmount = Math.floor(amount * 0.01); // ~1% total fees
        const net = amount - feeAmount;
        for (let i = 0; i < newReserves.length; i++) {
          if (i === outcomeIndex) {
            newReserves[i] = Math.max(1, newReserves[i] - shares);
          } else {
            newReserves[i] = newReserves[i] + net;
          }
        }
      } else {
        // After sell: outcome reserve increases, others decrease
        for (let i = 0; i < newReserves.length; i++) {
          if (i === outcomeIndex) {
            newReserves[i] = newReserves[i] + shares;
          } else {
            newReserves[i] = Math.max(1, newReserves[i] - amount);
          }
        }
      }
      return {
        ...m,
        reserves: newReserves,
        totalVolume: m.totalVolume + amount,
        tradeCount: m.tradeCount + 1,
        totalLiquidity: mode === 'buy' ? m.totalLiquidity + amount : m.totalLiquidity - amount,
      };
    });
    set({ markets: updated });
  },

  setCategory: (category) => set({ selectedCategory: category }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedToken: (token) => set({ selectedToken: token }),

  getFilteredMarkets: () => {
    const { markets, selectedCategory, sortBy, searchQuery, selectedToken } = get();

    // Hide resolved, cancelled, lightning/strike-round markets, and placeholder scanner artifacts
    let filtered = markets.filter(
      (m) => m.status !== 'resolved' && m.status !== 'cancelled' && !m.isLightning && !/^Market \d{5,}\.\.\./.test(m.question),
    );

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) => m.question.toLowerCase().includes(q)
      );
    }

    if (selectedToken !== 'All') {
      filtered = filtered.filter((m) => (m.tokenType || 'ALEO') === selectedToken);
    }

    switch (sortBy) {
      case 'volume':
        filtered.sort((a, b) => b.totalVolume - a.totalVolume);
        break;
      case 'liquidity':
        filtered.sort((a, b) => b.totalLiquidity - a.totalLiquidity);
        break;
      case 'newest':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'ending':
        filtered.sort((a, b) => a.endTime - b.endTime);
        break;
    }

    return filtered;
  },
}));
