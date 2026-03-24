import { useMemo } from 'react';
import type { Market, ChartDataPoint } from '@/types';
import ProbabilityChart from '@/components/charts/ProbabilityChart';
import Card from '@/components/shared/Card';

interface MarketChartProps {
  market: Market;
}

export default function MarketChart({ market }: MarketChartProps) {
  return (
    <Card className="p-4">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">
        Outcome Probabilities
      </h3>
      <ProbabilityChart
        outcomes={market.outcomes}
        reserves={market.reserves}
        createdAt={market.createdAt}
        totalVolume={market.totalVolume}
        height={280}
      />
    </Card>
  );
}
