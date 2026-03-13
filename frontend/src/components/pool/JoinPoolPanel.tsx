import { useState } from 'react';
import type { Pool } from '@/types';
import { useTransaction } from '@/hooks/useTransaction';
import { buildAddLiquidityTx, generateNonce } from '@/utils/transactions';
import { formatAleo, parseAleoInput } from '@/utils/format';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import ProgressBar from '@/components/shared/ProgressBar';

interface JoinPoolPanelProps {
  pool: Pool;
  onClose: () => void;
}

export default function JoinPoolPanel({ pool, onClose }: JoinPoolPanelProps) {
  const [amount, setAmount] = useState('');
  const { status, execute } = useTransaction();

  const amountMicro = parseAleoInput(amount);
  const remaining = pool.targetSize - pool.currentSize;
  const isOverflow = amountMicro > remaining;
  const isBelowMin = amountMicro > 0 && amountMicro < pool.minEntry;

  const handleJoin = async () => {
    if (amountMicro < pool.minEntry || isOverflow) return;
    const nonce = generateNonce();
    const tx = buildAddLiquidityTx(
      `${amountMicro}u64`,
      pool.id,
      nonce
    );
    await execute(tx);
    onClose();
  };

  const fillPct = (pool.currentSize / pool.targetSize) * 100;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-heading font-bold text-white mb-1">{pool.name}</h2>
      <p className="text-xs text-gray-500 mb-5">{pool.description}</p>

      <div className="mb-5">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">Pool Progress</span>
          <span className="font-mono text-gray-300">{fillPct.toFixed(0)}%</span>
        </div>
        <ProgressBar value={fillPct} color="teal" />
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>{formatAleo(pool.currentSize)} raised</span>
          <span>{formatAleo(remaining)} remaining</span>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Your Contribution (ALEO)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Min: ${formatAleo(pool.minEntry)}`}
          min="0"
          step="0.1"
          className="input-field"
        />
        {isBelowMin && (
          <p className="text-[10px] text-accent-red mt-1">
            Minimum entry: {formatAleo(pool.minEntry)} ALEO
          </p>
        )}
        {isOverflow && (
          <p className="text-[10px] text-accent-red mt-1">
            Exceeds remaining capacity ({formatAleo(remaining)} ALEO)
          </p>
        )}
      </div>

      <div className="flex gap-3 mt-5">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          loading={status === 'proving' || status === 'broadcasting'}
          disabled={amountMicro < pool.minEntry || isOverflow}
          onClick={handleJoin}
        >
          {status === 'proving' ? 'Generating Proof...' :
           status === 'broadcasting' ? 'Broadcasting...' :
           'Join Pool'}
        </Button>
      </div>
    </Card>
  );
}
