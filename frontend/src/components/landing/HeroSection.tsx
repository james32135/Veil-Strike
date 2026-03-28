import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useRef, useCallback, useMemo } from 'react';
import { ShieldIcon, BoltIcon } from '@/components/icons';
import { useMarketStore } from '@/stores/marketStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useOracleStore } from '@/stores/oracleStore';
import { calculatePrices } from '@/utils/fpmm';
import { formatAleo } from '@/utils/format';
import { PRECISION } from '@/constants';
import CryptoIcon from '@/components/shared/CryptoIcon';

/* ─── ANIMATED TEXT (blur-in-up word by word) ─── */
function AnimText({ children, delay = 0, className = '', gradient = false }: { children: string; delay?: number; className?: string; gradient?: boolean }) {
  const words = children.split(' ');
  const gradientStyle: React.CSSProperties = gradient ? {
    background: 'linear-gradient(135deg, #FF6B35, #FF3D00)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  } : {};

  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block whitespace-pre"
          style={gradientStyle}
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, delay: delay + i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {word}{' '}
        </motion.span>
      ))}
    </span>
  );
}

/* ─── PARTICLE FIELD ─── */
function ParticleField() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      dur: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.25 + 0.05,
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `rgba(255, 107, 53, ${p.opacity})`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity],
          }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ─── SPOTLIGHT CARD (3D tilt + cursor spotlight) ─── */
