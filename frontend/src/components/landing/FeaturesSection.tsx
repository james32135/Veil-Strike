import { motion } from 'framer-motion';
import { ShieldIcon, BoltIcon, LockIcon, ZKProofIcon } from '@/components/icons';

const features = [
  {
    icon: <ShieldIcon className="w-7 h-7" />,
    title: 'Private by Default',
    description: 'Every bet, position, and payout is protected by zero-knowledge proofs. No one sees your trades on-chain.',
  },
  {
    icon: <BoltIcon className="w-7 h-7" />,
    title: 'Lightning Markets',
    description: '5-minute price prediction rounds with live oracle feeds. Fast, exciting, and completely private.',
  },
  {
    icon: <LockIcon className="w-7 h-7" />,
    title: 'FPMM Pricing',
    description: 'Fixed Product Market Maker ensures fair pricing with deep liquidity. No order books, no front-running.',
  },
  {
    icon: <ZKProofIcon className="w-7 h-7" />,
    title: 'Multi-Token Support',
    description: 'Trade with both ALEO and USDCx stablecoin. Full privacy across multiple token types.',
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="section-title mb-4">
            Powerful Features{'\n'}
            For <span className="gradient-text">Smarter Crypto Trading</span>
          </h2>
          <p className="text-smoke/60 max-w-xl mx-auto">
            AI-optimized prediction markets with human-grade decision-making
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="glass-card p-8 relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  background: 'rgba(255, 107, 53, 0.08)',
                  border: '1px solid rgba(255, 107, 53, 0.15)',
                }}
                whileHover={{ scale: 1.05, boxShadow: '0 0 25px -5px rgba(255, 107, 53, 0.25)' }}
              >
                <div className="text-teal">{feature.icon}</div>
              </motion.div>

              <h3 className="font-heading text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-smoke/60 leading-relaxed">{feature.description}</p>

              <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-radial from-teal/[0.04] to-transparent blur-2xl" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
