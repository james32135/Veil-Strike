import { useState } from 'react';
import type { Market } from '@/types';
import { useCountdown } from '@/hooks/useCountdown';
import { useMarketStore } from '@/stores/marketStore';
import { API_BASE } from '@/constants';
import Badge from '@/components/shared/Badge';
import { ClockIcon, FireIcon, LockIcon } from '@/components/icons';

interface MarketHeaderProps {
  market: Market;
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  active: { label: 'Active', variant: 'success' },
  closed: { label: 'Closed', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'info' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  pending_resolution: { label: 'Pending Resolution', variant: 'warning' },
};

export default function MarketHeader({ market }: MarketHeaderProps) {
  const countdown = useCountdown(market.endTime);
  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const isPlaceholder = market.question.startsWith('Market ') && market.question.includes('...');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(market.question);
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    if (!editName.trim() || editName === market.question) { setEditing(false); return; }
    setSaving(true);
    try {
      await fetch(`${API_BASE}/markets/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: market.id,
          question: editName.trim(),
          outcomes: market.outcomes,
          isLightning: market.isLightning,
          tokenType: market.tokenType || undefined,
        }),
      });
      await fetchMarkets();
      setEditing(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const cfg = statusConfig[market.status] || statusConfig.active;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
        <span className="text-xs text-gray-500 font-mono uppercase px-2 py-0.5 bg-dark-200 rounded-md">
          {market.category}
        </span>
        {market.isLightning && (
          <span className="flex items-center gap-1 text-xs text-amber-400 px-2 py-0.5 bg-amber-400/10 rounded-md">
            <FireIcon className="w-3 h-3" />
            Lightning
          </span>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 bg-dark-200 border border-white/10 rounded-lg px-3 py-2 text-white text-lg font-heading focus:outline-none focus:border-teal/50"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false); }}
          />
          <button onClick={handleSaveName} disabled={saving} className="px-4 py-2 bg-teal/20 text-teal rounded-lg text-sm font-medium hover:bg-teal/30 disabled:opacity-50">{saving ? '...' : 'Save'}</button>
          <button onClick={() => setEditing(false)} className="px-3 py-2 text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-white">
            {market.question}
          </h1>
          {isPlaceholder && (
            <button onClick={() => { setEditName(''); setEditing(true); }} className="text-xs text-teal/70 hover:text-teal border border-teal/20 hover:border-teal/40 px-2 py-1 rounded-md transition-colors">Edit name</button>
          )}
        </div>
      )}

      {market.status === 'active' && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <ClockIcon className="w-4 h-4" />
          {countdown.days > 0 && (
            <span className="font-mono">{countdown.days}d {countdown.hours}h {countdown.minutes}m</span>
          )}
          {countdown.days === 0 && countdown.hours > 0 && (
            <span className="font-mono text-amber-400">{countdown.hours}h {countdown.minutes}m {countdown.seconds}s</span>
          )}
          {countdown.days === 0 && countdown.hours === 0 && (
            <span className="font-mono text-accent-red">{countdown.minutes}m {countdown.seconds}s</span>
          )}
          <span className="text-gray-600">remaining</span>
        </div>
      )}

      {market.status === 'resolved' && market.resolvedOutcome !== undefined && (
        <div className="flex items-center gap-2 mt-2">
          <LockIcon className="w-4 h-4 text-teal" />
          <span className="text-sm text-gray-400">
            Resolved: <span className="text-teal font-medium">{market.outcomes[market.resolvedOutcome]}</span>
          </span>
        </div>
      )}
    </div>
  );
}
