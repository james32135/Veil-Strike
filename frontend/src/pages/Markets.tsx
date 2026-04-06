import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMarketStore } from '@/stores/marketStore';
import { useMarkets } from '@/hooks/useMarkets';
import { MarketCard, MarketFilters } from '@/components/market';
import PageHeader from '@/components/layout/PageHeader';
import Loading from '@/components/shared/Loading';
import EmptyState from '@/components/shared/EmptyState';
import { ChartIcon } from '@/components/icons';

const POLL_INTERVAL = 15_000;

const TRENDING_TAGS = ['BTC', 'ETH', 'ALEO', 'Privacy', 'DeFi', 'Whale Watch', 'AI', 'Governance'];

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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchMarkets();
    intervalRef.current = setInterval(fetchMarkets, POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMarkets]);

  return (
    <div>
      <PageHeader
        title="Markets"
        subtitle="Browse and trade on prediction markets with full privacy"
        action={{ label: '+ Create Market', href: '/create' }}
      />

      {/* Trending tags bar */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-heading whitespace-nowrap mr-1">Trending</span>
        {TRENDING_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setSearchQuery(tag === searchQuery ? '' : tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-heading whitespace-nowrap border transition-all ${
              searchQuery === tag
                ? 'border-teal/30 bg-teal/10 text-teal'
                : 'border-white/[0.04] bg-white/[0.01] text-gray-500 hover:text-gray-300 hover:border-white/[0.08]'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* All Markets (non-lightning only — strike rounds live on /rounds) */}
      <div>
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
    </div>
  );
}
