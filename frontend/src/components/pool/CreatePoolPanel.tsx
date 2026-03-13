import { useState } from 'react';
import { useTransaction } from '@/hooks/useTransaction';
import { buildAddLiquidityTx, generateNonce } from '@/utils/transactions';
import { parseAleoInput } from '@/utils/format';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';

interface CreatePoolPanelProps {
  onClose: () => void;
}

export default function CreatePoolPanel({ onClose }: CreatePoolPanelProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetSize, setTargetSize] = useState('');
  const [minEntry, setMinEntry] = useState('1');
  const { status, execute } = useTransaction();

  const handleCreate = async () => {
    const targetMicro = parseAleoInput(targetSize);
    const minMicro = parseAleoInput(minEntry);
    if (!name || targetMicro < 1_000_000 || minMicro < 100_000) return;

    const nonce = generateNonce();
    const tx = buildAddLiquidityTx(
      `${targetMicro}u64`,
      nonce,
      nonce
    );
    await execute(tx);
    onClose();
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-heading font-bold text-white mb-5">Create Prediction Pool</h2>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
            Pool Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Bitcoin Bulls Q1 2025"
            className="input-field"
            maxLength={100}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your pool strategy..."
            className="input-field resize-none h-20"
            maxLength={500}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
              Target Size (ALEO)
            </label>
            <input
              type="number"
              value={targetSize}
              onChange={(e) => setTargetSize(e.target.value)}
              placeholder="100"
              min="1"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
              Min Entry (ALEO)
            </label>
            <input
              type="number"
              value={minEntry}
              onChange={(e) => setMinEntry(e.target.value)}
              placeholder="1"
              min="0.1"
              step="0.1"
              className="input-field"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          loading={status === 'proving' || status === 'broadcasting'}
          disabled={!name || parseAleoInput(targetSize) < 1_000_000}
          onClick={handleCreate}
        >
          {status === 'proving' ? 'Generating Proof...' :
           status === 'broadcasting' ? 'Broadcasting...' :
           'Create Pool'}
        </Button>
      </div>
    </Card>
  );
}
