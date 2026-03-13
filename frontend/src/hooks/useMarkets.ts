import { useState, useEffect, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';

export function useMarkets() {
  const { markets, loading, fetchMarkets, getFilteredMarkets, selectedCategory, sortBy, searchQuery, setCategory, setSortBy, setSearchQuery } = useMarketStore();

  useEffect(() => {
    if (markets.length === 0) {
      fetchMarkets();
    }
  }, []);

  return {
    markets: getFilteredMarkets(),
    allMarkets: markets,
    loading,
    selectedCategory,
    sortBy,
    searchQuery,
    setCategory,
    setSortBy,
    setSearchQuery,
    refresh: fetchMarkets,
  };
}

export function useMarketById(id: string | undefined) {
  const { markets, fetchMarkets } = useMarketStore();

  useEffect(() => {
    if (markets.length === 0) {
      fetchMarkets();
    }
  }, []);

  const market = markets.find((m) => m.id === id);
  return { market, loading: markets.length === 0 };
}
