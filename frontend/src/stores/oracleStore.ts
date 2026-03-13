import { create } from 'zustand';
import type { OraclePrices } from '@/types';
import { API_BASE } from '@/constants';

interface OracleState {
  prices: OraclePrices;
  lastUpdated: number | null;
  loading: boolean;
  fetchPrices: () => Promise<void>;
}

export const useOracleStore = create<OracleState>((set) => ({
  prices: {
    btc: 68_000,
    eth: 3_400,
    aleo: 0.5,
    timestamp: Date.now(),
  },
  lastUpdated: Date.now(),
  loading: false,

  fetchPrices: async () => {
    set({ loading: true });
    try {
      const res = await fetch(`${API_BASE}/oracle`);
      if (res.ok) {
        const data = await res.json();
        set({ prices: data.prices, lastUpdated: Date.now(), loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },
}));
