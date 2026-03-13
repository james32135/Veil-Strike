import { formatAleo } from '@/utils/format';
import Card from '@/components/shared/Card';
import StatCard from '@/components/shared/StatCard';

interface PnLSummaryProps {
  totalPnL: number;
  totalInvested: number;
  openPositions: number;
  winRate: number;
}

export default function PnLSummary({ totalPnL, totalInvested, openPositions, winRate }: PnLSummaryProps) {
  const roi = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Total P&L"
        value={`${totalPnL >= 0 ? '+' : ''}${formatAleo(totalPnL)}`}
        suffix="ALEO"
        trend={totalPnL >= 0 ? 'up' : 'down'}
        trendValue={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}% ROI`}
      />
      <StatCard
        label="Total Invested"
        value={formatAleo(totalInvested)}
        suffix="ALEO"
      />
      <StatCard
        label="Open Positions"
        value={openPositions.toString()}
      />
      <StatCard
        label="Win Rate"
        value={`${winRate.toFixed(0)}%`}
        trend={winRate >= 50 ? 'up' : 'down'}
      />
    </div>
  );
}
