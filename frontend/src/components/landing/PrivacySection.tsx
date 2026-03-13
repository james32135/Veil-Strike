import { motion } from 'framer-motion';
import { ShieldIcon, LockIcon, ZKProofIcon } from '@/components/icons';

const privacyFeatures = [
  {
    icon: <ShieldIcon className="w-6 h-6" />,
    title: 'No Address Leaks',
    detail: 'User addresses never appear in finalize functions. Market IDs are derived from random nonces — not creator addresses.',
  },
  {
    icon: <LockIcon className="w-6 h-6" />,
    title: 'Private Transfers',
    detail: 'All deposits use transfer_private_to_public. All payouts use transfer_public_to_private. Your identity stays encrypted.',
  },
  {
    icon: <ZKProofIcon className="w-6 h-6" />,
    title: 'Record-Based Positions',
    detail: 'Share positions, LP receipts, and streaks are stored as encrypted Aleo records. Only you can decrypt them.',
  },
];

export default function PrivacySection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="section-title mb-4">Privacy Model</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Every design decision prioritizes user privacy.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {privacyFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center text-teal mb-4">
                {feature.icon}
              </div>
              <h3 className="font-heading font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
