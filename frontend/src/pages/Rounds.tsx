import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOracleStore } from '@/stores/oracleStore';
import { useMarketStore } from '@/stores/marketStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { ActiveRounds, LightningHistory } from '@/components/lightning';
import PageHeader from '@/components/layout/PageHeader';
import LivePriceChart from '@/components/charts/LivePriceChart';
import CryptoIcon from '@/components/shared/CryptoIcon';
import { API_BASE, CHART_COLORS } from '@/constants';

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

/* ─── asset config ──────────────────────────────────────────────────── */
const ASSETS = [
  { key: 'BTC' as const, label: 'Bitcoin', color: '#F59E0B', textClass: 'text-amber-400', bgGlow: 'rgba(245,158,11,0.12)' },
  { key: 'ETH' as const, label: 'Ethereum', color: '#60A5FA', textClass: 'text-blue-400', bgGlow: 'rgba(96,165,250,0.12)' },
  { key: 'ALEO' as const, label: 'ALEO', color: '#00D4B8', textClass: 'text-teal', bgGlow: 'rgba(0,212,184,0.12)' },
] as const;

/* ─── Mini price card for 3-column header ────────────────────────── */
function PriceCard({ asset, price, prevPrice }: { asset: typeof ASSETS[number]; price: number; prevPrice: number | null }) {
  const delta = prevPrice && prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
  const isUp = delta >= 0;
  const isLoading = price === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-dark-400/50 backdrop-blur-sm p-4"
      style={{ boxShadow: `0 0 40px -12px ${asset.bgGlow}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <CryptoIcon symbol={asset.key} size={28} />
          <div>
            <h3 className={`text-sm font-heading font-bold ${asset.textClass}`}>{asset.label}</h3>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{asset.key}/USD</span>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isUp ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}%
        </div>
      </div>
      <div className="font-mono text-2xl font-bold text-white tabular-nums">
        {isLoading ? (
          <span className="inline-block w-32 h-7 rounded bg-white/[0.06] animate-pulse" />
        ) : (
          `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        )}
      </div>
      {/* Glow accent */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl" style={{ background: asset.color }} />
    </motion.div>
  );
}

/* ─── Countdown ring ─────────────────────────────────────────────── */
function CountdownRing({ secondsLeft, totalSeconds, color }: { secondsLeft: number; totalSeconds: number; color: string }) {
  const pct = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" className="absolute -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <div className="text-center">
        <span className="text-lg font-mono font-bold text-white tabular-nums">
          {mins}:{secs.toString().padStart(2, '0')}
        </span>
        <span className="block text-[9px] text-gray-500 uppercase tracking-wider">remaining</span>
      </div>
    </div>
  );
}

/* ─── Live status badge ──────────────────────────────────────────── */
function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span className="text-[10px] font-heading uppercase tracking-widest text-green-400/80">Live</span>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────── */
export default function Rounds() {
  const { prices, fetchPrices, connectSSE, disconnectSSE } = useOracleStore();
  const { fetchMarkets, markets } = useMarketStore();
  const resolveBets = useLightningBetStore((s) => s.resolveBets);
  const expireStaleBets = useLightningBetStore((s) => s.expireStaleBets);
  const bets = useLightningBetStore((s) => s.bets);
  const [allRounds, setAllRounds] = useState<StrikeRound[]>([]);
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [priceHistory, setPriceHistory] = useState<Record<string, { time: number; price: number }[]>>({});
  const [activeTab, setActiveTab] = useState<'rounds' | 'history'>('rounds');

  // Fetch price history for charts
  const fetchHistory = useCallback(async () => {
    for (const a of ['btc', 'eth', 'aleo']) {
      try {
        const res = await fetch(`${API_BASE}/oracle/history?asset=${a}`);
        if (res.ok) {
          const data = await res.json();
          setPriceHistory((prev) => ({ ...prev, [a]: data.history || [] }));
        }
      } catch { /* ignore */ }
    }
  }, []);

  const fetchAllRounds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/lightning`);
      if (res.ok) {
        const data = await res.json();
        setAllRounds(data.rounds || []);
      }
    } catch { /* ignore */ }
  }, []);

  // Track previous prices for delta calculation
  useEffect(() => {
    setPrevPrices((prev) => ({
      btc: prev.btc || prices.btc,
      eth: prev.eth || prices.eth,
      aleo: prev.aleo || prices.aleo,
    }));
  }, [prices]);

  useEffect(() => {
    // Initial fetches
    fetchPrices();
    fetchAllRounds();
    fetchHistory();
    fetchMarkets();

    // Connect SSE for real-time prices
    connectSSE();

    const marketInterval = setInterval(fetchMarkets, 10_000);
    const roundInterval = setInterval(fetchAllRounds, 8_000);
    const historyInterval = setInterval(fetchHistory, 30_000);

    return () => {
      disconnectSSE();
      clearInterval(marketInterval);
      clearInterval(roundInterval);
      clearInterval(historyInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expire stale PENDING bets on mount only
  useEffect(() => {
    expireStaleBets(2 * 60 * 60 * 1000);
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

  // Count active rounds from market store (consistent with ActiveRounds component)
  const totalActive = useMemo(() => {
    return markets.filter((m) => m.isLightning && m.status === 'active' && m.question.toLowerCase().includes('strike round')).length;
  }, [markets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-white">
              ⚡ Strike Rounds
            </h1>
            <LiveBadge />
          </div>
          <p className="text-sm text-gray-400">
            5-minute price prediction rounds — pick UP or DOWN, win when you're right
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-dark-400/60 border border-white/[0.06]">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Active Rounds</span>
            <span className="ml-2 text-sm font-mono font-bold text-white">{totalActive}</span>
          </div>
        </div>
      </div>

      {/* 3-column price cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ASSETS.map((a) => (
          <PriceCard
            key={a.key}
            asset={a}
            price={prices[a.key.toLowerCase() as keyof typeof prices] as number}
            prevPrice={prevPrices[a.key.toLowerCase()] ?? null}
          />
        ))}
      </div>

      {/* 3-column mini charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ASSETS.map((a) => (
          <div key={a.key} className="rounded-2xl border border-white/[0.06] bg-dark-400/30 overflow-hidden">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CryptoIcon symbol={a.key} size={18} />
                <span className={`text-xs font-heading font-semibold ${a.textClass}`}>{a.key}/USD</span>
              </div>
              <span className="text-[10px] text-gray-500">5m chart</span>
            </div>
            <LivePriceChart
              data={priceHistory[a.key.toLowerCase()] || []}
              asset={a.key}
              color={a.color}
              height={160}
              showTicker
            />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-dark-400/40 rounded-xl p-1 w-fit">
        {(['rounds', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-heading font-semibold uppercase tracking-wider transition-all duration-200 ${
              activeTab === tab
                ? 'bg-teal/15 text-teal border border-teal/20'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'rounds' ? `Active Rounds (${totalActive})` : 'History'}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'rounds' ? (
          <motion.div
            key="rounds"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <ActiveRounds markets={[]} />
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <LightningHistory markets={[]} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
