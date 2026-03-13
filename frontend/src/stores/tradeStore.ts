import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TradeHistoryEntry } from '@/types';

interface TradeState {
  trades: TradeHistoryEntry[];
  addTrade: (trade: TradeHistoryEntry) => void;
  getTradesForMarket: (marketId: string) => TradeHistoryEntry[];
}

export const useTradeStore = create<TradeState>()(
  persist(
    (set, get) => ({
      trades: [],

      addTrade: (trade) => {
        set((state) => ({ trades: [trade, ...state.trades].slice(0, 500) }));
      },

      getTradesForMarket: (marketId) => {
        return get().trades.filter((t) => t.marketId === marketId);
      },
    }),
    { name: 'veil-trades' }
  )
);
