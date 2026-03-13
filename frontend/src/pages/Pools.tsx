import { useState } from 'react';
import { PoolList, PoolStats, CreatePoolPanel } from '@/components/pool';
import PageHeader from '@/components/layout/PageHeader';
import Modal from '@/components/shared/Modal';
import type { Pool } from '@/types';

// Pools are fetched from on-chain LP records — starts empty until users create pools
const pools: Pool[] = [];

export default function Pools() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <PageHeader
        title="Prediction Pools"
        subtitle="Join collective pools to trade collaboratively with shared capital"
        action={{ label: '+ Create Pool', onClick: () => setShowCreate(true) }}
      />

      <div className="space-y-6 mt-6">
        <PoolStats pools={pools} />
        <PoolList pools={pools} />
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Pool" size="md">
        <CreatePoolPanel onClose={() => setShowCreate(false)} />
      </Modal>
    </div>
  );
}
