import { create } from 'zustand';

const COOLDOWN_MS = 40_000; // 40 seconds between bets

interface BetCooldownState {
  cooldownUntil: number; // timestamp (ms) when cooldown ends
  startCooldown: () => void;
  getRemainingSeconds: () => number;
  isOnCooldown: () => boolean;
}

export const useBetCooldownStore = create<BetCooldownState>()((set, get) => ({
  cooldownUntil: 0,

  startCooldown: () => set({ cooldownUntil: Date.now() + COOLDOWN_MS }),

  getRemainingSeconds: () => {
    const remaining = get().cooldownUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  },

  isOnCooldown: () => Date.now() < get().cooldownUntil,
}));
