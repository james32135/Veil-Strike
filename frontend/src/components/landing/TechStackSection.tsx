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
    <section className="py-28 px-4 relative">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="section-title mb-4">Built on <span className="gradient-text">Proven Technology</span></h2>
          <p className="text-smoke/60 max-w-xl mx-auto">Every component is designed for privacy and security.</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {techStack.map((tech, i) => (
            <motion.div key={tech.name} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} whileHover={{ y: -3 }} className="glass-card p-6 text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <p className="font-heading font-semibold text-white mb-1.5 text-lg">{tech.name}</p>
              <p className="text-xs text-smoke/40">{tech.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
