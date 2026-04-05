const parseCorsOrigin = (origin?: string): string | string[] => {
  if (!origin) return 'http://localhost:5173';
  if (origin.includes(',')) return origin.split(',').map(o => o.trim());
  return origin;
};

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  aleoEndpoint: process.env.ALEO_ENDPOINT || 'https://api.explorer.provable.com/v1',
  programId: 'veil_strike_v7.aleo',
  programIdCx: 'veil_strike_v7_cx.aleo',
  programIdSd: 'veil_strike_v7_sd.aleo',
  allProgramIds: ['veil_strike_v7.aleo', 'veil_strike_v7_cx.aleo', 'veil_strike_v7_sd.aleo'] as const,
  coingeckoUrl: 'https://api.coingecko.com/api/v3',
  oracleIntervalMinutes: 1,
  resolverIntervalMinutes: 5,
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  // Provable delegated proving
  provableApiKey: process.env.PROVABLE_API_KEY || '',
  provableConsumerId: process.env.PROVABLE_CONSUMER_ID || '',
  // Round bot
  roundDurationMinutes: parseInt(process.env.ROUND_DURATION_MINUTES || '15', 10),
  roundBotEnabled: process.env.ROUND_BOT_ENABLED !== 'false',
  roundInitialLiquidity: parseInt(process.env.ROUND_INITIAL_LIQUIDITY || '1000000', 10), // 1 token in microcredits
};
