import { motion } from 'framer-motion';

const tech = [
  { name: 'Aleo', desc: 'ZK-native L1 blockchain', color: '#FF6B35' },
  { name: 'Leo', desc: 'Smart contract language', color: '#00D46E' },
  { name: 'React', desc: 'Frontend framework', color: '#61DAFB' },
  { name: 'TypeScript', desc: 'Full-stack type safety', color: '#3178C6' },
  { name: 'Framer Motion', desc: 'Animation engine', color: '#FF0050' },
  { name: 'Tailwind', desc: 'Utility-first CSS', color: '#38BDF8' },
  { name: 'USDCx', desc: 'Private stablecoin (Circle)', color: '#2775CA' },
  { name: 'USAD', desc: 'Private stablecoin (Paxos)', color: '#00D4AA' },
];

export default function TechStackSection() {
  return (
    <section className="py-20 px-4 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12">
          <span className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-4">Tech Stack</span>
          <h2 className="section-title">
            Built With the <span className="gradient-text">Best</span>
          </h2>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-3">
          {tech.map((t, i) => (
            <motion.div key={t.name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.05, y: -2 }}
              className="glass-card px-5 py-3 flex items-center gap-3 cursor-default">
              <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
              <div>
                <span className="text-sm font-heading font-semibold text-white/75">{t.name}</span>
                <span className="text-[10px] text-smoke/30 ml-2">{t.desc}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
