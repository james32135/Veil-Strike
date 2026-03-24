import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Market } from '@/types';
import { calculatePrices } from '@/utils/fpmm';
import { formatAleo, formatCompact } from '@/utils/format';
import { PRECISION, CHART_COLORS } from '@/constants';
import Badge from '@/components/shared/Badge';
import CryptoIcon from '@/components/shared/CryptoIcon';

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

  // Calculate multiplier from probability (1/p)
  const getMultiplier = (prob: number) => {
    if (prob <= 0) return '—';
    const mult = 100 / prob;
    return mult >= 100 ? '99x' : `${mult.toFixed(2)}x`;
  };

  // Token icon for the market
  const tokenSymbol = market.tokenType || 'ALEO';

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
          {/* Header: Image + Category + Title */}
          <div className="flex gap-3 mb-4">
            {/* Event Image */}
            <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/[0.06] bg-dark-200">
              {market.imageUrl ? (
                <img
                  src={market.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                    el.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                    const fallback = document.createElement('span');
                    fallback.className = 'text-lg';
                    fallback.textContent = market.isLightning ? '⚡' : '📊';
                    el.parentElement!.appendChild(fallback);
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg">
                  {market.isLightning ? '⚡' : '📊'}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Category Tag */}
              <div className="flex items-center gap-1.5 mb-1">
                <CryptoIcon symbol={tokenSymbol} size={12} />
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-heading">
                  {market.isLightning ? 'Lightning' : market.category}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-heading text-sm font-semibold text-white line-clamp-2 leading-tight group-hover:text-teal/90 transition-colors duration-300">
                {market.question}
              </h3>
            </div>
          </div>

          {/* Outcome Rows - Kalshi style */}
          <div className="space-y-2 mb-4">
            {outcomesWithPrices.slice(0, 3).map((outcome, i) => (
              <div
                key={i}
                className="flex items-center gap-3 group/outcome"
              >
                {/* Outcome name with color indicator */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: outcome.color }}
                  />
                  <span className="text-xs text-gray-300 truncate">{outcome.name}</span>
                </div>

                {/* Multiplier */}
                <span className="text-[11px] text-gray-500 font-mono tabular-nums flex-shrink-0">
                  {getMultiplier(outcome.probability)}
                </span>

                {/* Probability Pill */}
                <div
                  className="px-3 py-1 rounded-full border text-xs font-mono font-medium tabular-nums flex-shrink-0 min-w-[52px] text-center"
                  style={{
                    borderColor: `${outcome.color}33`,
                    color: outcome.color,
                    backgroundColor: `${outcome.color}0D`,
                  }}
                >
                  {outcome.probability.toFixed(0)}%
                </div>
              </div>
            ))}
            {market.outcomes.length > 3 && (
              <p className="text-[10px] text-gray-600 pl-3.5">+{market.outcomes.length - 3} more outcomes</p>
            )}
          </div>

          {/* Footer: Volume + Token badge + Outcome count */}
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
            <span className="text-xs text-gray-500 font-mono tabular-nums">
              {formatCompact(Number(formatAleo(market.totalVolume)))} vol
            </span>
            <div className="flex items-center gap-2">
              {market.outcomes.length > 2 && (
                <span className="text-[10px] text-gray-600">{market.outcomes.length} outcomes</span>
              )}
              <Badge variant={market.status === 'active' ? 'green' : 'gray'} size="sm">
                {market.status}
              </Badge>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
