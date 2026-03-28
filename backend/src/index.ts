import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { config } from './config';
import { fetchOraclePrices, recordPriceSnapshot } from './services/oracle';
import { fetchMarketsFromChain, setCachedMarkets, clearAllLightningFlags } from './services/indexer';
import { resolveExpiredMarkets } from './services/resolver';
import { scanForNewMarkets } from './services/scanner';
import { autoResolveMarkets } from './services/auto-resolver';
import { initSeedLightningRounds } from './services/lightning-manager';
import { warmupWorker } from './services/proof-dispatcher';
import { startRoundBot } from './services/round-bot';
import marketsRouter from './routes/markets';
import oracleRouter from './routes/oracle';
import statsRouter from './routes/stats';
import healthRouter from './routes/health';
import lightningRouter from './routes/lightning';
import governanceRouter from './routes/governance';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/oracle', oracleRouter);
app.use('/api/stats', statsRouter);
app.use('/api/lightning', lightningRouter);
app.use('/api/governance', governanceRouter);

// Initialize data
async function initialize() {
  console.log('[Init] Fetching initial data...');

  // Clear stale lightning flags BEFORE fetching markets so old orphaned
  // rounds don't leak into the cache or get re-seeded.
  const cleared = clearAllLightningFlags();
  if (cleared > 0) console.log(`[Init] Cleared ${cleared} orphaned lightning flags`);

  const [markets] = await Promise.all([
    fetchMarketsFromChain(),
    fetchOraclePrices(),
  ]);
  setCachedMarkets(markets);
  recordPriceSnapshot();
  initSeedLightningRounds();
  warmupWorker(); // Pre-initialize SDK in worker thread

  // Start automated round bot (delegated proving required)
  startRoundBot().catch((err) => {
    console.error('[Init] Round bot failed to start:', err);
  });
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
});

cron.schedule(`*/${config.resolverIntervalMinutes} * * * *`, async () => {
  await resolveExpiredMarkets();
});

// Refresh market data from chain every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    const markets = await fetchMarketsFromChain();
    setCachedMarkets(markets);
    console.log(`[Cron] Refreshed ${markets.length} markets from chain`);
  } catch (err) {
    console.error('[Cron] Market refresh failed:', err);
  }
});

// Scan blockchain for new create_market transactions every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    const found = await scanForNewMarkets(300);
    if (found > 0) {
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

// Start server
initialize().then(() => {
  app.listen(config.port, () => {
    console.log(`[Server] Veil Strike backend running on port ${config.port}`);
    console.log(`[Server] Oracle interval: ${config.oracleIntervalMinutes}m`);
    console.log(`[Server] Resolver interval: ${config.resolverIntervalMinutes}m`);
  });
});
