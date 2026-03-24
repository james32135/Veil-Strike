import { Router } from 'express';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

const router = Router();

// ---- Proposal registry (persisted to disk) ----
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

const REGISTRY_PATH = path.join(process.cwd(), 'data', 'governance-registry.json');
let proposalRegistry: ProposalMeta[] = [];

function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      proposalRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    }
  } catch { proposalRegistry = []; }
}

function persistRegistry() {
  const dir = path.dirname(REGISTRY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(proposalRegistry, null, 2));
}

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
  if (registryChanged) persistRegistry();
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
      persistRegistry();
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
router.post('/register', (req, res) => {
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
      persistRegistry();
    }
    res.json({ success: true, message: 'already registered' });
    return;
  }
  proposalRegistry.push({
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
  });
  persistRegistry();
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

  if (updated > 0) persistRegistry();
  res.json({ success: true, resolved: updated });
});

export default router;
