import type { TradeHistoryEntry } from '@/types';
import { formatAleo, formatTimeAgo } from '@/utils/format';
import Card from '@/components/shared/Card';
import EmptyState from '@/components/shared/EmptyState';
import { WalletIcon } from '@/components/icons';

interface TradeHistoryProps {
  trades: TradeHistoryEntry[];
}

export default function TradeHistory({ trades }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<WalletIcon className="w-8 h-8 text-gray-600" />}
          title="No trade history"
          description="Your trades for this market will appear here"
        />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">
        Your Trade History
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dark-400/30">
              <th className="text-left text-gray-600 uppercase py-2">Type</th>
              <th className="text-left text-gray-600 uppercase py-2">Outcome</th>
              <th className="text-right text-gray-600 uppercase py-2">Amount</th>
              <th className="text-right text-gray-600 uppercase py-2">Shares</th>
              <th className="text-right text-gray-600 uppercase py-2">Price</th>
              <th className="text-right text-gray-600 uppercase py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, i) => (
              <tr key={i} className="border-b border-dark-400/10 last:border-0">
                <td className="py-2">
                  <span className={`font-medium ${
                    trade.type === 'buy' ? 'text-accent-green' : 'text-accent-red'
                  }`}>
                    {trade.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 text-gray-400">{trade.outcome}</td>
                <td className="py-2 text-right font-mono text-gray-300">
                  {formatAleo(trade.amount)}
                </td>
                <td className="py-2 text-right font-mono text-gray-300">
                  {formatAleo(trade.shares)}
                </td>
                <td className="py-2 text-right font-mono text-gray-300">
                  {(trade.price * 100).toFixed(1)}%
                </td>
                <td className="py-2 text-right text-gray-600">
                  {formatTimeAgo(trade.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
