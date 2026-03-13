import { Link } from 'react-router-dom';
import type { Market } from '@/types';
import { calculatePrices } from '@/utils/fpmm';
import { formatAleo, formatCompact } from '@/utils/format';
import { useCountdown } from '@/hooks/useCountdown';
import { PRECISION } from '@/constants';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import { BoltIcon, FireIcon, ClockIcon } from '@/components/icons';

interface LightningCardProps {
  market: Market;
}

export default function LightningCard({ market }: LightningCardProps) {
  const prices = calculatePrices(market.reserves);
  const countdown = useCountdown(market.endTime);
  const isUrgent = countdown.days === 0 && countdown.hours === 0 && countdown.minutes < 10;

  return (
    <Link to={`/markets/${market.id}`}>
      <Card hover className="p-5 relative overflow-hidden">
        {/* Lightning accent */}
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <BoltIcon className="w-4 h-4 text-amber-400" />
            </div>
            <Badge variant="warning">Lightning</Badge>
          </div>
          <div className={`flex items-center gap-1 text-xs font-mono ${
            isUrgent ? 'text-accent-red animate-pulse' : 'text-amber-400'
          }`}>
            <ClockIcon className="w-3 h-3" />
            {countdown.hours > 0
              ? `${countdown.hours}h ${countdown.minutes}m`
              : `${countdown.minutes}m ${countdown.seconds}s`
            }
          </div>
        </div>

        <h3 className="text-sm font-heading font-semibold text-white mb-4 line-clamp-2">
          {market.question}
        </h3>

        {/* Binary outcome display */}
        <div className="flex gap-2 mb-4">
          {market.outcomes.map((outcome, i) => {
            const pct = (prices[i] / PRECISION) * 100;
            return (
              <div
                key={i}
                className={`flex-1 p-3 rounded-xl text-center border transition-all ${
                  i === 0
                    ? 'border-accent-green/20 bg-accent-green/5'
                    : 'border-accent-red/20 bg-accent-red/5'
                }`}
              >
                <p className="text-xs text-gray-500 mb-1">{outcome}</p>
                <p className={`text-lg font-mono font-bold ${
                  i === 0 ? 'text-accent-green' : 'text-accent-red'
                }`}>
                  {pct.toFixed(1)}%
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Vol: {formatCompact(market.totalVolume / 1_000_000)} ALEO</span>
          <span className="flex items-center gap-1">
            <FireIcon className="w-3 h-3 text-amber-400" />
            {market.tradeCount} trades
          </span>
        </div>
      </Card>
    </Link>
  );
}
