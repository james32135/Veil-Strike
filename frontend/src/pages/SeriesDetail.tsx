import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSeriesStore } from '@/stores/seriesStore';
import { useOracleStore } from '@/stores/oracleStore';
import { useMarketStore } from '@/stores/marketStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { useBetCooldownStore } from '@/stores/betCooldownStore';
import { useTransaction } from '@/hooks/useTransaction';
import type { ShareRecord } from '@/hooks/useTransaction';
import { useCountdown } from '@/hooks/useCountdown';
import { buildBuySharesPrivateTx, buildBuySharesStableTx, buildRedeemSharesTx, generateNonce } from '@/utils/transactions';
import { getUsdcxProofs } from '@/utils/freezeListProof';
import { estimateBuySharesExact, estimateSellTokensOut, calculateFees } from '@/utils/fpmm';
import { formatUSD, formatAleo } from '@/utils/format';
import LivePriceChart from '@/components/charts/LivePriceChart';
import ProbabilityGauge from '@/components/shared/ProbabilityGauge';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import CryptoIcon from '@/components/shared/CryptoIcon';
import Loading from '@/components/shared/Loading';
import EmptyState from '@/components/shared/EmptyState';
import { BoltIcon, ArrowUpIcon, ArrowDownIcon, ChartIcon } from '@/components/icons';
import { API_BASE } from '@/constants';
import type { Market } from '@/types';

type TokenType = 'aleo' | 'usdcx' | 'usad';

const assetColors: Record<string, string> = {
  BTC: 'text-amber-400',
  ETH: 'text-blue-400',
  ALEO: 'text-teal',
};

const AMOUNT_PRESETS = ['1', '5', '10', '25'];

