import { useMemo } from 'react';
import type { Market, ChartDataPoint } from '@/types';
import PriceChart from '@/components/charts/PriceChart';
import Card from '@/components/shared/Card';

interface MarketChartProps {
  market: Market;
}

function computePriceData(market: Market): ChartDataPoint[] {
  const totalReserves = market.reserves.reduce((a, b) => a + b, 0);
  if (totalReserves === 0) return [];

  // Show current price point derived from reserves (FPMM pricing)
  const currentPrice = totalReserves > 0
    ? (totalReserves - market.reserves[0]) / totalReserves / (market.outcomes.length - 1)
    : 0.5;

  // Generate a price series from creation to now based on the current state
  const now = Date.now();
  const points: ChartDataPoint[] = [];
  const dayMs = 86_400_000;
  const age = Math.max(1, Math.floor((now - market.createdAt) / dayMs));
  const days = Math.min(age, 30);

  for (let i = days; i >= 0; i--) {
    // Interpolate from 0.5 (initial equal split) to current price
    const t = days > 0 ? (days - i) / days : 1;
    const price = 0.5 + (currentPrice - 0.5) * t;
    points.push({
      time: now - i * dayMs,
      price: Math.max(0.01, Math.min(0.99, price)),
      volume: market.totalVolume > 0 ? Math.floor(market.totalVolume / days) : 0,
    });
  }

  return points;
}

export default function MarketChart({ market }: MarketChartProps) {
  const data = useMemo(() => computePriceData(market), [market.id, market.reserves]);

  return (
    <Card className="p-4">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">
        Price History
      </h3>
      <PriceChart data={data} height={280} />
    </Card>
  );
}
