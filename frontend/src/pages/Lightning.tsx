import { useEffect, useState, useCallback } from 'react';
import { useOracleStore } from '@/stores/oracleStore';
import { useMarketStore } from '@/stores/marketStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { ActiveRounds, LightningHistory, OraclePriceFeed } from '@/components/lightning';
import PageHeader from '@/components/layout/PageHeader';
import { API_BASE } from '@/constants';

interface LightningRound {
  id: string;
  asset: 'BTC' | 'ETH' | 'ALEO';
  tokenType?: string;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number | null;
  status: 'open' | 'locked' | 'resolved';
  result: 'up' | 'down' | null;
}

export default function Lightning() {
  const { fetchPrices } = useOracleStore();
  const { fetchMarkets, markets } = useMarketStore();
  const resolveBets = useLightningBetStore((s) => s.resolveBets);
  const bets = useLightningBetStore((s) => s.bets);
  const [allRounds, setAllRounds] = useState<LightningRound[]>([]);

  // Fetch all rounds (including resolved) for bet resolution
  const fetchAllRounds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/lightning`);
      if (res.ok) {
        const data = await res.json();
        setAllRounds(data.rounds || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchPrices();
    fetchAllRounds();
    if (markets.length === 0) fetchMarkets();
    const priceInterval = setInterval(fetchPrices, 30_000);
    const marketInterval = setInterval(fetchMarkets, 30_000);
    const roundInterval = setInterval(fetchAllRounds, 10_000);
    return () => {
      clearInterval(priceInterval);
      clearInterval(marketInterval);
      clearInterval(roundInterval);
    };
  }, [fetchPrices, fetchMarkets, fetchAllRounds, markets.length]);

  // Auto-resolve bets when rounds become resolved
  useEffect(() => {
    const pendingBets = bets.filter((b) => !b.result);
    if (pendingBets.length === 0) return;

    for (const round of allRounds) {
      if (round.status === 'resolved' && round.result && round.endPrice) {
        const hasPending = pendingBets.some((b) => b.roundId === round.id);
        if (hasPending) {
          resolveBets(round.id, round.result, round.endPrice);
        }
      }
    }

    // Fallback: resolve stale bets older than 10 min whose round data is no longer available
    const now = Date.now();
    const resolvedRoundIds = new Set(allRounds.filter((r) => r.status === 'resolved').map((r) => r.id));
    for (const bet of pendingBets) {
      if (now - bet.timestamp > 10 * 60 * 1000 && !resolvedRoundIds.has(bet.roundId)) {
        // Round data expired — mark as lost (we can't determine result)
        resolveBets(bet.roundId, bet.direction === 'up' ? 'down' : 'up', bet.startPrice);
      }
    }
  }, [allRounds, bets, resolveBets]);

  return (
    <div>
      <PageHeader
        title="Lightning Markets"
        subtitle="Fast-resolving prediction markets powered by on-chain oracles"
        action={{ label: '⚡ Create Lightning', href: '/create' }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
        <div className="lg:col-span-3 space-y-6">
          <ActiveRounds markets={[]} />
          <LightningHistory markets={[]} />
        </div>
        <div>
          <OraclePriceFeed />
        </div>
      </div>
    </div>
  );
}
