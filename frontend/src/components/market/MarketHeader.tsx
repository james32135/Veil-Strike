import type { Market } from '@/types';
import { useCountdown } from '@/hooks/useCountdown';
import Badge from '@/components/shared/Badge';
import { ClockIcon, FireIcon, LockIcon } from '@/components/icons';

interface MarketHeaderProps {
  market: Market;
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  active: { label: 'Active', variant: 'success' },
  closed: { label: 'Closed', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'info' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  pending_resolution: { label: 'Pending Resolution', variant: 'warning' },
};

export default function MarketHeader({ market }: MarketHeaderProps) {
  const countdown = useCountdown(market.endTime);

  const cfg = statusConfig[market.status] || statusConfig.active;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
        <span className="text-xs text-gray-500 font-mono uppercase px-2 py-0.5 bg-dark-200 rounded-md">
          {market.category}
        </span>
        {market.isLightning && (
          <span className="flex items-center gap-1 text-xs text-amber-400 px-2 py-0.5 bg-amber-400/10 rounded-md">
            <FireIcon className="w-3 h-3" />
            Lightning
          </span>
        )}
      </div>

      <h1 className="text-2xl md:text-3xl font-heading font-bold text-white mb-4">
        {market.question}
      </h1>

      {market.status === 'active' && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <ClockIcon className="w-4 h-4" />
          {countdown.days > 0 && (
            <span className="font-mono">{countdown.days}d {countdown.hours}h {countdown.minutes}m</span>
          )}
          {countdown.days === 0 && countdown.hours > 0 && (
            <span className="font-mono text-amber-400">{countdown.hours}h {countdown.minutes}m {countdown.seconds}s</span>
          )}
          {countdown.days === 0 && countdown.hours === 0 && (
            <span className="font-mono text-accent-red">{countdown.minutes}m {countdown.seconds}s</span>
          )}
          <span className="text-gray-600">remaining</span>
        </div>
      )}

      {market.status === 'resolved' && market.resolvedOutcome !== undefined && (
        <div className="flex items-center gap-2 mt-2">
          <LockIcon className="w-4 h-4 text-teal" />
          <span className="text-sm text-gray-400">
            Resolved: <span className="text-teal font-medium">{market.outcomes[market.resolvedOutcome]}</span>
          </span>
        </div>
      )}
    </div>
  );
}
