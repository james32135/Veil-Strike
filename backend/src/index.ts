import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { config } from './config';
import { fetchOraclePrices, recordPriceSnapshot } from './services/oracle';
import { fetchMarketsFromChain, setCachedMarkets } from './services/indexer';
import { resolveExpiredMarkets } from './services/resolver';
import { scanForNewMarkets } from './services/scanner';
import { autoResolveMarkets } from './services/auto-resolver';
import { settleLightningRounds, recordRoundPriceSnapshot, initSeedLightningRounds } from './services/lightning-manager';
import marketsRouter from './routes/markets';
import oracleRouter from './routes/oracle';
import statsRouter from './routes/stats';
import healthRouter from './routes/health';
import lightningRouter from './routes/lightning';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/oracle', oracleRouter);
app.use('/api/stats', statsRouter);
app.use('/api/lightning', lightningRouter);

// Initialize data
async function initialize() {
  console.log('[Init] Fetching initial data...');
  const [markets] = await Promise.all([
    fetchMarketsFromChain(),
    fetchOraclePrices(),
  ]);
  setCachedMarkets(markets);
  recordPriceSnapshot();
  initSeedLightningRounds();
  console.log(`[Init] Loaded ${markets.length} markets`);

  // Run initial block scan in background (non-blocking)
  scanForNewMarkets(500).then(found => {
    if (found > 0) {
      fetchMarketsFromChain().then(m => {
        setCachedMarkets(m);
        console.log(`[Init] Post-scan: ${m.length} markets`);
      });
    }
  }).catch(() => {});
}

// Cron jobs
cron.schedule(`*/${config.oracleIntervalMinutes} * * * *`, async () => {
  await fetchOraclePrices();
  recordPriceSnapshot();
  recordRoundPriceSnapshot();
});

cron.schedule(`*/${config.resolverIntervalMinutes} * * * *`, async () => {
  await resolveExpiredMarkets();
});

// Refresh market data from chain every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    const markets = await fetchMarketsFromChain();
    setCachedMarkets(markets);
    console.log(`[Cron] Refreshed ${markets.length} markets from chain`);
  } catch (err) {
    console.error('[Cron] Market refresh failed:', err);
  }
});

// Scan blockchain for new create_market transactions every 3 minutes
cron.schedule('*/3 * * * *', async () => {
  try {
    const found = await scanForNewMarkets(300);
    if (found > 0) {
      // Re-fetch after discovering new markets so they appear in the cache
      const markets = await fetchMarketsFromChain();
      setCachedMarkets(markets);
    }
  } catch (err) {
    console.error('[Cron] Market scan failed:', err);
  }
});

// Auto-resolve event markets (seal → judge → confirm_verdict) every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    await autoResolveMarkets();
  } catch (err) {
    console.error('[Cron] Auto-resolve failed:', err);
  }
});

// Lightning settlement disabled from cron — WASM proving blocks Node.js for minutes.
// Oracle-based rounds resolve bets in-memory. On-chain settlement via POST /api/lightning/settle
// cron.schedule('*/1 * * * *', async () => {
//   try { await settleLightningRounds(); } catch (err) { console.error('[Cron] Lightning settle failed:', err); }
// });

// Start server
initialize().then(() => {
  app.listen(config.port, () => {
    console.log(`[Server] Veil Strike backend running on port ${config.port}`);
    console.log(`[Server] Oracle interval: ${config.oracleIntervalMinutes}m`);
    console.log(`[Server] Resolver interval: ${config.resolverIntervalMinutes}m`);
  });
});
