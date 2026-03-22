import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useMarkets } from '@/hooks/useMarkets';
import { calculatePrices } from '@/utils/fpmm';
import { formatAleo } from '@/utils/format';
import { PRECISION } from '@/constants';
import Badge from '@/components/shared/Badge';

export default function LiveMarketsSection() {
  const { allMarkets } = useMarkets();
  const liveMarkets = allMarkets.filter((m) => m.status === 'active').slice(0, 3);

  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-12"
        >
          <div>
            <h2 className="section-title mb-2">Live Markets</h2>
            <p className="text-smoke/60">Trade predictions with real-time FPMM pricing.</p>
          </div>
          <Link to="/markets" className="btn-secondary text-sm hidden sm:inline-flex">View All Markets</Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {liveMarkets.map((market, i) => {
            const prices = calculatePrices(market.reserves);
            return (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                whileHover={{ y: -5 }}
              >
                <Link to={`/markets/${market.id}`} className="block glass-card-hover p-6 h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={market.isLightning ? 'teal' : 'gray'}>
                      {market.isLightning ? '⚡ Lightning' : market.category}
                    </Badge>
                    <Badge variant="green" pulse>Active</Badge>
                  </div>

                  <h3 className="font-heading text-base font-semibold text-white mb-4 line-clamp-2">{market.question}</h3>

                  <div className="space-y-2.5 mb-5">
                    {market.outcomes.slice(0, 2).map((outcome, idx) => {
                      const pct = (prices[idx] / PRECISION) * 100;
                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-smoke/60">{outcome}</span>
                            <span className={`text-sm font-mono font-semibold ${idx === 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: `${pct}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                              className={`h-full rounded-full ${idx === 0 ? 'bg-accent-green' : 'bg-accent-red'}`}
                              style={{ boxShadow: `0 0 8px ${idx === 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                    <div>
                      <p className="text-[10px] text-smoke/30 uppercase tracking-wider">Volume</p>
                      <p className="text-sm font-mono text-smoke">{formatAleo(market.totalVolume)} ALEO</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-smoke/30 uppercase tracking-wider">Liquidity</p>
                      <p className="text-sm font-mono text-smoke">{formatAleo(market.totalLiquidity)} ALEO</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
