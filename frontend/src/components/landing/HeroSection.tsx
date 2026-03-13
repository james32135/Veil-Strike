import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ShieldIcon, BoltIcon } from '@/components/icons';
import { useMarketStore } from '@/stores/marketStore';
import { useTradeStore } from '@/stores/tradeStore';

export default function HeroSection() {
  const markets = useMarketStore((s) => s.markets);
  const trades = useTradeStore((s) => s.trades);

  const activeMarkets = markets.filter((m) => m.status === 'active').length;
  const totalVolume = markets.reduce((sum, m) => sum + (m.totalVolume || 0), 0);
  const totalLiquidity = markets.reduce((sum, m) => sum + (m.totalLiquidity || 0), 0);

  const formatCompact = (micro: number) => {
    const val = micro / 1_000_000;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toFixed(1);
  };

  return (
    <section className="relative flex items-center justify-center overflow-hidden py-32 md:py-40">
      {/* Full-bleed background */}
      <div className="absolute inset-0">
        <img
          src="/bg.jpg"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-dark/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-dark/40 to-dark" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal/10 border border-teal/20 rounded-full mb-8 backdrop-blur-sm">
            <ShieldIcon className="w-4 h-4 text-teal" />
            <span className="text-sm text-teal font-heading font-medium tracking-wide">Built on Aleo — Zero-Knowledge Privacy</span>
          </div>

          <h1 className="font-heading text-6xl md:text-8xl font-bold text-white leading-[1.05] tracking-tight mb-6">
            Predict.{' '}
            <span className="text-teal italic">Strike.</span>
            <br />
            Stay <span className="text-teal italic">Veiled.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed font-body">
            The first privacy-preserving prediction market protocol. 
            Trade with complete anonymity using zero-knowledge proofs on Aleo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/markets"
              className="btn-primary text-base px-10 py-4 flex items-center gap-2 text-lg"
            >
              Launch App
            </Link>
            <Link
              to="/lightning"
              className="btn-secondary text-base px-10 py-4 flex items-center gap-2 text-lg"
            >
              <BoltIcon className="w-5 h-5 text-teal" />
              Try Lightning
            </Link>
          </div>
        </motion.div>

        {/* Real stats from on-chain data */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto"
        >
          {[
            { label: 'Total Volume', value: `${formatCompact(totalVolume)} ALEO` },
            { label: 'Active Markets', value: String(activeMarkets || markets.length) },
            { label: 'Total Trades', value: String(trades.length) },
            { label: 'TVL', value: `${formatCompact(totalLiquidity)} ALEO` },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-mono text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-widest mt-1.5 font-heading">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient - seamless */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-dark to-transparent" />
    </section>
  );
}
