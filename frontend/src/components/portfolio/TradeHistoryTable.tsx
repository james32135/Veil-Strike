import type { TradeHistoryEntry } from '@/types';
import { formatAleo, formatTimeAgo } from '@/utils/format';
import Card from '@/components/shared/Card';
import EmptyState from '@/components/shared/EmptyState';
import { ClockIcon } from '@/components/icons';

interface TradeHistoryTableProps {
  trades: TradeHistoryEntry[];
}

export default function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  if (trades.length === 0) {
    return (
      <EmptyState
        icon={<ClockIcon className="w-8 h-8 text-gray-600" />}
        title="No trades yet"
        description="Your trade history will appear here after your first trade"
      />
    );
  }

  return (
    <Card className="p-4 overflow-x-auto">
      <table className="w-full text-xs min-w-[500px]">
        <thead>
          <tr className="border-b border-dark-400/30">
            <th className="text-left text-gray-600 uppercase py-2 font-heading">Market</th>
            <th className="text-left text-gray-600 uppercase py-2 font-heading">Type</th>
            <th className="text-left text-gray-600 uppercase py-2 font-heading">Outcome</th>
            <th className="text-right text-gray-600 uppercase py-2 font-heading">Amount</th>
            <th className="text-right text-gray-600 uppercase py-2 font-heading">Shares</th>
            <th className="text-right text-gray-600 uppercase py-2 font-heading">Price</th>
            <th className="text-right text-gray-600 uppercase py-2 font-heading">Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, i) => (
            <tr key={i} className="border-b border-dark-400/10 last:border-0 hover:bg-dark-200/30">
              <td className="py-2.5">
                <span className="text-gray-300 truncate block max-w-[200px]">{trade.marketId}</span>
              </td>
              <td className="py-2.5">
                <span className={`font-medium ${
                  trade.type === 'buy' ? 'text-accent-green' : 'text-accent-red'
                }`}>
                  {trade.type.toUpperCase()}
                </span>
              </td>
              <td className="py-2.5 text-gray-400">{trade.outcome}</td>
              <td className="py-2.5 text-right font-mono text-gray-300">{formatAleo(trade.amount)}</td>
              <td className="py-2.5 text-right font-mono text-gray-300">{formatAleo(trade.shares)}</td>
              <td className="py-2.5 text-right font-mono text-gray-300">{(trade.price * 100).toFixed(1)}%</td>
              <td className="py-2.5 text-right text-gray-600">{formatTimeAgo(trade.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
