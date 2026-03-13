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
    description: '5 to 60-minute price prediction rounds with live oracle feeds. Fast, exciting, private.',
  },
  {
    icon: <LockIcon className="w-7 h-7" />,
    title: 'FPMM Pricing',
    description: 'Fixed Product Market Maker ensures fair pricing with deep liquidity. No order books, no front-running.',
  },
  {
    icon: <ZKProofIcon className="w-7 h-7" />,
    title: 'ZK Streaks',
    description: 'Build winning streaks with on-chain proof of your track record. Compete on the leaderboard anonymously.',
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="section-title mb-4">
            Why <span className="text-teal">Veil Strike</span>?
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            The only prediction market where your identity stays completely private.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-8"
            >
              <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center text-teal mb-5">
                {feature.icon}
              </div>
              <h3 className="font-heading text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
