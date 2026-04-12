import { motion } from 'framer-motion';
import { ShieldIcon, BoltIcon, LockIcon, ZKProofIcon } from '@/components/icons';

const features = [
  {
    icon: <ShieldIcon className="w-7 h-7" />,
    title: 'Private by Default',
    description: 'Every bet, position, and payout is protected by zero-knowledge proofs. No one sees your trades — your identity and winnings are invisible on-chain.',
    badge: 'ZK Privacy',
  },
  {
    icon: <BoltIcon className="w-7 h-7" />,
    title: 'Strike Rounds',
    description: '5-minute Strike Rounds — auto-resolved crypto price predictions on BTC, ETH, and ALEO. Bet with USDCx stablecoins. The Round Bot creates, settles, and repeats every cycle via delegated proving.',
    badge: 'Auto-Resolved',
  },
  {
    icon: <LockIcon className="w-7 h-7" />,
    title: 'FPMM Pricing',
    description: 'Fixed Product Market Maker ensures fair, manipulation-resistant pricing with deep on-chain liquidity. No order books, no front-running — mathematically impossible.',
    badge: 'AMM Engine',
  },
  {
    icon: <ZKProofIcon className="w-7 h-7" />,
    title: 'Triple Token Support',
    description: 'Trade with native ALEO, USDCx (backed by USDC via Circle), or USAD (backed by USDG via Paxos) — each with its own dedicated smart contract for full privacy.',
    badge: 'Multi-Token',
  },
];

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } };
const item = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export default function FeaturesSection() {
  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-4">Core Features</motion.span>
          <h2 className="section-title mb-4">
            Why Traders Choose{' '}
            <span className="gradient-text">Veil Strike</span>
          </h2>
          <p className="text-smoke/55 max-w-xl mx-auto leading-relaxed">
            The only prediction market where your bets, positions, and payouts are fully encrypted — powered by Aleo's zero-knowledge blockchain.
          </p>
        </motion.div>

        <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-5" variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {features.map((feature) => (
            <motion.div key={feature.title} variants={item} whileHover={{ y: -5, transition: { duration: 0.3 } }}
              className="glass-card glass-border-beam p-8 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="flex items-start justify-between mb-6">
                <motion.div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(255, 107, 53, 0.08)', border: '1px solid rgba(255, 107, 53, 0.15)' }}
                  whileHover={{ scale: 1.08, boxShadow: '0 0 30px -5px rgba(255, 107, 53, 0.3)' }}>
                  <div className="text-teal">{feature.icon}</div>
                </motion.div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-heading font-medium bg-teal/5 text-teal border border-teal/10">{feature.badge}</span>
              </div>

              <h3 className="font-heading text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-smoke/55 leading-relaxed">{feature.description}</p>

              <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-radial from-teal/[0.04] to-transparent blur-2xl" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
