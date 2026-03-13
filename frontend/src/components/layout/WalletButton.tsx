import { useState } from 'react';
import { WalletIcon } from '@/components/icons';
import { useWalletStore } from '@/stores/walletStore';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useWalletModal } from '@provablehq/aleo-wallet-adaptor-react-ui';

export default function WalletButton() {
  const { connected, address } = useWalletStore();
  const { disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [showMenu, setShowMenu] = useState(false);

  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-dark text-sm font-heading font-semibold rounded-xl hover:bg-teal-400 transition-all duration-200 active:scale-[0.98]"
      >
        <WalletIcon className="w-4 h-4" />
        Connect Wallet
      </button>
    );
  }

  const displayAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : 'Connected';

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-dark-200 border border-dark-400 text-sm font-mono text-teal rounded-xl hover:border-teal/40 transition-all"
      >
        <div className="w-2 h-2 bg-accent-green rounded-full" />
        {displayAddr}
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 mt-2 w-48 py-2 bg-dark-100 border border-dark-300 rounded-xl shadow-xl z-50">
            <button
              onClick={() => {
                navigator.clipboard.writeText(address || '');
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-dark-200/50 transition-colors"
            >
              Copy Address
            </button>
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-accent-red hover:bg-accent-red/10 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
