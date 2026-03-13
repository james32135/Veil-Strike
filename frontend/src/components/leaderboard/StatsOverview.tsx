import { formatAleo, formatCompact } from '@/utils/format';
import StatCard from '@/components/shared/StatCard';
import type { ProtocolStats } from '@/types';

interface StatsOverviewProps {
  stats: ProtocolStats;
}

export default function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Total Markets"
        value={stats.totalMarkets.toString()}
      />
      <StatCard
        label="Total Volume"
        value={formatCompact(stats.totalVolume / 1_000_000)}
        suffix="ALEO"
      />
      <StatCard
        label="Total Liquidity"
        value={formatCompact(stats.totalLiquidity / 1_000_000)}
        suffix="ALEO"
      />
      <StatCard
        label="Unique Traders"
        value={formatCompact(stats.uniqueTraders)}
      />
      <StatCard
        label="Total Trades"
        value={formatCompact(stats.totalTrades)}
      />
      <StatCard
        label="Protocol Fees"
        value={formatAleo(stats.protocolFees)}
        suffix="ALEO"
      />
      <StatCard
        label="Active Markets"
        value={stats.activeMarkets.toString()}
      />
      <StatCard
        label="Resolved Markets"
        value={stats.resolvedMarkets.toString()}
      />
    </div>
  );
}