// Local rawInput state fully decouples from parent value — same fix as ActiveRounds
function CustomAmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [rawInput, setRawInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isPreset = AMOUNT_PRESETS.includes(value);

  // When parent resets to a preset, clear raw input so placeholder shows
  useEffect(() => { if (isPreset) setRawInput(''); }, [value, isPreset]);

  const customActive = !isPreset;

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={`flex-[1.4] flex items-center px-2 rounded-xl border transition-all duration-200 cursor-text ${
        customActive ? 'border-teal/40 bg-teal/10 shadow-[0_0_12px_-4px_rgba(0,212,184,0.3)]' : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08]'
      }`}
    >
      <input
        ref={inputRef}
        type="number"
        min="0.01"
        step="0.5"
        value={rawInput}
        placeholder="custom"
        onChange={(e) => {
          const raw = e.target.value;
          setRawInput(raw);
          const n = parseFloat(raw);
          if (!isNaN(n) && n > 0) onChange(raw);
        }}
        onBlur={() => { if (!rawInput || parseFloat(rawInput) <= 0) { setRawInput(''); if (customActive) onChange(AMOUNT_PRESETS[0]); } }}
        className="w-full bg-transparent text-xs font-mono text-gray-300 placeholder:text-gray-600 outline-none tabular-nums py-2.5
          [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}

export default function SeriesDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { currentSeries, loading, fetchSeriesBySlug } = useSeriesStore();
  const prices = useOracleStore((s) => s.prices);
  const fetchPrices = useOracleStore((s) => s.fetchPrices);
  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const allMarkets = useMarketStore((s) => s.markets);

  // Betting state
  const [betAmount, setBetAmount] = useState('1');
  const [pendingDirection, setPendingDirection] = useState<'up' | 'down' | null>(null);
  const { status: txStatus, execute, fetchCreditsRecord, fetchUsdcxRecord } = useTransaction();
  const addTrade = useTradeStore((s) => s.addTrade);
  const addBet = useLightningBetStore((s) => s.addBet);
  const allBets = useLightningBetStore((s) => s.bets);
  const startCooldown = useBetCooldownStore((s) => s.startCooldown);
  const isOnCooldown = useBetCooldownStore((s) => s.isOnCooldown);
  const getRemainingSeconds = useBetCooldownStore((s) => s.getRemainingSeconds);
  const { fetchShareRecords } = useTransaction();
  const [shareRecords, setShareRecords] = useState<ShareRecord[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [priceHistory, setPriceHistory] = useState<{ time: number; price: number }[]>([]);

  // Reactive cooldown ticker — re-evaluates every second while cooling down
  const [cooldownTick, setCooldownTick] = useState(0);
  useEffect(() => {
    if (!isOnCooldown()) return;
    const id = setInterval(() => setCooldownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isOnCooldown, cooldownTick]);
  const cooldownLeft = getRemainingSeconds();
  const onCooldown = cooldownLeft > 0;

  // Pre-compute round end time BEFORE early returns so useCountdown always runs (Rules of Hooks)
  const _preAsset = currentSeries?.asset?.toUpperCase() ?? '';
  const roundEndTime = currentSeries?.currentRound?.endTime
    ?? allMarkets.find((m) => {
      if (!m.isLightning || m.status !== 'active') return false;
      const q = m.question.toUpperCase();
      if (_preAsset === 'BTC') return q.includes('BTC') || q.includes('BITCOIN');
      if (_preAsset === 'ETH') return q.includes('ETH') || q.includes('ETHEREUM');
      return q.includes('ALEO');
    })?.endTime
    ?? 0;
  const roundCountdown = useCountdown(roundEndTime);

  // Fetch series + prices on mount
  useEffect(() => {
    if (slug) fetchSeriesBySlug(slug);
    fetchPrices();
    fetchMarkets();
    const i1 = setInterval(() => slug && fetchSeriesBySlug(slug), 15_000);
    const i2 = setInterval(fetchPrices, 15_000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, [slug, fetchSeriesBySlug, fetchPrices, fetchMarkets]);

  // Load share records
  const loadShareRecords = useCallback(async () => {
    const records = await fetchShareRecords();
    setShareRecords(records);
  }, [fetchShareRecords]);

  useEffect(() => { loadShareRecords(); }, [loadShareRecords]);

  // Load price history for chart — poll every 15s for fresh data
  useEffect(() => {
    if (!currentSeries) return;
    const asset = currentSeries.asset.toLowerCase();
    const fetchHistory = () => {
      fetch(`${API_BASE}/oracle/history?asset=${asset}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.history) setPriceHistory(data.history);
        })
        .catch(() => {});
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 15_000);
    return () => clearInterval(interval);
  }, [currentSeries]);

  // Pre-compute round + userBet before early returns (Rules of Hooks — hooks must not be conditional)
  const _preRound = currentSeries?.currentRound ?? allMarkets.find((m) => {
    if (!m.isLightning || m.status !== 'active') return false;
    const q = m.question.toUpperCase();
    if (_preAsset === 'BTC') return q.includes('BTC') || q.includes('BITCOIN');
    if (_preAsset === 'ETH') return q.includes('ETH') || q.includes('ETHEREUM');
    return q.includes('ALEO');
  });
  const _preUserBet = _preRound
    ? allBets.find((b) => (b.roundId === _preRound.id || b.marketId === _preRound.id) && !b.result)
    : undefined;

  // MUST be before early returns
  useEffect(() => { if (_preUserBet) setPendingDirection(null); }, [_preUserBet]);
  useEffect(() => { if (txStatus === 'error') setPendingDirection(null); }, [txStatus]);

  if (loading && !currentSeries) return <Loading />;
  if (!currentSeries) {
    return (
      <EmptyState
        icon={<ChartIcon className="w-10 h-10 text-gray-600" />}
        title="Series not found"
        description="This series may not exist or the link is incorrect"
        actionLabel="Browse Markets"
        actionHref="/markets"
      />
    );
  }

  const series = currentSeries;
  const asset = series.asset.toUpperCase();

  // Find the current active round for this asset:
  // 1. Try series.currentRound from API (needs DB series_id linkage)
  // 2. Fallback: search the market cache for an active lightning market matching this asset
  const round = series.currentRound ?? allMarkets.find((m) => {
    if (!m.isLightning || m.status !== 'active') return false;
    const q = m.question.toUpperCase();
    if (asset === 'BTC') return q.includes('BTC') || q.includes('BITCOIN');
    if (asset === 'ETH') return q.includes('ETH') || q.includes('ETHEREUM');
    return q.includes('ALEO');
  }) ?? undefined;

  const isRoundExpired = roundCountdown.isExpired && roundEndTime > 0;
  const isSettling = isRoundExpired && !!round && round.status === 'active';
  const isResolved = round?.status === 'resolved';
  const hasLiveRound = !!round && round.status === 'active' && !isRoundExpired;
  const currentPrice = asset === 'BTC' ? prices.btc : asset === 'ETH' ? prices.eth : prices.aleo;
  const tokenLabel = series.tokenType === 'USDCX' ? 'USDCx' : series.tokenType === 'USAD' ? 'USAD' : 'ALEO';
  const marketToken = round ? ((round.tokenType || 'ALEO').toLowerCase() as TokenType) : 'aleo';
  const isTxInProgress = txStatus === 'preparing' || txStatus === 'proving' || txStatus === 'broadcasting';

  // Probability from reserves
  let upProbability = 50;
  if (round && round.reserves && round.reserves.length === 2) {
    const [rUp, rDown] = round.reserves;
    const total = rUp + rDown;
    if (total > 0) upProbability = Math.round((rDown / total) * 100);
  }

  // User's existing bet on current round
  const userBet = round ? allBets.find((b) => (b.roundId === round.id || b.marketId === round.id) && !b.result) : undefined;

  // Reserves for FPMM calculations
  const liveReserves = round?.reserves || [1_000_000, 1_000_000];

  const handleBet = async (direction: 'up' | 'down') => {
    if (!round) return;
    setPendingDirection(direction);
    const amountMicro = Math.floor(parseFloat(betAmount) * 1_000_000);
    if (amountMicro < 1000) return;
    const outcome = direction === 'up' ? 0 : 1;
    const exactShares = estimateBuySharesExact(liveReserves, outcome, amountMicro);
    if (exactShares <= 0n) return;
    const minShares = exactShares * 95n / 100n;
    const nonce = generateNonce();

    let tx;
    if (marketToken === 'usdcx' || marketToken === 'usad') {
      const stableType = marketToken === 'usad' ? 'USAD' : 'USDCX';
      const tokenRecord = await fetchUsdcxRecord(amountMicro, stableType);
      if (!tokenRecord) return;
      const proofs = await getUsdcxProofs(stableType);
      tx = buildBuySharesStableTx(
        stableType, round.id, outcome,
        `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce,
        tokenRecord, proofs
      );
    } else {
      const record = await fetchCreditsRecord(amountMicro);
      if (!record) return;
      tx = buildBuySharesPrivateTx(
        round.id, outcome,
        `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce,
        record
      );
    }

    const refreshChain = () => fetch(`${API_BASE}/markets/refresh`, { method: 'POST' })
      .then(() => fetchMarkets())
      .catch(() => fetchMarkets());

    const txId = await execute(tx, refreshChain);
    if (txId) {
      startCooldown();
      // Immediately record the bet so panel switches to "Your Bet" view
      addBet({
        roundId: round.id, marketId: round.id, asset: asset as 'BTC' | 'ETH' | 'ALEO', direction,
        amount: amountMicro, shares: Number(exactShares),
        timestamp: Date.now(), startPrice: currentPrice, tokenType: marketToken,
      });
      addTrade({
        marketId: round.id, type: 'buy',
        outcome: direction === 'up' ? 'Up' : 'Down',
        amount: amountMicro, shares: Number(exactShares),
        price: 0.5, timestamp: Date.now(),
      });
      refreshChain();
    } else {
      setPendingDirection(null);
    }
  };

  const handleBetClick = (direction: 'up' | 'down') => handleBet(direction);

  const handleClaim = async (record: ShareRecord) => {
    setClaiming(true);
    try {
      const tokenTypeStr = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;
      const tx = buildRedeemSharesTx(record.plaintext, tokenTypeStr as 'USDCX' | 'USAD' | undefined);
      await execute(tx, loadShareRecords);
    } finally {
      setClaiming(false);
    }
  };

  // Claimable shares from resolved rounds in this series
  const pastRounds = series.pastRounds || [];
  const resolvedRoundIds = new Set(pastRounds.filter((r) => r.status === 'resolved').map((r) => r.id));
  const claimableShares = shareRecords.filter((s) => {
    if (!resolvedRoundIds.has(s.marketId)) return false;
    const rm = pastRounds.find((r) => r.id === s.marketId);
    return rm && rm.resolvedOutcome !== undefined && s.outcome === rm.resolvedOutcome + 1;
  });

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/rounds" className="hover:text-gray-300 transition-colors">Rounds</Link>
        <span>/</span>
        <span className={assetColors[asset]}>{series.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chart + Past Rounds */}
        <div className="lg:col-span-2 space-y-6">
          {/* Series Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] flex items-center justify-center">
                  <CryptoIcon symbol={asset} size={32} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h1 className={`text-xl font-heading font-bold ${assetColors[asset]}`}>{series.title}</h1>
                    <Badge
                      variant={isSettling ? 'warning' : hasLiveRound ? 'success' : 'gray'}
                      pulse={hasLiveRound || isSettling}
                    >
                      {isSettling ? 'SETTLING...' : hasLiveRound ? 'LIVE' : 'NEXT SOON'}
                    </Badge>
                  </div>
                  {series.subtitle && <p className="text-sm text-gray-500 mt-0.5">{series.subtitle}</p>}
                </div>
              </div>

              {/* Price row — Polymarket style */}
              <PriceRow
                startPrice={round?.startPrice}
                currentPrice={currentPrice}
                asset={asset}
                endTime={round?.endTime ?? 0}
                hasLiveRound={hasLiveRound}
                isSettling={isSettling}
              />
            </Card>
          </motion.div>

          {/* Price Chart — live real-time */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <LivePriceChart
              data={priceHistory}
              targetPrice={round?.startPrice}
              asset={asset}
              color={asset === 'BTC' ? '#F59E0B' : asset === 'ETH' ? '#60A5FA' : '#00D4B8'}
              height={340}
            />
          </motion.div>

          {/* Time Slot Tabs */}
          {series.upcomingSlots && series.upcomingSlots.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <Card className="p-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">Upcoming Rounds</h3>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {series.upcomingSlots.map((slot, i) => (
                    <div
                      key={i}
                      className={`px-4 py-2 rounded-xl text-xs font-mono whitespace-nowrap border transition-all ${
                        i === 0
                          ? 'border-teal/30 bg-teal/10 text-teal'
                          : 'border-white/[0.04] bg-white/[0.01] text-gray-500'
                      }`}
                    >
                      {slot}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Past Rounds */}
          {pastRounds.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <Card className="p-5">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-4">Recent Rounds</h3>
                <div className="space-y-2">
                  {pastRounds.slice(0, 10).map((r) => (
                    <PastRoundRow key={r.id} round={r} asset={asset} />
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right sidebar: Trade + Stats */}
        <div className="space-y-6">
          {/* Probability Gauge */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="p-5">
              <div className="flex justify-center mb-2">
                <ProbabilityGauge upProbability={upProbability} size={160} />
              </div>
            </Card>
          </motion.div>

          {/* Trade Panel */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-5">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-4">Trade</h3>

              {isSettling ? (
                // Settling state — round expired, waiting for on-chain resolution
                <div className="text-center py-5 rounded-xl border border-amber-400/10 bg-amber-400/[0.03]">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-sm font-heading text-amber-400/90">Settling on-chain...</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed px-2">
                    The bot is resolving this round and creating the next one.
                    Results appear in ~5 min. Claim winnings after.
                  </p>
                </div>
              ) : isResolved ? (
                // Resolved state
                <div className={`text-center py-4 rounded-xl border ${
                  round?.resolvedOutcome === 0
                    ? 'bg-gradient-to-r from-accent-green/[0.06] to-accent-green/[0.03] border-accent-green/15 text-accent-green'
                    : 'bg-gradient-to-r from-accent-red/[0.06] to-accent-red/[0.03] border-accent-red/15 text-accent-red'
                }`}>
                  <span className="text-sm font-heading font-bold">
                    {round?.resolvedOutcome === 0 ? '↑ UP WINS' : '↓ DOWN WINS'}
                  </span>
                </div>
              ) : !hasLiveRound ? (
                <div className="text-center py-6">
                  <BoltIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Waiting for next round...</p>
                  <p className="text-[10px] text-gray-600 mt-1">A new round will start automatically</p>
                </div>
              ) : isTxInProgress && pendingDirection ? (
                // Optimistic pending state — shows immediately after clicking UP/DOWN
                <div className={`p-4 rounded-xl border animate-pulse ${
                  pendingDirection === 'up'
                    ? 'border-accent-green/20 bg-accent-green/[0.04]'
                    : 'border-accent-red/20 bg-accent-red/[0.04]'
                }`}>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-gray-400 font-heading">Placing Bet...</span>
                    <Badge variant={pendingDirection === 'up' ? 'success' : 'danger'} size="sm">
                      {pendingDirection === 'up' ? '↑ UP' : '↓ DOWN'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: pendingDirection === 'up' ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)', borderTopColor: 'transparent' }}
                    />
                    <span>
                      {txStatus === 'preparing' ? 'Preparing transaction...' :
                       txStatus === 'proving' ? 'Generating ZK proof...' :
                       'Broadcasting to network...'}
                    </span>
                  </div>
                  <div className="mt-3 text-[10px] text-gray-600">{betAmount} {tokenLabel} at {pendingDirection === 'up' ? upProbability : 100 - upProbability}¢</div>
                </div>
              ) : userBet ? (
                <div className={`p-4 rounded-xl border ${
                  userBet.direction === 'up'
                    ? 'border-accent-green/20 bg-accent-green/[0.06]'
                    : 'border-accent-red/20 bg-accent-red/[0.06]'
                }`}>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-gray-400 font-heading">Your Bet</span>
                    <Badge variant={userBet.direction === 'up' ? 'success' : 'danger'} size="sm">
                      {userBet.direction === 'up' ? '↑ UP' : '↓ DOWN'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-mono font-medium text-white">
                      {formatAleo(userBet.amount)} {tokenLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-gray-500">Potential Win</span>
                    <span className="font-mono text-teal">
                      {(() => {
                        const out = userBet.direction === 'up' ? 0 : 1;
                        const { tokensOut } = estimateSellTokensOut(liveReserves, out, userBet.shares);
                        return formatAleo(calculateFees(tokensOut).amountAfterFee);
                      })()} {tokenLabel}
                    </span>
                  </div>
                </div>
              ) : onCooldown ? (
                <div className="text-center py-6 rounded-xl border border-amber-400/15 bg-amber-400/[0.04]">
                  <div className="text-xs text-amber-400/80 font-heading mb-1">Transaction Cooldown</div>
                  <div className="text-3xl font-mono font-bold text-amber-400 tabular-nums">{cooldownLeft}s</div>
                  <p className="text-[10px] text-gray-500 mt-1">Wait for your previous bet to confirm</p>
                </div>
              ) : (
                <>
                  {/* Amount selector */}
                  <div className="mb-4">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-2 block">
                      Amount ({tokenLabel})
                    </label>
                    <div className="flex gap-1.5">
                      {['1', '5', '10', '25'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setBetAmount(val)}
                          className={`flex-1 py-2.5 text-xs font-mono font-medium rounded-xl border transition-all duration-300 ${
                            betAmount === val
                              ? 'border-teal/30 bg-teal/10 text-teal shadow-[0_0_12px_-4px_rgba(0,212,184,0.3)]'
                              : 'border-white/[0.04] bg-white/[0.01] text-gray-500 hover:text-gray-300 hover:border-white/[0.08]'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                      {/* Custom amount */}
                      <CustomAmountInput value={betAmount} onChange={setBetAmount} />
                    </div>
                  </div>

                  {/* Up / Down */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="primary"
                      size="md"
                      className="!bg-gradient-to-r !from-accent-green/20 !to-accent-green/10 !text-accent-green !border !border-accent-green/20 hover:!from-accent-green/30 hover:!to-accent-green/15 hover:!shadow-[0_0_20px_-4px_rgba(34,197,94,0.3)] !rounded-xl"
                      onClick={() => handleBetClick('up')}
                      loading={isTxInProgress && pendingDirection === 'up'}
                    >
                      <ArrowUpIcon className="w-4 h-4 mr-1" /> Up {upProbability}¢
                    </Button>
                    <Button
                      variant="danger"
                      size="md"
                      className="!bg-gradient-to-r !from-accent-red/20 !to-accent-red/10 !text-accent-red !border !border-accent-red/20 hover:!from-accent-red/30 hover:!to-accent-red/15 hover:!shadow-[0_0_20px_-4px_rgba(239,68,68,0.3)] !rounded-xl"
                      onClick={() => handleBetClick('down')}
                      loading={isTxInProgress && pendingDirection === 'down'}
                    >
                      <ArrowDownIcon className="w-4 h-4 mr-1" /> Down {100 - upProbability}¢
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </motion.div>

          {/* Series Stats */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-5">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">Series Stats</h3>
              <div className="space-y-3">
                <StatRow label="Total Rounds" value={String(series.totalRounds)} />
                <StatRow label="Total Volume" value={`${formatAleo(series.totalVolume)} ${tokenLabel}`} />
                <StatRow label="Duration" value={series.durationSeconds < 3600 ? `${series.durationSeconds / 60} min` : `${series.durationSeconds / 3600} hr`} />
                <StatRow label="Token" value={tokenLabel} />
                {round && <StatRow label="Current Pool" value={`${formatAleo(round.totalLiquidity)} ${tokenLabel}`} />}
                {round && <StatRow label="Trades" value={String(round.tradeCount)} />}
              </div>
            </Card>
          </motion.div>

          {/* Claimable winnings */}
          {claimableShares.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-5 border-accent-green/20">
                <h3 className="text-xs text-accent-green uppercase tracking-wider font-heading mb-3">Claimable Winnings</h3>
                <div className="space-y-2">
                  {claimableShares.map((record, idx) => {
                    const tLabel = record.tokenType === 1 ? 'USDCx' : record.tokenType === 2 ? 'USAD' : 'ALEO';
                    return (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-xs text-accent-green/80">
                          {formatAleo(record.quantity)} shares → {formatAleo(record.quantity)} {tLabel}
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleClaim(record)}
                          loading={claiming}
                          className="!text-xs !py-1 !px-3 !bg-accent-green !text-black !border-accent-green"
                        >
                          Claim
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Related Series */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
            <Card className="p-5">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">Related Series</h3>
              <div className="space-y-2">
                {['BTC', 'ETH', 'ALEO']
                  .filter((a) => a !== asset)
                  .map((a) => (
                    <Link
                      key={a}
                      to={`/series/${a.toLowerCase()}-up-or-down`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-all"
                    >
                      <CryptoIcon symbol={a} size={20} />
                      <span className="text-sm text-gray-300 font-heading">{a} Up or Down</span>
                    </Link>
                  ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function PriceRow({ startPrice, currentPrice, asset, endTime, hasLiveRound, isSettling }: {
  startPrice?: number;
  currentPrice: number;
  asset: string;
  endTime: number;
  hasLiveRound: boolean;
  isSettling: boolean;
}) {
  const { minutes, seconds, isExpired } = useCountdown(endTime);
  const fmtPrice = (p: number) => asset === 'ALEO' ? `$${p.toFixed(4)}` : formatUSD(p);
  const priceUp = startPrice !== undefined ? currentPrice >= startPrice : true;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-0.5">Price To Beat</div>
        <div className="text-lg font-mono font-bold text-amber-400 tabular-nums">
          {startPrice !== undefined ? fmtPrice(startPrice) : '—'}
        </div>
      </div>
      <div className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-0.5">Current Price</div>
        <div className={`text-lg font-mono font-bold tabular-nums ${priceUp ? 'text-accent-green' : 'text-accent-red'}`}>
          {fmtPrice(currentPrice)}
        </div>
      </div>
      <div className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-0.5">Time Left</div>
        {isSettling ? (
          <div className="text-sm font-mono font-bold text-amber-400 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Settling...
          </div>
        ) : hasLiveRound && !isExpired ? (
          <div className="text-lg font-mono font-bold text-white tabular-nums flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        ) : (
          <div className="text-lg font-mono font-bold text-gray-600">--:--</div>
        )}
      </div>
    </div>
  );
}

function PastRoundRow({ round, asset }: { round: Market; asset: string }) {
  const isUp = round.resolvedOutcome === 0;
  const fmtPrice = (p: number) => asset === 'ALEO' ? `$${p.toFixed(4)}` : formatUSD(p);

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-white/[0.03] hover:border-white/[0.06] transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          round.status === 'resolved'
            ? isUp ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
            : 'bg-white/[0.04] text-gray-500'
        }`}>
          {round.status === 'resolved' ? (isUp ? '↑' : '↓') : '?'}
        </div>
        <div>
          <span className="text-xs text-gray-300 font-heading">{round.timeSlot || `Round`}</span>
          {round.roundNumber && <span className="text-[10px] text-gray-600 ml-2">#{round.roundNumber}</span>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {round.startPrice && (
          <span className="text-[10px] text-gray-500 font-mono">{fmtPrice(round.startPrice)}</span>
        )}
        <span className="text-xs font-mono text-gray-400">{formatAleo(round.totalVolume)} vol</span>
        {round.status === 'resolved' && (
          <Badge variant={isUp ? 'success' : 'danger'} size="sm">{isUp ? 'UP' : 'DOWN'}</Badge>
        )}
        {round.status === 'active' && <Badge variant="warning" size="sm">LIVE</Badge>}
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-mono text-gray-300">{value}</span>
    </div>
  );
}
