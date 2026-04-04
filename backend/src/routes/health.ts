import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '7.0.0',
    program: 'veil_strike_v7.aleo',
    programs: {
      main: 'veil_strike_v7.aleo',
      usdcx: 'veil_strike_v7_cx.aleo',
      usad: 'veil_strike_v7_sd.aleo',
    },
  });
});

export default router;
