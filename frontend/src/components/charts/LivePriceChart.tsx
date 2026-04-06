import { useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, LineStyle, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { CHART_COLORS, API_BASE } from '@/constants';

interface LivePriceChartProps {
  /** Initial data points { time: epoch ms, price: number } */
  data: { time: number; price: number }[];
  /** Horizontal target price line (start price / price to beat) */
  targetPrice?: number;
  /** Asset to poll live price for (BTC, ETH, ALEO) */
  asset?: string;
  /** Chart accent color */
  color?: string;
  height?: number;
}

export default function LivePriceChart({
  data,
  targetPrice,
  asset,
  color = CHART_COLORS.teal,
  height = 320,
}: LivePriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const liveDataRef = useRef<{ time: number; price: number }[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial chart setup
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6B7280',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#1C233318', style: LineStyle.Dotted },
        horzLines: { color: '#1C233318', style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: `${color}40`, labelBackgroundColor: '#111822' },
        horzLine: { color: `${color}40`, labelBackgroundColor: '#111822' },
      },
      rightPriceScale: {
        borderColor: '#1C2333',
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: '#1C2333',
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: color,
      topColor: `${color}25`,
      bottomColor: `${color}05`,
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    // Set initial data
    const sorted = [...data].sort((a, b) => a.time - b.time);
    liveDataRef.current = sorted;
    areaSeries.setData(
      sorted.map((d) => ({
        time: Math.floor(d.time / 1000) as any,
        value: d.price,
      }))
    );

    // Target price dashed line
    if (targetPrice !== undefined) {
      areaSeries.createPriceLine({
        price: targetPrice,
        color: '#F59E0B',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Target',
      });
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;
    seriesRef.current = areaSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [data, targetPrice, color, height]);

  // Live price polling — every 3 seconds, update chart with latest oracle price
  const appendLivePrice = useCallback(async () => {
    if (!asset || !seriesRef.current) return;
    try {
      const res = await fetch(`${API_BASE}/oracle`);
      if (!res.ok) return;
      const { prices } = await res.json();
      const key = asset.toLowerCase();
      const price = prices[key];
      if (price === undefined) return;

      const now = Date.now();
      const timeSec = Math.floor(now / 1000) as any;

      // Update chart
      seriesRef.current.update({ time: timeSec, value: price });
    } catch { /* ignore */ }
  }, [asset]);

  useEffect(() => {
    if (!asset) return;
    pollRef.current = setInterval(appendLivePrice, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [asset, appendLivePrice]);

  return (
    <div className="w-full rounded-xl overflow-hidden border border-white/[0.04] bg-dark-300/30">
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
