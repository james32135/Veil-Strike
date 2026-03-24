import { useState, useEffect, useCallback } from 'react';
import { formatTimeAgo, formatUSD, formatAleo } from '@/utils/format';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import EmptyState from '@/components/shared/EmptyState';
import { ClockIcon } from '@/components/icons';
import CryptoIcon from '@/components/shared/CryptoIcon';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { useMarketStore } from '@/stores/marketStore';
import { useTransaction } from '@/hooks/useTransaction';
import type { ShareRecord } from '@/hooks/useTransaction';
import { buildSellSharesTx, buildRedeemSharesTx } from '@/utils/transactions';
import { estimateSellTokensOut, calculateFees } from '@/utils/fpmm';
import { API_BASE } from '@/constants';

// Asset matching terms for dynamic market detection
const ASSET_TERMS: Record<string, string[]> = {
  BTC: ['BTC', 'BITCOIN'],
  ETH: ['ETH', 'ETHEREUM'],
  ALEO: ['ALEO'],
};

interface LightningRound {
  id: string;
  asset: 'BTC' | 'ETH' | 'ALEO';
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number | null;
  status: 'open' | 'locked' | 'resolved';
  result: 'up' | 'down' | null;
}

interface LightningHistoryProps {
  markets: never[];
}

export default function LightningHistory({ }: LightningHistoryProps) {
  const [rounds, setRounds] = useState<LightningRound[]>([]);
  const bets = useLightningBetStore((s) => s.bets);
  const recentBets = bets.slice(0, 20);
  const { status: txStatus, execute, fetchShareRecords } = useTransaction();
  const allMarkets = useMarketStore((s) => s.markets);
  const [shareRecords, setShareRecords] = useState<ShareRecord[]>([]);

  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/lightning`);
      if (res.ok) {
        const data = await res.json();
        setRounds((data.rounds || []).filter((r: LightningRound) => r.status === 'resolved'));
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch share records for sell functionality
  const loadShareRecords = useCallback(async () => {
    const records = await fetchShareRecords();
    setShareRecords(records);
  }, [fetchShareRecords]);

  useEffect(() => {
    fetchRounds();
    loadShareRecords();
    const id = setInterval(fetchRounds, 15_000);
    const shareId = setInterval(loadShareRecords, 30_000);
    return () => { clearInterval(id); clearInterval(shareId); };
  }, [fetchRounds, loadShareRecords]);

  const handleSellShares = async (record: ShareRecord) => {
    const market = allMarkets.find((m) => m.id === record.marketId);
    const isResolved = market?.status === 'resolved' && market.resolvedOutcome === record.outcome - 1;

    let tx;
    const tokenTypeStr = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;
    if (isResolved) {
      tx = tokenTypeStr
        ? buildRedeemSharesTx(record.plaintext, tokenTypeStr as 'USDCX' | 'USAD')
        : buildRedeemSharesTx(record.plaintext);
    } else {
      const reserves = market?.reserves ?? [1_000_000, 1_000_000];
      const outcomeIdx = record.outcome - 1;
      const { tokensOut } = estimateSellTokensOut(reserves, outcomeIdx, record.quantity);
      if (tokensOut <= 0) return;
      tx = buildSellSharesTx(record.plaintext, `${tokensOut}u128`, `${record.quantity}u128`, tokenTypeStr as 'USDCX' | 'USAD' | undefined);
    }

    const txId = await execute(tx);
    if (txId) {
      setTimeout(loadShareRecords, 5000);
      setTimeout(loadShareRecords, 15000);
    }
  };

  // Helper: get asset name from market ID using the market store
  const getAssetFromMarketId = (marketId: string): string => {
    const market = allMarkets.find((m) => m.id === marketId);
    if (market) {
      const q = market.question.toUpperCase();
      for (const [asset, terms] of Object.entries(ASSET_TERMS)) {
        if (terms.some((t) => q.includes(t))) return asset;
      }
    }
    return marketId.slice(0, 8) + '...';
  };

  // Separate user's bets from market results
  const resolvedBets = recentBets.filter((b) => b.result);
  const pendingBets = recentBets.filter((b) => !b.result);

  // Only show share records for lightning markets that are resolved (winning shares to claim)
  const claimableRecords = shareRecords.filter((r) => {
    const market = allMarkets.find((m) => m.id === r.marketId);
    if (!market || !market.isLightning) return false;
    // Only show if market is resolved and this is the winning outcome
    return market.status === 'resolved' && market.resolvedOutcome === r.outcome - 1;
  });

  if (rounds.length === 0 && recentBets.length === 0 && claimableRecords.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<ClockIcon className="w-8 h-8 text-gray-600" />}
          title="No history yet"
          description="Resolved lightning rounds will appear here"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* On-chain Share Records — Only resolved winning shares */}
      {claimableRecords.length > 0 && (
        <Card className="p-0 overflow-hidden" glow>
          {/* Accent bar */}
          <div className="h-px bg-gradient-to-r from-transparent via-accent-green/30 to-transparent" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent-green/10 border border-accent-green/15 flex items-center justify-center">
                  <span className="text-sm">💰</span>
                </div>
                <h3 className="text-xs text-gray-400 uppercase tracking-widest font-heading font-semibold">
                  Claim Your Winnings
                </h3>
              </div>
              <button
                onClick={loadShareRecords}
                className="text-[10px] text-teal hover:text-teal/80 transition-colors px-2 py-1 rounded-lg border border-white/[0.04] hover:border-teal/15 bg-white/[0.01]"
              >
                Refresh
            </button>
          </div>
          <div className="space-y-1">
            {claimableRecords.map((record, idx) => {
              const tokenLabel = record.tokenType === 1 ? 'USDCx' : record.tokenType === 2 ? 'USAD' : 'ALEO';
              const outcomeLabel = record.outcome === 1 ? 'UP' : 'DOWN';
              const assetName = getAssetFromMarketId(record.marketId);
              const market = allMarkets.find((m) => m.id === record.marketId);
              const reserves = market?.reserves ?? [1_000_000, 1_000_000];
              const { tokensOut } = estimateSellTokensOut(reserves, record.outcome - 1, record.quantity);
              const isResolved = market?.status === 'resolved' && market.resolvedOutcome === record.outcome - 1;
              const displayValue = isResolved ? record.quantity : calculateFees(tokensOut).amountAfterFee;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 px-3 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:border-accent-green/10 hover:bg-accent-green/[0.02] transition-all duration-300"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={record.outcome === 1 ? 'text-accent-green text-xs font-medium' : 'text-accent-red text-xs font-medium'}>
                        {outcomeLabel}
                      </span>
                      <div className="flex items-center gap-1">
                        <CryptoIcon symbol={assetName} size={14} />
                        <span className="font-mono font-bold text-sm text-white">{assetName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
                        <span className="font-mono text-xs text-gray-400 tabular-nums">{formatAleo(record.quantity)} {tokenLabel}</span>
                      </div>
                      <span className="text-[10px] text-gray-600">→</span>
                      <span className="text-xs font-mono text-accent-green tabular-nums">~{formatAleo(displayValue)} {tokenLabel}</span>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSellShares(record)}
                    loading={txStatus === 'proving' || txStatus === 'broadcasting'}
                    className="!text-xs !bg-gradient-to-r !from-accent-green/20 !to-accent-green/10 !text-accent-green !border !border-accent-green/20 hover:!shadow-[0_0_16px_-4px_rgba(34,197,94,0.3)] !rounded-xl"
                  >
                    {txStatus === 'proving' ? 'Proving...' : txStatus === 'broadcasting' ? 'Broadcasting...' : '💰 Claim'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
        </Card>
      )}

      {/* User's Bet Results */}
      {recentBets.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <div className="p-5">
            <h3 className="text-xs text-gray-400 uppercase tracking-widest font-heading font-semibold mb-4">
              Your Bets
            </h3>
            <div className="space-y-1.5">
              {pendingBets.map((bet) => (
                <div
                  key={`${bet.roundId}-${bet.timestamp}`}
                  className="flex items-center justify-between py-3 px-3 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:border-amber-400/10 hover:bg-amber-400/[0.02] transition-all duration-300"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CryptoIcon symbol={bet.asset} size={14} />
                      <span className="font-mono font-bold text-sm text-white">{bet.asset}</span>
                      <span className={`text-xs font-medium ${bet.direction === 'up' ? 'text-accent-green' : 'text-accent-red'}`}>
                        {bet.direction.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-gray-600">•</span>
                      <span className="font-mono text-xs text-gray-400 tabular-nums">{formatAleo(bet.amount)} {bet.tokenType === 'usdcx' ? 'USDCx' : bet.tokenType === 'usad' ? 'USAD' : 'ALEO'}</span>
                    </div>
                    <p className="text-[10px] text-gray-600">{formatTimeAgo(bet.timestamp)} • Waiting for round to end...</p>
                  </div>
                  <Badge variant="warning" size="sm">PENDING</Badge>
                </div>
              ))}
              {resolvedBets.map((bet) => (
                <div
                  key={`${bet.roundId}-${bet.timestamp}`}
                  className={`flex items-center justify-between py-3 px-3 rounded-xl border transition-all duration-300 ${
                    bet.won
                      ? 'border-accent-green/10 bg-accent-green/[0.02] hover:border-accent-green/20'
                      : 'border-accent-red/10 bg-accent-red/[0.02] hover:border-accent-red/20'
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CryptoIcon symbol={bet.asset} size={14} />
                      <span className="font-mono font-bold text-sm text-white">{bet.asset}</span>
                      <span className={`text-xs font-medium ${bet.direction === 'up' ? 'text-accent-green' : 'text-accent-red'}`}>
                        {bet.direction.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-gray-600">→</span>
                      <span className={`text-xs font-medium ${bet.result === 'up' ? 'text-accent-green' : 'text-accent-red'}`}>
                        {bet.result?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-600">
                      <span>{formatTimeAgo(bet.timestamp)}</span>
                      <span className="font-mono tabular-nums">{formatAleo(bet.amount)} {bet.tokenType === 'usdcx' ? 'USDCx' : bet.tokenType === 'usad' ? 'USAD' : 'ALEO'}</span>
                      {bet.won && <span className="text-accent-green font-mono">+{formatAleo(bet.payout || 0)} shares</span>}
                      {!bet.won && <span className="text-accent-red font-mono">-{formatAleo(bet.amount)}</span>}
                    </div>
                  </div>
                  <Badge variant={bet.won ? 'success' : 'danger'} size="sm">
                    {bet.won ? '✓ WON' : '✗ LOST'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Market Results */}
      {rounds.length > 0 && (
        <Card className="p-4">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">
            Recent Results
          </h3>
      <div className="space-y-0">
        {rounds.map((round) => {
          const priceChange = round.endPrice && round.startPrice
            ? ((round.endPrice - round.startPrice) / round.startPrice) * 100
            : null;
          return (
            <div
              key={round.id}
              className="flex items-center justify-between py-3 border-b border-dark-400/10 last:border-0"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm text-gray-300">
                  <span className="font-mono font-bold">{round.asset}</span>
                  {' — '}
                  {round.asset === 'ALEO' ? `$${round.startPrice.toFixed(4)}` : formatUSD(round.startPrice)}
                  {' → '}
                  {round.endPrice ? (round.asset === 'ALEO' ? `$${round.endPrice.toFixed(4)}` : formatUSD(round.endPrice)) : '—'}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">{formatTimeAgo(round.endTime)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={round.result === 'up' ? 'success' : 'danger'}>
                  {round.result === 'up' ? '↑ UP' : '↓ DOWN'}
                </Badge>
                {priceChange !== null && (
                  <span className={`text-xs font-mono ${priceChange >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(3)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
      )}
    </div>
  );
}
