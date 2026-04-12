import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import CryptoIcon from '@/components/shared/CryptoIcon';

const rounds = [
  { asset: 'BTC', pair: 'BTC / USD', color: '#F7931A' },
  { asset: 'ETH', pair: 'ETH / USD', color: '#627EEA' },
  { asset: 'ALEO', pair: 'ALEO / USD', color: '#FF6B35' },
];

const features = [
  { title: 'Auto-Resolved', desc: 'Every round resolves automatically after 5 minutes via on-chain oracles. No waiting.' },
  { title: 'USDCx Bets', desc: 'Bet with USDCx — private, backed 1:1 by USDC. Your balance stays encrypted.' },
  { title: 'Delegated Proving', desc: 'Our prover network handles ZK proof generation. You just click and bet.' },
  { title: 'Non-Stop', desc: 'Rounds open 24/7. As soon as one ends, the next begins. Always a live round.' },
];

export default function LightningSection() {
  return (
    <section className="py-28 px-4 relative">
      {/* Gradient accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-teal/5 rounded-full blur-[120px] -translate-y-1/2" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — Info */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <span className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-4">Strike Rounds</span>
            <h2 className="section-title mb-4">
              5-Minute{' '}
              <span className="gradient-text">Lightning Rounds</span>
            </h2>
            <p className="text-smoke/55 leading-relaxed mb-8 max-w-md">
              Predict whether BTC, ETH, or ALEO will go up or down in 5 minutes. 
              Each round locks automatically, resolves via oracle price feeds, and pays winners instantly — all on-chain, all private.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {features.map((f, i) => (
                <motion.div key={f.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
                  className="group">
                  <h4 className="text-sm font-heading font-semibold text-white/80 mb-1">{f.title}</h4>
                  <p className="text-xs text-smoke/40 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>

            <Link to="/rounds" className="btn-primary inline-flex items-center gap-2 text-sm">
              <span>⚡</span> Enter Strike Rounds
            </Link>
          </motion.div>

          {/* Right — Live Round Mockup */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card p-6 relative overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                <span className="text-xs font-heading text-white/60">LIVE ROUND</span>
              </div>
              <span className="text-[10px] text-smoke/30 font-mono">15:00 DURATION</span>
            </div>

            {/* Rounds */}
            <div className="space-y-3">
              {rounds.map((r, i) => (
                <motion.div key={r.asset}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${r.color}15` }}>
                      <CryptoIcon symbol={r.asset} size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-heading text-white/80">{r.pair}</p>
                      <p className="text-[10px] text-smoke/30">5-min round</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg text-[10px] font-heading font-semibold bg-accent-green/10 text-accent-green border border-accent-green/20 hover:bg-accent-green/20 transition-colors">
                      UP ↑
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-[10px] font-heading font-semibold bg-neon-red/10 text-neon-red border border-neon-red/20 hover:bg-neon-red/20 transition-colors">
                      DOWN ↓
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Chart mockup */}
            <div className="mt-6 h-24 rounded-lg bg-white/[0.01] border border-white/[0.04] flex items-end justify-around px-4 pb-2 overflow-hidden">
              {Array.from({ length: 30 }).map((_, i) => {
                const h = 15 + Math.sin(i * 0.5) * 30 + Math.random() * 20;
                return (
                  <motion.div key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.02, duration: 0.4 }}
                    className="w-1 rounded-full"
                    style={{ background: h > 50 ? '#00D46E' : '#FF3D00', opacity: 0.4 + (i / 30) * 0.6 }}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-smoke/20 text-center mt-2 font-mono">Price movement — last 30 ticks</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
