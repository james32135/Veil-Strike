import type { TradeHistoryEntry } from '@/types';
import { formatAleo, formatTimeAgo, truncateAddress } from '@/utils/format';
import Card from '@/components/shared/Card';
import EmptyState from '@/components/shared/EmptyState';
import { ChartIcon } from '@/components/icons';

interface OrderBookProps {
  trades: TradeHistoryEntry[];
}

export default function OrderBook({ trades }: OrderBookProps) {
  if (trades.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<ChartIcon className="w-8 h-8 text-gray-600" />}
          title="No trades yet"
          description="Be the first to trade on this market"
        />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">
        Recent Activity
      </h3>
      <div className="space-y-0">
        <div className="grid grid-cols-4 gap-2 pb-2 border-b border-dark-400/30">
          <span className="text-[10px] text-gray-600 uppercase">Type</span>
          <span className="text-[10px] text-gray-600 uppercase">Side</span>
          <span className="text-[10px] text-gray-600 uppercase">Amount</span>
          <span className="text-[10px] text-gray-600 uppercase text-right">Time</span>
        </div>
        {trades.slice(0, 20).map((trade, i) => (
          <div
            key={i}
            className="grid grid-cols-4 gap-2 py-2 border-b border-dark-400/10 last:border-0"
          >
            <span className={`text-xs font-medium ${
              trade.type === 'buy' ? 'text-accent-green' : 'text-accent-red'
            }`}>
              {trade.type.toUpperCase()}
            </span>
            <span className="text-xs text-gray-400">{trade.outcome}</span>
            <span className="text-xs font-mono text-gray-300">
              {formatAleo(trade.amount)}
            </span>
            <span className="text-[10px] text-gray-600 text-right">
              {formatTimeAgo(trade.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
