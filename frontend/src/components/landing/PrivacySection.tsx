import { motion } from 'framer-motion';
import { ShieldIcon, LockIcon, ZKProofIcon } from '@/components/icons';

const privacyFeatures = [
  { icon: <ShieldIcon className="w-6 h-6" />, title: 'No Address Leaks', detail: 'User addresses never appear in finalize functions. Market IDs are derived from random nonces — not creator addresses.' },
  { icon: <LockIcon className="w-6 h-6" />, title: 'Private Transfers', detail: 'All deposits use transfer_private_to_public. All payouts use transfer_public_to_private. Your identity stays encrypted.' },
  { icon: <ZKProofIcon className="w-6 h-6" />, title: 'Record-Based Positions', detail: 'Share positions, LP receipts, and streaks are stored as encrypted Aleo records. Only you can decrypt them.' },
];

export default function PrivacySection() {
  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <h2 className="section-title mb-4">Privacy Model</h2>
          <p className="text-smoke/60 max-w-xl mx-auto">Every design decision prioritizes user privacy.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {privacyFeatures.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} whileHover={{ y: -4 }} className="glass-card p-7 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <motion.div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-teal" style={{ background: 'rgba(255, 107, 53, 0.08)', border: '1px solid rgba(255, 107, 53, 0.15)' }} whileHover={{ scale: 1.08 }}>
                {f.icon}
              </motion.div>
              <h3 className="font-heading font-semibold text-white mb-2 text-lg">{f.title}</h3>
              <p className="text-sm text-smoke/50 leading-relaxed">{f.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
