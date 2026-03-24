import { useEffect, useState, useCallback } from 'react';
import { useTransaction } from '@/hooks/useTransaction';
import { buildSubmitProposalTx, buildCastVoteTx } from '@/utils/transactions';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import EmptyState from '@/components/shared/EmptyState';
import RefreshButton from '@/components/shared/RefreshButton';
import { ShieldIcon } from '@/components/icons';
import { motion } from 'framer-motion';
import { API_BASE, PROGRAM_ID } from '@/constants';
import { useMarketStore } from '@/stores/marketStore';

// ---- Types ----
interface ProposalChainData {
  votesFor: string;
  votesAgainst: string;
  createdAt: string;
  deadline: string;
  executed: boolean;
  proposer: string;
}

interface Proposal {
  id: string;
  txId?: string;
  onChainId?: string;
  title: string;
  description: string;
  actionType: number;
  targetMarket: string;
  amount: string;
  recipient: string;
  tokenType: number;
  createdAt: number;
  chain: ProposalChainData | null;
}

const ACTION_LABELS: Record<number, string> = {
  0: 'General',
  1: 'Approve Resolver',
  2: 'Treasury Withdrawal',
  3: 'Fee Update',
  4: 'Market Override',
};

const ACTION_DESCRIPTIONS: Record<number, string> = {
  0: 'A general protocol proposal — parameter changes, announcements, or community decisions.',
  1: 'Approve an address as a trusted market resolver.',
  2: 'Withdraw funds from the protocol treasury.',
  3: 'Update the fee rate or fee parameters.',
  4: 'Override or resolve a specific market.',
};

// Which fields are needed per action type
const NEEDS_TARGET_MARKET = [1, 4];
const NEEDS_RECIPIENT = [2];
const NEEDS_AMOUNT = [2, 3];
const NEEDS_TOKEN = [2, 3, 4];

