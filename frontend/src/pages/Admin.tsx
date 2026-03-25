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
import { buildFlashSettleTx } from '@/utils/transactions';
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

export default function Admin() {
  const { connected, address } = useWalletStore();
  const { status: txStatus, execute } = useTransaction();
  const { markets, fetchMarkets } = useMarketStore();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (markets.length === 0) {
      setLoading(true);
      fetchMarkets().finally(() => setLoading(false));
    }
  }, [markets.length, fetchMarkets]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await fetchMarkets();
    setLoading(false);
  }, [fetchMarkets]);

  const isDeployer = connected && address === DEPLOYER;

  // Show all active markets (lightning and non-lightning)
  const activeMarkets: AdminMarket[] = markets
    .filter((m) => m.status === 'active' || m.status === 'closed')
    .map((m) => ({
      id: m.id,
      question: m.question,
      status: m.status,
      tokenType: m.tokenType,
      isLightning: m.isLightning,
      totalVolume: m.totalVolume,
      reserves: m.reserves,
    }));

  const resolvedMarkets = markets.filter((m) => m.status === 'resolved');

  const handleResolve = async (marketId: string, winningOutcome: number, tokenType: string) => {
    setConfirm(null);
    const tx = buildFlashSettleTx(marketId, winningOutcome, (tokenType || 'ALEO') as TokenType);
    const txId = await execute(tx, () => {
      setResolvedIds((prev) => new Set(prev).add(marketId));
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
                          onClick={() => setConfirm({ marketId: market.id, question: market.question, tokenType, winningOutcome: 1, label: 'UP / YES' })}
                        >
                          Resolve UP ↑
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => setConfirm({ marketId: market.id, question: market.question, tokenType, winningOutcome: 2, label: 'DOWN / NO' })}
                        >
                          Resolve DOWN ↓
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

      {/* Instructions */}
      <Card className="mt-10 p-6">
        <h3 className="font-heading font-bold text-white mb-3">How it works</h3>
        <ul className="space-y-2 text-smoke/70 text-sm">
          <li>
            <span className="text-teal font-medium">1.</span> Click <strong className="text-white">Resolve UP</strong> or <strong className="text-white">Resolve DOWN</strong> — your wallet will open to sign the <code className="text-orange/80">flash_settle</code> transaction.
          </li>
          <li>
            <span className="text-teal font-medium">2.</span> Approve in your wallet — the ZK proof is generated and broadcast on-chain.
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
