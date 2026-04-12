import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

// ─── helpers ────────────────────────────────────────────────────────────────

function detectAsset(q: string): 'BTC' | 'ETH' | 'ALEO' {
  const u = q.toUpperCase();
  if (u.includes('BTC') || u.includes('BITCOIN')) return 'BTC';
  if (u.includes('ETH') || u.includes('ETHEREUM')) return 'ETH';
  return 'ALEO';
}

function assetToSlug(a: string) { return `${a.toLowerCase()}-up-or-down`; }

type TokenType = 'aleo' | 'usdcx' | 'usad';

function useCountdownSeconds(target: number) {
  const [s, setS] = useState(0);
  useEffect(() => {
    const tick = () => setS(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return s;
}

// ─── asset config ────────────────────────────────────────────────────────────

const CFG = {
  BTC:  { color: '#F59E0B', text: 'text-amber-400', glow: 'rgba(245,158,11,0.18)' },
  ETH:  { color: '#60A5FA', text: 'text-blue-400',  glow: 'rgba(96,165,250,0.18)' },
  ALEO: { color: '#00D4B8', text: 'text-teal',      glow: 'rgba(0,212,184,0.18)'  },
} as const;

// ─── AmountSelector (local rawInput state — FULLY decoupled from parent) ────
// Bug fix: previously typing '1' or '5' matched presets and React reset the
// controlled value, preventing users from entering custom numbers.

const PRESETS = ['1', '5', '10', '25'];

function AmountSelector({
  value, onChange, tokenLabel, assetColor,
}: { value: string; onChange: (v: string) => void; tokenLabel: string; assetColor: string }) {
  const [rawInput, setRawInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isPreset = PRESETS.includes(value);

  // When parent resets to a preset, clear raw so placeholder shows again
  useEffect(() => { if (isPreset) setRawInput(''); }, [value, isPreset]);

  const handlePreset = (v: string) => { setRawInput(''); onChange(v); inputRef.current?.blur(); };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setRawInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) onChange(raw);
  };

  const customActive = !isPreset;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-heading text-gray-500">Amount ({tokenLabel})</span>
        <span className="text-[11px] font-mono tabular-nums" style={{ color: assetColor }}>{value} {tokenLabel}</span>
      </div>
      <div className="flex gap-1.5">
        {PRESETS.map((v) => (
          <button
            key={v}
            onClick={() => handlePreset(v)}
            className={`flex-1 py-2 text-xs font-mono font-semibold rounded-xl border transition-all duration-200 ${
              value === v ? 'text-white' : 'border-white/[0.07] text-gray-500 hover:text-gray-200 hover:border-white/15'
            }`}
            style={value === v ? {
              background: `linear-gradient(135deg, ${assetColor}22, ${assetColor}11)`,
              borderColor: `${assetColor}55`,
              boxShadow: `0 0 14px -4px ${assetColor}55`,
            } : {}}
          >{v}</button>
        ))}
        {/* Custom — rawInput is fully uncontrolled so typing any digit works freely */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex-[1.5] flex items-center px-2.5 rounded-xl border cursor-text transition-all duration-200"
          style={customActive ? {
            background: `linear-gradient(135deg, ${assetColor}22, ${assetColor}11)`,
            borderColor: `${assetColor}55`,
            boxShadow: `0 0 14px -4px ${assetColor}55`,
          } : { borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <input
            ref={inputRef}
            type="number"
            min="0.01"
            step="0.5"
            value={rawInput}
            placeholder="custom"
            onChange={handleCustomChange}
            onBlur={() => { if (!rawInput || parseFloat(rawInput) <= 0) { setRawInput(''); if (customActive) onChange(PRESETS[0]); } }}
            className="w-full bg-transparent text-xs font-mono text-gray-200 placeholder:text-gray-600 outline-none py-2
              [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Card entrance animation variant ─────────────────────────────────────────

const cardVariants = {
  hidden:  { opacity: 0, y: 32, filter: 'blur(10px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

// ─── StrikeRoundCard ──────────────────────────────────────────────────────────

function StrikeRoundCard({ market, shareRecords, onClaimed }: { market: Market; shareRecords: ShareRecord[]; onClaimed: () => void }) {
  const asset = detectAsset(market.question);
  const cfg   = CFG[asset];

  const secondsLeft    = useCountdownSeconds(market.endTime);
  const mins           = Math.floor((secondsLeft % 3600) / 60);
  const secs           = secondsLeft % 60;
  const hours          = Math.floor((secondsLeft % 86400) / 3600);
  const days           = Math.floor(secondsLeft / 86400);
  const countdownLabel = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}:${secs.toString().padStart(2, '0')}`;
  const isUrgent       = secondsLeft < 120 && secondsLeft > 0;
  const isExpired      = secondsLeft === 0 && market.status === 'active';
  const isResolved     = market.status === 'resolved';
  const isActive       = !isExpired && !isResolved;

  // Mouse spotlight
  const [mouse,   setMouse]   = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const { status: txStatus, execute, fetchCreditsRecord, fetchUsdcxRecord } = useTransaction();
  const [betAmount, setBetAmount] = useState('1');
  const [pendingDir, setPendingDir] = useState<'up' | 'down' | null>(null);
  const isTxInProgress = txStatus === 'preparing' || txStatus === 'proving' || txStatus === 'broadcasting';
  const marketToken    = (market.tokenType || 'ALEO').toLowerCase() as TokenType;
  const [tokenType]    = useState<TokenType>(marketToken);
  const [claiming, setClaiming] = useState(false);

  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const oraclePrices = useOracleStore((s) => s.prices);
  const addTrade     = useTradeStore((s) => s.addTrade);
  const addBet       = useLightningBetStore((s) => s.addBet);
  const removeBet    = useLightningBetStore((s) => s.removeBet);
  const allBets      = useLightningBetStore((s) => s.bets);
  const roundBets    = allBets.filter((b) => b.marketId === market.id);

  const { isOnCooldown, getRemainingSeconds, startCooldown } = useBetCooldownStore();
  const [cooldownTick, setCooldownTick] = useState(0);
  useEffect(() => {
    if (!isOnCooldown()) return;
    const id = setInterval(() => setCooldownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isOnCooldown, cooldownTick]);
  const cooldownLeft = getRemainingSeconds();
  const onCooldown   = cooldownLeft > 0;

  const liveReserves = market.reserves ?? [1_000_000, 1_000_000];
  const tokenLabel   = tokenType === 'usdcx' ? 'USDCx' : tokenType === 'usad' ? 'USAD' : 'ALEO';
  const currentPrice = oraclePrices[asset.toLowerCase() as 'btc' | 'eth' | 'aleo'] || 0;
  const fmtPrice     = (p: number) => asset === 'ALEO' ? `$${p.toFixed(4)}` : formatUSD(p);
  const hasBeatPrice = market.startPrice !== undefined && market.startPrice > 0;
  const priceUp      = hasBeatPrice ? currentPrice >= (market.startPrice ?? 0) : true;
  const priceDelta   = hasBeatPrice
    ? ((currentPrice - (market.startPrice ?? 0)) / (market.startPrice ?? 1) * 100).toFixed(2)
    : null;

  // Probability from FPMM reserves
  const [rUp, rDown] = liveReserves;
  const totalRes = rUp + rDown;
  const upPct    = totalRes > 0 ? Math.round((rDown / totalRes) * 100) : 50;
  const downPct  = 100 - upPct;

  // Real-time win estimate — Strike Rounds redeem winning shares at face
  // value (1 share = 1 microcredit), NOT through AMM sell-back which
  // under-reports for small pools.
  const amountMicro   = Math.max(0, Math.floor((parseFloat(betAmount) || 0) * 1_000_000));
  const estSharesUp   = amountMicro > 0 ? estimateBuySharesExact(liveReserves, 0, amountMicro) : 0n;
  const estSharesDown = amountMicro > 0 ? estimateBuySharesExact(liveReserves, 1, amountMicro) : 0n;
  const potWinUp   = Number(estSharesUp);
  const potWinDown = Number(estSharesDown);

  const userBet = roundBets[0];
  useEffect(() => { if (userBet)              setPendingDir(null); }, [userBet]);
  useEffect(() => { if (txStatus === 'error') setPendingDir(null); }, [txStatus]);

  const winningOutcome  = market.resolvedOutcome !== undefined ? market.resolvedOutcome + 1 : 0;
  const claimableShares = isResolved && winningOutcome > 0
    ? shareRecords.filter((r) => r.marketId === market.id && r.outcome === winningOutcome) : [];
  const sellableShares  = isExpired && !isResolved
    ? shareRecords.filter((r) => r.marketId === market.id) : [];

  const refreshChain = useCallback(
    () => fetch(`${API_BASE}/markets/refresh`, { method: 'POST' }).then(() => fetchMarkets()).catch(() => fetchMarkets()),
    [fetchMarkets],
  );

  const handleBet = async (direction: 'up' | 'down') => {
    if (amountMicro < 1000 || onCooldown) return;
    setPendingDir(direction);
    const outcome     = direction === 'up' ? 0 : 1;
    const exactShares = estimateBuySharesExact(liveReserves, outcome, amountMicro);
    if (exactShares <= 0n) { setPendingDir(null); return; }
    const minShares = exactShares * 95n / 100n;
    const nonce     = generateNonce();
    let tx;
    if (tokenType === 'usdcx' || tokenType === 'usad') {
      const st = tokenType === 'usad' ? 'USAD' : 'USDCX';
      const tokenRecord = await fetchUsdcxRecord(amountMicro, st);
      if (!tokenRecord) { setPendingDir(null); return; }
      const proofs = await getUsdcxProofs(st);
      tx = buildBuySharesStableTx(st, market.id, outcome, `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce, tokenRecord, proofs);
    } else {
      const record = await fetchCreditsRecord(amountMicro);
      if (!record) { setPendingDir(null); return; }
      tx = buildBuySharesPrivateTx(market.id, outcome, `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce, record);
    }
    // Start cooldown BEFORE execute so other cards are immediately blocked,
    // preventing concurrent bets that would reuse the same token record.
    startCooldown();
    const txId = await execute(tx, refreshChain, (rejectedId) => {
      // On-chain rejection detected — remove the local bet so UI doesn't
      // show "Your Bet" for a transaction that didn't actually land.
      removeBet(rejectedId);
    });
    if (txId) {
      addBet({ roundId: market.id, marketId: market.id, asset, direction, amount: amountMicro, shares: Number(exactShares), timestamp: Date.now(), startPrice: currentPrice, tokenType, txId });
      addTrade({ marketId: market.id, type: 'buy', outcome: direction === 'up' ? 'Up' : 'Down', amount: amountMicro, shares: Number(exactShares), price: 0.5, timestamp: Date.now() });
      refreshChain();
    } else { setPendingDir(null); }
  };

  const handleClaim = async (record: ShareRecord) => {
    setClaiming(true);
    try {
      const tt = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;
      await execute(buildRedeemSharesTx(record.plaintext, tt as any), onClaimed);
    } finally { setClaiming(false); }
  };

  const handleSellAMM = async (record: ShareRecord) => {
    setClaiming(true);
    try {
      const tt = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;
      const { tokensOut } = estimateSellTokensOut(liveReserves, record.outcome - 1, record.quantity);
      if (tokensOut <= 0) return;
      await execute(buildSellSharesTx(record.plaintext, `${tokensOut}u128`, `${record.quantity}u128`, tt as any), onClaimed);
    } finally { setClaiming(false); }
  };

  const txLabel = txStatus === 'preparing' ? 'Preparing...' : txStatus === 'proving' ? 'Generating ZK proof...' : 'Broadcasting...';

  return (
    <motion.div
      variants={cardVariants}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(14,14,18,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: isActive
          ? `0 0 60px -18px ${cfg.glow}, 0 4px 30px rgba(0,0,0,0.6)`
          : '0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      {/* Mouse spotlight */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl transition-opacity duration-400"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(260px circle at ${mouse.x}px ${mouse.y}px, ${cfg.glow}, transparent 65%)`,
        }}
      />

      {/* Animated top bar */}
      <div className="relative h-[3px] w-full overflow-hidden flex-shrink-0">
        <div className="absolute inset-0" style={{
          background: isResolved
            ? market.resolvedOutcome === 0 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#ef4444,#dc2626)'
            : `linear-gradient(90deg, ${cfg.color}44, ${cfg.color}, ${cfg.color}44)`,
        }} />
        {isActive && (
          <motion.div
            className="absolute inset-y-0 w-2/5"
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}dd, transparent)` }}
          />
        )}
      </div>

      <div className="relative z-10 p-5 flex flex-col gap-4 flex-1">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          {/* Icon with live dot */}
          <div className="relative flex-shrink-0">
            <div
              className="w-11 h-11 rounded-[14px] flex items-center justify-center"
              style={{ background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)`, border: `1px solid ${cfg.color}28` }}
            >
              <CryptoIcon symbol={asset} size={22} />
            </div>
            {isActive && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: cfg.color }} />
                <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-[#0e0e12]" style={{ background: cfg.color }} />
              </span>
            )}
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[15px] font-heading font-bold tracking-tight ${cfg.text}`}>{asset}</span>
              <span className="text-[10px] text-gray-600 font-heading">Strike</span>
              {market.tokenType && market.tokenType !== 'ALEO' && <Badge variant="gray" size="sm">{market.tokenType}</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={isResolved ? 'gray' : isExpired ? 'warning' : 'success'} size="sm" pulse={isActive}>
                {isResolved ? 'RESOLVED' : isExpired ? 'SETTLING...' : 'LIVE'}
              </Badge>
              {market.roundNumber && <span className="text-[10px] text-gray-600 font-mono">#{market.roundNumber}</span>}
            </div>
          </div>

          {/* Countdown */}
          {isActive && (
            <motion.div
              animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
              transition={isUrgent ? { duration: 0.8, repeat: Infinity } : {}}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-center ${
                isUrgent ? 'bg-accent-red/10 border border-accent-red/30' : 'bg-white/[0.03] border border-white/[0.06]'
              }`}
            >
              <div className={`text-lg font-mono font-bold tabular-nums leading-none ${isUrgent ? 'text-accent-red' : 'text-white'}`}>
                {countdownLabel}
              </div>
              <div className="text-[9px] text-gray-600 font-heading uppercase tracking-wider mt-0.5">left</div>
            </motion.div>
          )}
        </div>

        {/* ── Series CTA ─────────────────────────────────────────── */}
        <Link
          to={`/series/${assetToSlug(asset)}`}
          className="group/cta flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${cfg.glow}, rgba(255,255,255,0.01))`,
            border: `1px solid ${cfg.color}28`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = `${cfg.color}60`;
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 0 24px -8px ${cfg.glow}`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = `${cfg.color}28`;
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '';
          }}
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-heading font-semibold text-gray-300 group-hover/cta:text-white transition-colors">View Live Chart &amp; Details</div>
            <div className="text-[10px] text-gray-600 mt-0.5">Full price history, series stats &amp; more rounds</div>
          </div>
          <motion.span
            className="text-sm flex-shrink-0"
            style={{ color: cfg.color }}
            animate={{ x: [0, 2, 0], y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >↗</motion.span>
        </Link>

        {/* ── Price Row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          {/* Price to Beat */}
          <div className="px-3.5 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-heading mb-1.5">Price To Beat</div>
            {hasBeatPrice ? (
              <>
                <div className="text-sm font-mono font-bold text-amber-400 tabular-nums">{fmtPrice(market.startPrice!)}</div>
                <div className="text-[9px] text-gray-600 mt-0.5">at round open</div>
              </>
            ) : (
              <>
                <div className="text-sm font-mono font-bold text-gray-600 tabular-nums">—</div>
                <div className="text-[9px] text-gray-700 mt-0.5">set when round starts</div>
              </>
            )}
          </div>

          {/* Live Price → series link */}
          <Link
            to={`/series/${assetToSlug(asset)}`}
            className="group/p px-3.5 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/10 transition-all block"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-heading">Live Price</span>
              <span className="text-[9px] opacity-0 group-hover/p:opacity-100 transition-opacity" style={{ color: cfg.color }}>↗</span>
            </div>
            <div className={`text-sm font-mono font-bold tabular-nums ${priceUp ? 'text-accent-green' : 'text-accent-red'}`}>
              {fmtPrice(currentPrice)}
            </div>
            {priceDelta && (
              <div className={`text-[9px] mt-0.5 font-mono ${priceUp ? 'text-accent-green/60' : 'text-accent-red/60'}`}>
                {priceUp ? '+' : ''}{priceDelta}% vs target
              </div>
            )}
          </Link>
        </div>

        {/* ── Probability Bar ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-heading mb-1.5">
            <span className="text-accent-green font-semibold">↑ UP {upPct}%</span>
            <span className="text-gray-700 text-[9px]">probability</span>
            <span className="text-accent-red font-semibold">↓ DOWN {downPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-accent-red/15 relative">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: '50%' }}
              animate={{ width: `${upPct}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              style={{ background: 'linear-gradient(90deg, #22c55e, #16a34a)' }}
            />
          </div>
        </div>

        {/* ── Pool Stats ──────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-0 border-t border-white/[0.04] pt-3">
          {[
            { label: 'Pool',   val: `${formatAleo(market.totalLiquidity)} ${tokenLabel}` },
            { label: 'Trades', val: String(market.tradeCount) },
            { label: 'Volume', val: `${formatAleo(market.totalVolume)} ${tokenLabel}` },
            { label: 'Token',  val: tokenLabel },
          ].map(({ label, val }, i) => (
            <div key={i} className={`text-center ${i > 0 ? 'border-l border-white/[0.04]' : ''}`}>
              <div className="text-[9px] text-gray-600 font-heading uppercase tracking-wide mb-0.5">{label}</div>
              <div className="text-[10px] font-mono text-gray-400 leading-tight">{val}</div>
            </div>
          ))}
        </div>

        {/* ── Trade Area ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3">
          <AnimatePresence mode="wait">
            {isExpired && !isResolved ? (
              <motion.div key="settling"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="py-5 rounded-xl border border-amber-400/12 bg-amber-400/[0.03] text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-amber-400"
                  />
                  <span className="text-sm font-heading text-amber-400/90">Settling on-chain...</span>
                </div>
                <p className="text-[10px] text-gray-500">Bot is resolving rounds. Results in ~5 min.</p>
              </motion.div>

            ) : isResolved ? (
              <motion.div key="resolved"
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <div className={`text-center py-3 rounded-xl border font-heading font-bold text-sm ${
                  market.resolvedOutcome === 0
                    ? 'border-accent-green/20 bg-accent-green/[0.07] text-accent-green'
                    : 'border-accent-red/20 bg-accent-red/[0.07] text-accent-red'
                }`}>
                  {market.resolvedOutcome === 0 ? '↑ UP WINS' : '↓ DOWN WINS'}
                </div>
                {claimableShares.map((record, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-accent-green/80">{formatAleo(record.quantity)} shares</span>
                    <Button variant="primary" size="sm" onClick={() => handleClaim(record)} loading={claiming || isTxInProgress}
                      className="!text-xs !py-1.5 !px-4 !bg-accent-green !text-black !border-accent-green">
                      {txStatus === 'proving' ? 'Proving...' : '💰 Claim'}
                    </Button>
                  </div>
                ))}
              </motion.div>

            ) : isTxInProgress && pendingDir ? (
              <motion.div key="pending"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`p-4 rounded-xl border ${
                  pendingDir === 'up' ? 'border-accent-green/20 bg-accent-green/[0.05]' : 'border-accent-red/20 bg-accent-red/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-heading text-gray-400">Placing Bet...</span>
                  <Badge variant={pendingDir === 'up' ? 'success' : 'danger'} size="sm">
                    {pendingDir === 'up' ? '↑ UP' : '↓ DOWN'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2.5">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 rounded-full border-2"
                    style={{
                      borderColor: pendingDir === 'up' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                      borderTopColor: pendingDir === 'up' ? '#22c55e' : '#ef4444',
                    }}
                  />
                  <span className="text-xs text-gray-500">{txLabel}</span>
                </div>
                <div className="mt-1.5 text-[10px] text-gray-600">{betAmount} {tokenLabel} wagered</div>
              </motion.div>

            ) : userBet ? (
              <motion.div key="userbet"
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className={`p-3.5 rounded-xl border ${
                  userBet.direction === 'up'
                    ? 'border-accent-green/20 bg-gradient-to-br from-accent-green/[0.08] to-transparent'
                    : 'border-accent-red/20 bg-gradient-to-br from-accent-red/[0.08] to-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-heading font-semibold text-gray-300">Your Bet</span>
                  <Badge variant={userBet.direction === 'up' ? 'success' : 'danger'} size="sm">
                    {userBet.direction === 'up' ? '↑ UP' : '↓ DOWN'}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Wagered</span>
                    <span className="font-mono text-white">{formatAleo(userBet.amount)} {tokenLabel}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Potential Return</span>
                    <span className="font-mono" style={{ color: cfg.color }}>{formatAleo(userBet.shares)} {tokenLabel}</span>
                  </div>
                </div>
              </motion.div>

            ) : onCooldown ? (
              <motion.div key="cooldown"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] text-center"
              >
                <div className="text-[10px] text-amber-400/70 font-heading uppercase tracking-wider mb-2">Transaction Cooldown</div>
                <motion.div
                  key={cooldownLeft}
                  initial={{ scale: 1.15, opacity: 0.2 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-3xl font-mono font-bold text-amber-400 tabular-nums"
                >{cooldownLeft}s</motion.div>
                <p className="text-[10px] text-gray-600 mt-1.5">Wait for your previous bet to confirm</p>
              </motion.div>

            ) : isActive ? (
              <motion.div key="form"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <AmountSelector
                  value={betAmount}
                  onChange={setBetAmount}
                  tokenLabel={tokenLabel}
                  assetColor={cfg.color}
                />

                {/* Win estimate */}
                {amountMicro >= 1000 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-2 gap-1.5 text-[10px]"
                  >
                    <div className="flex justify-between items-center px-2.5 py-2 rounded-lg bg-accent-green/[0.04] border border-accent-green/10">
                      <span className="text-gray-600">Win if UP</span>
                      <span className="font-mono text-accent-green font-semibold">{formatAleo(potWinUp)}</span>
                    </div>
                    <div className="flex justify-between items-center px-2.5 py-2 rounded-lg bg-accent-red/[0.04] border border-accent-red/10">
                      <span className="text-gray-600">Win if DOWN</span>
                      <span className="font-mono text-accent-red font-semibold">{formatAleo(potWinDown)}</span>
                    </div>
                  </motion.div>
                )}

                {/* UP / DOWN buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    onClick={() => handleBet('up')}
                    disabled={amountMicro < 1000 || isTxInProgress || onCooldown}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="relative py-4 rounded-xl border border-accent-green/25 overflow-hidden
                      bg-gradient-to-br from-accent-green/18 to-accent-green/6
                      hover:from-accent-green/30 hover:border-accent-green/50
                      hover:shadow-[0_0_30px_-4px_rgba(34,197,94,0.45)]
                      transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed group/up"
                  >
                    <div className="absolute inset-0 opacity-0 group-hover/up:opacity-100 pointer-events-none overflow-hidden rounded-xl">
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }}
                        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent-green/25 to-transparent -skew-x-12"
                      />
                    </div>
                    <div className="relative flex items-center justify-center gap-1.5">
                      <ArrowUpIcon className="w-4 h-4 text-accent-green" />
                      <span className="font-heading font-bold text-sm text-accent-green">UP</span>
                      <span className="text-[10px] text-accent-green/55 font-mono">{upPct}¢</span>
                    </div>
                  </motion.button>

                  <motion.button
                    onClick={() => handleBet('down')}
                    disabled={amountMicro < 1000 || isTxInProgress || onCooldown}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="relative py-4 rounded-xl border border-accent-red/25 overflow-hidden
                      bg-gradient-to-br from-accent-red/18 to-accent-red/6
                      hover:from-accent-red/30 hover:border-accent-red/50
                      hover:shadow-[0_0_30px_-4px_rgba(239,68,68,0.45)]
                      transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed group/dn"
                  >
                    <div className="absolute inset-0 opacity-0 group-hover/dn:opacity-100 pointer-events-none overflow-hidden rounded-xl">
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }}
                        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent-red/25 to-transparent -skew-x-12"
                      />
                    </div>
                    <div className="relative flex items-center justify-center gap-1.5">
                      <ArrowDownIcon className="w-4 h-4 text-accent-red" />
                      <span className="font-heading font-bold text-sm text-accent-red">DOWN</span>
                      <span className="text-[10px] text-accent-red/55 font-mono">{downPct}¢</span>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Expired — sell via AMM */}
          {isExpired && sellableShares.length > 0 && (
            <div className="space-y-1.5 mt-1">
              <p className="text-[10px] text-gray-500 font-heading uppercase tracking-wider">Sell via AMM:</p>
              {sellableShares.map((record, idx) => {
                const tl = record.tokenType === 1 ? 'USDCx' : record.tokenType === 2 ? 'USAD' : 'ALEO';
                const { tokensOut } = estimateSellTokensOut(liveReserves, record.outcome - 1, record.quantity);
                return (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs font-mono" style={{ color: cfg.color }}>
                      ~{formatAleo(calculateFees(tokensOut).amountAfterFee)} {tl}
                    </span>
                    <Button variant="primary" size="sm" onClick={() => handleSellAMM(record)} loading={claiming || isTxInProgress} className="!text-xs !py-1 !px-3">💸 Sell</Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── stagger container variant ───────────────────────────────────────────────

const gridVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

interface ActiveRoundsProps {
  markets: never[];
}

export default function ActiveRounds({ }: ActiveRoundsProps) {
  const allMarkets = useMarketStore((s) => s.markets);
  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const storeLoading = useMarketStore((s) => s.loading);
  const { fetchShareRecords } = useTransaction();
  const [shareRecords, setShareRecords] = useState<ShareRecord[]>([]);

  // Use ref for share record loader to avoid effect re-runs on identity change
  const loadShareRecordsRef = useRef<() => Promise<void>>();
  loadShareRecordsRef.current = async () => {
    const records = await fetchShareRecords();
    setShareRecords(records);
  };

  useEffect(() => {
    // Only fetch markets if store is empty (parent Rounds handles polling)
    if (allMarkets.length === 0) fetchMarkets().catch(() => {});
    loadShareRecordsRef.current?.();
    const shareId = setInterval(() => loadShareRecordsRef.current?.(), 30_000);
    return () => { clearInterval(shareId); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const strikeMarkets  = allMarkets.filter((m) => m.isLightning && m.question.toLowerCase().includes('strike round'));
  const activeMarkets  = strikeMarkets.filter((m) => m.status === 'active');
  const resolvedMarkets = strikeMarkets.filter((m) => m.status === 'resolved').slice(0, 6);

  // Loading skeleton only on first load with zero data
  if (storeLoading && allMarkets.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[560px] rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        ))}
      </div>
    );
  }

  if (activeMarkets.length === 0 && resolvedMarkets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
          <BoltIcon className="w-8 h-8 text-gray-600" />
        </div>
        <p className="text-gray-400 font-heading">Waiting for Strike Rounds</p>
        <p className="text-xs text-gray-600 mt-1">Rounds will appear automatically when the bot creates them</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <RefreshButton onRefresh={async () => { await fetchMarkets(); await loadShareRecordsRef.current?.(); }} label="Refresh" />
      </div>

      {activeMarkets.length === 0 && resolvedMarkets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-6 rounded-xl border border-teal/10 bg-teal/[0.03] text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 rounded-full border-2 border-teal/30 border-t-teal"
            />
            <span className="text-sm font-heading text-teal/80">Creating next rounds...</span>
          </div>
          <p className="text-[10px] text-gray-600">New rounds appear automatically every 5 minutes</p>
        </motion.div>
      )}

      {activeMarkets.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
              <h3 className="text-xs text-gray-400 uppercase tracking-widest font-heading">Active Rounds</h3>
            </div>
            <div className="flex-1 h-px bg-white/[0.04]" />
            <span className="text-xs font-mono text-gray-600">{activeMarkets.length} live</span>
          </div>
          <motion.div
            variants={gridVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {activeMarkets.map((market) => (
              <StrikeRoundCard key={market.id} market={market} shareRecords={shareRecords} onClaimed={() => loadShareRecordsRef.current?.()} />
            ))}
          </motion.div>
        </div>
      )}

      {resolvedMarkets.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-widest font-heading">Recently Resolved</h3>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <motion.div
            variants={gridVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {resolvedMarkets.map((market) => (
              <StrikeRoundCard key={market.id} market={market} shareRecords={shareRecords} onClaimed={() => loadShareRecordsRef.current?.()} />
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}

