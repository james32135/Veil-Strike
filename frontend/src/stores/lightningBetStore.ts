import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LightningBet {
  roundId: string;
  marketId?: string; // Per-round on-chain market ID
  asset: 'BTC' | 'ETH' | 'ALEO';
  direction: 'up' | 'down';
  amount: number; // microcredits
  shares: number;
  timestamp: number;
  startPrice: number;
  tokenType?: 'aleo' | 'usdcx' | 'usad';
  // Filled when round resolves
  endPrice?: number;
  result?: 'up' | 'down';
  won?: boolean;
  payout?: number; // potential payout in microcredits
}

interface LightningBetState {
  bets: LightningBet[];
  addBet: (bet: LightningBet) => void;
  resolveBets: (roundId: string, result: 'up' | 'down', endPrice: number) => void;
  expireStaleBets: (maxAgeMs: number) => void;
  getBetsForRound: (roundId: string) => LightningBet[];
  getRecentBets: (limit?: number) => LightningBet[];
}

export const useLightningBetStore = create<LightningBetState>()(
  persist(
    (set, get) => ({
      bets: [],

      addBet: (bet) => {
        set((state) => ({ bets: [bet, ...state.bets].slice(0, 200) }));
      },

      resolveBets: (roundId, result, endPrice) => {
        set((state) => ({
          bets: state.bets.map((b) => {
            if (b.roundId !== roundId || b.result) return b;
            const won = b.direction === result;
            // If won: payout ≈ shares value (roughly 2x minus fees for 50/50 market)
            // If lost: payout = 0
            return { ...b, result, endPrice, won, payout: won ? b.shares : 0 };
          }),
        }));
      },

      expireStaleBets: (maxAgeMs) => {
        const cutoff = Date.now() - maxAgeMs;
        const hasStale = get().bets.some((b) => !b.result && b.timestamp <= cutoff);
        if (!hasStale) return;
        set((state) => ({
          bets: state.bets.map((b) => {
            if (b.result || b.timestamp > cutoff) return b;
            return { ...b, result: 'down', won: false, payout: 0, endPrice: b.startPrice };
          }),
        }));
      },

      getBetsForRound: (roundId) => {
        return get().bets.filter((b) => b.roundId === roundId);
      },

      getRecentBets: (limit = 20) => {
        return get().bets.slice(0, limit);
      },
    }),
    { name: 'veil-lightning-bets' }
  )
);
