import { Router } from 'express';
import { getLightningRounds } from '../services/oracle';
import { getActiveLightningRounds } from '../services/lightning-manager';

const router = Router();

router.get('/', (_req, res) => {
  const rounds = getLightningRounds();
  res.json({ rounds });
});

router.get('/active', (_req, res) => {
  const activeRounds = getActiveLightningRounds();
  res.json({ activeRounds });
});

export default router;
