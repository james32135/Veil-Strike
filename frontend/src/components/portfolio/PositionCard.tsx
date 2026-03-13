import type { SharePosition, Market } from '@/types';
import { calculatePrices } from '@/utils/fpmm';
import { formatAleo } from '@/utils/format';
import { PRECISION } from '@/constants';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';

interface PositionCardProps {
  position: SharePosition;
  market?: Market;
}

export default function PositionCard({ position, market }: PositionCardProps) {
  const currentPrice = market
    ? calculatePrices(market.reserves)[position.outcomeIndex] / PRECISION
    : 0;
  const costBasis = position.amount > 0 ? position.costBasis / position.amount : 0;
  const pnl = market
    ? (currentPrice - costBasis) * position.amount
    : 0;
  const pnlPct = costBasis > 0 ? ((currentPrice - costBasis) / costBasis) * 100 : 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-3">
          <p className="text-sm font-heading font-medium text-white truncate">
            {market?.question || 'Unknown Market'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={position.outcomeIndex === 0 ? 'success' : 'danger'}>
              {market?.outcomes[position.outcomeIndex] || `Outcome ${position.outcomeIndex}`}
            </Badge>
            {market && (
              <span className="text-[10px] text-gray-600">{market.category}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm font-mono font-medium ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {pnl >= 0 ? '+' : ''}{formatAleo(Math.round(pnl))}
          </p>
          <p className={`text-[10px] font-mono ${pnlPct >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dark-400/20">
        <div>
          <p className="text-[10px] text-gray-600">Shares</p>
          <p className="text-xs font-mono text-gray-300">{formatAleo(position.amount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600">Avg Price</p>
          <p className="text-xs font-mono text-gray-300">{(costBasis * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600">Current</p>
          <p className="text-xs font-mono text-gray-300">{(currentPrice * 100).toFixed(1)}%</p>
        </div>
      </div>
    </Card>
  );
}
