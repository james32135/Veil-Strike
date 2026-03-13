import type { SharePosition, Market } from '@/types';
import PositionCard from './PositionCard';
import EmptyState from '@/components/shared/EmptyState';
import { ChartIcon } from '@/components/icons';

interface PositionListProps {
  positions: SharePosition[];
  markets: Market[];
}

export default function PositionList({ positions, markets }: PositionListProps) {
  if (positions.length === 0) {
    return (
      <EmptyState
        icon={<ChartIcon className="w-10 h-10 text-gray-600" />}
        title="No open positions"
        description="Start trading to see your positions here"
        actionLabel="Browse Markets"
        actionHref="/markets"
      />
    );
  }

  const marketMap = new Map(markets.map((m) => [m.id, m]));

  return (
    <div className="space-y-3">
      {positions.map((pos, i) => (
        <PositionCard
          key={`${pos.marketId}-${pos.outcomeIndex}-${i}`}
          position={pos}
          market={marketMap.get(pos.marketId)}
        />
      ))}
    </div>
  );
}
