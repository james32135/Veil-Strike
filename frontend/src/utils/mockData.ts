import type { Market } from '@/types';
import { API_BASE } from '@/constants';

/**
 * Fetch real markets from backend (which reads chain state).
 */
export async function fetchRealMarkets(): Promise<Market[]> {
  const res = await fetch(`${API_BASE}/markets`);
  if (!res.ok) throw new Error('Failed to fetch markets');
  const data = await res.json();
  return (data.markets || []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    question: m.question as string,
    category: m.category as string,
    outcomes: m.outcomes as string[],
    reserves: m.reserves as number[],
    totalLiquidity: m.totalLiquidity as number,
    totalVolume: m.totalVolume as number,
    tradeCount: m.tradeCount as number,
    status: m.status as string,
    endTime: m.endTime as number,
    createdAt: m.createdAt as number,
    isLightning: m.isLightning as boolean,
    resolvedOutcome: m.resolvedOutcome as number | undefined,
    tokenType: (m.tokenType as string) || 'ALEO',
  }));
}
