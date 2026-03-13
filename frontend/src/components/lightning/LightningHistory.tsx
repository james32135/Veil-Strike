import type { Market } from '@/types';
import { formatAleo, formatTimeAgo } from '@/utils/format';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import EmptyState from '@/components/shared/EmptyState';
import { ClockIcon, CheckIcon } from '@/components/icons';

interface LightningHistoryProps {
  markets: Market[];
}

export default function LightningHistory({ markets }: LightningHistoryProps) {
  const resolved = markets
    .filter((m) => m.isLightning && m.status === 'resolved')
    .sort((a, b) => b.endTime - a.endTime);

  if (resolved.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<ClockIcon className="w-8 h-8 text-gray-600" />}
          title="No history yet"
          description="Resolved lightning rounds will appear here"
        />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">
        Recent Results
      </h3>
      <div className="space-y-0">
        {resolved.slice(0, 10).map((market) => (
          <div
            key={market.id}
            className="flex items-center justify-between py-3 border-b border-dark-400/10 last:border-0"
          >
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-sm text-gray-300 truncate">{market.question}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{formatTimeAgo(market.endTime)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {market.resolvedOutcome !== undefined && (
                <Badge variant="success">
                  <CheckIcon className="w-3 h-3 mr-1" />
                  {market.outcomes[market.resolvedOutcome]}
                </Badge>
              )}
              <span className="text-xs font-mono text-gray-500">
                {formatAleo(market.totalVolume)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
