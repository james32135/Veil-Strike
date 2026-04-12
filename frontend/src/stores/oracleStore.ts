import { create } from 'zustand';
import type { OraclePrices } from '@/types';
import { API_BASE } from '@/constants';

interface OracleState {
  prices: OraclePrices;
  lastUpdated: number | null;
  loading: boolean;
  connected: boolean;
  fetchPrices: () => Promise<void>;
  connectSSE: () => void;
  disconnectSSE: () => void;
}

let sseInstance: EventSource | null = null;

export const useOracleStore = create<OracleState>((set, get) => ({
  prices: {
    btc: 0,
    eth: 0,
    aleo: 0,
    timestamp: 0,
  },
  lastUpdated: null,
  loading: true,
  connected: false,

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

  connectSSE: () => {
    if (sseInstance) return;
    const es = new EventSource(`${API_BASE}/oracle/stream`);
    es.onmessage = (event) => {
      try {
        const prices = JSON.parse(event.data);
        set({ prices, lastUpdated: Date.now(), connected: true });
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      set({ connected: false });
      // Auto-reconnect handled by EventSource
    };
    sseInstance = es;
  },

  disconnectSSE: () => {
    if (sseInstance) {
      sseInstance.close();
      sseInstance = null;
      set({ connected: false });
    }
  },
}));
