import { motion } from 'framer-motion';

const architecture = [
  { layer: 'Frontend', items: ['React 18', 'Tailwind CSS', 'Framer Motion', 'Zustand'] },
  { layer: 'Wallet', items: ['Shield Wallet', 'Delegated Proving', 'Record Decryption'] },
  { layer: 'Smart Contract', items: ['Leo (Aleo)', 'FPMM Engine', 'Private Records', 'credits.aleo'] },
  { layer: 'Backend', items: ['Oracle Service', 'CoinGecko API', 'Market Resolver', 'Indexer'] },
];

export default function ArchitectureSection() {
  return (
    <section className="py-24 px-4 bg-dark-50/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="section-title mb-4">Architecture</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Full-stack privacy from frontend to blockchain.
          </p>
        </motion.div>

        <div className="space-y-4">
          {architecture.map((section, i) => (
            <motion.div
              key={section.layer}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            >
              <div className="w-32 shrink-0">
                <span className="text-xs text-gray-500 uppercase tracking-wider">{section.layer}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {section.items.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1.5 bg-dark-300/50 rounded-lg text-sm text-gray-300 font-heading"
                  >
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
