import { useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useMarkets } from '@/hooks/useMarkets';
import { MarketCard, MarketFilters } from '@/components/market';
import PageHeader from '@/components/layout/PageHeader';
import Loading from '@/components/shared/Loading';
import EmptyState from '@/components/shared/EmptyState';
import { ChartIcon } from '@/components/icons';

export default function Markets() {
  const { loading, fetchMarkets } = useMarketStore();
  const {
    markets,
    selectedCategory,
    sortBy,
    searchQuery,
    selectedToken,
    setCategory,
    setSortBy,
    setSearchQuery,
    setSelectedToken,
  } = useMarkets();

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return (
    <div>
      <PageHeader
        title="Markets"
        subtitle="Browse and trade on prediction markets with full privacy"
        action={{ label: '+ Create Market', href: '/create' }}
      />

      <MarketFilters
        selectedCategory={selectedCategory}
        sortBy={sortBy}
        searchQuery={searchQuery}
        selectedToken={selectedToken}
        onCategoryChange={setCategory}
        onSortChange={setSortBy}
        onSearchChange={setSearchQuery}
        onTokenChange={setSelectedToken}
      />

      {loading ? (
        <Loading />
      ) : markets.length === 0 ? (
        <EmptyState
          icon={<ChartIcon className="w-10 h-10 text-gray-600" />}
          title="No markets found"
          description="Try adjusting your filters or create a new market"
          actionLabel="Create Market"
          actionHref="/create"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {markets.map((market, i) => (
            <MarketCard key={market.id} market={market} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