const VOTE_DURATION_OPTIONS = [
  { label: '1 day',   days: 1 },
  { label: '3 days',  days: 3 },
  { label: '7 days',  days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

// ~3 seconds per Aleo block
const BLOCKS_PER_DAY = Math.floor((24 * 60 * 60) / 3);

function parseU128(val: string): number {
  return parseInt(val.replace('u128', '').replace('u32', ''), 10) || 0;
}

// ---- Component ----
export default function Governance() {
  const { status: txStatus, execute, fetchGovernanceReceipts, connected } = useTransaction();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'proposals' | 'create'>('proposals');

  // Current Aleo block height
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);

  // Markets from store for dropdown
  const { markets, fetchMarkets } = useMarketStore();

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actionType, setActionType] = useState(0);
  const [targetMarketId, setTargetMarketId] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [tokenType, setTokenType] = useState(0);
  const [voteDurationDays, setVoteDurationDays] = useState(7);

  // Derived: computed deadline block
  const computedDeadline = currentBlock != null
    ? currentBlock + voteDurationDays * BLOCKS_PER_DAY
    : null;

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/governance`);
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Fetch current Aleo block height
  const fetchBlockHeight = useCallback(async () => {
    try {
      const res = await fetch('https://api.explorer.provable.com/v1/testnet/latest/height');
      if (res.ok) {
        const height = await res.json();
        setCurrentBlock(typeof height === 'number' ? height : parseInt(height, 10));
      }
    } catch { /* ignore — form still works with fallback */ }
  }, []);

  useEffect(() => {
    fetchProposals();
    fetchMarkets();
    fetchBlockHeight();
  }, [fetchProposals, fetchMarkets, fetchBlockHeight]);

  // Auto-resolve proposal IDs from wallet GovernanceReceipt records.
  // The wallet holds the real on-chain proposal_id (BHP256 hash of proposer+nonce).
  useEffect(() => {
    if (!connected) return;
    const resolve = async () => {
      const receiptIds = await fetchGovernanceReceipts();
      if (receiptIds.length === 0) return;
      try {
        const res = await fetch(`${API_BASE}/governance/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalIds: receiptIds }),
        });
        const data = await res.json();
        if (data.resolved > 0) fetchProposals();
      } catch { /* ignore */ }
    };
    const timer = setTimeout(resolve, 1500);
    return () => clearTimeout(timer);
  }, [connected, fetchGovernanceReceipts, fetchProposals]);

  const handleSubmitProposal = async () => {
    if (!title.trim()) return;
    const nonce = `${BigInt(Math.floor(Math.random() * 2 ** 64))}field`;
    const deadlineVal = computedDeadline
      ? `${computedDeadline}`
      : '999999999';

    // Target market: use selected market id (already a field) or default 0field
    const targetMarketField = targetMarketId || '0field';

    const tx = buildSubmitProposalTx(
      actionType,
      targetMarketField,
      amount || '0',
      recipient || 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc',
      NEEDS_TOKEN.includes(actionType) ? tokenType : 0,
      deadlineVal,
      nonce
    );

    const txId = await execute(tx, async () => {
      // Auto-refresh after confirmation: re-resolve proposal IDs
      const receiptIds = await fetchGovernanceReceipts();
      if (receiptIds.length > 0) {
        try {
          await fetch(`${API_BASE}/governance/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposalIds: receiptIds }),
          });
        } catch { /* ignore */ }
      }
      fetchProposals();
    });
    if (txId) {
      try {
        await fetch(`${API_BASE}/governance/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: nonce,
            txId,
            title: title.trim(),
            description: description.trim(),
            actionType,
            targetMarket: targetMarketField,
            amount: amount || '0',
            recipient,
            tokenType: NEEDS_TOKEN.includes(actionType) ? tokenType : 0,
          }),
        });
      } catch { /* ignore */ }
      setTitle('');
      setDescription('');
      setActionType(0);
      setTargetMarketId('');
      setAmount('');
      setRecipient('');
      setVoteDurationDays(7);
      setActiveTab('proposals');
    }
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    const tx = buildCastVoteTx(proposalId, support);
    await execute(tx, fetchProposals);
  };

  const tabs = [
    { id: 'proposals' as const, label: `Proposals (${proposals.length})` },
    { id: 'create' as const, label: 'New Proposal' },
  ];

  return (
    <div>
      <PageHeader
        title="Governance"
        subtitle="Submit proposals and vote to shape the protocol"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1">Total Proposals</p>
            <p className="text-2xl font-mono font-bold text-white">{proposals.length}</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1">Active Votes</p>
            <p className="text-2xl font-mono font-bold text-teal">
              {proposals.filter(p => p.chain && !p.chain.executed).length}
            </p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1">Executed</p>
            <p className="text-2xl font-mono font-bold text-accent-green">
              {proposals.filter(p => p.chain?.executed).length}
            </p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1">Program</p>
            <p className="text-sm font-mono text-gray-400 truncate">{PROGRAM_ID}</p>
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

      {/* Proposals List */}
      {activeTab === 'proposals' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex justify-end mb-2">
            <RefreshButton onRefresh={fetchProposals} label="Refresh" />
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-teal/30 border-t-teal rounded-full animate-spin" />
            </div>
          ) : proposals.length === 0 ? (
            <EmptyState
              icon={<ShieldIcon className="w-10 h-10 text-gray-600" />}
              title="No proposals yet"
              description="Be the first to submit a governance proposal"
              action={{ label: 'Create Proposal', onClick: () => setActiveTab('create') }}
            />
          ) : (
            <div className="space-y-3">
              {proposals.map((proposal, idx) => {
                const votesFor = proposal.chain ? parseU128(proposal.chain.votesFor) : 0;
                const votesAgainst = proposal.chain ? parseU128(proposal.chain.votesAgainst) : 0;
                const totalVotes = votesFor + votesAgainst;
                const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;
                const isActive = proposal.chain ? !proposal.chain.executed : false;
                const isExecuted = proposal.chain?.executed || false;
                const isConfirming = !proposal.chain && !!proposal.txId;
                // Use the resolved on-chain ID for voting; fall back to raw id
                const voteId = proposal.onChainId || proposal.id;

                return (
                  <motion.div
                    key={proposal.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <Card className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-heading font-semibold text-white truncate">
                              {proposal.title}
                            </h3>
                            <Badge variant={isExecuted ? 'green' : isActive ? 'teal' : isConfirming ? 'gray' : 'gray'}>
                              {isExecuted ? 'Executed' : isActive ? 'Active' : isConfirming ? 'Confirming…' : 'Pending'}
                            </Badge>
                            <Badge variant="gray">
                              {ACTION_LABELS[proposal.actionType] || 'Unknown'}
                            </Badge>
                          </div>

                          {proposal.description && (
                            <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                              {proposal.description}
                            </p>
                          )}

                          {/* Vote Bar */}
                          <div className="mb-2">
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                              <span>For: <span className="text-accent-green font-mono">{votesFor}</span></span>
                              <span>Against: <span className="text-accent-red font-mono">{votesAgainst}</span></span>
                            </div>
                            <div className="h-2 bg-dark-400/50 rounded-full overflow-hidden flex">
                              <div
                                className="h-full bg-accent-green/70 transition-all duration-500"
                                style={{ width: `${forPercent}%` }}
                              />
                              <div
                                className="h-full bg-accent-red/70 transition-all duration-500"
                                style={{ width: `${100 - forPercent}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-[10px] text-gray-600">
                            <span>ID: <span className="font-mono">{proposal.id.slice(0, 16)}...</span></span>
                            <span>Total votes: <span className="font-mono">{totalVotes}</span></span>
                          </div>
                        </div>

                        {/* Vote Buttons */}
                        {isActive && (
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleVote(voteId, true)}
                              loading={txStatus === 'proving' || txStatus === 'broadcasting'}
                              className="!text-xs !px-3"
                            >
                              {txStatus === 'broadcasting' ? 'Submitting...' : 'Vote For'}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleVote(voteId, false)}
                              loading={txStatus === 'proving' || txStatus === 'broadcasting'}
                              className="!text-xs !px-3"
                            >
                              {txStatus === 'broadcasting' ? 'Submitting...' : 'Against'}
                            </Button>
                          </div>
                        )}
                        {isConfirming && (
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-4 h-4 border-2 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />
                            <span className="text-[11px] text-gray-500">On-chain…</span>
                          </div>
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

      {/* Create Proposal Form */}
      {activeTab === 'create' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="p-6 max-w-2xl">
            <h3 className="text-sm font-heading font-semibold text-white mb-1">
              Submit New Proposal
            </h3>
            <p className="text-xs text-gray-500 mb-5">Your wallet address will be recorded as the proposer. You automatically cast 1 vote for your own proposal.</p>

            <div className="space-y-5">

              {/* Title */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                  Title <span className="text-orange-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Approve new resolver for BTC markets"
                  className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Explain what this proposal does and why it should pass..."
                  rows={3}
                  className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors resize-none"
                />
              </div>

              {/* Action Type */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                  Proposal Type
                </label>
                <select
                  value={actionType}
                  onChange={e => { setActionType(parseInt(e.target.value, 10)); setTargetMarketId(''); setAmount(''); setRecipient(''); }}
                  className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal/40 transition-colors mb-2"
                >
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <p className="text-[11px] text-teal/70 bg-teal/5 border border-teal/10 rounded-lg px-3 py-2">
                  {ACTION_DESCRIPTIONS[actionType]}
                </p>
              </div>

              {/* Target Market — only for relevant action types */}
              {NEEDS_TARGET_MARKET.includes(actionType) && (
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                    Target Market
                  </label>
                  {markets.length > 0 ? (
                    <select
                      value={targetMarketId}
                      onChange={e => setTargetMarketId(e.target.value)}
                      className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal/40 transition-colors"
                    >
                      <option value="">— None / Not applicable —</option>
                      {markets.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.question.length > 60 ? m.question.slice(0, 60) + '…' : m.question}
                          {m.tokenType ? ` [${m.tokenType}]` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={targetMarketId}
                      onChange={e => setTargetMarketId(e.target.value)}
                      placeholder="Loading markets… or paste market field ID"
                      className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors"
                    />
                  )}
                  <p className="text-[11px] text-gray-600 mt-1">Select the market this proposal applies to. Leave blank if not applicable.</p>
                </div>
              )}

              {/* Amount + Token Type — only for relevant action types */}
              {NEEDS_AMOUNT.includes(actionType) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                      Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors"
                    />
                    <p className="text-[11px] text-gray-600 mt-1">In microcredits (1 ALEO = 1,000,000)</p>
                  </div>
                  {NEEDS_TOKEN.includes(actionType) && (
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                        Token
                      </label>
                      <select
                        value={tokenType}
                        onChange={e => setTokenType(parseInt(e.target.value, 10))}
                        className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal/40 transition-colors"
                      >
                        <option value={0}>ALEO</option>
                        <option value={1}>USDCx</option>
                        <option value={2}>USAD</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Recipient — only for Treasury Withdrawal */}
              {NEEDS_RECIPIENT.includes(actionType) && (
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder="aleo1..."
                    className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors"
                  />
                  <p className="text-[11px] text-gray-600 mt-1">The address that will receive the treasury withdrawal.</p>
                </div>
              )}

              {/* Vote Duration */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                  Voting Period
                </label>
                <div className="flex gap-2 flex-wrap">
                  {VOTE_DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setVoteDurationDays(opt.days)}
                      className={`px-4 py-2 rounded-lg text-sm font-heading font-medium transition-all border ${
                        voteDurationDays === opt.days
                          ? 'bg-teal/15 border-teal/40 text-teal'
                          : 'bg-dark-200 border-dark-400/30 text-gray-400 hover:text-white hover:border-dark-400/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Block height info */}
                <div className="mt-3 px-3 py-2.5 rounded-lg bg-dark-200 border border-dark-400/20">
                  {currentBlock != null ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Current block:</span>
                      <span className="font-mono text-gray-300">{currentBlock.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 italic">Fetching current block height…</div>
                  )}
                  {computedDeadline != null && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-gray-500">Voting ends at block:</span>
                      <span className="font-mono text-teal font-semibold">{computedDeadline.toLocaleString()}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-600 mt-1.5">Aleo produces ~1 block every 3 seconds. Estimated deadline may shift slightly.</p>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-1">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSubmitProposal}
                  loading={txStatus === 'proving' || txStatus === 'broadcasting'}
                  disabled={!title.trim()}
                  className="w-full"
                >
                  {txStatus === 'broadcasting' ? 'Submitting...' : 'Submit Proposal'}
                </Button>
                <p className="text-[11px] text-gray-600 text-center mt-2">This will prompt your Leo Wallet to sign and broadcast a transaction on Aleo Testnet.</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
