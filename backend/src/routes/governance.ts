import { Router } from 'express';
import { config } from '../config';
import { query } from '../services/db';

const router = Router();

// ---- Proposal registry (persisted to PostgreSQL) ----
interface ProposalMeta {
  id: string;          // The nonce field used when submitting
  txId?: string;       // Transaction ID from the wallet
  resolvedId?: string; // Actual on-chain proposal ID (BHP256 hash of proposer+nonce)
  title: string;
  description: string;
  actionType: number;
  targetMarket: string;
  amount: string;
  recipient: string;
  tokenType: number;
  createdAt: number;
}

let proposalRegistry: ProposalMeta[] = [];

async function loadRegistry(): Promise<void> {
  try {
    const { rows } = await query('SELECT * FROM proposals ORDER BY created_at DESC');
    proposalRegistry = rows.map((r: any) => ({
      id: r.id,
      txId: r.tx_id || undefined,
      resolvedId: r.resolved_id || undefined,
      title: r.title || '',
      description: r.description || '',
      actionType: r.action_type || 0,
      targetMarket: r.target_market || '0field',
      amount: r.amount || '0',
      recipient: r.recipient || '',
      tokenType: r.token_type || 0,
      createdAt: Number(r.created_at) || 0,
    }));
    console.log(`[Governance] Loaded ${proposalRegistry.length} proposal(s) from database`);
  } catch (err) {
    console.error('[Governance] Failed to load proposals from DB:', err);
    proposalRegistry = [];
  }
}

async function persistProposal(meta: ProposalMeta): Promise<void> {
  try {
    await query(
      `INSERT INTO proposals (id, tx_id, resolved_id, title, description, action_type, target_market, amount, recipient, token_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         tx_id = COALESCE(EXCLUDED.tx_id, proposals.tx_id),
         resolved_id = COALESCE(EXCLUDED.resolved_id, proposals.resolved_id),
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         action_type = EXCLUDED.action_type,
         target_market = EXCLUDED.target_market,
         amount = EXCLUDED.amount,
         recipient = EXCLUDED.recipient,
         token_type = EXCLUDED.token_type`,
      [meta.id, meta.txId || null, meta.resolvedId || null, meta.title, meta.description,
       meta.actionType, meta.targetMarket, meta.amount, meta.recipient, meta.tokenType, meta.createdAt],
    );
  } catch (err) {
    console.error('[Governance] Failed to persist proposal:', err);
  }
}

async function persistAllProposals(): Promise<void> {
  for (const meta of proposalRegistry) {
    await persistProposal(meta);
  }
}

// Load on startup
loadRegistry();

