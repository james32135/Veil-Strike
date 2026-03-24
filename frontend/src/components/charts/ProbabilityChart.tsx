import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle, type IChartApi } from 'lightweight-charts';
import { CHART_COLORS } from '@/constants';

interface ProbabilityChartProps {
  outcomes: string[];
  reserves: number[];
  createdAt: number;
  totalVolume: number;
  height?: number;
}

const OUTCOME_COLORS = [CHART_COLORS.green, CHART_COLORS.red, '#F59E0B', '#8B5CF6', '#EC4899'];

function computeOutcomeProbabilities(reserves: number[]): number[] {
  const total = reserves.reduce((a, b) => a + b, 0);
  if (total === 0) return reserves.map(() => 1 / reserves.length);
  // FPMM: probability of outcome i = product(reserves_j for j≠i) / sum(product(reserves_j for j≠k) for all k)
  // For 2 outcomes: P(0) = reserves[1]/(reserves[0]+reserves[1])
  return reserves.map((_, i) => {
    const others = reserves.reduce((prod, r, j) => j !== i ? prod * r : prod, 1);
    return others;
  }).map((p, _, arr) => {
    const sum = arr.reduce((s, v) => s + v, 0);
    return sum > 0 ? p / sum : 1 / arr.length;
  });
}

export default function ProbabilityChart({
  outcomes, reserves, createdAt, totalVolume, height = 280,
}: ProbabilityChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || reserves.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6B7280',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1C233320', style: LineStyle.Dotted },
        horzLines: { color: '#1C233320', style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: '#00D4B840', labelBackgroundColor: '#111822' },
        horzLine: { color: '#00D4B840', labelBackgroundColor: '#111822' },
      },
      rightPriceScale: {
        borderColor: '#1C2333',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: { borderColor: '#1C2333' },
    });

    const currentProbs = computeOutcomeProbabilities(reserves);
    const now = Date.now();
    const dayMs = 86_400_000;
    const age = Math.max(1, Math.floor((now - createdAt) / dayMs));
    const days = Math.min(age, 30);
    const initProb = 1 / outcomes.length;

    // One area series per outcome
    outcomes.forEach((_, idx) => {
      const color = OUTCOME_COLORS[idx % OUTCOME_COLORS.length];
      const series = chart.addAreaSeries({
        lineColor: color,
        topColor: `${color}20`,
        bottomColor: `${color}05`,
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: false,
      });

      const points = [];
      for (let i = days; i >= 0; i--) {
        const t = days > 0 ? (days - i) / days : 1;
        const prob = initProb + (currentProbs[idx] - initProb) * t;
        points.push({
          time: Math.floor((now - i * dayMs) / 1000) as any,
          value: Math.max(0.01, Math.min(0.99, prob)),
        });
      }
      series.setData(points);
    });

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [outcomes, reserves, createdAt, totalVolume, height]);

  // Current probability bars
  const probs = computeOutcomeProbabilities(reserves);

  return (
    <div>
      {/* Probability Bars */}
      <div className="flex items-center gap-3 mb-4">
        {outcomes.map((name, idx) => {
          const pct = (probs[idx] * 100).toFixed(1);
          const color = OUTCOME_COLORS[idx % OUTCOME_COLORS.length];
          return (
            <div key={idx} className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-heading font-medium text-gray-400">{name}</span>
                <span className="text-xs font-mono font-bold" style={{ color }}>{pct}%</span>
              </div>
              <div className="h-2 bg-dark-400/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart Legend */}
      <div className="flex items-center gap-4 mb-2">
        {outcomes.map((name, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: OUTCOME_COLORS[idx % OUTCOME_COLORS.length] }}
            />
            <span className="text-[10px] text-gray-500 font-heading">{name}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
