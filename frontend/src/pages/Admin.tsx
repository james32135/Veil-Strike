import { useEffect, useState, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE, DEPLOYER } from '@/constants';
import type { TokenType } from '@/constants';
import { useWalletStore } from '@/stores/walletStore';
import { useTransaction } from '@/hooks/useTransaction';
import { buildFlashSettleTx, buildEmergencyPauseTx, buildEmergencyUnpauseTx, buildRegisterResolverTx, buildWithdrawResolverStakeTx } from '@/utils/transactions';
import { useMarketStore } from '@/stores/marketStore';

interface AdminMarket {
  id: string;
  question: string;
  status: string;
  tokenType?: string;
  isLightning: boolean;
  totalVolume: number;
  reserves: number[];
}

interface ConfirmState {
  marketId: string;
  question: string;
  tokenType: string;
  winningOutcome: number;
  label: string;
}

interface LightningOracleData {
  result: 'up' | 'down' | null;
  startPrice: number;
  endPrice: number | null;
  asset: string;
}

interface BotSlot {
  id: string;
  asset: string;
  tokenType: string;
  state: string;
  marketId: string | null;
  startPrice: number;
  startTime: number;
  endTime: number;
  roundNumber: number;
  totalVolume: number;
  error: string | null;
  timeRemainingMs: number;
}

interface BotStatus {
  running: boolean;
  slots: BotSlot[];
  stats: {
    totalRoundsCreated: number;
    totalRoundsSettled: number;
    totalRoundsSkipped: number;
    uptime: number;
  };
}

