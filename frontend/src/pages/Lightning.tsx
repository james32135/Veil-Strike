import { useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useOracleStore } from '@/stores/oracleStore';
import { ActiveRounds, LightningHistory, OraclePriceFeed } from '@/components/lightning';
import PageHeader from '@/components/layout/PageHeader';
import Loading from '@/components/shared/Loading';

export default function Lightning() {
  const { markets, loading, fetchMarkets } = useMarketStore();
  const { fetchPrices } = useOracleStore();

  useEffect(() => {
    fetchMarkets();
    fetchPrices();
    const interval = setInterval(fetchPrices, 30_000);
    return () => clearInterval(interval);
  }, [fetchMarkets, fetchPrices]);

  return (
    <div>
      <PageHeader
        title="Lightning Markets"
        subtitle="Fast-resolving prediction markets powered by on-chain oracles"
        action={{ label: '⚡ Create Lightning', href: '/create' }}
      />

      {loading ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          <div className="lg:col-span-3 space-y-6">
            <ActiveRounds markets={markets} />
            <LightningHistory markets={markets} />
          </div>
          <div>
            <OraclePriceFeed />
          </div>
        </div>
      )}
    </div>
  );
}
