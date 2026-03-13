import { motion } from 'framer-motion';

const techStack = [
  { name: 'Aleo', description: 'Layer 1 privacy blockchain' },
  { name: 'Leo', description: 'ZK smart contract language' },
  { name: 'snarkVM', description: 'Zero-knowledge proving engine' },
  { name: 'Shield Wallet', description: 'Delegated proving wallet' },
  { name: 'FPMM', description: 'Automated market maker' },
  { name: 'credits.aleo', description: 'Native token program' },
];

export default function TechStackSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="section-title mb-4">Built on Proven Technology</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Every component is designed for privacy and security.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {techStack.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass-card p-5 text-center"
            >
              <p className="font-heading font-semibold text-white mb-1">{tech.name}</p>
              <p className="text-xs text-gray-500">{tech.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
