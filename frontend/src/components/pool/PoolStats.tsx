import type { Pool } from '@/types';
import { formatAleo, formatCompact } from '@/utils/format';
import Card from '@/components/shared/Card';
import StatCard from '@/components/shared/StatCard';

interface PoolStatsProps {
  pools: Pool[];
}

export default function PoolStats({ pools }: PoolStatsProps) {
  const totalValue = pools.reduce((s, p) => s + p.currentSize, 0);
  const totalMembers = pools.reduce((s, p) => s + p.memberCount, 0);
  const totalPnL = pools.reduce((s, p) => s + p.totalPnL, 0);
  const activePools = pools.filter((p) => p.status === 'active').length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="Total Pools" value={pools.length.toString()} />
      <StatCard label="Active" value={activePools.toString()} />
      <StatCard
        label="Total Value"
        value={formatCompact(totalValue / 1_000_000)}
        suffix="ALEO"
      />
      <StatCard
        label="Members"
        value={totalMembers.toString()}
      />
    </div>
  );
}
