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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/markets/${market.id}`} className="block glass-card-hover p-6 h-full">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant={market.isLightning ? 'teal' : 'gray'} size="sm">
            {market.isLightning ? 'Lightning' : market.category}
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

        <h3 className="font-heading text-base font-semibold text-white mb-4 line-clamp-2 min-h-[2.5rem]">
          {market.question}
        </h3>

        <OutcomeBar outcomes={outcomesWithPrices.slice(0, 3)} />

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-300/30">
          <div>
            <p className="text-xs text-gray-500">Volume</p>
            <p className="text-sm font-mono text-gray-300">{formatAleo(market.totalVolume)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Trades</p>
            <p className="text-sm font-mono text-gray-300">{market.tradeCount}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Liquidity</p>
            <p className="text-sm font-mono text-gray-300">{formatAleo(market.totalLiquidity)}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
