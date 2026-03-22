import { motion } from 'framer-motion';

const architecture = [
  { layer: 'Frontend', items: ['React 18', 'Tailwind CSS', 'Framer Motion', 'Zustand'] },
  { layer: 'Wallet', items: ['Shield Wallet', 'Delegated Proving', 'Record Decryption'] },
  { layer: 'Smart Contract', items: ['Leo (Aleo)', 'FPMM Engine', 'Private Records', 'credits.aleo'] },
  { layer: 'Backend', items: ['Oracle Service', 'CoinGecko API', 'Market Resolver', 'Indexer'] },
];

export default function ArchitectureSection() {
  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="section-title mb-4">Architecture</h2>
          <p className="text-smoke/60 max-w-xl mx-auto">Full-stack privacy from frontend to blockchain.</p>
        </motion.div>

        <div className="space-y-4">
          {architecture.map((section, i) => (
            <motion.div key={section.layer} initial={{ opacity: 0, x: -25 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} whileHover={{ x: 4 }}
              className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 group">
              <div className="w-32 shrink-0">
                <span className="text-xs uppercase tracking-[0.2em] font-heading font-semibold text-teal">{section.layer}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {section.items.map((item) => (
                  <span key={item} className="px-3 py-1.5 bg-white/[0.03] rounded-full text-sm text-smoke font-heading border border-white/[0.05] hover:border-teal/20 transition-colors">
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
