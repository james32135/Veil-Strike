import { create } from 'zustand';
import type { Market, MarketSortBy } from '@/types';
import { fetchRealMarkets } from '@/utils/marketApi';
import type { TokenFilter } from '@/components/market/MarketFilters';

interface MarketState {
  markets: Market[];
  loading: boolean;
  selectedCategory: string;
  sortBy: MarketSortBy;
  searchQuery: string;
  selectedToken: TokenFilter;
  fetchMarkets: () => Promise<void>;
  setCategory: (category: string) => void;
  setSortBy: (sortBy: MarketSortBy) => void;
  setSearchQuery: (query: string) => void;
  setSelectedToken: (token: TokenFilter) => void;
  getFilteredMarkets: () => Market[];
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
      const markets = await fetchRealMarkets();
      set({ markets, loading: false });
    } catch {
      if (isFirstLoad) set({ loading: false });
    }
  },

  setCategory: (category) => set({ selectedCategory: category }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedToken: (token) => set({ selectedToken: token }),

  getFilteredMarkets: () => {
    const { markets, selectedCategory, sortBy, searchQuery, selectedToken } = get();

    // Hide resolved & cancelled markets — users browse active/open markets here
    let filtered = markets.filter((m) => m.status !== 'resolved' && m.status !== 'cancelled');

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
