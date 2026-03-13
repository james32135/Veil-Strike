import type { LeaderboardEntry } from '@/types';
import { formatAleo, truncateAddress } from '@/utils/format';
import Card from '@/components/shared/Card';
import { TrophyIcon, FireIcon } from '@/components/icons';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

const rankColors = ['text-amber-400', 'text-gray-400', 'text-amber-600'];

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <Card className="p-4 overflow-x-auto">
      <table className="w-full text-xs min-w-[600px]">
        <thead>
          <tr className="border-b border-dark-400/30">
            <th className="text-left text-gray-600 uppercase py-2 font-heading w-12">#</th>
            <th className="text-left text-gray-600 uppercase py-2 font-heading">Trader</th>
            <th className="text-right text-gray-600 uppercase py-2 font-heading">P&L</th>
            <th className="text-right text-gray-600 uppercase py-2 font-heading">Win Rate</th>
            <th className="text-right text-gray-600 uppercase py-2 font-heading">Trades</th>
            <th className="text-right text-gray-600 uppercase py-2 font-heading">Streak</th>
            <th className="text-right text-gray-600 uppercase py-2 font-heading">Volume</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={entry.address} className="border-b border-dark-400/10 last:border-0 hover:bg-dark-200/30">
              <td className="py-3">
                {i < 3 ? (
                  <div className="flex items-center gap-1">
                    <TrophyIcon className={`w-4 h-4 ${rankColors[i]}`} />
                    <span className={`font-mono font-bold ${rankColors[i]}`}>{i + 1}</span>
                  </div>
                ) : (
                  <span className="font-mono text-gray-500">{i + 1}</span>
                )}
              </td>
              <td className="py-3">
                <span className="font-mono text-gray-300">{truncateAddress(entry.address)}</span>
              </td>
              <td className="py-3 text-right">
                <span className={`font-mono font-medium ${
                  entry.totalPnL >= 0 ? 'text-accent-green' : 'text-accent-red'
                }`}>
                  {entry.totalPnL >= 0 ? '+' : ''}{formatAleo(entry.totalPnL)}
                </span>
              </td>
              <td className="py-3 text-right">
                <span className="font-mono text-gray-300">{entry.winRate.toFixed(0)}%</span>
              </td>
              <td className="py-3 text-right font-mono text-gray-400">{entry.totalTrades}</td>
              <td className="py-3 text-right">
                {entry.streak > 0 && (
                  <span className="flex items-center gap-1 justify-end text-amber-400">
                    <FireIcon className="w-3 h-3" />
                    <span className="font-mono">{entry.streak}</span>
                  </span>
                )}
              </td>
              <td className="py-3 text-right font-mono text-gray-400">
                {formatAleo(entry.totalVolume)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
