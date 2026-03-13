import { Link } from 'react-router-dom';
import type { Pool } from '@/types';
import { formatAleo, formatCompact, truncateAddress } from '@/utils/format';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import ProgressBar from '@/components/shared/ProgressBar';
import { PoolIcon, TrophyIcon } from '@/components/icons';

interface PoolCardProps {
  pool: Pool;
}

export default function PoolCard({ pool }: PoolCardProps) {
  const fillPct = (pool.currentSize / pool.targetSize) * 100;

  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center">
            <PoolIcon className="w-4.5 h-4.5 text-teal" />
          </div>
          <div>
            <h3 className="text-sm font-heading font-semibold text-white">{pool.name}</h3>
            <p className="text-[10px] text-gray-600">by {truncateAddress(pool.creator)}</p>
          </div>
        </div>
        <Badge variant={pool.status === 'active' ? 'success' : pool.status === 'settled' ? 'info' : 'warning'}>
          {pool.status}
        </Badge>
      </div>

      <p className="text-xs text-gray-400 mb-4 line-clamp-2">{pool.description}</p>

      {/* Pool progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">Pool Size</span>
          <span className="font-mono text-gray-300">
            {formatCompact(pool.currentSize / 1_000_000)} / {formatCompact(pool.targetSize / 1_000_000)} ALEO
          </span>
        </div>
        <ProgressBar value={fillPct} color="teal" />
        <p className="text-[10px] text-gray-600 mt-1">{pool.memberCount} members</p>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-dark-400/20">
        <div className="text-center flex-1">
          <p className="text-xs text-gray-500">Markets</p>
          <p className="text-sm font-mono text-white">{pool.marketIds.length}</p>
        </div>
        <div className="w-px h-8 bg-dark-400/30" />
        <div className="text-center flex-1">
          <p className="text-xs text-gray-500">Min Entry</p>
          <p className="text-sm font-mono text-white">{formatAleo(pool.minEntry)}</p>
        </div>
        <div className="w-px h-8 bg-dark-400/30" />
        <div className="text-center flex-1">
          <p className="text-xs text-gray-500">P&L</p>
          <p className={`text-sm font-mono ${pool.totalPnL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {pool.totalPnL >= 0 ? '+' : ''}{formatAleo(pool.totalPnL)}
          </p>
        </div>
      </div>
    </Card>
  );
}
