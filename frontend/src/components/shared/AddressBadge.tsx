import { useState as useReactState, useCallback } from 'react';
import { CopyIcon, CheckIcon } from '@/components/icons';

interface AddressBadgeProps {
  address: string;
  truncate?: boolean;
  copyable?: boolean;
}

export default function AddressBadge({ address, truncate = true, copyable = true }: AddressBadgeProps) {
  const [copied, setCopied] = useReactState(false);

  const displayAddr = truncate && address.length > 16
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : address;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-dark-200 border border-dark-400/50 rounded-lg">
      <span className="font-mono text-xs text-gray-300">{displayAddr}</span>
      {copyable && (
        <button onClick={handleCopy} className="text-gray-500 hover:text-teal transition-colors">
          {copied ? <CheckIcon className="w-3 h-3 text-accent-green" /> : <CopyIcon className="w-3 h-3" />}
        </button>
      )}
    </span>
  );
}
