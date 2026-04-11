import { motion } from 'framer-motion';

const layers = [
  {
    label: 'User Layer',
    items: ['Shield Wallet (Aleo)', 'React Frontend (Vite)', 'Framer Motion UI'],
    color: '#FF6B35',
  },
  {
    label: 'Protocol Layer',
    items: ['FPMM Market Maker', 'Oracle Price Feeds', 'Strike Round Engine', 'Governance DAO'],
    color: '#00D46E',
  },
  {
    label: 'Execution Layer',
    items: ['Delegated Proof Service', 'Chain Executor Queue', 'Auto Resolver Bot', 'Market Indexer'],
    color: '#627EEA',
  },
  {
    label: 'Blockchain Layer',
    items: ['Aleo Mainnet (ZK-native)', 'Leo Smart Contracts (v7)', '53 On-Chain Transitions', 'USDCx / USAD / ALEO'],
    color: '#2775CA',
  },
];

export default function ArchitectureSection() {
  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <span className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-4">Architecture</span>
          <h2 className="section-title mb-4">
            Full-Stack{' '}
            <span className="gradient-text">Privacy Architecture</span>
          </h2>
          <p className="text-smoke/55 max-w-lg mx-auto leading-relaxed">
            Four layers working together to deliver private predictions — from wallet to blockchain.
          </p>
        </motion.div>

        <div className="space-y-4">
          {layers.map((layer, i) => (
            <motion.div key={layer.label}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="glass-card p-6 relative overflow-hidden group hover:border-white/[0.08] transition-colors">
              
              {/* Left accent */}
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r" style={{ background: layer.color }} />

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pl-4">
                <div className="sm:w-48 shrink-0">
                  <span className="text-[10px] font-mono text-smoke/30">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="font-heading font-bold text-white/80" style={{ color: `${layer.color}CC` }}>{layer.label}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {layer.items.map((item) => (
                    <span key={item} className="px-3 py-1.5 rounded-lg text-xs font-heading text-smoke/50 bg-white/[0.02] border border-white/[0.04]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}