import { create } from 'zustand';

interface WalletStateData {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  publicKey: string | null;
}

interface WalletState extends WalletStateData {
  balance: number;
  setWalletState: (state: WalletStateData) => void;
  setBalance: (balance: number) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  connected: false,
  address: null,
  publicKey: null,
  balance: 0,
  connecting: false,

  setWalletState: (state) => set(state),
  setBalance: (balance) => set({ balance }),
}));
