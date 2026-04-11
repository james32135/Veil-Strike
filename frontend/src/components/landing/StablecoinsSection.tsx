import { motion } from 'framer-motion';

const stablecoins = [
  {
    name: 'USDCx',
    tagline: 'The First Private Stablecoin on Aleo',
    description: 'USDCx is backed 1:1 by USDC held in Circle xReserve. Bridge your USDC from Ethereum to Aleo and get full privacy — encrypted balances, hidden transfers, and confidential DeFi.',
    backed: 'Backed 1:1 by USDC (Circle)',
    how: 'Bridge USDC on Ethereum → USDCx on Aleo via Circle xReserve',
    mintUrl: 'https://usdcx.aleo.org/',
    learnUrl: 'https://aleo.org/usdcx/',
    color: '#2775CA',
    program: 'usdcx_stablecoin.aleo',
    features: ['Circle-backed reserves', 'Private by default', 'Instant settlement', 'Compliance-ready'],
  },
  {
    name: 'USAD',
    tagline: 'The Stablecoin Built for Modern Business',
    description: 'USAD is backed 1:1 by USDG, the reserve token of Global Dollar Network, issued by Paxos Trust Company. No personal data required. Encrypted custody and transfers by default.',
    backed: 'Backed 1:1 by USDG (Paxos)',
    how: 'Bridge USDG on Ethereum → USAD on Aleo via Paxos Labs infrastructure',
    mintUrl: 'https://usad.aleo.org/',
    learnUrl: 'https://aleo.org/usad/',
    color: '#00D4AA',
    program: 'usad_stablecoin.aleo',
    features: ['Paxos Trust-backed', 'Encrypted balances', 'Business-ready', 'Global payments'],
  },
];

export default function StablecoinsSection() {
  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-4">Stablecoins</motion.span>
          <h2 className="section-title mb-4">
            Trade With{' '}
            <span className="gradient-text">Private Stablecoins</span>
          </h2>
          <p className="text-smoke/55 max-w-2xl mx-auto leading-relaxed">
            Veil Strike supports two privacy-native stablecoins on Aleo — USDCx and USAD. Both are 1:1 backed, fully compliant, and encrypted by default. Your balance and transactions are invisible to everyone.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stablecoins.map((coin, i) => (
            <motion.div key={coin.name}
              initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="glass-card glass-border-beam relative overflow-hidden group">

              {/* Top accent */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${coin.color}40, ${coin.color}, ${coin.color}40)` }} />

              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-heading font-bold text-lg text-white"
                    style={{ background: `${coin.color}15`, border: `1px solid ${coin.color}30` }}>
                    {coin.name === 'USDCx' ? '$' : '₮'}
                  </div>
                  <div>
                    <h3 className="font-heading text-xl font-bold text-white">{coin.name}</h3>
                    <p className="text-xs text-smoke/40">{coin.tagline}</p>
                  </div>
                </div>

                <p className="text-smoke/55 leading-relaxed mb-5">{coin.description}</p>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {coin.features.map((f) => (
                    <span key={f} className="px-2.5 py-1 rounded-full text-[10px] font-heading text-smoke/50 bg-white/[0.03] border border-white/[0.05]">{f}</span>
                  ))}
                </div>

                {/* Info rows */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-accent-green text-xs mt-0.5">●</span>
                    <span className="text-smoke/50"><span className="text-white/70 font-medium">Backing:</span> {coin.backed}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-teal text-xs mt-0.5">●</span>
                    <span className="text-smoke/50"><span className="text-white/70 font-medium">How to get:</span> {coin.how}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-smoke/30 text-xs mt-0.5">●</span>
                    <span className="text-smoke/50"><span className="text-white/70 font-medium">Program:</span> <code className="text-teal/70 text-xs">{coin.program}</code></span>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex gap-3">
                  <a href={coin.mintUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-primary text-xs px-5 py-2.5">
                    Mint {coin.name}
                  </a>
                  <a href={coin.learnUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-secondary text-xs px-5 py-2.5">
                    Learn More
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center text-xs text-smoke/30 mt-8 max-w-lg mx-auto">
          Both stablecoins are fully backed, regularly audited, and comply with regulatory standards. Privacy features apply exclusively to transactions on the Aleo network.
        </motion.p>
      </div>
    </section>
  );
}
