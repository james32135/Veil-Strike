import { useState, useCallback } from 'react';

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  className?: string;
  label?: string;
}

export default function RefreshButton({ onRefresh, className = '', label }: RefreshButtonProps) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = useCallback(async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      // Keep spin animation visible for at least 600ms for visual feedback
      setTimeout(() => setSpinning(false), 600);
    }
  }, [onRefresh, spinning]);

  return (
    <button
      onClick={handleClick}
      disabled={spinning}
      title={label ?? 'Refresh'}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all duration-200 disabled:opacity-50 ${className}`}
    >
      <svg
        className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M23 4v6h-6" />
        <path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      {label && <span>{label}</span>}
    </button>
  );
}