// ---- Fetch proposal data from chain ----
async function fetchProposalFromChain(proposalId: string) {
  try {
    const url = `${config.aleoEndpoint}/testnet/program/${config.programId}/mapping/proposals/${proposalId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  } catch { return null; }
}

/**
 * Resolve the actual on-chain proposal ID from a transaction.
 * The submit_proposal finalize inputs contain the proposal_id as the first argument.
 */
async function resolveProposalIdFromTx(txId: string): Promise<string | null> {
  try {
    const url = `${config.aleoEndpoint}/testnet/transaction/${txId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;

    // Navigate: execution.transitions[] → find submit_proposal → extract finalize[0]
    const execution = data?.execution as Record<string, unknown> | undefined;
    const transitions = execution?.transitions;
    if (!Array.isArray(transitions)) return null;

    for (const t of transitions as Record<string, unknown>[]) {
      if (t.program === config.programId && t.function === 'submit_proposal') {
        const finalizeInputs = t.finalize as unknown[];
        if (Array.isArray(finalizeInputs) && finalizeInputs.length > 0) {
          // First finalize input is the proposal_id (field)
          const raw = finalizeInputs[0] as Record<string, unknown> | string;
          const val = typeof raw === 'object' ? raw.value : raw;
          if (typeof val === 'string' && val.endsWith('field')) {
            return val;
          }
        }
      }
    }
    return null;
  } catch { return null; }
}

function parseProposalStruct(raw: string): Record<string, string> | null {
  if (!raw || raw === 'null') return null;
  const fields: Record<string, string> = {};
  const content = raw.replace(/^\s*\{/, '').replace(/\}\s*$/, '');
  for (const line of content.split(',')) {
    const match = line.trim().match(/^(\w+)\s*:\s*(.+)$/);
    if (match) fields[match[1]] = match[2].trim();
  }
  return Object.keys(fields).length > 0 ? fields : null;
}

// ---- Routes ----

// List all known proposals with on-chain data
router.get('/', async (_req, res) => {
  let registryChanged = false;
  const enriched = await Promise.all(
    proposalRegistry.map(async (meta) => {
      // Determine the on-chain lookup key
      let lookupId = meta.resolvedId || null;

      // If we haven't resolved the on-chain ID yet, try via txId
      if (!lookupId && meta.txId) {
        const resolved = await resolveProposalIdFromTx(meta.txId);
        if (resolved) {
          meta.resolvedId = resolved;
          registryChanged = true;
          lookupId = resolved;
        }
      }

      // Fallback: try the raw nonce (won't match, but keeps compat)
      if (!lookupId) lookupId = meta.id;

      const raw = await fetchProposalFromChain(lookupId);
      const chain = raw ? parseProposalStruct(typeof raw === 'string' ? raw : JSON.stringify(raw)) : null;
      return {
        ...meta,
        onChainId: lookupId,
        chain: chain ? {
          votesFor: chain.votes_for || '0u128',
          votesAgainst: chain.votes_against || '0u128',
          createdAt: chain.created_at || '0u32',
          deadline: chain.deadline || '0u32',
          executed: chain.executed === 'true',
          proposer: chain.proposer || '',
        } : null,
      };
    })
  );
  if (registryChanged) persistAllProposals().catch(() => {});
  res.json({ proposals: enriched });
});

// Get single proposal
router.get('/:id', async (req, res) => {
  const meta = proposalRegistry.find(p => p.id === req.params.id || p.resolvedId === req.params.id);
  if (!meta) {
    res.status(404).json({ error: 'Proposal not found' });
    return;
  }

  // Try to resolve on-chain ID if needed
  let lookupId = meta.resolvedId || null;
  if (!lookupId && meta.txId) {
    const resolved = await resolveProposalIdFromTx(meta.txId);
    if (resolved) {
      meta.resolvedId = resolved;
      persistProposal(meta).catch(() => {});
      lookupId = resolved;
    }
  }
  if (!lookupId) lookupId = meta.id;

  const raw = await fetchProposalFromChain(lookupId);
  const chain = raw ? parseProposalStruct(typeof raw === 'string' ? raw : JSON.stringify(raw)) : null;
  res.json({
    proposal: {
      ...meta,
      onChainId: lookupId,
      chain: chain ? {
        votesFor: chain.votes_for || '0u128',
        votesAgainst: chain.votes_against || '0u128',
        createdAt: chain.created_at || '0u32',
        deadline: chain.deadline || '0u32',
        executed: chain.executed === 'true',
        proposer: chain.proposer || '',
      } : null,
    },
  });
});

// Register a new proposal (called by frontend after tx confirms)
router.post('/register', async (req, res) => {
  const { id, txId, title, description, actionType, targetMarket, amount, recipient, tokenType } = req.body;
  if (!id || !title) {
    res.status(400).json({ error: 'id and title required' });
    return;
  }
  const existing = proposalRegistry.find(p => p.id === id);
  if (existing) {
    // Update txId if provided and not already set
    if (txId && !existing.txId) {
      existing.txId = txId;
      persistProposal(existing).catch(() => {});
    }
    res.json({ success: true, message: 'already registered' });
    return;
  }
  const newProposal: ProposalMeta = {
    id,
    txId: txId || undefined,
    title: title || '',
    description: description || '',
    actionType: actionType || 0,
    targetMarket: targetMarket || '0field',
    amount: amount || '0',
    recipient: recipient || '',
    tokenType: tokenType || 0,
    createdAt: Date.now(),
  };
  proposalRegistry.push(newProposal);
  persistProposal(newProposal).catch(() => {});
  res.json({ success: true, count: proposalRegistry.length });
});

// Resolve proposal on-chain IDs from wallet GovernanceReceipt records.
// The frontend reads real proposal_ids (BHP256 hashes) from the wallet and sends them here.
// We look each up on-chain, then match to unresolved registry entries by field comparison.
router.post('/resolve', async (req, res) => {
  const { proposalIds } = req.body;
  if (!Array.isArray(proposalIds) || proposalIds.length === 0) {
    res.json({ success: true, resolved: 0 });
    return;
  }

  let updated = 0;
  for (const pid of proposalIds) {
    if (typeof pid !== 'string' || !pid.endsWith('field')) continue;
    // Skip if already resolved to this ID
    if (proposalRegistry.some(p => p.resolvedId === pid)) continue;

    // Verify it exists on-chain
    const raw = await fetchProposalFromChain(pid);
    if (!raw) continue;
    const chain = parseProposalStruct(typeof raw === 'string' ? raw : JSON.stringify(raw));
    if (!chain) continue;

    // Extract on-chain fields for matching
    const chainActionType = parseInt((chain.action_type || '0').replace(/u\d+$/, ''), 10);
    const chainTarget = chain.target_market || '0field';
    const chainAmount = (chain.amount || '0').replace(/u\d+$/, '');
    const chainTokenType = parseInt((chain.token_type || '0').replace(/u\d+$/, ''), 10);

    // Find best matching unresolved proposal in registry
    let bestMatch: ProposalMeta | null = null;
    let bestScore = 0;
    for (const meta of proposalRegistry) {
      if (meta.resolvedId) continue;
      let score = 0;
      if (meta.actionType === chainActionType) score += 10;
      if (meta.targetMarket === chainTarget) score += 5;
      if (meta.amount === chainAmount) score += 5;
      if (meta.tokenType === chainTokenType) score += 3;
      if (score > bestScore) { bestScore = score; bestMatch = meta; }
    }

    if (bestMatch && bestScore >= 10) {
      bestMatch.resolvedId = pid;
      updated++;
    }
  }

  if (updated > 0) persistAllProposals().catch(() => {});
  res.json({ success: true, resolved: updated });
});

// Check if a proposal is ready for execution (quorum + timelock passed)
router.get('/:id/executable', async (req, res) => {
  const meta = proposalRegistry.find(p => p.id === req.params.id || p.resolvedId === req.params.id);
  if (!meta) { res.status(404).json({ error: 'Proposal not found' }); return; }

  const lookupId = meta.resolvedId || meta.id;
  const raw = await fetchProposalFromChain(lookupId);
  if (!raw) { res.json({ executable: false, reason: 'Not found on-chain' }); return; }

  const chain = parseProposalStruct(typeof raw === 'string' ? raw : JSON.stringify(raw));
  if (!chain) { res.json({ executable: false, reason: 'Parse error' }); return; }

  const executed = chain.executed === 'true';
  if (executed) { res.json({ executable: false, reason: 'Already executed' }); return; }

  const votesFor = parseInt((chain.votes_for || '0').replace(/u\d+$/, ''), 10);
  const votesAgainst = parseInt((chain.votes_against || '0').replace(/u\d+$/, ''), 10);
  const deadline = parseInt((chain.deadline || '0').replace(/u\d+$/, ''), 10);
  const QUORUM = 3;
  const TIMELOCK = 480;

  // Fetch current block height
  let currentHeight = 0;
  try {
    const hRes = await fetch(`${config.aleoEndpoint}/testnet/block/height/latest`);
    if (hRes.ok) currentHeight = parseInt(await hRes.text(), 10);
  } catch {}

  const votingEnded = currentHeight > deadline;
  const timelockPassed = currentHeight >= deadline + TIMELOCK;
  const hasMajority = votesFor > votesAgainst;
  const hasQuorum = votesFor >= QUORUM;

  const executable = votingEnded && timelockPassed && hasMajority && hasQuorum;
  const actionType = parseInt((chain.action_type || '0').replace(/u\d+$/, ''), 10);
  const isTreasury = actionType === 2;

  res.json({
    executable,
    isTreasury,
    actionType,
    votesFor,
    votesAgainst,
    deadline,
    currentHeight,
    timelockBlock: deadline + TIMELOCK,
    reasons: {
      votingEnded,
      timelockPassed,
      hasMajority,
      hasQuorum,
    },
    // For treasury execution, frontend needs these params
    ...(isTreasury ? {
      recipient: chain.recipient || '',
      amount: (chain.amount || '0').replace(/u\d+$/, ''),
    } : {}),
  });
});

// Fetch approved resolvers status
router.get('/resolvers/:address', async (req, res) => {
  try {
    const addr = req.params.address;
    const [approvedRaw, stakeRaw] = await Promise.all([
      fetchMapping('approved_resolvers', addr),
      fetchMapping('resolver_stakes', addr),
    ]);
    const approved = approvedRaw === 'true';
    const stake = parseInt((stakeRaw || '0').replace(/u\d+$/, ''), 10);
    res.json({ address: addr, approved, stake });
  } catch {
    res.json({ address: req.params.address, approved: false, stake: 0 });
  }
});

function fetchMapping(mappingName: string, key: string): Promise<string | null> {
  return fetch(`${config.aleoEndpoint}/testnet/program/${config.programId}/mapping/${mappingName}/${key}`)
    .then(r => r.ok ? r.text().then(t => { try { return JSON.parse(t); } catch { return t; } }) : null)
    .catch(() => null);
}

export default router;
