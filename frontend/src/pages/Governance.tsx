import { useEffect, useState, useCallback } from 'react';
import { useTransaction } from '@/hooks/useTransaction';
import { buildSubmitProposalTx, buildCastVoteTx } from '@/utils/transactions';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import EmptyState from '@/components/shared/EmptyState';
import { ShieldIcon } from '@/components/icons';
import { motion } from 'framer-motion';
import { API_BASE, PROGRAM_ID } from '@/constants';

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

function parseU128(val: string): number {
  return parseInt(val.replace('u128', '').replace('u32', ''), 10) || 0;
}

// ---- Component ----
export default function Governance() {
  const { status: txStatus, execute } = useTransaction();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'proposals' | 'create'>('proposals');

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actionType, setActionType] = useState(0);
  const [targetMarket, setTargetMarket] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [tokenType, setTokenType] = useState(0);
  const [voteDeadline, setVoteDeadline] = useState('');

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/governance`);
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const handleSubmitProposal = async () => {
    if (!title.trim()) return;
    const nonce = `${BigInt(Math.floor(Math.random() * 2 ** 64))}field`;
    const deadlineVal = voteDeadline || '999999999';

    const tx = buildSubmitProposalTx(
      actionType,
      targetMarket || '0field',
      amount || '0',
      recipient || 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc',
      tokenType,
      deadlineVal,
      nonce
    );

    const txId = await execute(tx);
    if (txId) {
      // Register proposal metadata on backend
      try {
        await fetch(`${API_BASE}/governance/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: nonce, // proposal_id is hash of {signer, nonce}
            title: title.trim(),
            description: description.trim(),
            actionType,
            targetMarket: targetMarket || '0field',
            amount: amount || '0',
            recipient,
            tokenType,
          }),
        });
      } catch { /* ignore */ }
      setTitle('');
      setDescription('');
      setActionType(0);
      setTargetMarket('');
      setAmount('');
      setRecipient('');
      setVoteDeadline('');
      setActiveTab('proposals');
      setTimeout(fetchProposals, 8000);
    }
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    const tx = buildCastVoteTx(proposalId, support);
    const txId = await execute(tx);
    if (txId) setTimeout(fetchProposals, 8000);
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
                            <Badge variant={isExecuted ? 'green' : isActive ? 'teal' : 'gray'}>
                              {isExecuted ? 'Executed' : isActive ? 'Active' : 'Pending'}
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
                              onClick={() => handleVote(proposal.id, true)}
                              loading={txStatus === 'proving'}
                              className="!text-xs !px-3"
                            >
                              Vote For
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleVote(proposal.id, false)}
                              loading={txStatus === 'proving'}
                              className="!text-xs !px-3"
                            >
                              Against
                            </Button>
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
            <h3 className="text-sm font-heading font-semibold text-white mb-5">
              Submit New Proposal
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Approve new resolver"
                  className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Explain what this proposal does..."
                  rows={3}
                  className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                    Action Type
                  </label>
                  <select
                    value={actionType}
                    onChange={e => setActionType(parseInt(e.target.value, 10))}
                    className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal/40 transition-colors"
                  >
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                    Token Type
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
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                  Target Market (field)
                </label>
                <input
                  type="text"
                  value={targetMarket}
                  onChange={e => setTargetMarket(e.target.value)}
                  placeholder="0field (leave empty for general proposals)"
                  className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                    Amount
                  </label>
                  <input
                    type="text"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5">
                    Vote Deadline (block height)
                  </label>
                  <input
                    type="text"
                    value={voteDeadline}
                    onChange={e => setVoteDeadline(e.target.value)}
                    placeholder="e.g. 16000000"
                    className="w-full bg-dark-200 border border-dark-400/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal/40 transition-colors"
                  />
                </div>
              </div>

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
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSubmitProposal}
                  loading={txStatus === 'proving'}
                  disabled={!title.trim()}
                  className="w-full"
                >
                  Submit Proposal
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
