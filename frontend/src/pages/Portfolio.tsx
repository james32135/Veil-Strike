import { useEffect, useState, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { useTransaction } from '@/hooks/useTransaction';
import type { ShareRecord } from '@/hooks/useTransaction';
import { formatAleo, formatTimeAgo } from '@/utils/format';
import { estimateSellTokensOut } from '@/utils/fpmm';
import { buildSellSharesTx, buildSellSharesUsdcxTx } from '@/utils/transactions';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import EmptyState from '@/components/shared/EmptyState';
import { ChartIcon, ClockIcon, ShieldIcon } from '@/components/icons';
import { motion } from 'framer-motion';
import { API_BASE } from '@/constants';

export default function Portfolio() {
  const { markets, fetchMarkets } = useMarketStore();
  const trades = useTradeStore((s) => s.trades);
  const lightningBets = useLightningBetStore((s) => s.bets);
  const { status: txStatus, execute, fetchShareRecords } = useTransaction();
  const [shareRecords, setShareRecords] = useState<ShareRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'shares' | 'trades' | 'lightning'>('shares');

  useEffect(() => {
    if (markets.length === 0) fetchMarkets();
  }, [markets.length, fetchMarkets]);

  const loadShareRecords = useCallback(async () => {
    const records = await fetchShareRecords();
    setShareRecords(records);
  }, [fetchShareRecords]);

  useEffect(() => {
    loadShareRecords();
  }, [loadShareRecords]);

  const handleSell = async (record: ShareRecord) => {
    const market = markets.find((m) => m.id === record.marketId);
    const reserves = market?.reserves ?? [1_000_000, 1_000_000];
    const outcomeIdx = record.outcome - 1;
    const { tokensOut } = estimateSellTokensOut(reserves, outcomeIdx, record.quantity);
    if (tokensOut <= 0) return;
    const buildFn = record.tokenType === 1 ? buildSellSharesUsdcxTx : buildSellSharesTx;
    const tx = buildFn(record.plaintext, `${tokensOut}u128`, `${record.quantity}u128`);
    const txId = await execute(tx);
    if (txId) setTimeout(loadShareRecords, 5000);
  };

  // Computed stats
  const totalInvested = trades.reduce((s, t) => t.type === 'buy' ? s + t.amount : s, 0);
  const wonBets = lightningBets.filter((b) => b.won);
  const lostBets = lightningBets.filter((b) => b.won === false);
  const totalWon = wonBets.reduce((s, b) => s + (b.payout || 0), 0);
  const totalLost = lostBets.reduce((s, b) => s + b.amount, 0);
  const pnl = totalWon - totalLost;
  const winRate = lightningBets.filter(b => b.result).length > 0
    ? (wonBets.length / lightningBets.filter(b => b.result).length) * 100
    : 0;

  const tabs = [
    { id: 'shares', label: `On-Chain Shares (${shareRecords.length})` },
    { id: 'trades', label: `Trade History (${trades.length})` },
    { id: 'lightning', label: `Lightning Bets (${lightningBets.length})` },
  ] as const;

  return (
    <div>
      <PageHeader
        title="Portfolio"
        subtitle="Your positions, trades, and on-chain share records"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1">On-Chain Shares</p>
            <p className="text-2xl font-mono font-bold text-white">{shareRecords.length}</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1">Total Invested</p>
            <p className="text-2xl font-mono font-bold text-white">{formatAleo(totalInvested)}</p>
            <p className="text-[10px] text-gray-600">ALEO</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1">Lightning P&L</p>
            <p className={`text-2xl font-mono font-bold ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {pnl >= 0 ? '+' : ''}{formatAleo(pnl)}
            </p>
            <p className="text-[10px] text-gray-600">ALEO</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1">Win Rate</p>
            <p className={`text-2xl font-mono font-bold ${winRate >= 50 ? 'text-accent-green' : 'text-teal'}`}>
              {winRate.toFixed(0)}%
            </p>
            <p className="text-[10px] text-gray-600">{wonBets.length}W / {lostBets.length}L</p>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-dark-200/50 rounded-xl mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-heading font-medium rounded-lg transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-dark-300 text-teal shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* On-Chain Shares Tab */}
      {activeTab === 'shares' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {shareRecords.length === 0 ? (
            <EmptyState
              icon={<ShieldIcon className="w-10 h-10 text-gray-600" />}
              title="No on-chain shares"
              description="Buy shares on Markets or Lightning to see them here"
              actionLabel="Browse Markets"
              actionHref="/markets"
            />
          ) : (
            <div className="space-y-2">
              <div className="flex justify-end mb-2">
                <button onClick={loadShareRecords} className="text-xs text-teal hover:text-teal/80 transition-colors">
                  Refresh Records
                </button>
              </div>
              {shareRecords.map((record, idx) => {
                const market = markets.find((m) => m.id === record.marketId);
                const reserves = market?.reserves ?? [1_000_000, 1_000_000];
                const outcomeIdx = record.outcome - 1;
                const { tokensOut } = estimateSellTokensOut(reserves, outcomeIdx, record.quantity);
                const tokenLabel = record.tokenType === 1 ? 'USDCx' : 'ALEO';
                const outcomeLabel = record.outcome === 1 ? 'UP / YES' : 'DOWN / NO';

                return (
                  <Card key={idx} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={record.outcome === 1 ? 'green' : 'red'}>{outcomeLabel}</Badge>
                          <Badge variant="teal">{tokenLabel}</Badge>
                        </div>
                        <p className="text-sm font-mono text-gray-300 truncate">
                          {market?.question || `Market ${record.marketId.slice(0, 12)}...`}
                        </p>
                        <div className="flex items-center gap-4 mt-1.5">
                          <span className="text-xs text-gray-500">
                            Qty: <span className="font-mono text-gray-400">{formatAleo(record.quantity)}</span>
                          </span>
                          <span className="text-xs text-gray-500">
                            Sell value: <span className="font-mono text-teal">~{formatAleo(tokensOut)} {tokenLabel}</span>
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSell(record)}
                        loading={txStatus === 'proving'}
                        className="!text-xs"
                      >
                        Sell
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Trade History Tab */}
      {activeTab === 'trades' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {trades.length === 0 ? (
            <EmptyState
              icon={<ClockIcon className="w-8 h-8 text-gray-600" />}
              title="No trades yet"
              description="Your trade history will appear here after your first trade"
            />
          ) : (
            <Card className="p-4 overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-dark-400/30">
                    <th className="text-left text-gray-600 uppercase py-2 font-heading">Market</th>
                    <th className="text-left text-gray-600 uppercase py-2 font-heading">Type</th>
                    <th className="text-left text-gray-600 uppercase py-2 font-heading">Outcome</th>
                    <th className="text-right text-gray-600 uppercase py-2 font-heading">Amount</th>
                    <th className="text-right text-gray-600 uppercase py-2 font-heading">Shares</th>
                    <th className="text-right text-gray-600 uppercase py-2 font-heading">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 50).map((trade, i) => {
                    const m = markets.find((mk) => mk.id === trade.marketId);
                    return (
                      <tr key={i} className="border-b border-dark-400/10 last:border-0 hover:bg-dark-200/30">
                        <td className="py-2.5">
                          <span className="text-gray-300 truncate block max-w-[200px]">
                            {m?.question || trade.marketId.slice(0, 16) + '...'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className={`font-medium ${trade.type === 'buy' ? 'text-accent-green' : 'text-accent-red'}`}>
                            {trade.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-400">{trade.outcome}</td>
                        <td className="py-2.5 text-right font-mono text-gray-300">{formatAleo(trade.amount)}</td>
                        <td className="py-2.5 text-right font-mono text-gray-300">{formatAleo(trade.shares)}</td>
                        <td className="py-2.5 text-right text-gray-600">{formatTimeAgo(trade.timestamp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </motion.div>
      )}

      {/* Lightning Bets Tab */}
      {activeTab === 'lightning' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {lightningBets.length === 0 ? (
            <EmptyState
              icon={<ChartIcon className="w-8 h-8 text-gray-600" />}
              title="No lightning bets"
              description="Place bets on Lightning rounds to see your history"
              actionLabel="Go to Lightning"
              actionHref="/lightning"
            />
          ) : (
            <div className="space-y-2">
              {lightningBets.slice(0, 50).map((bet, i) => (
                <Card key={`${bet.roundId}-${i}`} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-heading font-semibold text-white">{bet.asset}</span>
                        <Badge variant={bet.direction === 'up' ? 'green' : 'red'}>
                          {bet.direction === 'up' ? '↑ UP' : '↓ DOWN'}
                        </Badge>
                        {bet.result && (
                          <Badge variant={bet.won ? 'green' : 'red'}>
                            {bet.won ? '✓ WON' : '✗ LOST'}
                          </Badge>
                        )}
                        {!bet.result && <Badge variant="gray">PENDING</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Bet: <span className="font-mono text-gray-400">{formatAleo(bet.amount)} ALEO</span></span>
                        {bet.won && <span>Won: <span className="font-mono text-accent-green">{formatAleo(bet.payout || 0)} ALEO</span></span>}
                        {bet.won === false && <span>Lost: <span className="font-mono text-accent-red">{formatAleo(bet.amount)} ALEO</span></span>}
                        <span>{formatTimeAgo(bet.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
