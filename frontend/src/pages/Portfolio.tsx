import { useEffect, useState, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { useTransaction } from '@/hooks/useTransaction';
import type { ShareRecord } from '@/hooks/useTransaction';
import { formatAleo, formatTimeAgo } from '@/utils/format';
import { estimateSellTokensOut, calculateFees } from '@/utils/fpmm';
import { buildSellSharesTx, buildRedeemSharesTx } from '@/utils/transactions';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import EmptyState from '@/components/shared/EmptyState';
import RefreshButton from '@/components/shared/RefreshButton';
import { ChartIcon, ClockIcon, ShieldIcon } from '@/components/icons';
import CryptoIcon from '@/components/shared/CryptoIcon';
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
    // Always refresh markets on mount to catch recent resolves (e.g. admin flash_settle)
    fetchMarkets();
  }, [fetchMarkets]);

  const loadShareRecords = useCallback(async () => {
    const records = await fetchShareRecords();
    setShareRecords(records);
  }, [fetchShareRecords]);

  useEffect(() => {
    loadShareRecords();
  }, [loadShareRecords]);

  const handleSell = async (record: ShareRecord) => {
    const market = markets.find((m) => m.id === record.marketId);
    const outcomeIdx = record.outcome - 1;
    const marketResolved = market?.status === 'resolved';
    const isWinner = marketResolved && market.resolvedOutcome === outcomeIdx;
    const isLoser = marketResolved && !isWinner;

    if (isLoser) return; // Can't sell losing shares

    let tx;
    const tokenTypeStr = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;

    if (isWinner) {
      // Market resolved on-chain — redeem at full value via harvest_winnings (1:1)
      tx = buildRedeemSharesTx(record.plaintext, tokenTypeStr as 'USDCX' | 'USAD' | undefined);
    } else {
      // Not yet resolved — sell through AMM (partial value, but user gets funds now)
      const reserves = market?.reserves ?? [1_000_000, 1_000_000];
      const outcomeIdx = record.outcome - 1;
      const { tokensOut } = estimateSellTokensOut(reserves, outcomeIdx, record.quantity);
      if (tokensOut <= 0) return;
      tx = buildSellSharesTx(record.plaintext, `${tokensOut}u128`, `${record.quantity}u128`, tokenTypeStr as 'USDCX' | 'USAD' | undefined);
    }

    const txId = await execute(tx, loadShareRecords);
    void txId;
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
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.5 }}>
          <Card className="p-5 group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-teal/10 border border-teal/15 flex items-center justify-center group-hover/stat:shadow-[0_0_12px_-4px_rgba(255,107,53,0.2)] transition-all duration-300">
                <ShieldIcon className="w-4 h-4 text-teal" />
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading">On-Chain Shares</p>
            </div>
            <p className="text-2xl font-mono font-bold text-white tabular-nums">{shareRecords.length}</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.5 }}>
          <Card className="p-5 group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center group-hover/stat:shadow-[0_0_12px_-4px_rgba(59,130,246,0.2)] transition-all duration-300">
                <ChartIcon className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading">Total Invested</p>
            </div>
            <p className="text-2xl font-mono font-bold text-white tabular-nums">{formatAleo(totalInvested)}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">All tokens</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.5 }}>
          <Card className="p-5 group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all duration-300 ${pnl >= 0 ? 'bg-accent-green/10 border-accent-green/15 group-hover/stat:shadow-[0_0_12px_-4px_rgba(34,197,94,0.2)]' : 'bg-accent-red/10 border-accent-red/15 group-hover/stat:shadow-[0_0_12px_-4px_rgba(239,68,68,0.2)]'}`}>
                <ChartIcon className={`w-4 h-4 ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`} />
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading">Lightning P&L</p>
            </div>
            <p className={`text-2xl font-mono font-bold tabular-nums ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {pnl >= 0 ? '+' : ''}{formatAleo(pnl)}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">All tokens</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.5 }}>
          <Card className="p-5 group/stat">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all duration-300 ${winRate >= 50 ? 'bg-accent-green/10 border-accent-green/15 group-hover/stat:shadow-[0_0_12px_-4px_rgba(34,197,94,0.2)]' : 'bg-teal/10 border-teal/15 group-hover/stat:shadow-[0_0_12px_-4px_rgba(255,107,53,0.2)]'}`}>
                <span className={`text-sm font-bold ${winRate >= 50 ? 'text-accent-green' : 'text-teal'}`}>%</span>
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading">Win Rate</p>
            </div>
            <p className={`text-2xl font-mono font-bold tabular-nums ${winRate >= 50 ? 'text-accent-green' : 'text-teal'}`}>
              {winRate.toFixed(0)}%
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">{wonBets.length}W / {lostBets.length}L</p>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-heading font-medium rounded-lg transition-all duration-300 ${activeTab === tab.id
                ? 'bg-gradient-to-r from-teal/15 to-teal/10 text-teal border border-teal/15 shadow-[0_0_12px_-4px_rgba(255,107,53,0.15)]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] border border-transparent'
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
                <RefreshButton onRefresh={loadShareRecords} label="Refresh Records" />
              </div>
              {shareRecords.map((record, idx) => {
                const market = markets.find((m) => m.id === record.marketId);
                const reserves = market?.reserves ?? [1_000_000, 1_000_000];
                const outcomeIdx = record.outcome - 1;
                const marketResolved = market?.status === 'resolved';
                const isWinner = marketResolved && market.resolvedOutcome === outcomeIdx;
                const isLoser = marketResolved && market.resolvedOutcome !== outcomeIdx;
                const { tokensOut } = estimateSellTokensOut(reserves, outcomeIdx, record.quantity);
                const displayValue = isWinner ? record.quantity : isLoser ? 0 : calculateFees(tokensOut).amountAfterFee;
                const tokenLabel = record.tokenType === 1 ? 'USDCx' : record.tokenType === 2 ? 'USAD' : 'ALEO';
                const outcomeLabel = record.outcome === 1 ? 'UP / YES' : 'DOWN / NO';

                // Detect lightning winning position — user won even if on-chain market not yet resolved
                const isLightningWin = !marketResolved && market?.isLightning && lightningBets.some(
                  (b) => b.won && b.marketId === record.marketId && b.direction === (record.outcome === 1 ? 'up' : 'down')
                );
                const isLightningLoss = !marketResolved && market?.isLightning && lightningBets.some(
                  (b) => b.won === false && b.marketId === record.marketId && b.direction === (record.outcome === 1 ? 'up' : 'down')
                );
                const isClaimable = isWinner;

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.4 }}
                  >
                    <Card className={`p-4 group/share ${isLoser || isLightningLoss ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge variant={record.outcome === 1 ? 'green' : 'red'}>{outcomeLabel}</Badge>
                            <Badge variant="teal"><CryptoIcon symbol={tokenLabel} size={12} className="mr-1" />{tokenLabel}</Badge>
                            {isWinner && <Badge variant="success" size="sm">💰 Claimable</Badge>}
                            {isLoser && <Badge variant="danger" size="sm">✗ Lost</Badge>}
                            {isLightningWin && <Badge variant="success" size="sm">⚡ Won</Badge>}
                            {isLightningLoss && <Badge variant="danger" size="sm">⚡ Lost</Badge>}
                          </div>
                          <p className="text-sm font-mono text-gray-300 truncate group-hover/share:text-white transition-colors duration-300">
                            {market?.question || `Market ${record.marketId.slice(0, 12)}...`}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="px-2.5 py-1 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                              <span className="text-[10px] text-gray-500">Qty </span>
                              <span className="text-xs font-mono text-gray-300 tabular-nums">{formatAleo(record.quantity)}</span>
                            </div>
                            {isLoser ? (
                              <div className="px-2.5 py-1 rounded-lg bg-accent-red/[0.06] border border-accent-red/[0.12]">
                                <span className="text-xs font-mono tabular-nums text-accent-red">Worthless</span>
                              </div>
                            ) : (
                              <div className={`px-2.5 py-1 rounded-lg ${isClaimable ? 'bg-accent-green/[0.06] border border-accent-green/[0.12]' : 'bg-teal/[0.04] border border-teal/[0.08]'}`}>
                                <span className="text-[10px] text-gray-500">{isClaimable ? 'Claim' : 'Sell'} </span>
                                <span className={`text-xs font-mono tabular-nums ${isClaimable ? 'text-accent-green' : 'text-teal'}`}>~{formatAleo(displayValue)} {tokenLabel}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isLoser && !isLightningLoss && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSell(record)}
                            loading={txStatus === 'proving' || txStatus === 'broadcasting'}
                            className={`!text-xs !rounded-xl ${isClaimable ? '!bg-gradient-to-r !from-accent-green/20 !to-accent-green/10 !text-accent-green !border !border-accent-green/20 hover:!shadow-[0_0_16px_-4px_rgba(34,197,94,0.3)]' : ''}`}
                          >
                            {txStatus === 'proving' ? 'Proving...' : txStatus === 'broadcasting' ? 'Broadcasting...' : isClaimable ? '💰 Claim' : '🔄 Sell'}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
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
                <motion.div
                  key={`${bet.roundId}-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                >
                  <Card className="p-4 group/bet">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.06] flex items-center justify-center">
                            <CryptoIcon symbol={bet.asset} size={16} />
                          </div>
                          <span className="text-sm font-heading font-semibold text-white">{bet.asset}</span>
                          <Badge variant={bet.direction === 'up' ? 'green' : 'red'} size="sm">
                            {bet.direction === 'up' ? '↑ UP' : '↓ DOWN'}
                          </Badge>
                          {bet.result && (
                            <Badge variant={bet.won ? 'green' : 'red'} size="sm">
                              {bet.won ? '✓ WON' : '✗ LOST'}
                            </Badge>
                          )}
                          {!bet.result && <Badge variant="gray" size="sm">PENDING</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <div className="px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
                            <span className="font-mono text-gray-400 tabular-nums">{formatAleo(bet.amount)} {bet.tokenType === 'usdcx' ? 'USDCx' : bet.tokenType === 'usad' ? 'USAD' : 'ALEO'}</span>
                          </div>
                          {bet.won && <span className="font-mono text-accent-green">+{formatAleo(bet.payout || 0)}</span>}
                          {bet.won === false && <span className="font-mono text-accent-red">-{formatAleo(bet.amount)}</span>}
                          <span className="text-gray-600">{formatTimeAgo(bet.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
