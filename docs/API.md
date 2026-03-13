# API Documentation

## Base URL

```
http://localhost:3001/api
```

## Endpoints

### Health Check

```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1705000000000,
  "version": "1.0.0",
  "program": "veil_strike_v2.aleo"
}
```

---

### Markets

#### List All Markets

```
GET /api/markets
```

**Response:**
```json
{
  "markets": [
    {
      "id": "1",
      "question": "Will Bitcoin reach $150k by June 2025?",
      "category": "crypto",
      "outcomes": ["Yes", "No"],
      "reserves": [70000000, 30000000],
      "totalLiquidity": 100000000,
      "totalVolume": 450000000,
      "tradeCount": 234,
      "status": "active",
      "endTime": 1720000000000,
      "createdAt": 1705000000000,
      "isLightning": false
    }
  ]
}
```

#### Get Market by ID

```
GET /api/markets/:id
```

**Response:**
```json
{
  "market": { ... }
}
```

**Error (404):**
```json
{
  "error": "Market not found"
}
```

#### Refresh Markets

```
POST /api/markets/refresh
```

Re-fetches market data from the Aleo blockchain.

**Response:**
```json
{
  "markets": [...],
  "refreshed": true
}
```

---

### Oracle

#### Get Current Prices

```
GET /api/oracle
```

**Response:**
```json
{
  "prices": {
    "btc": 97500.00,
    "eth": 3450.00,
    "aleo": 0.85,
    "timestamp": 1705000000000
  }
}
```

#### Force Price Refresh

```
POST /api/oracle/refresh
```

**Response:**
```json
{
  "prices": { ... },
  "refreshed": true
}
```

---

### Protocol Stats

```
GET /api/stats
```

**Response:**
```json
{
  "stats": {
    "totalMarkets": 47,
    "activeMarkets": 23,
    "resolvedMarkets": 24,
    "totalVolume": 1250000000,
    "totalLiquidity": 340000000,
    "totalTrades": 3456,
    "uniqueTraders": 289,
    "protocolFees": 12500000
  }
}
```

## Data Formats

### Amounts

All amounts are in **micro-credits** (1 ALEO = 1,000,000 micro-credits).

Example: `5000000` = 5 ALEO

### Timestamps

All timestamps are in **milliseconds since Unix epoch**.

### Market Status

- `active` — Market is open for trading
- `closed` — Trading has stopped, awaiting resolution
- `resolved` — Winning outcome determined
- `disputed` — Resolution is being challenged

### Categories

`crypto`, `defi`, `politics`, `sports`, `entertainment`, `science`, `other`
