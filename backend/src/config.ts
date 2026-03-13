export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  aleoEndpoint: process.env.ALEO_ENDPOINT || 'https://api.explorer.provable.com/v1',
  programId: 'veil_strike_v1.aleo',
  coingeckoUrl: 'https://api.coingecko.com/api/v3',
  oracleIntervalMinutes: 1,
  resolverIntervalMinutes: 5,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
