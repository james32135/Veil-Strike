import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import { BoltIcon, ArrowUpIcon, ArrowDownIcon } from '@/components/icons';
import CryptoIcon from '@/components/shared/CryptoIcon';
import RefreshButton from '@/components/shared/RefreshButton';
import { useTransaction } from '@/hooks/useTransaction';
import type { ShareRecord } from '@/hooks/useTransaction';
import { buildBuySharesPrivateTx, buildBuySharesStableTx, buildRedeemSharesTx, buildSellSharesTx, generateNonce } from '@/utils/transactions';
import { getUsdcxProofs } from '@/utils/freezeListProof';
import { estimateBuySharesExact, estimateSellTokensOut, calculateFees } from '@/utils/fpmm';
import { formatUSD, formatAleo } from '@/utils/format';
import { useMarketStore } from '@/stores/marketStore';
import { useOracleStore } from '@/stores/oracleStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { useBetCooldownStore } from '@/stores/betCooldownStore';
import { API_BASE } from '@/constants';
import type { Market } from '@/types';

// Detect asset from market question text
function detectAsset(question: string): 'BTC' | 'ETH' | 'ALEO' {
  const upper = question.toUpperCase();
  if (upper.includes('BTC') || upper.includes('BITCOIN')) return 'BTC';
  if (upper.includes('ETH') || upper.includes('ETHEREUM')) return 'ETH';
  return 'ALEO';
}

function assetToSlug(asset: string): string {
  return `${asset.toLowerCase()}-up-or-down`;
}

// Detect duration label from question text
function detectDuration(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('30 day')) return '30 Days';
  if (q.includes('7 day')) return '7 Days';
  if (q.includes('2 day') || q.includes('48')) return '2 Days';
  if (q.includes('24 hour')) return '24 Hours';
  return '';
}

type TokenType = 'aleo' | 'usdcx' | 'usad';

function useCountdownSeconds(targetTime: number) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.floor((targetTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime]);
  return seconds;
}

// Asset config
const ASSET_CONFIG: Record<string, { color: string; textColor: string; borderColor: string; bgColor: string; glowColor: string }> = {
  BTC: { color: '#F59E0B', textColor: 'text-amber-400', borderColor: 'border-amber-400/20', bgColor: 'bg-amber-400/[0.06]', glowColor: 'rgba(245,158,11,0.15)' },
  ETH: { color: '#60A5FA', textColor: 'text-blue-400', borderColor: 'border-blue-400/20', bgColor: 'bg-blue-400/[0.06]', glowColor: 'rgba(96,165,250,0.15)' },
  ALEO: { color: '#00D4B8', textColor: 'text-teal', borderColor: 'border-teal/20', bgColor: 'bg-teal/[0.06]', glowColor: 'rgba(0,212,184,0.15)' },
};

const PRESETS = ['1', '5', '10', '25'];

function AmountSelector({ value, onChange, tokenLabel }: { value: string; onChange: (v: string) => void; tokenLabel: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustom = !PRESETS.includes(value);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider font-heading">Amount ({tokenLabel})</label>
        {parseFloat(value) > 0 && (
          <span className="text-[10px] text-gray-600 font-mono">{value} {tokenLabel}</span>
        )}
      </div>
      <div className="flex gap-1.5">
        {PRESETS.map((val) => (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={`flex-1 py-2 text-xs font-mono font-medium rounded-xl border transition-all duration-200 ${
              value === val
                ? 'border-teal/40 bg-teal/10 text-teal shadow-[0_0_12px_-4px_rgba(0,212,184,0.3)]'
                : 'border-white/[0.05] bg-white/[0.01] text-gray-500 hover:text-gray-300 hover:border-white/[0.1]'
            }`}
          >
            {val}
          </button>
        ))}
        {/* Custom input */}
        <div
          onClick={() => inputRef.current?.focus()}
          className={`flex-[1.4] flex items-center px-2 rounded-xl border transition-all duration-200 cursor-text ${
            isCustom
              ? 'border-teal/40 bg-teal/10 shadow-[0_0_12px_-4px_rgba(0,212,184,0.3)]'
              : 'border-white/[0.05] bg-white/[0.01] hover:border-white/[0.1]'
          }`}
        >
          <input
            ref={inputRef}
            type="number"
            min="0.01"
            step="0.5"
            value={isCustom ? value : ''}
            placeholder="custom"
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || v === '0') return;
              onChange(v);
            }}
            className="w-full bg-transparent text-xs font-mono text-gray-300 placeholder:text-gray-600 outline-none tabular-nums py-2"
          />
        </div>
      </div>
    </div>
  );
}

