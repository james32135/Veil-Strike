import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Market } from '@/types';
import { calculatePrices } from '@/utils/fpmm';
import { formatAleo } from '@/utils/format';
import { PRECISION, CHART_COLORS } from '@/constants';
import Badge from '@/components/shared/Badge';
import CryptoIcon from '@/components/shared/CryptoIcon';
import OutcomeBar from '@/components/charts/OutcomeBar';

interface MarketCardProps {
  market: Market;
  index?: number;
}

export default function MarketCard({ market, index = 0 }: MarketCardProps) {
  const prices = calculatePrices(market.reserves);
  const outcomesWithPrices = market.outcomes.map((name, i) => ({
    name,
    probability: i < prices.length ? (prices[i] / PRECISION) * 100 : 0,
    color: i === 0 ? CHART_COLORS.green : i === 1 ? CHART_COLORS.red : CHART_COLORS.teal,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link to={`/markets/${market.id}`} className="block glass-card-hover p-0 h-full group">
        {/* Top accent line */}
        <div className={`h-px w-full ${market.isLightning ? 'bg-gradient-to-r from-transparent via-amber-400/30 to-transparent' : 'bg-gradient-to-r from-transparent via-white/[0.06] to-transparent'}`} />

        <div className="p-5">
          {/* Badge Row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <Badge variant={market.isLightning ? 'teal' : 'gray'} size="sm">
              {market.isLightning ? '⚡ Lightning' : market.category}
            </Badge>
            <Badge variant="green" size="sm">{market.status}</Badge>
            {market.tokenType === 'USDCX' && (
              <Badge variant="teal" size="sm"><CryptoIcon symbol="USDCX" size={12} className="mr-1" />USDCx</Badge>
            )}
            {market.tokenType === 'USAD' && (
              <Badge variant="green" size="sm"><CryptoIcon symbol="USAD" size={12} className="mr-1" />USAD</Badge>
            )}
            {market.outcomes.length > 2 && (
              <Badge variant="gray" size="sm">{market.outcomes.length} outcomes</Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="font-heading text-base font-semibold text-white mb-4 line-clamp-2 min-h-[2.5rem] group-hover:text-teal/90 transition-colors duration-300">
            {market.question}
          </h3>

          {/* Outcome Bar */}
          <OutcomeBar outcomes={outcomesWithPrices.slice(0, 3)} />

          {/* Stats Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-heading">Volume</p>
              <p className="text-sm font-mono text-gray-300 tabular-nums">{formatAleo(market.totalVolume)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-heading">Trades</p>
              <p className="text-sm font-mono text-gray-300 tabular-nums">{market.tradeCount}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-heading">Liquidity</p>
              <p className="text-sm font-mono text-gray-300 tabular-nums">{formatAleo(market.totalLiquidity)}</p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
