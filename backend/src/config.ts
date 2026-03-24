const parseCorsOrigin = (origin?: string): string | string[] => {
  if (!origin) return 'http://localhost:5173';
  if (origin.includes(',')) return origin.split(',').map(o => o.trim());
  return origin;
};

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  aleoEndpoint: process.env.ALEO_ENDPOINT || 'https://api.explorer.provable.com/v1',
  programId: 'veil_strike_v6.aleo',
  programIdCx: 'veil_strike_v6_cx.aleo',
  programIdSd: 'veil_strike_v6_sd.aleo',
  allProgramIds: ['veil_strike_v6.aleo', 'veil_strike_v6_cx.aleo', 'veil_strike_v6_sd.aleo'] as const,
  coingeckoUrl: 'https://api.coingecko.com/api/v3',
  oracleIntervalMinutes: 1,
  resolverIntervalMinutes: 5,
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
};
