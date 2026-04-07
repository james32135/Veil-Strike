import { ReactNode, useMemo } from 'react';
import { AleoWalletProvider, useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { DecryptPermission } from '@provablehq/aleo-wallet-adaptor-core';
import { WalletModalProvider } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { Network } from '@provablehq/aleo-types';
import '@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css';
import { useWalletStore } from '@/stores/walletStore';
import { useEffect } from 'react';

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'veil_strike_v7.aleo';
const PROGRAM_ID_CX = 'veil_strike_v7_cx.aleo';
const PROGRAM_ID_SD = 'veil_strike_v7_sd.aleo';
const NETWORK = import.meta.env.VITE_NETWORK === 'testnet' ? Network.TESTNET : Network.MAINNET;

interface WalletProviderProps {
  children: ReactNode;
}

function WalletSync({ children }: { children: ReactNode }) {
  const { address, connected, connecting } = useWallet();
  const setWalletState = useWalletStore((s) => s.setWalletState);

  useEffect(() => {
    setWalletState({
      connected,
      connecting,
      address: address ?? null,
      publicKey: address ?? null,
    });
  }, [address, connected, connecting, setWalletState]);

  return <>{children}</>;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const wallets = useMemo(() => [new ShieldWalletAdapter()], []);

  return (
    <AleoWalletProvider
      wallets={wallets}
      network={NETWORK}
      autoConnect
      decryptPermission={DecryptPermission.UponRequest}
      programs={[PROGRAM_ID, PROGRAM_ID_CX, PROGRAM_ID_SD, 'credits.aleo', 'usdcx_stablecoin.aleo', 'usad_stablecoin.aleo']}
    >
      <WalletModalProvider>
        <WalletSync>
          {children}
        </WalletSync>
      </WalletModalProvider>
    </AleoWalletProvider>
  );
}
