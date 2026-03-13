import type { Market } from '@/types';
import LightningCard from './LightningCard';
import EmptyState from '@/components/shared/EmptyState';
import { BoltIcon } from '@/components/icons';

interface ActiveRoundsProps {
  markets: Market[];
}

export default function ActiveRounds({ markets }: ActiveRoundsProps) {
  const lightningMarkets = markets.filter((m) => m.isLightning && m.status === 'active');

  if (lightningMarkets.length === 0) {
    return (
      <EmptyState
        icon={<BoltIcon className="w-10 h-10 text-gray-600" />}
        title="No active lightning rounds"
        description="Lightning rounds resolve in minutes. Check back soon!"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {lightningMarkets.map((market) => (
        <LightningCard key={market.id} market={market} />
      ))}
    </div>
  );
}
