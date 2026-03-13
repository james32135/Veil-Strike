import type { LPReceipt } from '@/types';
import { formatAleo, formatTimeAgo } from '@/utils/format';
import Card from '@/components/shared/Card';
import EmptyState from '@/components/shared/EmptyState';
import Badge from '@/components/shared/Badge';
import { PoolIcon } from '@/components/icons';

interface LPPositionsProps {
  receipts: LPReceipt[];
}

export default function LPPositions({ receipts }: LPPositionsProps) {
  if (receipts.length === 0) {
    return (
      <EmptyState
        icon={<PoolIcon className="w-8 h-8 text-gray-600" />}
        title="No LP positions"
        description="Provide liquidity to markets to earn fees"
        actionLabel="Browse Markets"
        actionHref="/markets"
      />
    );
  }

  return (
    <div className="space-y-3">
      {receipts.map((receipt, i) => (
        <Card key={`lp-${i}`} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PoolIcon className="w-4 h-4 text-teal" />
              <span className="text-sm font-heading text-white truncate max-w-[250px]">
                Market #{receipt.marketId}
              </span>
            </div>
            <Badge variant="info">LP</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dark-400/20">
            <div>
              <p className="text-[10px] text-gray-600">LP Shares</p>
              <p className="text-xs font-mono text-gray-300">{formatAleo(receipt.lpShares)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-600">Deposited</p>
              <p className="text-xs font-mono text-gray-300">{formatAleo(receipt.depositAmount)} ALEO</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-600">Share %</p>
              <p className="text-xs font-mono text-teal">{receipt.sharePercentage.toFixed(2)}%</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
