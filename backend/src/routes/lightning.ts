import { Router } from 'express';
import { getLightningRounds } from '../services/oracle';
import { getActiveLightningRounds, settleLightningRounds, getMarketAssignments, notifyBet, adminResolveMarket, getActiveMarkets, adminCreateReplacement } from '../services/lightning-manager';

const router = Router();

// GET / — Oracle rounds enriched with per-round market IDs and on-chain status
router.get('/', (_req, res) => {
  const oracleRounds = getLightningRounds();
  const assignments = getMarketAssignments();

  // For each oracle round, attach market assignments for all token types
  const enriched = oracleRounds.map((r) => {
    // Oracle round id is like "BTC-1747123400000"
    // Market assignments keys are like "BTC-ALEO-1747123400000"
    const parts = r.id.split('-');
    const asset = parts[0];
    const roundTs = parts[1];

    const markets: Record<string, { marketId: string; onChainStatus: string }> = {};
    for (const token of ['ALEO', 'USDCX', 'USAD']) {
      const key = `${asset}-${token}-${roundTs}`;
      const assignment = assignments.get(key);
      if (assignment) {
        markets[token.toLowerCase()] = {
          marketId: assignment.marketId,
          onChainStatus: assignment.onChainStatus,
        };
      }
    }

    return { ...r, markets };
  });

  res.json({ rounds: enriched });
});

router.get('/active', (_req, res) => {
  const activeRounds = getActiveLightningRounds();
  res.json({ activeRounds });
});

// POST /notify-bet — Frontend signals that a bet was placed on a round
router.post('/notify-bet', (req, res) => {
  const { roundId } = req.body;
  if (!roundId || typeof roundId !== 'string') {
    res.status(400).json({ status: 'error', message: 'roundId required' });
    return;
  }
  notifyBet(roundId);
  res.json({ status: 'ok' });
});

// POST /settle — Manual trigger for round result resolution (off-chain only, no on-chain tx)
router.post('/settle', async (_req, res) => {
  try {
    await settleLightningRounds();
    res.json({ status: 'ok', message: 'Round results resolved' });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err?.message || 'Resolution failed' });
  }
});

// GET /admin/markets — List active markets for admin dashboard
router.get('/admin/markets', (_req, res) => {
  const markets = getActiveMarkets();
  res.json({ markets });
});

// POST /admin/resolve — Admin manually resolves a market on-chain (flash_settle)
// WARNING: This permanently resolves the market. Create a new market afterward.
// Body: { marketId: string, winningOutcome: 1|2, tokenType?: 'ALEO'|'USDCX'|'USAD' }
router.post('/admin/resolve', async (req, res) => {
  const { marketId, winningOutcome, tokenType } = req.body;

  if (!marketId || typeof marketId !== 'string') {
    res.status(400).json({ status: 'error', message: 'marketId required' });
    return;
  }
  if (winningOutcome !== 1 && winningOutcome !== 2) {
    res.status(400).json({ status: 'error', message: 'winningOutcome must be 1 (UP) or 2 (DOWN)' });
    return;
  }

  const result = await adminResolveMarket(marketId, winningOutcome, tokenType);
  if (result.txId) {
    res.json({
      status: 'ok',
      txId: result.txId,
      replacementTxId: result.replacementTxId || null,
      message: result.replacementTxId
        ? 'Market resolved. Replacement market creating — rounds will resume after indexing.'
        : 'Market resolved. Winners can claim 1:1. Create a new market manually if needed.',
    });
  } else {
    res.status(500).json({ status: 'error', message: result.error || 'Resolution failed' });
  }
});

// POST /admin/create-replacement — Create a replacement lightning market after wallet-based resolve
// Body: { marketId: string, tokenType?: 'ALEO'|'USDCX'|'USAD' }
router.post('/admin/create-replacement', async (req, res) => {
  const { marketId, tokenType } = req.body;

  if (!marketId || typeof marketId !== 'string') {
    res.status(400).json({ status: 'error', message: 'marketId required' });
    return;
  }

  const validTokenTypes = ['ALEO', 'USDCX', 'USAD'];
  const token = validTokenTypes.includes(tokenType) ? tokenType : 'ALEO';

  const txId = await adminCreateReplacement(marketId, token);
  if (txId) {
    res.json({ status: 'ok', txId, message: 'Replacement market creating — rounds will resume after indexing.' });
  } else {
    res.json({ status: 'ok', txId: null, message: 'Replacement not created (no resolver key or asset not found). Create manually.' });
  }
});

export default router;