function StrikeRoundCard({ market, shareRecords, onClaimed }: { market: Market; shareRecords: ShareRecord[]; onClaimed: () => void }) {
  const asset = detectAsset(market.question);
  const cfg = ASSET_CONFIG[asset] ?? ASSET_CONFIG.BTC;
  const secondsLeft = useCountdownSeconds(market.endTime);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const days = Math.floor(secondsLeft / 86400);
  const countdownLabel = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}:${secs.toString().padStart(2, '0')}`;
  const isUrgent = secondsLeft < 120 && secondsLeft > 0;

  const isExpired = secondsLeft === 0 && market.status === 'active';
  const isResolved = market.status === 'resolved';
  const isActive = !isExpired && !isResolved;

  const { status: txStatus, execute, fetchCreditsRecord, fetchUsdcxRecord } = useTransaction();
  const [betAmount, setBetAmount] = useState('1');
  const [pendingDir, setPendingDir] = useState<'up' | 'down' | null>(null);
  const isTxInProgress = txStatus === 'preparing' || txStatus === 'proving' || txStatus === 'broadcasting';
  const marketToken = (market.tokenType || 'ALEO').toLowerCase() as TokenType;
  const [tokenType] = useState<TokenType>(marketToken);
  const [claiming, setClaiming] = useState(false);

  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const oraclePrices = useOracleStore((s) => s.prices);
  const addTrade = useTradeStore((s) => s.addTrade);
  const addBet = useLightningBetStore((s) => s.addBet);
  const allBets = useLightningBetStore((s) => s.bets);
  const roundBets = allBets.filter((b) => b.marketId === market.id);

  const { isOnCooldown, getRemainingSeconds, startCooldown } = useBetCooldownStore();
  const [cooldownTick, setCooldownTick] = useState(0);
  useEffect(() => {
    if (!isOnCooldown()) return;
    const id = setInterval(() => setCooldownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isOnCooldown, cooldownTick]);
  const cooldownLeft = getRemainingSeconds();
  const onCooldown = cooldownLeft > 0;

  const liveReserves = market.reserves ?? [1_000_000, 1_000_000];
  const tokenLabel = tokenType === 'usdcx' ? 'USDCx' : tokenType === 'usad' ? 'USAD' : 'ALEO';
  const currentPrice = oraclePrices[asset.toLowerCase() as 'btc' | 'eth' | 'aleo'] || 0;
  const fmtPrice = (p: number) => asset === 'ALEO' ? `$${p.toFixed(4)}` : formatUSD(p);
  const priceUp = market.startPrice !== undefined ? currentPrice >= market.startPrice : true;

  // Probability from reserves
  const [rUp, rDown] = liveReserves;
  const totalRes = rUp + rDown;
  const upPct = totalRes > 0 ? Math.round((rDown / totalRes) * 100) : 50;
  const downPct = 100 - upPct;

  // Real-time estimated win based on current betAmount
  const amountMicro = Math.max(0, Math.floor((parseFloat(betAmount) || 0) * 1_000_000));
  const estSharesUp = amountMicro > 0 ? estimateBuySharesExact(liveReserves, 0, amountMicro) : 0n;
  const estSharesDown = amountMicro > 0 ? estimateBuySharesExact(liveReserves, 1, amountMicro) : 0n;
  const { tokensOut: winUp } = estSharesUp > 0n ? estimateSellTokensOut(liveReserves, 0, Number(estSharesUp)) : { tokensOut: 0 };
  const { tokensOut: winDown } = estSharesDown > 0n ? estimateSellTokensOut(liveReserves, 1, Number(estSharesDown)) : { tokensOut: 0 };
  const potWinUp = calculateFees(winUp).amountAfterFee;
  const potWinDown = calculateFees(winDown).amountAfterFee;

  const userBet = roundBets[0];

  // Clear pending once stored, or on error
  useEffect(() => { if (userBet) setPendingDir(null); }, [userBet]);
  useEffect(() => { if (txStatus === 'error') setPendingDir(null); }, [txStatus]);

  const winningOutcome = market.resolvedOutcome !== undefined ? market.resolvedOutcome + 1 : 0;
  const claimableShares = isResolved && winningOutcome > 0
    ? shareRecords.filter((r) => r.marketId === market.id && r.outcome === winningOutcome)
    : [];
  const sellableShares = isExpired && !isResolved
    ? shareRecords.filter((r) => r.marketId === market.id)
    : [];

  const refreshChain = useCallback(() =>
    fetch(`${API_BASE}/markets/refresh`, { method: 'POST' }).then(() => fetchMarkets()).catch(() => fetchMarkets()),
  [fetchMarkets]);

  const handleBet = async (direction: 'up' | 'down') => {
    if (amountMicro < 1000) return;
    setPendingDir(direction);
    const outcome = direction === 'up' ? 0 : 1;
    const exactShares = estimateBuySharesExact(liveReserves, outcome, amountMicro);
    if (exactShares <= 0n) { setPendingDir(null); return; }
    const minShares = exactShares * 95n / 100n;
    const nonce = generateNonce();
    let tx;
    if (tokenType === 'usdcx' || tokenType === 'usad') {
      const stableType = tokenType === 'usad' ? 'USAD' : 'USDCX';
      const tokenRecord = await fetchUsdcxRecord(amountMicro, stableType);
      if (!tokenRecord) { setPendingDir(null); return; }
      const proofs = await getUsdcxProofs(stableType);
      tx = buildBuySharesStableTx(stableType, market.id, outcome, `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce, tokenRecord, proofs);
    } else {
      const record = await fetchCreditsRecord(amountMicro);
      if (!record) { setPendingDir(null); return; }
      tx = buildBuySharesPrivateTx(market.id, outcome, `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce, record);
    }
    const txId = await execute(tx, refreshChain);
    if (txId) {
      startCooldown();
      addBet({ roundId: market.id, marketId: market.id, asset, direction, amount: amountMicro, shares: Number(exactShares), timestamp: Date.now(), startPrice: currentPrice, tokenType });
      addTrade({ marketId: market.id, type: 'buy', outcome: direction === 'up' ? 'Up' : 'Down', amount: amountMicro, shares: Number(exactShares), price: 0.5, timestamp: Date.now() });
      refreshChain();
    } else {
      setPendingDir(null);
    }
  };

  const handleClaim = async (record: ShareRecord) => {
    setClaiming(true);
    try {
      const tokenTypeStr = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;
      const tx = buildRedeemSharesTx(record.plaintext, tokenTypeStr as 'USDCX' | 'USAD' | undefined);
      await execute(tx, onClaimed);
    } finally { setClaiming(false); }
  };

  const handleSellAMM = async (record: ShareRecord) => {
    setClaiming(true);
    try {
      const tokenTypeStr = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;
      const outcomeIdx = record.outcome - 1;
      const { tokensOut } = estimateSellTokensOut(liveReserves, outcomeIdx, record.quantity);
      if (tokensOut <= 0) return;
      const tx = buildSellSharesTx(record.plaintext, `${tokensOut}u128`, `${record.quantity}u128`, tokenTypeStr as 'USDCX' | 'USAD' | undefined);
      await execute(tx, onClaimed);
    } finally { setClaiming(false); }
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: isActive ? `0 0 40px -12px ${cfg.glowColor}, 0 2px 20px rgba(0,0,0,0.4)` : '0 2px 20px rgba(0,0,0,0.3)' }}
    >
      {/* Top gradient bar */}
      <div className="h-[3px] w-full" style={{ background: isResolved ? (market.resolvedOutcome === 0 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#ef4444,#dc2626)') : `linear-gradient(90deg, ${cfg.color}aa, ${cfg.color}, ${cfg.color}aa)` }}>
        {isActive && <div className="h-full w-full animate-pulse opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }} />}
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Icon with colored ring */}
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `radial-gradient(circle, ${cfg.glowColor} 0%, transparent 70%)`, border: `1px solid ${cfg.color}33` }}>
                <CryptoIcon symbol={asset} size={24} />
              </div>
              {isActive && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent-green border-2 border-surface animate-pulse" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-base font-heading font-bold tracking-tight ${cfg.textColor}`}>{asset}</span>
                <span className="text-[10px] text-gray-500 font-heading">Strike</span>
                {market.tokenType && market.tokenType !== 'ALEO' && (
                  <Badge variant="gray" size="sm">{market.tokenType}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={isResolved ? 'gray' : isExpired ? 'warning' : 'success'} size="sm" pulse={isActive}>
                  {isResolved ? 'RESOLVED' : isExpired ? 'SETTLING...' : 'LIVE'}
                </Badge>
                {market.roundNumber && <span className="text-[10px] text-gray-600 font-mono">#{market.roundNumber}</span>}
              </div>
            </div>
          </div>

          {/* Countdown */}
          {isActive && (
            <div className={`px-3 py-2 rounded-xl text-center ${isUrgent ? 'bg-accent-red/10 border border-accent-red/25' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
              <div className={`text-lg font-mono font-bold tabular-nums leading-none ${isUrgent ? 'text-accent-red animate-pulse' : 'text-white'}`}>
                {countdownLabel}
              </div>
              <div className="text-[9px] text-gray-600 font-heading uppercase tracking-wider mt-0.5">left</div>
            </div>
          )}
        </div>

        {/* ── Price Row ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-heading mb-1">Price To Beat</div>
            <div className="text-sm font-mono font-bold text-amber-400 tabular-nums">
              {market.startPrice ? fmtPrice(market.startPrice) : '—'}
            </div>
          </div>
          <Link to={`/series/${assetToSlug(asset)}`} className="group/price px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all block">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-heading">Current Price</span>
              <span className="text-[9px] text-teal opacity-0 group-hover/price:opacity-100 transition-opacity">↗</span>
            </div>
            <div className={`text-sm font-mono font-bold tabular-nums ${priceUp ? 'text-accent-green' : 'text-accent-red'}`}>
              {fmtPrice(currentPrice)}
            </div>
          </Link>
        </div>

        {/* ── Probability Bar ── */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-heading mb-1.5">
            <span className="text-accent-green">↑ UP {upPct}%</span>
            <span className="text-gray-600">chance</span>
            <span className="text-accent-red">↓ DOWN {downPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${upPct}%`, background: `linear-gradient(90deg, #22c55e, #16a34a)` }} />
          </div>
        </div>

        {/* ── Pool Stats ── */}
        <div className="flex items-center justify-between text-[10px] text-gray-600 border-t border-white/[0.03] pt-3">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Pool</span>
            <span className="font-mono text-gray-400">{formatAleo(market.totalLiquidity)} {tokenLabel}</span>
          </div>
          <div className="w-px h-3 bg-white/[0.06]" />
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Trades</span>
            <span className="font-mono text-gray-400">{market.tradeCount}</span>
          </div>
          <div className="w-px h-3 bg-white/[0.06]" />
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Vol</span>
            <span className="font-mono text-gray-400">{formatAleo(market.totalVolume)} {tokenLabel}</span>
          </div>
        </div>

        {/* ── Trade Area ── */}
        <div className="flex-1">
          {isExpired && !isResolved ? (
            /* Settling */
            <div className="text-center py-4 rounded-xl border border-amber-400/10 bg-amber-400/[0.03]">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm font-heading text-amber-400/90">Settling on-chain...</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed px-2">Bot is resolving rounds. Results in ~5 min.</p>
            </div>
          ) : isResolved ? (
            /* Resolved */
            <div>
              <div className={`text-center py-3 rounded-xl border mb-2 ${market.resolvedOutcome === 0 ? 'border-accent-green/20 bg-accent-green/[0.06] text-accent-green' : 'border-accent-red/20 bg-accent-red/[0.06] text-accent-red'}`}>
                <span className="text-base font-heading font-bold">{market.resolvedOutcome === 0 ? '↑ UP WINS' : '↓ DOWN WINS'}</span>
              </div>
              {claimableShares.map((record, idx) => {
                const tLabel = record.tokenType === 1 ? 'USDCx' : record.tokenType === 2 ? 'USAD' : 'ALEO';
                return (
                  <div key={idx} className="flex items-center justify-between mt-2">
                    <span className="text-xs text-accent-green/80">{formatAleo(record.quantity)} shares</span>
                    <Button variant="primary" size="sm" onClick={() => handleClaim(record)} loading={claiming || isTxInProgress}
                      className="!text-xs !py-1.5 !px-4 !bg-accent-green !text-black !border-accent-green hover:!bg-accent-green/80">
                      {txStatus === 'proving' ? 'Proving...' : '💰 Claim'}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : isTxInProgress && pendingDir ? (
            /* Optimistic pending */
            <div className={`p-4 rounded-xl border ${pendingDir === 'up' ? 'border-accent-green/20 bg-accent-green/[0.04]' : 'border-accent-red/20 bg-accent-red/[0.04]'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-heading text-gray-400">Placing Bet...</span>
                <Badge variant={pendingDir === 'up' ? 'success' : 'danger'} size="sm">{pendingDir === 'up' ? '↑ UP' : '↓ DOWN'}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: pendingDir === 'up' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)', borderTopColor: 'transparent' }} />
                <span>{txStatus === 'preparing' ? 'Preparing...' : txStatus === 'proving' ? 'Generating ZK proof...' : 'Broadcasting...'}</span>
              </div>
              <div className="mt-2 text-[10px] text-gray-600">{betAmount} {tokenLabel}</div>
            </div>
          ) : userBet ? (
            /* User's existing bet */
            <div className={`p-3.5 rounded-xl border ${userBet.direction === 'up' ? 'border-accent-green/20 bg-gradient-to-br from-accent-green/[0.07] to-accent-green/[0.02]' : 'border-accent-red/20 bg-gradient-to-br from-accent-red/[0.07] to-accent-red/[0.02]'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-heading text-gray-400">Your Bet</span>
                <Badge variant={userBet.direction === 'up' ? 'success' : 'danger'} size="sm">{userBet.direction === 'up' ? '↑ UP' : '↓ DOWN'}</Badge>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-mono text-white">{formatAleo(userBet.amount)} {tokenLabel}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Potential Win</span>
                  <span className="font-mono text-teal">{(() => {
                    const out = userBet.direction === 'up' ? 0 : 1;
                    const { tokensOut } = estimateSellTokensOut(liveReserves, out, userBet.shares);
                    return formatAleo(calculateFees(tokensOut).amountAfterFee);
                  })()} {tokenLabel}</span>
                </div>
              </div>
            </div>
          ) : onCooldown ? (
            /* Cooldown (no bet on this market yet) */
            <div className="text-center py-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.04]">
              <div className="text-xs text-amber-400/80 font-heading mb-1">Transaction Cooldown</div>
              <div className="text-2xl font-mono font-bold text-amber-400 tabular-nums">{cooldownLeft}s</div>
              <p className="text-[10px] text-gray-500 mt-1">Wait for your previous bet to confirm</p>
            </div>
          ) : isActive ? (
            /* Betting form */
            <div className="space-y-3">
              <AmountSelector value={betAmount} onChange={setBetAmount} tokenLabel={tokenLabel} />

              {/* Real-time win estimate */}
              {amountMicro >= 1000 && (
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="flex justify-between px-2 py-1.5 rounded-lg bg-accent-green/[0.04] border border-accent-green/10">
                    <span className="text-gray-600">Win if UP</span>
                    <span className="font-mono text-accent-green">{formatAleo(potWinUp)} {tokenLabel}</span>
                  </div>
                  <div className="flex justify-between px-2 py-1.5 rounded-lg bg-accent-red/[0.04] border border-accent-red/10">
                    <span className="text-gray-600">Win if DOWN</span>
                    <span className="font-mono text-accent-red">{formatAleo(potWinDown)} {tokenLabel}</span>
                  </div>
                </div>
              )}

              {/* UP / DOWN */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleBet('up')}
                  disabled={amountMicro < 1000 || isTxInProgress}
                  className="group relative py-3 rounded-xl border border-accent-green/25 bg-gradient-to-r from-accent-green/15 to-accent-green/8 hover:from-accent-green/25 hover:to-accent-green/15 hover:border-accent-green/40 hover:shadow-[0_0_20px_-4px_rgba(34,197,94,0.4)] transition-all duration-300 disabled:opacity-40"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <ArrowUpIcon className="w-4 h-4 text-accent-green" />
                    <span className="text-sm font-heading font-bold text-accent-green">UP</span>
                    <span className="text-[10px] text-accent-green/60">{upPct}¢</span>
                  </div>
                </button>
                <button
                  onClick={() => handleBet('down')}
                  disabled={amountMicro < 1000 || isTxInProgress}
                  className="group relative py-3 rounded-xl border border-accent-red/25 bg-gradient-to-r from-accent-red/15 to-accent-red/8 hover:from-accent-red/25 hover:to-accent-red/15 hover:border-accent-red/40 hover:shadow-[0_0_20px_-4px_rgba(239,68,68,0.4)] transition-all duration-300 disabled:opacity-40"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <ArrowDownIcon className="w-4 h-4 text-accent-red" />
                    <span className="text-sm font-heading font-bold text-accent-red">DOWN</span>
                    <span className="text-[10px] text-accent-red/60">{downPct}¢</span>
                  </div>
                </button>
              </div>
            </div>
          ) : null}

          {/* Expired — sell via AMM */}
          {isExpired && sellableShares.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-gray-400 font-heading">Sell shares via AMM:</p>
              {sellableShares.map((record, idx) => {
                const tLabel = record.tokenType === 1 ? 'USDCx' : record.tokenType === 2 ? 'USAD' : 'ALEO';
                const { tokensOut } = estimateSellTokensOut(liveReserves, record.outcome - 1, record.quantity);
                return (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-teal/80">~{formatAleo(calculateFees(tokensOut).amountAfterFee)} {tLabel}</span>
                    <Button variant="primary" size="sm" onClick={() => handleSellAMM(record)} loading={claiming || isTxInProgress} className="!text-xs !py-1 !px-3">💸 Sell</Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ActiveRoundsProps {
  markets: never[];
}

export default function ActiveRounds({ }: ActiveRoundsProps) {
  const allMarkets = useMarketStore((s) => s.markets);
  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const [loading, setLoading] = useState(true);
  const { fetchShareRecords } = useTransaction();
  const [shareRecords, setShareRecords] = useState<ShareRecord[]>([]);

  const loadShareRecords = useCallback(async () => {
    const records = await fetchShareRecords();
    setShareRecords(records);
  }, [fetchShareRecords]);

  useEffect(() => {
    fetchMarkets().then(() => setLoading(false));
    loadShareRecords();
    const marketId = setInterval(fetchMarkets, 30_000);
    const shareId = setInterval(loadShareRecords, 30_000);
    return () => { clearInterval(marketId); clearInterval(shareId); };
  }, [fetchMarkets, loadShareRecords]);

  // Filter to only lightning/strike-round markets
  const strikeMarkets = allMarkets.filter((m) => m.isLightning && m.question.toLowerCase().includes('strike round'));
  const activeMarkets = strikeMarkets.filter((m) => m.status === 'active');
  const resolvedMarkets = strikeMarkets.filter((m) => m.status === 'resolved').slice(0, 6);

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Loading rounds...</div>;
  }

  if (activeMarkets.length === 0 && resolvedMarkets.length === 0) {
    return (
      <div className="text-center py-8">
        <BoltIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No active Strike Rounds</p>
        <p className="text-xs text-gray-600 mt-1">Create a Strike Round to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton onRefresh={async () => { await fetchMarkets(); await loadShareRecords(); }} label="Refresh" />
      </div>

      {/* Active Strike Rounds */}
      {activeMarkets.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">Active Rounds</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMarkets.map((market) => (
              <StrikeRoundCard key={market.id} market={market} shareRecords={shareRecords} onClaimed={loadShareRecords} />
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolvedMarkets.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">Recently Resolved</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resolvedMarkets.map((market) => (
              <StrikeRoundCard key={market.id} market={market} shareRecords={shareRecords} onClaimed={loadShareRecords} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
