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
    <section className="py-24 px-4 bg-dark-50/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <h2 className="section-title mb-2">Live Markets</h2>
            <p className="text-gray-500">Trade predictions with real-time FPMM pricing.</p>
          </div>
          <Link to="/markets" className="btn-secondary text-sm hidden sm:inline-flex">
            View All Markets
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {liveMarkets.map((market, i) => {
            const prices = calculatePrices(market.reserves);
            return (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to={`/markets/${market.id}`} className="block glass-card-hover p-6 h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={market.isLightning ? 'teal' : 'gray'}>
                      {market.isLightning ? 'Lightning' : market.category}
                    </Badge>
                    <Badge variant="green">Active</Badge>
                  </div>

                  <h3 className="font-heading text-base font-semibold text-white mb-4 line-clamp-2">
                    {market.question}
                  </h3>

                  <div className="space-y-2 mb-4">
                    {market.outcomes.slice(0, 2).map((outcome, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">{outcome}</span>
                        <span className={`text-sm font-mono font-medium ${idx === 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                          {((prices[idx] / PRECISION) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-dark-300/30">
                    <div>
                      <p className="text-xs text-gray-500">Volume</p>
                      <p className="text-sm font-mono text-gray-300">{formatAleo(market.totalVolume)} ALEO</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Liquidity</p>
                      <p className="text-sm font-mono text-gray-300">{formatAleo(market.totalLiquidity)} ALEO</p>
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
