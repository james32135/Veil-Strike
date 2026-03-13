import { useEffect, useState } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { StatsOverview } from '@/components/leaderboard';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';
import type { ProtocolStats } from '@/types';
import { API_BASE } from '@/constants';

export default function Stats() {
  const { markets, fetchMarkets } = useMarketStore();
  const [stats, setStats] = useState<ProtocolStats>({
    totalMarkets: 0, activeMarkets: 0, resolvedMarkets: 0,
    totalVolume: 0, totalLiquidity: 0, totalTrades: 0,
    uniqueTraders: 0, protocolFees: 0,
  });

  useEffect(() => {
    fetchMarkets();
    fetch(`${API_BASE}/stats`)
      .then(r => r.json())
      .then(d => d.stats && setStats(d.stats))
      .catch(() => {});
  }, [fetchMarkets]);

  const categoryCount = markets.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {});
  const lightningCount = markets.filter(m => m.isLightning).length;
  const eventCount = markets.length - lightningCount;

  return (
    <div>
      <PageHeader
        title="Protocol Stats"
        subtitle="Real-time analytics for the Veil Strike protocol"
      />

      <div className="space-y-6 mt-6">
        <StatsOverview stats={stats} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-sm font-heading font-semibold text-white mb-4">Protocol Revenue</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Protocol Fee</span>
                <span className="font-mono text-gray-300">0.5%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Creator Fee</span>
                <span className="font-mono text-gray-300">0.5%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">LP Fee</span>
                <span className="font-mono text-gray-300">1.0%</span>
              </div>
              <div className="h-px bg-dark-400/30 my-2" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 font-medium">Total Fee</span>
                <span className="font-mono text-teal font-medium">2.0%</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-heading font-semibold text-white mb-4">Market Distribution</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Event Markets</span>
                <span className="font-mono text-gray-300">{eventCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Lightning Markets</span>
                <span className="font-mono text-amber-400">{lightningCount}</span>
              </div>
              <div className="h-px bg-dark-400/30 my-2" />
              {Object.entries(categoryCount).map(([cat, count]) => (
                <div key={cat} className="flex justify-between text-sm">
                  <span className="text-gray-500">{cat}</span>
                  <span className="font-mono text-gray-300">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
