import { useEffect } from 'react';
import { useOracleStore } from '@/stores/oracleStore';
import { useMarketStore } from '@/stores/marketStore';
import { ActiveRounds, LightningHistory, OraclePriceFeed } from '@/components/lightning';
import PageHeader from '@/components/layout/PageHeader';

export default function Lightning() {
  const { fetchPrices } = useOracleStore();
  const { fetchMarkets, markets } = useMarketStore();

  useEffect(() => {
    fetchPrices();
    if (markets.length === 0) fetchMarkets();
    const priceInterval = setInterval(fetchPrices, 30_000);
    const marketInterval = setInterval(fetchMarkets, 30_000);
    return () => {
      clearInterval(priceInterval);
      clearInterval(marketInterval);
    };
  }, [fetchPrices, fetchMarkets, markets.length]);

  return (
    <div>
      <PageHeader
        title="Lightning Markets"
        subtitle="Fast-resolving prediction markets powered by on-chain oracles"
        action={{ label: '⚡ Create Lightning', href: '/create' }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
        <div className="lg:col-span-3 space-y-6">
          <ActiveRounds markets={[]} />
          <LightningHistory markets={[]} />
        </div>
        <div>
          <OraclePriceFeed />
        </div>
      </div>
    </div>
  );
}
