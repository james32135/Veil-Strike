import { useEffect, useState, useCallback } from 'react';
import { useOracleStore } from '@/stores/oracleStore';
import { useMarketStore } from '@/stores/marketStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { ActiveRounds, LightningHistory } from '@/components/lightning';
import PageHeader from '@/components/layout/PageHeader';
import { API_BASE } from '@/constants';

interface StrikeRound {
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

export default function Rounds() {
  const { fetchPrices } = useOracleStore();
  const { fetchMarkets, markets } = useMarketStore();
  const resolveBets = useLightningBetStore((s) => s.resolveBets);
  const expireStaleBets = useLightningBetStore((s) => s.expireStaleBets);
  const bets = useLightningBetStore((s) => s.bets);
  const [allRounds, setAllRounds] = useState<StrikeRound[]>([]);

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
    const priceInterval = setInterval(fetchPrices, 15_000);
    const marketInterval = setInterval(fetchMarkets, 15_000);
    const roundInterval = setInterval(fetchAllRounds, 15_000);
    return () => {
      clearInterval(priceInterval);
      clearInterval(marketInterval);
      clearInterval(roundInterval);
    };
  }, [fetchPrices, fetchMarkets, fetchAllRounds, markets.length]);

  // Expire stale PENDING bets on mount only
  useEffect(() => {
    expireStaleBets(30 * 60 * 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resolve bets when markets resolve
  useEffect(() => {
    const pendingBets = bets.filter((b) => !b.result);
    if (pendingBets.length === 0) return;

    for (const bet of pendingBets) {
      const market = markets.find((m) => m.id === bet.roundId || m.id === bet.marketId);
      if (market && market.status === 'resolved' && market.resolvedOutcome !== undefined) {
        const result = market.resolvedOutcome === 0 ? 'up' : 'down';
        const endPrice = bet.startPrice;
        resolveBets(bet.roundId, result as 'up' | 'down', endPrice);
      }
    }

    for (const round of allRounds) {
      if (round.status === 'resolved' && round.result && round.endPrice) {
        const hasPending = pendingBets.some((b) => b.roundId === round.id);
        if (hasPending) {
          resolveBets(round.id, round.result, round.endPrice);
        }
      }
    }
  }, [allRounds, bets, markets, resolveBets]);

  return (
    <div>
      <PageHeader
        title="Strike Rounds"
        subtitle="Price prediction markets — pick a direction, win when you're right"
        action={{ label: '+ Create Round', href: '/create' }}
      />

      {/* Full-width rounds grid — no sidebar */}
      <div className="space-y-8">
        <ActiveRounds markets={[]} />
        <LightningHistory markets={[]} />
      </div>
    </div>
  );
}
