import { SearchIcon, ChevronDownIcon } from '@/components/icons';
import { CATEGORIES } from '@/constants';
import type { MarketSortBy } from '@/types';

interface MarketFiltersProps {
  selectedCategory: string;
  sortBy: MarketSortBy;
  searchQuery: string;
  onCategoryChange: (cat: string) => void;
  onSortChange: (sort: MarketSortBy) => void;
  onSearchChange: (query: string) => void;
}

export default function MarketFilters({
  selectedCategory,
  sortBy,
  searchQuery,
  onCategoryChange,
  onSortChange,
  onSearchChange,
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