function SpotlightCard({
  children,
  className = '',
  floatDelay = 0,
  rotation = 0,
  glowIntensity = 0.15,
}: {
  children: React.ReactNode;
  className?: string;
  floatDelay?: number;
  rotation?: number;
  glowIntensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [5, -5]), { damping: 20, stiffness: 150 });
  const ry = useSpring(useTransform(mx, [0, 1], [-5, 5]), { damping: 20, stiffness: 150 });
  const spotX = useTransform(mx, (v) => `${v * 100}%`);
  const spotY = useTransform(my, (v) => `${v * 100}%`);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }, [mx, my]);

  const onLeave = useCallback(() => { mx.set(0.5); my.set(0.5); }, [mx, my]);

  return (
    <motion.div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{
        rotateX: rx,
        rotateY: ry,
        transformStyle: 'preserve-3d',
        background: 'rgba(18, 18, 18, 0.65)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '24px',
        boxShadow: `0 0 0 1px rgba(255, 255, 255, 0.02), inset 0 1px 0 0 rgba(255, 255, 255, 0.04), 0 8px 40px -8px rgba(0, 0, 0, 0.9), 0 0 60px -20px rgba(255, 107, 53, ${glowIntensity})`,
      }}
      animate={{ y: [0, -10, 0], rotate: rotation }}
      transition={{ duration: 5 + floatDelay, repeat: Infinity, ease: 'easeInOut', delay: floatDelay }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          left: spotX,
          top: spotY,
          x: '-50%',
          y: '-50%',
          background: 'radial-gradient(circle, rgba(255, 107, 53, 0.12) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/* ─── HERO SECTION ─── */
export default function HeroSection() {
  const markets = useMarketStore((s) => s.markets);
  const trades = useTradeStore((s) => s.trades);
  const oraclePrices = useOracleStore((s) => s.prices);
  const activeMarkets = markets.filter((m) => m.status === 'active').length;
  const totalVolume = markets.reduce((sum, m) => sum + (m.totalVolume || 0), 0);
  const totalLiquidity = markets.reduce((sum, m) => sum + (m.totalLiquidity || 0), 0);

  const fmt = (micro: number) => {
    const v = micro / 1_000_000;
    return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(1);
  };

  return (
    <section className="relative min-h-[100vh] flex flex-col items-center justify-center overflow-hidden -mt-[72px] pt-[72px]">
      {/* BG layers */}
      <div className="hero-gradient-mesh" />
      <div className="grid-overlay" />
      <div className="noise-overlay" />
      <ParticleField />

      {/* Main aurora */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255, 61, 0, 0.22) 0%, rgba(255, 107, 53, 0.08) 35%, transparent 65%)',
          filter: 'blur(60px)',
          top: '-20%',
          left: '50%',
          x: '-50%',
        }}
        animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── CONTENT ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 text-center py-16">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8"
          style={{
            background: 'rgba(255, 107, 53, 0.06)',
            border: '1px solid rgba(255, 107, 53, 0.12)',
            boxShadow: '0 0 20px -8px rgba(255, 107, 53, 0.2)',
          }}
        >
          <ShieldIcon className="w-3.5 h-3.5 text-teal" />
          <span className="text-xs text-teal font-heading font-medium tracking-wide">Built on Aleo — Zero-Knowledge Privacy</span>
        </motion.div>

        {/* ── HEADLINE — responsive, no overflow ── */}
        <h1 className="font-heading font-bold text-white leading-[1.08] tracking-tight mb-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
          <AnimText delay={0.15}>Step Into The Future Of</AnimText>
          <br />
          <AnimText delay={0.65} gradient={true}>Private Predictions</AnimText>
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-base md:text-lg text-smoke/60 max-w-lg mx-auto mb-10 leading-relaxed font-body"
        >
          Zero-knowledge prediction markets with 15-minute auto-resolved Strike Rounds. Every bet, position, and payout is encrypted on-chain — only you can see it.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link to="/markets" className="btn-primary text-sm px-8 py-3.5 flex items-center gap-2 relative overflow-hidden group">
            <motion.span
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />
            <span className="relative z-10 flex items-center gap-2">
              Get Started
              <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>→</motion.span>
            </span>
          </Link>
          <Link to="/rounds" className="btn-secondary text-sm px-7 py-3.5 flex items-center gap-2">
            <BoltIcon className="w-3.5 h-3.5 text-teal" />
            Strike Rounds
          </Link>
        </motion.div>

        {/* ── FLOATING GLASS CARDS ── */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.9, duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mt-16 relative flex items-end justify-center gap-4 md:gap-5 max-w-4xl mx-auto"
          style={{ perspective: '1200px', height: '300px' }}
        >
          {/* LEFT — Top Markets (real data) */}
          <SpotlightCard className="p-5 w-[250px] hidden lg:block" floatDelay={0} rotation={-2}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-heading font-semibold text-white">Markets</span>
              <Link to="/markets" className="text-[10px] text-teal font-mono cursor-pointer hover:underline">See All</Link>
            </div>
            {markets.filter((m) => m.status === 'active').slice(0, 3).map((m) => {
              const prices = calculatePrices(m.reserves);
              const topProb = prices.length > 0 ? (prices[0] / PRECISION) * 100 : 50;
              const questionLower = m.question.toLowerCase();
              const icon = questionLower.includes('btc') || questionLower.includes('bitcoin') ? 'BTC'
                : questionLower.includes('eth') || questionLower.includes('ethereum') ? 'ETH'
                : questionLower.includes('aleo') ? 'ALEO' : null;
              return (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-teal/8 flex items-center justify-center border border-teal/10 flex-shrink-0">
                      {icon ? <CryptoIcon symbol={icon} size={16} /> : <span className="text-[10px]">📊</span>}
                    </div>
                    <p className="text-[11px] font-medium text-white truncate">{m.question.length > 22 ? m.question.slice(0, 22) + '…' : m.question}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-[11px] font-mono text-white">{formatAleo(m.totalVolume)}</p>
                    <p className="text-[10px] font-mono text-accent-green">{topProb.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
            {markets.filter((m) => m.status === 'active').length === 0 && (
              <p className="text-[10px] text-smoke/30 text-center py-4">No active markets yet</p>
            )}
          </SpotlightCard>

          {/* CENTER — Protocol Stats dashboard (real data) */}
          <SpotlightCard className="p-6 w-[280px] md:w-[310px] z-10" floatDelay={0.5} rotation={0} glowIntensity={0.2}>
            <div className="flex items-center justify-between mb-2">
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <span className="text-[10px] text-smoke/50">☰</span>
              </div>
              <div className="flex gap-0.5 bg-white/[0.03] rounded-full p-0.5 border border-white/[0.05]">
                {['Volume', 'Markets', 'TVL'].map((t, i) => (
                  <span key={t} className={`px-2 py-1 rounded-full text-[9px] font-medium ${i === 0 ? 'bg-gradient-to-r from-teal to-neon-red text-white shadow-glow-sm' : 'text-smoke/30'}`}>{t}</span>
                ))}
              </div>
            </div>

            <div className="text-center my-5">
              <p className="text-[2.5rem] font-mono font-bold text-white tracking-tight leading-none">{fmt(totalVolume)}</p>
              <p className="text-[10px] text-smoke/30 mt-1.5 tracking-[0.25em] font-heading uppercase">Total Volume (ALEO)</p>
            </div>

            <div className="relative h-[70px] mb-3">
              <svg viewBox="0 0 300 70" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="hcg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: '#FF6B35', stopOpacity: 0.2 }} />
                    <stop offset="100%" style={{ stopColor: '#FF6B35', stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
                <path d="M0 55 Q25 48 50 44 T100 30 T150 40 T200 15 T250 25 T300 8" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" />
                <path d="M0 55 Q25 48 50 44 T100 30 T150 40 T200 15 T250 25 T300 8 V70 H0 Z" fill="url(#hcg)" />
              </svg>
            </div>

            <div className="flex items-center justify-between text-[10px]">
              <span className="text-smoke/25">{activeMarkets || markets.length} active markets</span>
              <span className="text-accent-green font-mono">TVL {fmt(totalLiquidity)} <span className="text-smoke/15">ALEO</span></span>
            </div>
          </SpotlightCard>

          {/* RIGHT — Live Oracle Prices (real data) */}
          <SpotlightCard className="p-5 w-[250px] hidden lg:block" floatDelay={1} rotation={2}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-heading font-semibold text-white">Live Prices</span>
              <span className="text-smoke/20 cursor-pointer">⋮</span>
            </div>
            <div className="flex items-center gap-1.5 mb-4">
              <span className="px-2.5 py-1 rounded-full text-[10px] bg-gradient-to-r from-teal to-neon-red text-white font-medium shadow-glow-sm">Oracle</span>
              <span className="text-[9px] text-smoke/25">CoinGecko · Live</span>
            </div>
            {[
              { symbol: 'BTC' as const, label: 'BTC', price: oraclePrices.btc },
              { symbol: 'ETH' as const, label: 'ETH', price: oraclePrices.eth },
              { symbol: 'ALEO' as const, label: 'ALEO', price: oraclePrices.aleo },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-xl mb-2 last:mb-0 border border-white/[0.03]">
                <div className="flex items-center gap-2">
                  <CryptoIcon symbol={r.symbol} size={16} />
                  <span className="text-[12px] font-medium text-white">{r.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono text-white">${r.price >= 1000 ? r.price.toLocaleString(undefined, { maximumFractionDigits: 0 }) : r.price.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </SpotlightCard>
        </motion.div>
      </div>

      {/* Partner logos */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.6, duration: 0.6 }}
        className="relative z-10 w-full max-w-3xl mx-auto px-4 py-8"
      >
        <p className="text-center text-[10px] text-smoke/20 mb-4 tracking-[0.2em] font-heading uppercase">
          Simplifying Blockchain Workflows For <span className="text-white/60 font-semibold">2,500+</span> Organizations
        </p>
        <div className="flex items-center justify-center gap-8 md:gap-12 flex-wrap opacity-20">
          {['Aleo', 'snarkVM', 'Leo', 'Shield', 'CoinGecko'].map((n) => (
            <span key={n} className="text-smoke text-[11px] font-heading font-medium tracking-wider">◆ {n}</span>
          ))}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.8, duration: 0.5 }}
        className="relative z-10 w-full max-w-3xl mx-auto px-4 pb-16"
      >
        <div className="glass-card p-5 flex items-center justify-around">
          {[
            { l: 'Total Volume', v: `${fmt(totalVolume)} ALEO` },
            { l: 'Markets', v: String(activeMarkets || markets.length) },
            { l: 'Trades', v: String(trades.length) },
            { l: 'TVL', v: `${fmt(totalLiquidity)} ALEO` },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="font-mono text-base md:text-lg font-bold text-white">{s.v}</p>
              <p className="text-[9px] text-smoke/25 uppercase tracking-[0.2em] mt-0.5 font-heading">{s.l}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-dark to-transparent pointer-events-none" />
    </section>
  );
}
