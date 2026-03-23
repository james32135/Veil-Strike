import { useState, useEffect, useCallback } from 'react';
import { formatTimeAgo, formatUSD, formatAleo } from '@/utils/format';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import EmptyState from '@/components/shared/EmptyState';
import { ClockIcon } from '@/components/icons';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { useMarketStore } from '@/stores/marketStore';
import { useTransaction } from '@/hooks/useTransaction';
import type { ShareRecord } from '@/hooks/useTransaction';
import { buildSellSharesTx, buildSellSharesUsdcxTx, buildRedeemSharesTx, buildRedeemSharesUsdcxTx } from '@/utils/transactions';
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
    if (isResolved) {
      tx = record.tokenType === 1
        ? buildRedeemSharesUsdcxTx(record.plaintext)
        : buildRedeemSharesTx(record.plaintext);
    } else {
      const reserves = market?.reserves ?? [1_000_000, 1_000_000];
      const outcomeIdx = record.outcome - 1;
      const { tokensOut } = estimateSellTokensOut(reserves, outcomeIdx, record.quantity);
      if (tokensOut <= 0) return;
      const buildFn = record.tokenType === 1 ? buildSellSharesUsdcxTx : buildSellSharesTx;
      tx = buildFn(record.plaintext, `${tokensOut}u128`, `${record.quantity}u128`);
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

  if (rounds.length === 0 && recentBets.length === 0 && shareRecords.length === 0) {
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
      {/* On-chain Share Records — Sell to claim profit */}
      {shareRecords.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading">
              💰 Claim Your Winnings
            </h3>
            <button
              onClick={loadShareRecords}
              className="text-[10px] text-teal hover:text-teal/80 transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-0">
            {shareRecords.map((record, idx) => {
              const tokenLabel = record.tokenType === 1 ? 'USDCx' : 'ALEO';
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
                  className="flex items-center justify-between py-3 border-b border-dark-400/10 last:border-0"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm text-gray-300">
                      <span className={record.outcome === 1 ? 'text-accent-green' : 'text-accent-red'}>
                        {outcomeLabel}
                      </span>
                      {' '}
                      <span className="font-mono font-bold">{assetName}</span>
                      {' • '}
                      <span className="font-mono">{formatAleo(record.quantity)} {tokenLabel}</span>
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {isResolved ? 'Redeem' : 'Claim'} value: ~{formatAleo(displayValue)} {tokenLabel}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSellShares(record)}
                    loading={txStatus === 'proving'}
                    className="!text-xs !bg-accent-green !text-black !border-accent-green hover:!bg-accent-green/80"
                  >
                    💰 Claim
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* User's Bet Results */}
      {recentBets.length > 0 && (
        <Card className="p-4">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">
            Your Bets
          </h3>
          <div className="space-y-0">
            {pendingBets.map((bet) => (
              <div
                key={`${bet.roundId}-${bet.timestamp}`}
                className="flex items-center justify-between py-3 border-b border-dark-400/10 last:border-0"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm text-gray-300">
                    <span className="font-mono font-bold">{bet.asset}</span>
                    {' — Bet '}
                    <span className={bet.direction === 'up' ? 'text-accent-green' : 'text-accent-red'}>
                      {bet.direction.toUpperCase()}
                    </span>
                    {' • '}{formatAleo(bet.amount)} ALEO
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{formatTimeAgo(bet.timestamp)} • Waiting for round to end...</p>
                </div>
                <Badge variant="warning">PENDING</Badge>
              </div>
            ))}
            {resolvedBets.map((bet) => (
              <div
                key={`${bet.roundId}-${bet.timestamp}`}
                className="flex items-center justify-between py-3 border-b border-dark-400/10 last:border-0"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm text-gray-300">
                    <span className="font-mono font-bold">{bet.asset}</span>
                    {' — Bet '}
                    <span className={bet.direction === 'up' ? 'text-accent-green' : 'text-accent-red'}>
                      {bet.direction.toUpperCase()}
                    </span>
                    {' → Result: '}
                    <span className={bet.result === 'up' ? 'text-accent-green' : 'text-accent-red'}>
                      {bet.result?.toUpperCase()}
                    </span>
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-gray-600 mt-0.5">
                    <span>{formatTimeAgo(bet.timestamp)}</span>
                    <span>Bet: {formatAleo(bet.amount)} ALEO</span>
                    {bet.won && <span className="text-accent-green">Won: {formatAleo(bet.payout || 0)} shares → sell on Portfolio to claim</span>}
                    {!bet.won && <span className="text-accent-red">Lost: {formatAleo(bet.amount)} ALEO</span>}
                  </div>
                </div>
                <Badge variant={bet.won ? 'success' : 'danger'}>
                  {bet.won ? '✓ WON' : '✗ LOST'}
                </Badge>
              </div>
            ))}
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
