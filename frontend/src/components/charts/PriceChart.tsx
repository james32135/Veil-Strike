import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle, type IChartApi } from 'lightweight-charts';
import type { ChartDataPoint } from '@/types';
import { CHART_COLORS } from '@/constants';

interface PriceChartProps {
  data: ChartDataPoint[];
  color?: string;
  height?: number;
}

export default function PriceChart({ data, color = CHART_COLORS.teal, height = 300 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

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
      rightPriceScale: { borderColor: '#1C2333' },
      timeScale: { borderColor: '#1C2333' },
    });

    const series = chart.addAreaSeries({
      lineColor: color,
      topColor: `${color}30`,
      bottomColor: `${color}05`,
      lineWidth: 2,
    });

    series.setData(
      data.map((d) => ({
        time: Math.floor(d.time / 1000) as any,
        value: d.price,
      }))
    );

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
  }, [data, color, height]);

  return <div ref={containerRef} className="w-full" />;
}
