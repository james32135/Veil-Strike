# VEIL STRIKE — Automated Strike Rounds System

Complete technical reference for the auto-round system: architecture, setup, code flow, debugging, and testing.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites & Setup](#prerequisites--setup)
4. [Environment Variables](#environment-variables)
5. [Core Components](#core-components)
6. [Round Lifecycle](#round-lifecycle)
7. [Delegated Proving (DPS)](#delegated-proving-dps)
8. [On-Chain Contract](#on-chain-contract)
9. [Market Registration & Discovery](#market-registration--discovery)
10. [Block Time & Deadline Calculation](#block-time--deadline-calculation)
11. [Settlement Flow](#settlement-flow)
12. [Frontend Integration](#frontend-integration)
13. [API Endpoints](#api-endpoints)
14. [State Persistence](#state-persistence)
15. [Startup Cleanup](#startup-cleanup)
16. [Known Limitations](#known-limitations)
17. [Debugging Guide](#debugging-guide)
18. [Testing](#testing)
19. [File Reference](#file-reference)
20. [Lessons Learned](#lessons-learned)

---

## Overview

Strike Rounds are automated 15-minute prediction markets on asset prices (BTC, ETH, ALEO). A backend bot creates markets on the Aleo blockchain, waits for the round to expire, compares start/end prices, and settles the market (UP or DOWN). Users bet during the round window using the frontend Rounds page.

Key facts:
- **3 active slots**: BTC-ALEO, ETH-ALEO, ALEO-ALEO
- **15-minute rounds** with automatic creation → settlement → next round
- **Delegated proving** via Provable API (ZK proofs generated remotely in ~15-30s)
- **On-chain settlement** via `flash_settle` for ALL markets (including empty ones)
- **Program**: `veil_strike_v6.aleo` on Aleo testnet

---

## Architecture

```
┌──────────────┐    Provable DPS     ┌──────────────────┐
│  Round Bot   │ ──── prove+broadcast ──→ │  Aleo Testnet    │
│  (round-bot) │                      │  (on-chain state) │
│              │ ←── tx confirmed ─── │                    │
└──────┬───────┘                      └────────┬───────────┘
       │                                       │
       │ registers market                      │ scanner polls
       ▼                                       ▼
┌──────────────┐                      ┌──────────────────┐
│   Indexer    │ ←─── discovers ───── │    Scanner       │
│ (market meta)│                      │ (chain polling)  │
└──────┬───────┘                      └──────────────────┘
       │
       │ serves via API
       ▼
┌──────────────────────────────────────┐
│           Express Backend            │
│  /api/lightning/bot/status           │
│  /api/lightning/bot/rounds           │
│  /api/markets (includes lightning)   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│         React Frontend               │
│  Rounds.tsx → ActiveRounds.tsx       │
│  (countdown, bet, claim)             │
└──────────────────────────────────────┘
```

---

## Prerequisites & Setup

### 1. Register with Provable API

```bash
curl -X POST https://api.provable.com/consumers \
  -H "Content-Type: application/json" \
  -d '{"username":"veil-strike"}'
```

Response:
```json
{
  "id": "CONSUMER_ID",
  "key": "API_KEY"
}
```

### 2. Resolver Private Key

The resolver wallet must:
- Be the `resolver` address set when creating markets
- Have some public ALEO balance (for transaction authorization; DPS pays actual fees with `useFeeMaster: true`)
- Be set as `RESOLVER_PRIVATE_KEY` in `.env`

Our resolver address: `aleo19za49scmhufst9q8lhwka5hmkvzx5ersrue3gjwcs705542daursptmx0r`

### 3. Install Dependencies

```bash
cd backend
npm install
```

Required package: `@provablehq/sdk` (ESM, lazy-loaded)

### 4. Configure .env

See [Environment Variables](#environment-variables) below.

### 5. Start Backend

```bash
cd backend
npm run dev
```

The round bot starts automatically if `ROUND_BOT_ENABLED=true`.

---

## Environment Variables

File: `backend/.env`

```env
PORT=3001
ALEO_ENDPOINT=https://api.explorer.provable.com/v1
CORS_ORIGIN=http://localhost:5173
RESOLVER_PRIVATE_KEY=APrivateKey1zkp...

# Provable delegated proving API
PROVABLE_API_KEY=8TfQNB0Hg3QmRt1VGV4TEXtJZXfplAY5
PROVABLE_CONSUMER_ID=1cb092fd-2004-4592-b8f1-338ab62d1727

# Round bot settings
ROUND_BOT_ENABLED=true
ROUND_DURATION_MINUTES=15
ROUND_INITIAL_LIQUIDITY=1000000
```

| Variable | Purpose |
|----------|---------|
| `PROVABLE_API_KEY` | Auth key from Provable consumer registration |
| `PROVABLE_CONSUMER_ID` | Consumer ID from Provable registration |
| `RESOLVER_PRIVATE_KEY` | Private key of the resolver/admin wallet |
| `ROUND_BOT_ENABLED` | `true` to auto-start bot on server boot |
| `ROUND_DURATION_MINUTES` | Round length (default: 15) |
| `ROUND_INITIAL_LIQUIDITY` | Microcredits seeded into AMM pool (default: 1000000 = 1 ALEO) |

---

## Core Components

### 1. Round Bot (`backend/src/services/round-bot.ts`)

The main state machine. Manages 3 market slots, each cycling through:
`IDLE → CREATING → OPEN → SETTLING → COOLDOWN → IDLE`

- **Tick interval**: 15 seconds
- **Cooldown**: 30 seconds after settlement before creating next round
- **TX confirmation timeout**: 2 minutes
- **State persisted** to `backend/data/round-bot-state.json`
- **Recovery**: ALL non-idle slots reset to idle on restart (prevents stuck bot)
- **Settle retry limit**: Max 3 attempts per round before skipping
- **`settleRetries`** field on MarketSlot tracks consecutive failures

### 2. Delegated Prover (`backend/src/services/delegated-prover.ts`)

Handles ZK proof generation via Provable's remote proving service.

- URL: `https://api.provable.com/prove/testnet`
- `useFeeMaster: true` — Provable pays the on-chain fee
- Authorization built locally (~1s), proving done remotely (~15-30s)
- Exposes: `delegatedCreateMarket()`, `delegatedSettle()`, `delegatedExecute()`

### 3. Indexer (`backend/src/services/indexer.ts`)

Maintains the market registry with metadata not stored on-chain (question text, outcomes, `isLightning` flag, `botEndTime`).

- **MarketMeta**: `{ questionHash, question, outcomes, isLightning, tokenType?, botEndTime? }`
- `botEndTime`: wall-clock millisecond timestamp, used for accurate countdown
- `clearAllLightningFlags()`: resets `isLightning=false` on all markets (called at bot startup)
- Persists to `backend/data/dynamic-markets.json`

### 4. Scanner (`backend/src/services/scanner.ts`)

Polls the chain for new transactions, discovers markets created by the bot.

- **Pending meta system**: `savePendingMeta(questionHash, meta)` → scanner tags discovered markets as lightning
- `deletePendingMeta(questionHash)`: called after bot extracts market_id from tx response
- Auto-cleans entries older than 24 hours

### 5. Oracle (`backend/src/services/oracle.ts`)

Fetches live asset prices from CoinGecko for BTC, ETH, ALEO. The round bot uses these to determine UP/DOWN outcome at settlement.

---

## Round Lifecycle

### Phase 1: Market Creation (`createMarketForSlot`)

```
1. Generate question hash: "BTC Strike Round #N" → deterministic field element
2. Generate random nonce
3. Fetch current block height
4. Calculate on-chain deadline: currentBlock + ceil(15*60/5) + 30 = currentBlock + 210
5. Save pending meta (so scanner knows this is a lightning market)
6. Call delegatedCreateMarket() via Provable DPS
7. Extract real market_id from DPS transaction response
8. Register market in indexer with botEndTime = Date.now() + 15*60*1000
9. Delete pending meta (prevent scanner from re-tagging old markets)
10. Wait for TX confirmation (poll every 10s, timeout 2min)
11. Record start price from oracle
12. Set slot state → OPEN
```

### Phase 2: Round Open

- Slot state: `open`
- Users bet via frontend (acquire_shares on-chain)
- Bot checks every 15s if `Date.now() >= slot.endTime`
- No bot action needed during this phase

### Phase 3: Settlement (`settleSlot`)

```
1. Fetch on-chain pool volume (amm_pools mapping)
2. Get current asset price from oracle
3. Determine outcome: endPrice >= startPrice → UP (1), else DOWN (2)
4. Call delegatedSettle(marketId, outcome) → flash_settle on-chain
5. Track: empty markets → totalRoundsSkipped, otherwise → totalRoundsSettled
6. Enter COOLDOWN (30s)
7. After cooldown: increment roundNumber, reset to IDLE → creates next market
```

**Critical**: ALL markets get `flash_settle` on-chain, even empty ones (zero bets). This ensures the on-chain status moves to `RESOLVED` and the frontend doesn't show stuck "AWAITING RESOLVE" state.

**Settle Retry Limit**: If `flash_settle` fails 3 times in a row (e.g., market already resolved from a previous run), the bot gives up on that round, increments `totalRoundsSkipped`, and moves to cooldown → creates the next round. This prevents the bot from getting permanently stuck. The `settleRetries` counter resets on success or after skipping.

### Phase 4: Cooldown

- 30 seconds pause between settlement confirmation and next market creation
- Prevents rapid-fire transactions that might conflict

### Phase 5: Restart Recovery

On backend restart, the bot loads state from disk and **intelligently recovers**:

```typescript
for (const slot of botState.slots) {
  if (slot.state === 'open' && slot.marketId && slot.endTime > Date.now()) {
    // Round still live — re-register and keep going
    registerMarket(slot.marketId, { ...meta, isLightning: true, botEndTime: slot.endTime });
  } else if (slot.state !== 'idle') {
    slot.state = 'idle';
    slot.marketId = null;
    slot.txId = null;
    slot.error = null;
    slot.settleRetries = 0;
    slot.roundNumber++;  // Skip the stale round
  }
}
```

**Why?** Live rounds shouldn't be abandoned — they'd become orphaned markets on-chain. Expired/transient slots need reset to prevent stuck `tickBusy=true` loops.

---

## Delegated Proving (DPS)

### How It Works

1. **Local authorization** (~1s): `pm.provingRequest()` builds the execution authorization using the private key
2. **Remote proving** (~15-30s): Sent to `https://api.provable.com/prove/testnet` where Provable generates the ZK proof
3. **Broadcast**: Provable broadcasts the proven transaction to Aleo testnet

### Key Configuration

```typescript
const provingRequest = await pm.provingRequest({
  programName: programId,
  functionName,
  inputs,
  priorityFee: 10_000,    // 0.01 ALEO
  privateFee: false,       // Public fee
  useFeeMaster: true,      // DPS pays the fee (critical!)
  broadcast: true,         // DPS broadcasts after proving
});

const result = await networkClient.submitProvingRequestSafe({
  provingRequest,
  url: 'https://api.provable.com/prove/testnet',  // Must be explicit
  apiKey: config.provableApiKey,
  consumerId: config.provableConsumerId,
});
```

### Why `useFeeMaster: true`?

Without it, the resolver wallet needs enough ALEO balance to cover the fee. With `useFeeMaster: true`, Provable's fee master account pays the on-chain fee. This avoids "Fee verification failed: insufficient balance" errors.

### Why explicit `url`?

The SDK's `submitProvingRequestSafe` defaults to the explorer API URL (`api.explorer.provable.com`) which returns 404 for proving requests. The DPS URL `https://api.provable.com/prove/testnet` must be set explicitly.

---

## On-Chain Contract

Program: `veil_strike_v6.aleo`

### Key Transitions Used by Bot

| Transition | Purpose | Inputs |
|------------|---------|--------|
| `open_market` | Create a new market | questionHash, category, numOutcomes, deadline, resolutionDeadline, resolver, initialLiquidity, nonce |
| `flash_settle` | Instantly resolve a market | marketId, winningOutcome (1=UP, 2=DOWN) |
| `acquire_shares` | User buys shares (bet) | marketId, outcome, amountIn, expectedShares, minSharesOut |
| `harvest_winnings` | Winner claims payout | marketId, ShareToken record |
| `dispose_shares` | Sell shares before resolution | marketId, ShareToken record, minAmountOut |

### `flash_settle` Contract Logic

```leo
async function flash_settle_finalize(market_id: field, winning_outcome: u8, caller: address) {
    let market: Market = markets.get(market_id);
    assert(market.resolver == caller);                    // Only resolver can settle
    let is_active: bool = market.status == STATUS_ACTIVE;
    let is_closed: bool = market.status == STATUS_CLOSED;
    assert(is_active || is_closed);                       // Must be active or closed
    assert(winning_outcome >= 1u8 && winning_outcome <= market.num_outcomes);
    // ... sets status to RESOLVED, records resolution
}
```

### `acquire_shares` Deadline Check

```leo
let current_height: u32 = block.height;
assert(current_height <= market.deadline);  // Bets REJECTED after deadline block
```

This means bets submitted near the end of a round may be rejected if the transaction is included in a block after the on-chain deadline. This is expected behavior.

---

## Market Registration & Discovery

### Problem Solved

When the bot creates a market via DPS, the transaction ID is not the market_id. The market_id is assigned on-chain by the contract (derived from `question_hash`). The frontend needs the real market_id to display and bet on the market.

### Solution: `extractMarketIdFromTx()`

Parses the DPS transaction response to extract the real market_id from the `open_market` transition's future output:

```typescript
function extractMarketIdFromTx(transaction: any): string | null {
  const transitions = transaction?.execution?.transitions || [];
  for (const t of transitions) {
    if (t.function !== 'open_market') continue;
    for (const output of t.outputs || []) {
      if (output.type !== 'future') continue;
      // Parse future value → extract first field argument (market_id)
      // ...
    }
  }
  return null;
}
```

### Pending Meta System

Backup for when `extractMarketIdFromTx` fails:

1. Before creating tx: `savePendingMeta(questionHash, { question, outcomes, isLightning: true })`
2. Scanner discovers the market on-chain → matches `questionHash` → tags it with pending meta
3. After extracting market_id: `deletePendingMeta(questionHash)` — prevents scanner from re-tagging old markets with the same questionHash pattern

---

## Block Time & Deadline Calculation

### The Problem

Aleo testnet block time is ~4-5 seconds, NOT 15 seconds. Using wrong block time causes:
- Deadline too far in future (173 days instead of 15 minutes)
- Deadline arriving too early (4 min instead of 15 min)

### The Fix

```typescript
const ACTUAL_BLOCK_TIME_S = 5;  // Aleo testnet: ~4-5s per block
const roundBlocks = Math.ceil(config.roundDurationMinutes * 60 / ACTUAL_BLOCK_TIME_S) + 30;
// For 15 min: ceil(900/5) + 30 = 180 + 30 = 210 blocks
const deadline = currentBlock + roundBlocks;
```

At 5s/block, 210 blocks ≈ 17.5 minutes (15 min + 2.5 min buffer).

### botEndTime (Wall-Clock Timestamp)

The on-chain deadline is in block height, but converting blocks → wall-clock time is unreliable because block times vary. Solution: store a wall-clock timestamp when the market is created.

```typescript
// In round-bot.ts (creation):
registerMarket(marketId, { ..., botEndTime: Date.now() + ROUND_DURATION_MS });

// In indexer.ts (serving to frontend):
endTime: meta.botEndTime || blockHeightToTimestamp(market.deadline, currentBlock)
```

The frontend uses `endTime` (milliseconds) directly for its countdown timer. No block→time conversion on the frontend.

---

## Settlement Flow

### All Markets Get `flash_settle`

Previous approach had "virtual reset" for empty markets (zero bets) — just reset the timer without on-chain settlement. This caused empty markets to stay `ACTIVE` on-chain, and the frontend showed "AWAITING RESOLVE" indefinitely.

**Current approach**: Every expired market gets `flash_settle` on-chain, regardless of volume:

```typescript
// In settleSlot():
const volume = await fetchPoolVolume(slot.marketId, slot.tokenType);
const isEmpty = volume === 0;

// Always settle on-chain
const result = await delegatedSettle(slot.marketId, winningOutcome, ...);

if (result.success) {
  if (isEmpty) botState.totalRoundsSkipped++;   // Track as "skipped"
  else botState.totalRoundsSettled++;            // Track as "settled"
  // → cooldown → next round
}
```

### Settlement Cost

Each `flash_settle` takes ~15-30s of DPS proving time. With `useFeeMaster: true`, there's no ALEO cost to the resolver. The only cost is DPS API usage quota.

---

## Frontend Integration

### Rounds Page (`frontend/src/pages/Rounds.tsx`)

- Displays active Strike Round markets from `/api/markets` (filtered by `isLightning: true`)
- Shows countdown timer using `market.endTime` (wall-clock ms)
- Bet placement calls `acquire_shares` on-chain
- After round resolves, checks `market.resolvedOutcome` to mark bets as WON/LOST

### ActiveRounds Component (`frontend/src/components/lightning/ActiveRounds.tsx`)

- Filters: `allMarkets.filter(m => m.isLightning && m.question.toLowerCase().includes('strike round'))`
- State display:
  - `secondsLeft > 0` → countdown timer
  - `secondsLeft === 0 && status === 'active'` → "AWAITING RESOLVE"
  - `status === 'resolved'` → shows outcome (UP/DOWN)
- Auto-refreshes markets and share records every 30 seconds

### Bet Resolution in Rounds.tsx

Bets are resolved by matching the bet's market ID against the resolved market:

```typescript
const market = markets.find(m =>
  m.id === (bet.roundId || bet.marketId) ||
  m.id === bet.marketId
);
if (market?.resolvedOutcome) {
  const won = bet.outcome.toLowerCase() === market.resolvedOutcome.toLowerCase();
  // Display WON or LOST accordingly
}
```

### Stale Bet Auto-Expiry

PENDING bets older than 30 minutes (2x round duration) are automatically expired as LOST. This handles edge cases where a market was never settled (bot crash, restart, etc.):

```typescript
// In lightningBetStore.ts — only calls set() when there are actual stale bets:
expireStaleBets: (maxAgeMs) => {
  const cutoff = Date.now() - maxAgeMs;
  const hasStale = get().bets.some((b) => !b.result && b.timestamp <= cutoff);
  if (!hasStale) return;  // CRITICAL: skip set() if nothing to expire
  set((state) => ({
    bets: state.bets.map((b) => {
      if (b.result || b.timestamp > cutoff) return b;
      return { ...b, result: 'down', won: false, payout: 0, endPrice: b.startPrice };
    }),
  }));
},

// Called in Rounds.tsx in a SEPARATE mount-only useEffect (not in the bets effect):
useEffect(() => {
  expireStaleBets(30 * 60 * 1000);
}, []); // eslint-disable-line
```

**CRITICAL**: `expireStaleBets` must NOT be called inside a `useEffect` that depends on `bets`. Zustand's `set()` with `.map()` always creates a new array reference, which re-triggers the effect → infinite loop → React crash (`Maximum update depth exceeded`). The fix is twofold:
1. Only call `set()` when there are actually stale bets (`hasStale` check)
2. Run expiry in a separate mount-only `useEffect(() => {...}, [])`

---

## API Endpoints

### Lightning Routes (`/api/lightning/...`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/bot/status` | Full bot state (slots, stats, uptime) |
| GET | `/bot/rounds` | Active bot rounds (frontend format) |
| POST | `/bot/start` | Start the round bot |
| POST | `/bot/stop` | Stop the round bot |
| POST | `/bot/force-settle` | Force settle a slot `{ slotId, winningOutcome }` |
| POST | `/admin/resolve` | Admin resolve market `{ marketId, winningOutcome, tokenType? }` |
| POST | `/admin/create-replacement` | Create replacement market after manually resolving |
| GET | `/admin/markets` | List active lightning markets |

### Market Routes (`/api/markets`)

Markets with `isLightning: true` are Strike Round markets. The frontend filters these for the Rounds page.

---

## State Persistence

### `backend/data/round-bot-state.json`

Stores full bot state including all slot info, round numbers, and counters. Loaded on restart so the bot resumes where it left off.

```json
{
  "slots": [
    {
      "id": "BTC-ALEO",
      "asset": "BTC",
      "tokenType": "ALEO",
      "state": "open",
      "marketId": "123456field",
      "startPrice": 103500,
      "startTime": 1747123400000,
      "endTime": 1747124300000,
      "roundNumber": 5,
      "totalVolume": 0,
      "settleRetries": 0
    }
  ],
  "resolverAddress": "aleo19za49...",
  "totalRoundsCreated": 12,
  "totalRoundsSettled": 8,
  "totalRoundsSkipped": 4
}
```

### `backend/data/dynamic-markets.json`

Registry of all discovered/registered markets with metadata. Includes `isLightning`, `botEndTime`, question text, outcomes.

### Startup Recovery

On restart, the bot recovers slots intelligently:
- **OPEN slots with valid marketId + time remaining** → kept open, re-registered with indexer (prevents orphaning live markets)
- **Everything else** (expired `open`, `creating`, `settling`, `cooldown`) → reset to `idle` with `roundNumber++`

```typescript
for (const slot of botState.slots) {
  if (slot.state === 'open' && slot.marketId && slot.endTime > Date.now()) {
    // Round still live — re-register and keep going
    registerMarket(slot.marketId, { ...meta, isLightning: true, botEndTime: slot.endTime });
  } else if (slot.state !== 'idle') {
    slot.state = 'idle';
    slot.roundNumber++;
  }
}
```

This prevents two problems:
1. **Orphaned markets** — if bot restarts while rounds are live, it doesn't create duplicates
2. **Stuck bot** — expired/transient slots are reset to idle so new markets are created

---

## Startup Cleanup

### `clearAllLightningFlags()`

Called at bot startup. Sets `isLightning = false` on ALL existing markets in the registry. This prevents orphaned Strike Round markets from previous bot runs from appearing on the Rounds page.

```typescript
export function clearAllLightningFlags(): number {
  let count = 0;
  for (const meta of Object.values(MARKET_REGISTRY)) {
    if (meta.isLightning) { meta.isLightning = false; count++; }
  }
  if (count > 0) persistRegistry();
  return count;
}
```

The bot then creates fresh markets, which get registered with `isLightning: true` and a new `botEndTime`.

### `deletePendingMeta()`

After the bot extracts the real market_id from the DPS transaction response, it deletes the pending meta for that `questionHash`. This prevents the scanner from later tagging a different (older) market with the same hash as a lightning market.

---

## Known Limitations

### 1. CX/SD Stablecoin Slots Disabled

The `veil_strike_v6_cx.aleo` and `veil_strike_v6_sd.aleo` contracts require private Token records + MerkleProofs as the 9th and 10th inputs to `open_market`. These cannot be constructed via the current delegated proving flow. Only the base `veil_strike_v6.aleo` (ALEO-denominated) works.

### 2. Bets Near Deadline May Be Rejected

The contract enforces `assert(current_height <= market.deadline)` in `acquire_shares_finalize`. If a user submits a bet close to the round end, the transaction may be included in a block after the deadline, causing on-chain rejection. This is correct behavior — the bot can't control block inclusion timing.

### 3. Block Time Variability

Aleo testnet block time ranges from ~3s to ~6s. We use `ACTUAL_BLOCK_TIME_S = 5` which gives a 210-block deadline for 15-min rounds (~17.5 min at 5s/block). The `botEndTime` wall-clock timestamp ensures the frontend countdown is accurate regardless of actual block timing.

### 4. DPS Proving Latency

Each DPS call (create or settle) takes ~15-30 seconds. With 3 slots, a full round cycle involves:
- 3 create txns (~45-90s total)
- 3 settle txns (~45-90s total)
- Total overhead: ~2-3 min per round cycle

### 5. Scanner Polling Frequency

- Market refresh: every 5 minutes (cron `*/5`)
- Scanner (new tx detection): every 2 minutes (cron `*/2`)

This means a newly created market may take up to 5 minutes to appear in the `/api/markets` response. However, the bot registers markets directly with the indexer at creation time, so newly created lightning markets appear immediately.

---

## Debugging Guide

### Bot Not Creating New Markets After Restart

**Root cause**: Bot restored state with expired `open` slots → tried to settle stale markets → DPS calls failed + blocked all other slots (`tickBusy=true`).

**Fix applied**: Smart recovery: live rounds (open with time remaining) are kept and re-registered. Expired/transient slots are reset to `idle` with `roundNumber++`. Settle retry limit (max 3) prevents permanent stuck states.

**Symptoms**: No `[RoundBot] Creating...` logs after startup. Only oracle/scanner/indexer logs appear.

### Bot Not Starting

1. Check `ROUND_BOT_ENABLED=true` in `.env`
2. Check `PROVABLE_API_KEY` and `PROVABLE_CONSUMER_ID` are set
3. Check `RESOLVER_PRIVATE_KEY` is set
4. Look for `[RoundBot] Delegated proving not configured` in logs

### Markets Not Appearing on Rounds Page

1. Check backend logs for `[RoundBot] ... extracted market_id: ...`
2. Verify market registered with `isLightning: true` in `dynamic-markets.json`
3. Check frontend filter: market question must include "Strike Round"
4. Force refresh: restart backend (clears + re-registers)

### "AWAITING RESOLVE" Stuck

This should no longer happen after the virtual-reset removal. All markets get `flash_settle`. If it still occurs:
1. Check bot logs for settle errors
2. Use admin API: `POST /api/lightning/admin/resolve { marketId, winningOutcome: 1 }`
3. Check `flash_settle` requirements: market must be ACTIVE or CLOSED, caller must be resolver

### Bet Rejected on Chain

1. Check if on-chain deadline block has passed: query `markets` mapping for the market_id
2. Compare deadline block vs current block height
3. If `current_height > market.deadline`, rejection is expected
4. Increase deadline buffer (currently +30 blocks) if this happens frequently

### DPS 404 Error

The SDK defaults to the explorer API for proving. Must explicitly set URL:
```typescript
url: 'https://api.provable.com/prove/testnet'
```

### Fee Verification Failed

Enable `useFeeMaster: true` in the proving request so DPS pays the fee.

### 173-Day Countdown

Wrong deadline calculation. Check that `ACTUAL_BLOCK_TIME_S = 5` is used, not 15.

### Old Markets Polluting UI

1. Stop backend
2. Edit `backend/data/dynamic-markets.json`: Set `"isLightning": false` on stale entries
3. Delete `backend/data/round-bot-state.json` for a fresh start
4. Restart backend

---

## Testing

### 1. Test Delegated Proving Connectivity

```bash
cd backend
npx tsx scripts/test-delegated-proving.ts
```

Tests:
- API credential validation
- Proving request construction (~1s)
- Provable API connectivity (submits to DPS)
- Block height fetch
- Resolver account balance check

Expected output: Test 2 will fail with a "market not found" error (using fake market_id), but the API connectivity check passes.

### 2. Test Full Round Cycle

```bash
cd backend
npm run dev
```

Watch logs for:
```
[RoundBot] Started — 3 slots, 15min rounds
[RoundBot] Creating BTC-ALEO round #1: "BTC Strike Round #1"
[DelegatedProver] Building proving request: veil_strike_v6.aleo.open_market(...)
[DelegatedProver] Submitting to Provable for remote proving...
[DelegatedProver] Success: tx=at1... broadcast=Accepted (25000ms)
[RoundBot] BTC-ALEO extracted market_id: 12345...field
[RoundBot] BTC-ALEO round #1 OPEN. Start price: $103500
```

After 15 minutes:
```
[RoundBot] BTC-ALEO round #1 SETTLING. Start=$103500 End=$103800 → UP
[DelegatedProver] flash_settle market=12345...field outcome=1
[RoundBot] BTC-ALEO settled tx=at1... (18000ms)
```

### 3. Test Bet Placement (Frontend)

1. Open `http://localhost:5173/rounds`
2. Connect wallet (Leo Wallet / Puzzle Wallet)
3. Select a market (e.g., BTC Strike Round)
4. Choose UP or DOWN
5. Enter amount and submit
6. Wallet popup → approve transaction
7. After round resolves: WIN → "Claim" button appears; LOSE → marked as lost

### 4. Test Bot API

```bash
# Check bot status
curl http://localhost:3001/api/lightning/bot/status

# Check active rounds
curl http://localhost:3001/api/lightning/bot/rounds

# Force settle a slot (emergency)
curl -X POST http://localhost:3001/api/lightning/bot/force-settle \
  -H "Content-Type: application/json" \
  -d '{"slotId":"BTC-ALEO","winningOutcome":1}'

# Stop bot
curl -X POST http://localhost:3001/api/lightning/bot/stop

# Start bot
curl -X POST http://localhost:3001/api/lightning/bot/start
```

### 5. Test Settlement of Empty Markets

1. Start bot, wait for markets to be created
2. Do NOT place any bets
3. Wait for round to expire (15 min)
4. Watch logs: should show `EMPTY settled tx=...` (not virtual reset)
5. Verify frontend: market should move to RESOLVED, not stay as "AWAITING RESOLVE"

### 6. Verify On-Chain State

```bash
# Check market status on-chain
curl "https://api.explorer.provable.com/v1/testnet/program/veil_strike_v6.aleo/mapping/markets/MARKET_ID_FIELD"

# Check pool volume
curl "https://api.explorer.provable.com/v1/testnet/program/veil_strike_v6.aleo/mapping/amm_pools/MARKET_ID_FIELD"

# Check resolution
curl "https://api.explorer.provable.com/v1/testnet/program/veil_strike_v6.aleo/mapping/market_resolutions/MARKET_ID_FIELD"
```

---

## File Reference

| File | Purpose |
|------|---------|
| `backend/src/services/round-bot.ts` | Round bot state machine (main logic) |
| `backend/src/services/delegated-prover.ts` | Provable DPS integration |
| `backend/src/services/indexer.ts` | Market registry & metadata |
| `backend/src/services/scanner.ts` | Chain polling & pending meta |
| `backend/src/services/oracle.ts` | Price feeds (CoinGecko) |
| `backend/src/services/lightning-manager.ts` | Legacy lightning manager |
| `backend/src/services/auto-resolver.ts` | Auto-resolver (skips lightning markets) |
| `backend/src/routes/lightning.ts` | API routes for bot + admin |
| `backend/src/config.ts` | Environment config |
| `backend/src/index.ts` | Express server + cron jobs |
| `backend/scripts/test-delegated-proving.ts` | DPS connectivity test |
| `backend/data/round-bot-state.json` | Bot state persistence |
| `backend/data/dynamic-markets.json` | Market registry persistence |
| `backend/.env` | Environment variables |
| `frontend/src/pages/Rounds.tsx` | Rounds page (bet + claim UI) |
| `frontend/src/stores/lightningBetStore.ts` | Bet storage + expiry (zustand + localStorage) |
| `frontend/src/components/lightning/ActiveRounds.tsx` | Active rounds display component |
| `contract/veil_strike_v6/src/main.leo` | On-chain contract (17 transitions) |

---

## Lessons Learned

### 1. DPS URL Must Be Explicit
The `@provablehq/sdk` defaults `submitProvingRequestSafe` to the explorer API URL, which returns 404 for proving. Always pass `url: 'https://api.provable.com/prove/testnet'`.

### 2. `useFeeMaster: true` Is Required
Without it, the resolver wallet needs enough ALEO to cover the fee. DPS's fee master pays it for you.

### 3. Block Time Is ~5s on Testnet (Not 15s)
Using wrong block time makes deadlines arrive 3x too early or too late. Always verify actual block time empirically.

### 4. Wall-Clock `botEndTime` > Block-Height Conversion
Block times are unpredictable. Store the intended end time as a wall-clock timestamp and serve it directly to the frontend.

### 5. Virtual Reset Creates Ghost Markets
Not settling empty markets on-chain leaves them as ACTIVE forever. Always `flash_settle` every market.

### 6. Transaction ID ≠ Market ID
The DPS tx response ID is `at1...`, but the market's on-chain ID is a `field` value. Must parse the transaction's future output to extract the real market_id.

### 7. Scanner + Pending Meta Race Condition
Without `deletePendingMeta`, the scanner can tag old markets (same questionHash pattern) as new lightning markets. Always clean up pending meta after direct registration.

### 8. `clearAllLightningFlags()` at Startup
Previous bot runs leave orphaned `isLightning: true` entries in the registry. Clearing them on startup prevents stale markets from polluting the Rounds page.

### 9. Auto-Resolver Must Skip Lightning Markets
The auto-resolver tries to `lock_market` expired markets, which crashes for lightning markets (wrong flow). The guard `if (market.isLightning) continue;` prevents this.

### 10. Cron Frequency Matters
Polling 30+ markets every 1-2 minutes generates 60+ API calls per cycle. Reduced to 5-min refresh / 2-min scan to avoid rate limits.

### 11. Smart Recovery on Restart
Naively resetting ALL slots to idle on restart causes orphaned markets — live rounds get abandoned and new duplicates are created. Instead, check if open slots still have time left: if yes, re-register them and keep running. Only reset expired/transient slots.

### 12. Settle Retry Limit Prevents Deadlock
If `flash_settle` fails repeatedly (market already resolved, DPS timeout, etc.), the bot must eventually give up and move on. Without a retry limit, the bot is permanently stuck on that slot. Max 3 retries, then skip the round.

### 14. Zustand `set()` + `useEffect` = Infinite Loop
Calling a zustand action that uses `set()` inside a `useEffect` that depends on the store's state creates an infinite render loop. Even if no data changes, `.map()` creates a new array reference → triggers re-render → effect re-runs → `set()` again. Fix: (1) guard with an early-return check (`hasStale`), (2) move the call to a separate mount-only `useEffect`.
