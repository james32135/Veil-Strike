import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '6.0.0',
    program: 'veil_strike_v6.aleo',
    programs: {
      main: 'veil_strike_v6.aleo',
      usdcx: 'veil_strike_v6_cx.aleo',
      usad: 'veil_strike_v6_sd.aleo',
    },
  });
});

export default router;
