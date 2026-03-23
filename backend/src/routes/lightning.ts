import { Router } from 'express';
import { getLightningRounds } from '../services/oracle';
import { getActiveLightningRounds, settleLightningRounds } from '../services/lightning-manager';

const router = Router();

router.get('/', (_req, res) => {
  const rounds = getLightningRounds();
  res.json({ rounds });
});

router.get('/active', (_req, res) => {
  const activeRounds = getActiveLightningRounds();
  res.json({ activeRounds });
});

// Manual trigger for on-chain settlement (WASM proving is heavy, don't run on cron)
router.post('/settle', async (_req, res) => {
  try {
    await settleLightningRounds();
    res.json({ status: 'ok', message: 'Settlement triggered' });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err?.message || 'Settlement failed' });
  }
});

export default router;
