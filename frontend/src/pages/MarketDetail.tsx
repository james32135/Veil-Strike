import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMarketStore } from '@/stores/marketStore';
import { MarketHeader, TradePanel, MarketStats, MarketChart, OrderBook, TradeHistory } from '@/components/market';
import Loading from '@/components/shared/Loading';
import EmptyState from '@/components/shared/EmptyState';
import { ChartIcon } from '@/components/icons';

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const { markets, loading, fetchMarkets } = useMarketStore();

  useEffect(() => {
    if (markets.length === 0) fetchMarkets();
  }, [markets.length, fetchMarkets]);

  const market = useMemo(
    () => markets.find((m) => m.id === id),
    [markets, id]
  );

  if (loading) return <Loading />;

  if (!market) {
    return (
      <EmptyState
        icon={<ChartIcon className="w-10 h-10 text-gray-600" />}
        title="Market not found"
        description="This market may have been removed or the link is incorrect"
        actionLabel="Browse Markets"
        actionHref="/markets"
      />
    );
  }

  return (
    <div className="space-y-6">
      <MarketHeader market={market} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <MarketChart market={market} />
          <OrderBook trades={[]} />
          <TradeHistory trades={[]} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <TradePanel market={market} />
          <MarketStats market={market} />
        </div>
      </div>
    </div>
  );
}
