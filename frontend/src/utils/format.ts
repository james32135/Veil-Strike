import { PRECISION } from '@/constants';

/**
 * Format microcredits to ALEO with precision.
 */
export function formatAleo(microcredits: number, decimals = 2): string {
  const aleo = microcredits / PRECISION;
  return aleo.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a price (0-1_000_000 range) as percentage.
 */
export function formatPrice(price: number): string {
  const pct = (price / PRECISION) * 100;
  return `${pct.toFixed(1)}%`;
}

/**
 * Format a USD value.
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format large numbers with K/M/B suffixes.
 */
export function formatCompact(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Format a timestamp to relative time.
 */
export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

/**
 * Format a date from timestamp.
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Truncate an Aleo address for display.
 */
export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Parse ALEO input to microcredits.
 */
export function parseAleoInput(input: string): number {
  const num = parseFloat(input);
  if (isNaN(num) || num < 0) return 0;
  return Math.floor(num * PRECISION);
}
