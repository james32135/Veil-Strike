import { create } from 'zustand';
import type { Market, MarketSortBy } from '@/types';
import { fetchRealMarkets } from '@/utils/mockData';

interface MarketState {
  markets: Market[];
  loading: boolean;
  selectedCategory: string;
  sortBy: MarketSortBy;
  searchQuery: string;
  fetchMarkets: () => Promise<void>;
  setCategory: (category: string) => void;
  setSortBy: (sortBy: MarketSortBy) => void;
  setSearchQuery: (query: string) => void;
  getFilteredMarkets: () => Market[];
}

export const useMarketStore = create<MarketState>((set, get) => ({
  markets: [],
  loading: false,
  selectedCategory: 'All',
  sortBy: 'volume',
  searchQuery: '',

  fetchMarkets: async () => {
    set({ loading: true });
    try {
      const markets = await fetchRealMarkets();
      set({ markets, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setCategory: (category) => set({ selectedCategory: category }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  getFilteredMarkets: () => {
    const { markets, selectedCategory, sortBy, searchQuery } = get();

    let filtered = [...markets];

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) => m.question.toLowerCase().includes(q)
      );
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
