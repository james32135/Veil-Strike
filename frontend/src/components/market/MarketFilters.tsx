import { SearchIcon, ChevronDownIcon } from '@/components/icons';
import { CATEGORIES } from '@/constants';
import CryptoIcon from '@/components/shared/CryptoIcon';
import type { MarketSortBy } from '@/types';

const TOKEN_FILTERS = ['All', 'ALEO', 'USDCX', 'USAD'] as const;
export type TokenFilter = (typeof TOKEN_FILTERS)[number];

interface MarketFiltersProps {
  selectedCategory: string;
  sortBy: MarketSortBy;
  searchQuery: string;
  selectedToken: TokenFilter;
  onCategoryChange: (cat: string) => void;
  onSortChange: (sort: MarketSortBy) => void;
  onSearchChange: (query: string) => void;
  onTokenChange: (token: TokenFilter) => void;
}

export default function MarketFilters({
  selectedCategory,
  sortBy,
  searchQuery,
  selectedToken,
  onCategoryChange,
  onSortChange,
  onSearchChange,
  onTokenChange,
}: MarketFiltersProps) {
  return (
    <div className="space-y-4 mb-8">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-field pl-11"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Categories */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`px-3 py-1.5 text-xs font-heading font-medium rounded-lg transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-teal/10 text-teal border border-teal/20'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Token Filter */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          {TOKEN_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => onTokenChange(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-heading font-medium rounded-md transition-all ${
                selectedToken === t
                  ? 'bg-gradient-to-b from-teal/20 to-teal/10 text-teal shadow-[0_0_10px_-3px_rgba(45,212,191,0.25)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
              }`}
            >
              {t !== 'All' && <CryptoIcon symbol={t} size={13} />}
              {t === 'USDCX' ? 'USDCx' : t}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="ml-auto relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as MarketSortBy)}
            className="appearance-none bg-dark-200 border border-dark-400 text-gray-300 text-xs font-heading px-3 py-1.5 pr-8 rounded-lg focus:outline-none focus:border-teal/50"
          >
            <option value="volume">Volume</option>
            <option value="liquidity">Liquidity</option>
            <option value="newest">Newest</option>
            <option value="ending">Ending Soon</option>
          </select>
          <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
