import { motion } from 'framer-motion';
import { ShieldIcon, LockIcon, ZKProofIcon } from '@/components/icons';

const privacyLayers = [
  {
    icon: <ShieldIcon className="w-6 h-6" />,
    title: 'Invisible Identity',
    detail: 'Your wallet address never appears in finalize functions. Market IDs are derived from random nonces — not creator addresses. No on-chain link to you.',
    tag: 'Identity',
  },
  {
    icon: <LockIcon className="w-6 h-6" />,
    title: 'Encrypted Transfers',
    detail: 'All deposits use transfer_private_to_public. All payouts use transfer_public_to_private. Your credits flow through ZK-encrypted channels — sender and amount hidden.',
    tag: 'Transfers',
  },
  {
    icon: <ZKProofIcon className="w-6 h-6" />,
    title: 'Record-Based Positions',
    detail: 'Share positions, LP receipts, dispute bonds, and refund claims are stored as encrypted Aleo records. Only the holder\'s view key can decrypt them.',
    tag: 'Records',
  },
];

const privacyTable = [
  { what: 'Trader identity', privacy: 'Fully Private', level: 'green' },
  { what: 'Position sizes', privacy: 'Encrypted Record', level: 'green' },
  { what: 'LP positions', privacy: 'Encrypted LPToken', level: 'green' },
  { what: 'All payouts', privacy: 'Private ZK Transfer', level: 'green' },
  { what: 'Dispute bonds', privacy: 'Encrypted Receipt', level: 'green' },
  { what: 'Market state / AMM', privacy: 'Public (fair pricing)', level: 'yellow' },
  { what: 'Winning outcome', privacy: 'Public (at finalization)', level: 'yellow' },
];

export default function PrivacySection() {
  return (
    <section className="py-28 px-4 relative">
      {/* Section glow */}
      <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255, 107, 53, 0.04) 0%, transparent 60%)', filter: 'blur(80px)' }} />

      <div className="max-w-6xl mx-auto relative">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-4">Privacy Architecture</motion.span>
          <h2 className="section-title mb-4">
            Your Data,{' '}
            <span className="gradient-text">Your Control</span>
          </h2>
          <p className="text-smoke/55 max-w-2xl mx-auto leading-relaxed">
            Unlike Polymarket and Azuro where every trade is public, Veil Strike encrypts everything by default using Aleo's zero-knowledge proofs. No one can see what you bet, how much you hold, or what you won.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Privacy cards */}
          <div className="space-y-4">
            {privacyLayers.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, x: -25 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }} whileHover={{ x: 4 }}
                className="glass-card p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="flex items-start gap-4">
                  <motion.div className="w-11 h-11 rounded-xl flex items-center justify-center text-teal flex-shrink-0"
                    style={{ background: 'rgba(255, 107, 53, 0.08)', border: '1px solid rgba(255, 107, 53, 0.15)' }}
                    whileHover={{ scale: 1.08 }}>
                    {f.icon}
                  </motion.div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-heading font-semibold text-white text-lg">{f.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-heading text-teal/70 bg-teal/5 border border-teal/10">{f.tag}</span>
                    </div>
                    <p className="text-sm text-smoke/50 leading-relaxed">{f.detail}</p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Privacy flow diagram */}
            <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="glass-card p-5 mt-4">
              <p className="text-[10px] font-heading text-smoke/30 uppercase tracking-[0.2em] mb-3">Privacy Flow</p>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-accent-green">BUY</span>
                  <span className="text-smoke/30">→</span>
                  <span className="text-smoke/50">private credits → transfer_private_to_public → encrypted OutcomeShare</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-accent-red">SELL</span>
                  <span className="text-smoke/30">→</span>
                  <span className="text-smoke/50">OutcomeShare → AMM → transfer_public_to_private → private credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-teal">WIN</span>
                  <span className="text-smoke/30">→</span>
                  <span className="text-smoke/50">OutcomeShare → harvest_winnings → private credits (1:1)</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right: Privacy table */}
          <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="glass-card overflow-hidden h-fit">
            <div className="p-5 border-b border-white/[0.04]">
              <h3 className="font-heading font-semibold text-white text-lg">Privacy Matrix</h3>
              <p className="text-xs text-smoke/40 mt-1">What's private, what's public, and why</p>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {privacyTable.map((row, i) => (
                <motion.div key={row.what} className="flex items-center justify-between px-5 py-3.5 hover:bg-teal/[0.02] transition-colors"
                  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 + 0.2 }}>
                  <span className="text-sm text-smoke/70">{row.what}</span>
                  <span className={`text-sm font-medium flex items-center gap-1.5 ${row.level === 'green' ? 'text-accent-green' : 'text-yellow-500/70'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${row.level === 'green' ? 'bg-accent-green' : 'bg-yellow-500/70'}`} />
                    {row.privacy}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
