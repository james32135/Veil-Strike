import { TokenBTC, TokenETH } from '@web3icons/react';

const LOCAL_ICONS: Record<string, string> = {
  ALEO: '/icons/aleo.png',
  USDCX: '/icons/usdcx.svg',
  USAD: '/icons/USAD.svg',
};

interface CryptoIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export default function CryptoIcon({ symbol, size = 20, className = '' }: CryptoIconProps) {
  const upper = symbol.toUpperCase();

  if (upper === 'BTC' || upper === 'BITCOIN') {
    return <TokenBTC variant="branded" size={size} className={className} />;
  }

  if (upper === 'ETH' || upper === 'ETHEREUM') {
    return <TokenETH variant="branded" size={size} className={className} />;
  }

  const src = LOCAL_ICONS[upper];
  if (src) {
    return (
      <img
        src={src}
        alt={upper}
        width={size}
        height={size}
        className={`inline-block ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallback: colored circle with first letter
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-dark-400 text-[10px] font-bold text-gray-300 ${className}`}
      style={{ width: size, height: size }}
    >
      {upper[0]}
    </span>
  );
}