export default function Admin() {
  const { connected, address } = useWalletStore();
  const { status: txStatus, execute } = useTransaction();
  const { markets, fetchMarkets } = useMarketStore();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [lightningResults, setLightningResults] = useState<Map<string, LightningOracleData>>(new Map());
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [resolverStake, setResolverStake] = useState('10');
  const [withdrawStake, setWithdrawStake] = useState('10');

  const fetchLightningResults = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/lightning`);
      const data = await res.json() as {
        rounds?: Array<{
          result: 'up' | 'down' | null;
          startPrice: number;
          endPrice: number | null;
          asset: string;
          markets?: Record<string, { marketId?: string }>;
        }>;
      };
      const map = new Map<string, LightningOracleData>();
      for (const round of data.rounds ?? []) {
        for (const assignment of Object.values(round.markets ?? {})) {
          if (assignment?.marketId) {
            map.set(assignment.marketId, {
              result: round.result,
              startPrice: round.startPrice,
              endPrice: round.endPrice,
              asset: round.asset,
            });
          }
        }
      }
      setLightningResults(map);
    } catch {
      // backend may be offline
    }
  }, []);

  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/lightning/bot/status`);
      if (res.ok) setBotStatus(await res.json());
    } catch { /* backend may be offline */ }
  }, []);

  useEffect(() => {
    if (markets.length === 0) {
      setLoading(true);
      fetchMarkets().finally(() => setLoading(false));
    }
    void fetchLightningResults();
    void fetchBotStatus();
    const botInterval = setInterval(fetchBotStatus, 10_000);
    return () => clearInterval(botInterval);
  }, [markets.length, fetchMarkets, fetchLightningResults, fetchBotStatus]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMarkets(), fetchLightningResults(), fetchBotStatus()]);
    setLoading(false);
  }, [fetchMarkets, fetchLightningResults, fetchBotStatus]);

  const isDeployer = connected && address === DEPLOYER;

  // Show all active markets (lightning and non-lightning)
  // Filter out locally-resolved markets so they move to the resolved section immediately
  const activeMarkets: AdminMarket[] = markets
    .filter((m) => (m.status === 'active' || m.status === 'closed') && !resolvedIds.has(m.id))
    .map((m) => ({
      id: m.id,
      question: m.question,
      status: m.status,
      tokenType: m.tokenType,
      isLightning: m.isLightning,
      totalVolume: m.totalVolume,
      reserves: m.reserves,
    }));

  const resolvedMarkets = markets.filter((m) => m.status === 'resolved' || resolvedIds.has(m.id));

  const handleEmergencyPause = async () => {
    const tx = buildEmergencyPauseTx();
    await execute(tx, handleRefresh);
  };

  const handleEmergencyUnpause = async () => {
    const tx = buildEmergencyUnpauseTx();
    await execute(tx, handleRefresh);
  };

  const handleRegisterResolver = async () => {
    const microcredits = String(Math.floor(parseFloat(resolverStake) * 1_000_000));
    const tx = buildRegisterResolverTx('', microcredits);
    await execute(tx);
  };

  const handleWithdrawResolverStake = async () => {
    const microcredits = String(Math.floor(parseFloat(withdrawStake) * 1_000_000));
    const tx = buildWithdrawResolverStakeTx(microcredits);
    await execute(tx);
  };

  const handleResolve = async (marketId: string, winningOutcome: number, tokenType: string) => {
    setConfirm(null);
    const isLightning = markets.find((m) => m.id === marketId)?.isLightning;
    const tx = buildFlashSettleTx(marketId, winningOutcome, (tokenType || 'ALEO') as TokenType);
    const txId = await execute(tx, () => {
      setResolvedIds((prev) => new Set(prev).add(marketId));
      // If lightning market, trigger backend to create a replacement market
      if (isLightning) {
        fetch(`${API_BASE}/lightning/admin/create-replacement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketId, tokenType: tokenType || 'ALEO' }),
        }).catch(() => {});
      }
      // Refresh markets after a delay to pick up new status
      setTimeout(handleRefresh, 10_000);
    });
    void txId;
  };

  // Not connected or not deployer — show gate
  if (!connected) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <PageHeader title="Admin" subtitle="Connect your wallet to continue" />
        <Card className="p-8 text-center">
          <p className="text-smoke/60 text-lg">Please connect your wallet.</p>
        </Card>
      </div>
    );
  }

  if (!isDeployer) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <PageHeader title="Admin" subtitle="Access restricted" />
        <Card className="p-8 text-center space-y-3">
          <p className="text-accent-red text-lg font-heading font-bold">Access Denied</p>
          <p className="text-smoke/60 text-sm">This page is only available to the protocol deployer.</p>
          <p className="text-smoke/30 text-xs font-mono break-all">Your address: {address}</p>
        </Card>
      </div>
    );
  }

  const isBusy = txStatus === 'preparing' || txStatus === 'proving' || txStatus === 'broadcasting';

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <PageHeader
        title="Admin — Resolve Markets"
        subtitle="Resolve markets on-chain via your wallet so winners can claim 1:1"
      />

      <div className="flex items-center gap-3 mb-6">
        <Button variant="secondary" size="sm" onClick={handleRefresh} loading={loading}>
          Refresh
        </Button>
        <span className="text-smoke/50 text-sm">
          {activeMarkets.length} active markets
        </span>
        {isBusy && (
          <Badge variant="warning" pulse>
            Wallet transaction in progress...
          </Badge>
        )}
      </div>

      {/* Round Bot Status */}
      {botStatus && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-heading font-bold text-white">Round Bot</h3>
              <Badge variant={botStatus.running ? 'green' : 'red'} pulse={botStatus.running}>
                {botStatus.running ? 'Running' : 'Stopped'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-smoke/50 text-xs">
              <span>Created: {botStatus.stats.totalRoundsCreated}</span>
              <span>·</span>
              <span>Settled: {botStatus.stats.totalRoundsSettled}</span>
              <span>·</span>
              <span>Skipped: {botStatus.stats.totalRoundsSkipped}</span>
            </div>
          </div>
          {botStatus.slots.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {botStatus.slots.map((slot) => (
                <div key={slot.id} className="bg-dark-200/50 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-heading font-bold text-white text-sm">{slot.id}</span>
                    <Badge variant={
                      slot.state === 'open' ? 'green' :
                      slot.state === 'creating' ? 'warning' :
                      slot.state === 'settling' ? 'info' :
                      'gray'
                    }>
                      {slot.state}
                    </Badge>
                  </div>
                  <div className="text-xs text-smoke/50 space-y-1">
                    <div>Round #{slot.roundNumber}</div>
                    {slot.startPrice > 0 && <div>Start: ${slot.startPrice.toLocaleString()}</div>}
                    {slot.state === 'open' && slot.timeRemainingMs > 0 && (
                      <div className="text-teal font-mono">
                        {Math.floor(slot.timeRemainingMs / 60000)}m {Math.floor((slot.timeRemainingMs % 60000) / 1000)}s left
                      </div>
                    )}
                    {slot.error && <div className="text-accent-red">{slot.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Active markets */}
      {activeMarkets.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <p className="text-smoke/60">No active markets to resolve.</p>
        </Card>
      )}

      <div className="space-y-4">
        {activeMarkets.map((market, i) => {
          const justResolved = resolvedIds.has(market.id);
          const tokenType = market.tokenType || 'ALEO';
          const oracleData = market.isLightning ? lightningResults.get(market.id) : undefined;

          return (
            <motion.div
              key={market.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className={`p-5 ${justResolved ? 'ring-1 ring-accent-green/30' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-bold text-white text-lg truncate">
                        {market.question}
                      </span>
                      <Badge variant={tokenType === 'ALEO' ? 'teal' : tokenType === 'USDCX' ? 'info' : 'warning'}>
                        {tokenType}
                      </Badge>
                      {market.isLightning && <Badge variant="warning">Lightning</Badge>}
                      <Badge variant={market.status === 'active' ? 'green' : 'gray'}>
                        {market.status}
                      </Badge>
                      {justResolved && <Badge variant="success">Resolved!</Badge>}
                    </div>
                    <p className="text-smoke/40 text-xs font-mono break-all">
                      {market.id}
                    </p>
                    {market.totalVolume > 0 && (
                      <p className="text-smoke/50 text-xs">
                        Volume: {(market.totalVolume / 1_000_000).toFixed(2)} {tokenType}
                      </p>
                    )}

                    {/* Oracle result indicator for lightning markets */}
                    {market.isLightning && oracleData && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-smoke/40 text-xs">
                          ${oracleData.startPrice.toLocaleString()} →{' '}
                          {oracleData.endPrice !== null
                            ? `$${oracleData.endPrice.toLocaleString()}`
                            : 'pending...'}
                        </span>
                        {oracleData.result === 'up' && (
                          <Badge variant="green">↑ Oracle: UP WINS</Badge>
                        )}
                        {oracleData.result === 'down' && (
                          <Badge variant="red">↓ Oracle: DOWN WINS</Badge>
                        )}
                        {oracleData.result === null && (
                          <Badge variant="warning">Awaiting oracle result</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Resolve buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {justResolved ? (
                      <span className="text-accent-green text-sm font-heading">Resolved</span>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isBusy}
                          className={
                            oracleData?.result === 'up'
                              ? 'ring-2 ring-accent-green ring-offset-1 ring-offset-dark-100'
                              : oracleData?.result === 'down'
                              ? 'opacity-50'
                              : ''
                          }
                          onClick={() => setConfirm({ marketId: market.id, question: market.question, tokenType, winningOutcome: 1, label: 'UP / YES' })}
                        >
                          Resolve UP ↑{oracleData?.result === 'up' ? ' ✓' : ''}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isBusy}
                          className={
                            oracleData?.result === 'down'
                              ? 'ring-2 ring-accent-red ring-offset-1 ring-offset-dark-100'
                              : oracleData?.result === 'up'
                              ? 'opacity-50'
                              : ''
                          }
                          onClick={() => setConfirm({ marketId: market.id, question: market.question, tokenType, winningOutcome: 2, label: 'DOWN / NO' })}
                        >
                          Resolve DOWN ↓{oracleData?.result === 'down' ? ' ✓' : ''}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Already resolved */}
      {resolvedMarkets.length > 0 && (
        <div className="mt-10">
          <h2 className="font-heading text-lg text-smoke/50 mb-4">
            Already Resolved ({resolvedMarkets.length})
          </h2>
          <div className="space-y-3">
            {resolvedMarkets.map((market) => (
              <Card key={market.id} className="p-4 opacity-60">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading font-bold text-white truncate">
                    {market.question}
                  </span>
                  <Badge variant={market.tokenType === 'ALEO' ? 'teal' : market.tokenType === 'USDCX' ? 'info' : 'warning'}>
                    {market.tokenType || 'ALEO'}
                  </Badge>
                  <Badge variant="success">Resolved</Badge>
                  {market.resolvedOutcome !== undefined && (
                    <Badge variant="gray">
                      Outcome {market.resolvedOutcome === 0 ? 'UP/YES' : 'DOWN/NO'}
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Controls & Resolver Registry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <Card className="p-5">
          <h3 className="font-heading font-bold text-white mb-3">Emergency Controls</h3>
          <p className="text-smoke/50 text-xs mb-4">Pause or unpause all protocol operations. Deployer only.</p>
          <div className="flex items-center gap-3">
            <Button variant="danger" size="sm" disabled={isBusy} onClick={handleEmergencyPause}>
              Pause Protocol
            </Button>
            <Button variant="primary" size="sm" disabled={isBusy} onClick={handleEmergencyUnpause}>
              Unpause Protocol
            </Button>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-heading font-bold text-white mb-3">Resolver Registry</h3>
          <p className="text-smoke/50 text-xs mb-4">Register as a resolver by staking ALEO, or withdraw your stake.</p>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={resolverStake}
                onChange={(e) => setResolverStake(e.target.value)}
                className="bg-dark-200 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-24"
                placeholder="ALEO"
              />
              <Button variant="primary" size="sm" disabled={isBusy} onClick={handleRegisterResolver}>
                Register Resolver
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={withdrawStake}
                onChange={(e) => setWithdrawStake(e.target.value)}
                className="bg-dark-200 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-24"
                placeholder="ALEO"
              />
              <Button variant="secondary" size="sm" disabled={isBusy} onClick={handleWithdrawResolverStake}>
                Withdraw Stake
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="mt-10 p-6">
        <h3 className="font-heading font-bold text-white mb-3">How it works</h3>
        <ul className="space-y-2 text-smoke/70 text-sm">
          <li>
            <span className="text-teal font-medium">Auto:</span> The <strong className="text-white">Round Bot</strong> automatically creates, monitors, and resolves Strike Rounds using delegated proving (~30s per tx). Empty rounds are skipped at zero cost.
          </li>
          <li>
            <span className="text-teal font-medium">Manual:</span> Click <strong className="text-white">Resolve UP</strong> or <strong className="text-white">Resolve DOWN</strong> to resolve any active market manually via your wallet's <code className="text-orange/80">flash_settle</code>.
          </li>
          <li>
            <span className="text-teal font-medium">3.</span> After resolving, winners can claim shares at <strong className="text-accent-green">1:1 value</strong> in Portfolio.
          </li>
          <li>
            <span className="text-orange font-medium">⚠️</span> Resolving is <strong className="text-white">permanent</strong>. Only the resolver (deployer) can call <code className="text-orange/80">flash_settle</code>.
          </li>
        </ul>
      </Card>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-dark-100 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-heading font-bold text-white text-lg mb-2">
                Confirm Resolution
              </h3>
              <p className="text-smoke/70 text-sm mb-2">
                Resolve <strong className="text-white">{confirm.question}</strong> ({confirm.tokenType}) as{' '}
                <strong className={confirm.winningOutcome === 1 ? 'text-accent-green' : 'text-accent-red'}>
                  {confirm.label}
                </strong>
              </p>
              {/* Oracle guidance in modal */}
              {(() => {
                const od = lightningResults.get(confirm.marketId);
                if (!od) return null;
                const matchesOracle =
                  (confirm.winningOutcome === 1 && od.result === 'up') ||
                  (confirm.winningOutcome === 2 && od.result === 'down');
                const contradictsOracle =
                  (confirm.winningOutcome === 1 && od.result === 'down') ||
                  (confirm.winningOutcome === 2 && od.result === 'up');
                return (
                  <div className={`rounded-lg px-3 py-2 mb-3 text-xs flex items-center gap-2 ${
                    matchesOracle
                      ? 'bg-accent-green/10 border border-accent-green/20 text-accent-green'
                      : contradictsOracle
                      ? 'bg-accent-red/10 border border-accent-red/20 text-accent-red'
                      : 'bg-white/5 border border-white/10 text-smoke/50'
                  }`}>
                    {matchesOracle && '✓ Oracle agrees: '}
                    {contradictsOracle && '⚠️ Oracle disagrees: '}
                    {!matchesOracle && !contradictsOracle && 'Oracle: '}
                    ${od.startPrice.toLocaleString()} → {od.endPrice !== null ? `$${od.endPrice.toLocaleString()}` : 'pending'}
                    {od.result && (
                      <strong className="ml-1">({od.result.toUpperCase()} wins)</strong>
                    )}
                  </div>
                );
              })()}
              <p className="text-smoke/50 text-xs mb-6">
                This calls <code className="text-orange/80">flash_settle</code> on-chain. Your wallet will open for approval. This is permanent and cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant={confirm.winningOutcome === 1 ? 'primary' : 'danger'}
                  size="sm"
                  loading={isBusy}
                  onClick={() => handleResolve(confirm.marketId, confirm.winningOutcome, confirm.tokenType)}
                >
                  Yes, Resolve {confirm.label}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
