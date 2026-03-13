import type { Market } from '@/types';
import { formatAleo, formatCompact } from '@/utils/format';
import { calculatePrices } from '@/utils/fpmm';
import { PRECISION } from '@/constants';
import Card from '@/components/shared/Card';
import StatCard from '@/components/shared/StatCard';

interface MarketStatsProps {
  market: Market;
}

export default function MarketStats({ market }: MarketStatsProps) {
  const prices = calculatePrices(market.reserves);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Volume"
          value={formatCompact(market.totalVolume / 1_000_000)}
          suffix="ALEO"
        />
        <StatCard
          label="Liquidity"
          value={formatCompact(market.totalLiquidity / 1_000_000)}
          suffix="ALEO"
        />
        <StatCard
          label="Trades"
          value={market.tradeCount.toString()}
        />
        <StatCard
          label="Fee"
          value="2%"
        />
      </div>

      <Card className="p-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">
          Outcome Probabilities
        </h3>
        <div className="space-y-3">
          {market.outcomes.map((outcome, i) => {
            const pct = (prices[i] / PRECISION) * 100;
            return (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-300">{outcome}</span>
                  <span className="text-sm font-mono text-gray-300">{pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-dark-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: i === 0 ? '#22C55E' : i === 1 ? '#EF4444' : '#00D4B8',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">
          Reserves
        </h3>
        <div className="space-y-2">
          {market.outcomes.map((outcome, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-500">{outcome}</span>
              <span className="font-mono text-gray-300">{formatAleo(market.reserves[i])} ALEO</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
