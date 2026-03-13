import { create } from 'zustand';
import type { SharePosition, LPReceipt, TradeHistoryEntry } from '@/types';

interface PortfolioState {
  positions: SharePosition[];
  lpReceipts: LPReceipt[];
  tradeHistory: TradeHistoryEntry[];
  totalPnL: number;
  loading: boolean;
  fetchPortfolio: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  positions: [],
  lpReceipts: [],
  tradeHistory: [],
  totalPnL: 0,
  loading: false,

  fetchPortfolio: async () => {
    set({ loading: true });
    try {
      // Wallet records are private - decoded from user's wallet via Shield/Leo SDK
      // Positions and LP receipts will be populated when user connects wallet
      // and decrypts their on-chain records
      set({
        positions: [],
        lpReceipts: [],
        tradeHistory: [],
        totalPnL: 0,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
}));
