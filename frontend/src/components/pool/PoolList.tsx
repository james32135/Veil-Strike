import type { Pool } from '@/types';
import PoolCard from './PoolCard';
import EmptyState from '@/components/shared/EmptyState';
import { PoolIcon } from '@/components/icons';

interface PoolListProps {
  pools: Pool[];
}

export default function PoolList({ pools }: PoolListProps) {
  if (pools.length === 0) {
    return (
      <EmptyState
        icon={<PoolIcon className="w-10 h-10 text-gray-600" />}
        title="No pools available"
        description="Create the first prediction pool and invite traders to join"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {pools.map((pool) => (
        <PoolCard key={pool.id} pool={pool} />
      ))}
    </div>
  );
}
