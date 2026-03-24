import { Router } from 'express';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

const router = Router();

// ---- Proposal registry (persisted to disk) ----
interface ProposalMeta {
  id: string;
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
  const enriched = await Promise.all(
    proposalRegistry.map(async (meta) => {
      const raw = await fetchProposalFromChain(meta.id);
      const chain = raw ? parseProposalStruct(typeof raw === 'string' ? raw : JSON.stringify(raw)) : null;
      return {
        ...meta,
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
  res.json({ proposals: enriched });
});

// Get single proposal
router.get('/:id', async (req, res) => {
  const meta = proposalRegistry.find(p => p.id === req.params.id);
  if (!meta) {
    res.status(404).json({ error: 'Proposal not found' });
    return;
  }
  const raw = await fetchProposalFromChain(meta.id);
  const chain = raw ? parseProposalStruct(typeof raw === 'string' ? raw : JSON.stringify(raw)) : null;
  res.json({
    proposal: {
      ...meta,
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
  const { id, title, description, actionType, targetMarket, amount, recipient, tokenType } = req.body;
  if (!id || !title) {
    res.status(400).json({ error: 'id and title required' });
    return;
  }
  const existing = proposalRegistry.find(p => p.id === id);
  if (existing) {
    res.json({ success: true, message: 'already registered' });
    return;
  }
  proposalRegistry.push({
    id,
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

export default router;
