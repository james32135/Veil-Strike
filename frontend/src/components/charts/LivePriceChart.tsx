import { useEffect, useRef, useCallback, useState } from 'react';
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
  /** Show live price ticker overlay */
  showTicker?: boolean;
}

export default function LivePriceChart({
  data,
  targetPrice,
  asset,
  color = CHART_COLORS.teal,
  height = 320,
  showTicker = false,
}: LivePriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const liveDataRef = useRef<{ time: number; price: number }[]>([]);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef<number | null>(null);

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

    // Set initial data — sort, convert to seconds, deduplicate (keep last value per second)
    const sorted = [...data].sort((a, b) => a.time - b.time);
    liveDataRef.current = sorted;
    const secMap = new Map<number, number>();
    for (const d of sorted) {
      secMap.set(Math.floor(d.time / 1000), d.price);
    }
    const deduped = Array.from(secMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as any, value }));
    areaSeries.setData(deduped);

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

  // Live price via SSE — streams every ~15s, falls back to REST polling
  const updatePrice = useCallback((price: number) => {
    if (!seriesRef.current) return;
    const timeSec = Math.floor(Date.now() / 1000) as any;
    seriesRef.current.update({ time: timeSec, value: price });

    // Flash up/down
    if (prevPriceRef.current !== null) {
      if (price > prevPriceRef.current) setPriceFlash('up');
      else if (price < prevPriceRef.current) setPriceFlash('down');
    }
    prevPriceRef.current = price;
    setLivePrice(price);
    setTimeout(() => setPriceFlash(null), 500);
  }, []);

  useEffect(() => {
    if (!asset) return;
    const key = asset.toLowerCase();

    // Try SSE first
    const sseUrl = `${API_BASE}/oracle/stream`;
    const es = new EventSource(sseUrl);
    let sseActive = false;

    es.onmessage = (event) => {
      sseActive = true;
      try {
        const prices = JSON.parse(event.data);
        const price = prices[key];
        if (price !== undefined) updatePrice(price);
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      // If SSE fails, fall back to REST polling
      if (!sseActive) {
        es.close();
        pollRef.current = setInterval(async () => {
          try {
            const res = await fetch(`${API_BASE}/oracle`);
            if (!res.ok) return;
            const { prices } = await res.json();
            const price = prices[key];
            if (price !== undefined) updatePrice(price);
          } catch { /* ignore */ }
        }, 3000);
      }
    };

    sseRef.current = es;

    return () => {
      es.close();
      sseRef.current = null;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [asset, updatePrice]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.04] bg-dark-300/30">
      {showTicker && livePrice !== null && (
        <div className={`absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg bg-dark-400/80 backdrop-blur-sm border border-white/[0.06] font-mono text-sm transition-colors duration-300 ${
          priceFlash === 'up' ? 'text-green-400' : priceFlash === 'down' ? 'text-red-400' : 'text-white'
        }`}>
          ${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
