import { motion } from 'framer-motion';

const reasons = [
  {
    title: 'Zero-Knowledge Proofs',
    description: 'Every transaction on Aleo generates a mathematical proof that verifies correctness without revealing any data. Your bets are private by the laws of cryptography — not by policy.',
  },
  {
    title: 'Encrypted Records',
    description: 'Aleo stores data as encrypted records only the owner can decrypt with their view key. Your OutcomeShares, LPTokens, and payouts are invisible to everyone else on-chain.',
  },
  {
    title: 'No Front-Running',
    description: 'On public blockchains, MEV bots watch the mempool and front-run trades. On Aleo, transaction data is encrypted — front-running is mathematically impossible.',
  },
  {
    title: 'Mainnet Live',
    description: 'Aleo mainnet launched with full ZK support. Veil Strike\'s 3 contracts (53 transitions) are deployed and operational. Real markets, real privacy, real money.',
  },
];

export default function WhyAleoSection() {
  return (
    <section className="py-28 px-4 relative">
      <motion.div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255, 107, 53, 0.04) 0%, transparent 60%)', filter: 'blur(60px)' }} />

      <div className="max-w-6xl mx-auto relative">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-4">Why Aleo</motion.span>
          <h2 className="section-title mb-4">
            Built On The{' '}
            <span className="gradient-text">Most Private Blockchain</span>
          </h2>
          <p className="text-smoke/55 max-w-2xl mx-auto leading-relaxed">
            Aleo is the first Layer 1 blockchain designed for privacy at scale. Unlike Ethereum or Polygon where all data is public, Aleo uses zero-knowledge proofs to encrypt everything by default.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reasons.map((r, i) => (
            <motion.div key={r.title} initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              className="glass-card p-7 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex items-start gap-4">
                <span className="font-mono text-2xl font-bold text-teal/20 leading-none mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-white mb-2">{r.title}</h3>
                  <p className="text-smoke/50 leading-relaxed text-sm">{r.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
