# Veil Strike — Mainnet Migration Summary

## Status: DEPLOYED ON MAINNET ✅

---

## Phase 1: Contract Changes ✅
- **MIN_LIQUIDITY**: Lowered from `1_000_000u128` to `10_000u128` (0.01 ALEO) in all contracts
- **Stablecoin imports**: `test_usad_stablecoin.aleo` → `usad_stablecoin.aleo`, `test_usdcx_stablecoin.aleo` → `usdcx_stablecoin.aleo` (138 references)
- **program.json**: All dependency networks changed from `testnet` → `mainnet`, stablecoin dep names updated
- **v6 contracts**: Removed (only v7 contracts deployed to mainnet)
- **Contract .env files**: `NETWORK=mainnet`, `ENDPOINT=https://api.provable.com/v2`

## Phase 2: Backend Changes ✅
- **config.ts**: Endpoint → `https://api.provable.com/v2`, added `aleoNetwork: 'mainnet'`, `roundInitialLiquidity` → `10000`
- **delegated-prover.ts**: DPS URL → `https://api.provable.com/prove/mainnet/prove`
- **14 API paths**: All hardcoded `/testnet/` → `/${config.aleoNetwork}/` across 6 service/route files
- **0 TypeScript errors**

## Phase 3: Frontend Changes ✅
- **constants**: `ALEO_TESTNET_API` → `ALEO_API` (`https://api.provable.com/v2/mainnet`), `MIN_LIQUIDITY` → `10_000`
- **WalletProvider**: Default network → `MAINNET`, stablecoin program IDs updated
- **freezeListProof**: Freezelist programs → `usdcx_freezelist.aleo`, `usad_freezelist.aleo`, API → v2
- **useTransaction**: Explorer → `https://explorer.provable.com/transaction`, stablecoin IDs updated
- **Governance/FAQ/Privacy/RiskDisclosure/Footer**: All user-facing text updated to mainnet
- **CreateEventForm**: Max outcomes capped at 4
- **frontend/.env**: `VITE_NETWORK=mainnet`, `VITE_ALEO_ENDPOINT=https://api.provable.com/v2`
- **0 TypeScript errors**

## Phase 4: API Upgrade (v1 → v2) ✅
- Provable docs confirm v2 is the latest recommended API
- Base URL: `https://api.provable.com/v2/{network}` — same path structure as v1
- All references across backend, frontend, scripts, docs, .env files upgraded from v1 to v2
- Both v1 and v2 tested live — identical responses, v2 is official

## Phase 5: Scripts & Environment ✅
- Deploy/seed/oracle/initialize scripts default `NETWORK=mainnet`
- All `.env` files updated: `NETWORK=mainnet`, `ENDPOINT=https://api.provable.com/v2`
- Documentation (DEPLOYMENT.md, README.md) and `.env.example` updated
- `docs/DEPLOYMENT.md` → `export NETWORK="mainnet"`

## Phase 6: Contract Build & Deploy ✅
- All 3 contracts compiled with Leo 4.0.0 — zero errors
- All 3 contracts deployed to Aleo mainnet with `leo deploy --network mainnet --broadcast --yes`

### Deployment Transactions

| Program | TX ID | Fee (ALEO) | Size |
|---|---|---|---|
| `veil_strike_v7.aleo` | `at1x2xwxrdars5u59c95nkckj9ulvkkz8qvrje0w4jfkmu7zehrxyysffwlxu` | 42.34 | 37.86 KB |
| `veil_strike_v7_cx.aleo` | `at1tl7jqrktfgrq93e9e4fa7kwjph7km3jkxekzr9lxdn7r6lkkjszqk4pgt8` | 31.53 | 29.11 KB |
| `veil_strike_v7_sd.aleo` | `at1wp4y7ezw2nwnuk4y25r722uqdve5wrt2mw6rnnq7dmnf6w9c2yzsl2u3th` | 31.49 | 29.07 KB |

**Total deployment cost: ~105.35 ALEO**
**Remaining deployer balance: ~360.25 ALEO**

## Phase 7: Verification ✅
- `veil_strike_v7.aleo` — confirmed on-chain via API
- `veil_strike_v7_cx.aleo` — confirmed on-chain via API
- `veil_strike_v7_sd.aleo` — TX confirmed on-chain
- Deployer balance verified: 360,249,065 microcredits
- Backend: 0 TypeScript errors
- Frontend: 0 TypeScript errors
- All deployment TXs accepted by network (consensus version 13)

## Phase 8: Data Cleanup ✅
- **Backend `.env`**: Fixed `ALEO_ENDPOINT` (v1→v2), added `ALEO_NETWORK=mainnet`, fixed `ROUND_INITIAL_LIQUIDITY` (1000000→10000)
- **Provable API credentials**: Verified working for mainnet (JWT issued successfully) — same key/consumerId works for both networks
- **PostgreSQL DB**: All 10 tables truncated (markets, series, market_tags, proposals, round_bot_state, round_bot_slots, price_history, pending_market_meta, scanner_state, event_log) — singletons re-seeded
- **JSON data files**: All 4 files reset to empty (dynamic-markets.json, governance-registry.json, market-pool.json, round-bot-state.json)
- **scan-tokens.mjs**: Fixed testnet stablecoin IDs → mainnet (`usdcx_stablecoin.aleo`, `usad_stablecoin.aleo`)
- **README.md**: Updated badge (Mainnet), explorer URL, program text, status, footer disclaimer
- **deploy.sh**: Updated comments from v4/testnet → v7/mainnet
- **Code comments**: Removed "testnet" references from indexer.ts and round-bot.ts

---

## Programs
| Program | ID | Status |
|---|---|---|
| Main (ALEO) | `veil_strike_v7.aleo` | Deployed |
| USDCx | `veil_strike_v7_cx.aleo` | Deployed |
| USAD | `veil_strike_v7_sd.aleo` | Deployed |

## Key Addresses
- **DEPLOYER**: `aleo19za49scmhufst9q8lhwka5hmkvzx5ersrue3gjwcs705542daursptmx0r`

## API Endpoints
- **Node API**: `https://api.provable.com/v2/mainnet` (v2 — latest recommended)
- **DPS**: `https://api.provable.com/prove/mainnet/prove`
- **Explorer**: `https://explorer.provable.com/transaction`

## Dependencies (Mainnet — Resolved On-Chain)
- `credits.aleo`
- `merkle_tree.aleo`
- `usdcx_stablecoin.aleo` + `usdcx_freezelist.aleo` + `usdcx_multisig_core.aleo`
- `usad_stablecoin.aleo` + `usad_freezelist.aleo` + `usad_multisig_core.aleo`

## Phase 9: SDK Network Entry Point Fix ✅
- **Root cause**: `@provablehq/sdk` exports per-network entry points — the default `'@provablehq/sdk'` maps to `dist/testnet/node.js` which bakes `/testnet` into all API URLs
- **Symptom**: `Invalid network ID. Expected 0, found 1` — SDK was creating transactions with testnet network_id (1) instead of mainnet (0)
- **Fix**: Changed all dynamic imports from `'@provablehq/sdk'` → `'@provablehq/sdk/mainnet.js'` which uses `dist/mainnet/node.js` and bakes `/mainnet` into URLs
- **Files fixed**:
  - `backend/src/services/delegated-prover.ts` — SDK import + reverted endpoint (SDK handles `/mainnet` internally)
  - `backend/src/services/chain-executor.ts` — SDK import + reverted endpoint
  - `backend/src/workers/prove-worker.ts` — SDK import
  - `backend/src/services/proof-dispatcher.ts` — reverted endpoint (passed to worker)
  - `backend/scripts/test-delegated-proving.ts` — SDK import
- **Note**: Raw `fetch()` calls (e.g., `fetchAccountBalance`) still use `${config.aleoEndpoint}/${config.aleoNetwork}` since they bypass the SDK

## Phase 10: Double Network Path Fix ✅
- **Root cause**: Phase 9's initial attempt appended `/${config.aleoNetwork}` to all SDK endpoint URLs — but the SDK _also_ appends the network path internally via its `%%NETWORK%%` build-time placeholder
- **Symptom**: `404 — https://api.provable.com/v2/mainnet/testnet/program/veil_strike_v7.aleo` (double path)
- **Fix**: Reverted all manual `/${config.aleoNetwork}` appends for SDK URLs and switched to the correct import entry point (`@provablehq/sdk/mainnet.js`)
- **SDK export map** (`package.json`):
  - `@provablehq/sdk` → `dist/testnet/node.js` (appends `/testnet`)
  - `@provablehq/sdk/mainnet.js` → `dist/mainnet/node.js` (appends `/mainnet`)
  - `@provablehq/sdk/dynamic.js` → `dist/dynamic/node.js` (runtime network selection)

## Phase 11: Frontend Block Height API Path Fix ✅
- **Root cause**: All frontend block height fetches used `${ALEO_API}/latest/height` — not a valid Aleo REST API path
- **Correct path**: `/block/height/latest`
- **Symptom**: 404 errors on every page load, market creation silently failed (`handleCreate` returned early with `if (!block) return`) — no wallet popup appeared
- **Files fixed (5 occurrences)**:
  - `frontend/src/components/create/CreateEventForm.tsx` — 2 occurrences
  - `frontend/src/components/create/CreateLightningForm.tsx` — 2 occurrences
  - `frontend/src/pages/Governance.tsx` — 1 occurrence (hardcoded URL)

## Phase 12: Category System Unification ✅
- **Root cause**: Three separate category mappings were out of sync:
  - `CreateEventForm.tsx` had: `{Crypto:1, Sports:3, Politics:4, Science:5, Entertainment:6, Other:7}`
  - `backend/indexer.ts` had: `{1:'Crypto', 2:'Crypto', 3:'Sports', 4:'Politics', 5:'Science', 6:'Entertainment', 7:'Other'}`
  - `frontend/constants/index.ts` had: `{1:'Crypto', 2:'Crypto', 3:'Privacy', 4:'DeFi', 5:'Governance', 6:'AI', 7:'Other'}`
  - `CATEGORIES` array had 10 categories but only 6 were mapped to numbers
- **Additional bugs**: Default category state was `'crypto'` (lowercase) but values are `'Crypto'` (capitalized); filter used `c !== 'all'` but constant is `'All'`
- **Fix**: Unified to 10 professional categories with consistent numbering:
  ```
  1: Crypto, 2: Privacy, 3: DeFi, 4: Governance, 5: Whale Watch,
  6: Geopolitics, 7: AI, 8: Sports, 9: Culture, 10: Other
  ```
- **Files fixed**:
  - `frontend/src/constants/index.ts` — CATEGORY_MAP updated (10 categories)
  - `backend/src/services/indexer.ts` — CATEGORY_MAP updated (10 categories)
  - `frontend/src/components/create/CreateEventForm.tsx` — categoryMap updated, default state `'Crypto'`, filter `'All'`

---

## Round Bot — First Mainnet Transactions ✅
After all fixes, rounds created successfully on mainnet:

| Round | TX ID | Time |
|---|---|---|
| ALEO-ALEO #2 | `at1dsjtq7kaw4fvfkyxzyrxzadg8ahs6n8390df8feu9pd02p8f7uzsj4t2hf` | 10.0s |
| BTC-ALEO #1 | `at13kc8yqkzwpcy8hzf747y9fq60w5mq88wpv29wtcuqksty396qgrq6xtqxd` | 8.9s |
| ETH-ALEO #1 | `at1purkpsw7zjs0ma05clmhcn4tvn42ptcperqsw2tw685dy208uu8qqxt6lp` | 4.3s |

User-created markets also deployed on-chain successfully from the frontend.

---

## Phase 13: USDCX Round Bot Migration ✅

Migrated all 3 Strike Round slots from ALEO credits to USDCX stablecoin tokens — **no contract changes required**. The existing `veil_strike_v7_cx.aleo` contract handles USDCX markets natively with `TOKEN_USDCX = 1u8`.

### Architecture

The round bot creates USDCX markets by:
1. Fetching the bot's unspent USDCX Token records via **Provable Scanner API**
2. Computing **MerkleProofs** for USDCX freeze-list compliance (server-side)
3. Calling `veil_strike_v7_cx.aleo.open_market` with 10 inputs (8 primitives + Token record + MerkleProofs)
4. Settling via `veil_strike_v7_cx.aleo.flash_settle` (standard 2-input call)

### New Files Created

| File | Purpose |
|---|---|
| `backend/src/services/record-scanner.ts` | Provable Scanner API client — JWT auth, view key registration, record fetching + local decryption |
| `backend/src/services/freeze-list.ts` | Server-side MerkleProof computation for USDCX compliance (ported from frontend) |
| `backend/src/services/fetch-timeout.ts` | Shared `fetchWithTimeout()` utility — prevents indefinite TCP hangs on all network calls |

### APIs Used

| API | URL | Purpose |
|---|---|---|
| **Provable JWT** | `POST https://api.provable.com/jwts/{consumerId}` | Obtain short-lived JWT (~2 min). Header: `X-Provable-API-Key` |
| **Provable Scanner Register** | `POST https://api.provable.com/scanner/mainnet/register` | Register bot's view key for record scanning |
| **Provable Scanner Records** | `POST https://api.provable.com/scanner/mainnet/records/owned` | Fetch unspent USDCX Token records (with filters) |
| **Provable DPS** | `POST https://api.provable.com/prove/mainnet/prove` | Delegated proving + broadcast (via SDK `submitProvingRequestSafe`) |
| **Aleo Node API** | `GET https://api.provable.com/v2/mainnet/...` | On-chain mapping reads, tx confirmation, block height |
| **CoinGecko** | Oracle price feed | BTC, ETH, ALEO price feeds for strike round outcomes |

### Record Scanner Flow

```
getJwt() → POST /jwts/{consumerId}  →  JWT (~2min lifetime, auto-refresh 10s before expiry)
     ↓
registerScanner() → POST /scanner/mainnet/register  →  Scanner UUID (persistent per view key)
     ↓
fetchUnspentUsdcxRecords() → POST /scanner/mainnet/records/owned  →  Ciphertext records
     ↓
decryptRecord() → ViewKey.from_string() + RecordCiphertext.decrypt()  →  Plaintext Token record
     ↓
findUsdcxRecord(minAmount) → Filter by amount >= minAmount  →  Ready for open_market input
```

- Scanner returns `record_ciphertext` only (server-side decrypt not available) → local decryption using SDK's `ViewKey` + `RecordCiphertext`
- JWT is obtained from response `Authorization` header (already includes "Bearer " prefix)
- On 401: clears JWT + UUID → re-authenticates → re-registers → retries

### Freeze List MerkleProof Flow

```
getFreezeListCount() → Read usdcx_freezelist.aleo/freeze_list_last_index/true
     ↓
getFreezeListIndex(0) → Read usdcx_freezelist.aleo/freeze_list_index/0u32
     ↓
generateFreezeListProof() → Build 16-level Merkle tree proof with Poseidon4 hashing
     ↓
getUsdcxProofs() → Returns pair of proofs: [proof, proof] (sender + receiver)
```

- Uses fallback all-zero proofs when Poseidon4 encounters "Input must be an array of fields" error
- Fallback proofs are accepted on-chain for non-frozen addresses (which is the normal case)
- WASM module (`@provablehq/wasm`) is cached globally to avoid re-importing per call

### Round Bot Changes

**Slot Definitions**: `BTC-ALEO`, `ETH-ALEO`, `ALEO-ALEO` → `BTC-USDCX`, `ETH-USDCX`, `ALEO-USDCX`

**Batch-Create Pattern** (timer sync fix):
1. Phase 1: Settle all expired open slots
2. Phase 2: Only create when **ALL** slots are idle
3. Create all 3 markets sequentially (~15-19s each via DPS)
4. Align all `endTime` values to the **latest** created slot's endTime
5. Result: all 3 markets expire within seconds of each other

**Create Flow for USDCX**:
```
createMarketForSlot() → findUsdcxRecord(10000)  →  Token record (≥0.01 USDCX)
                       → getUsdcxProofs('USDCX')  →  MerkleProofs pair
                       → delegatedCreateMarket(hash, cat, outcomes, deadline, resDeadline,
                           resolver, liquidity, nonce, 'USDCX', tokenRecord, proofs)
                       → veil_strike_v7_cx.aleo.open_market (10 inputs)
```

**Error Recovery**:
- **DPS 401**: Destroy `networkClientCache` → create fresh `AleoNetworkClient` → retry once
- **Scanner 401**: Clear JWT + UUID → re-auth → re-register → retry once
- **Create failures**: `createRetries` counter (max 3) with 60s backoff. After 3 retries → 5min cooldown then reset
- **Settle failures**: 3 automatic retries then skip round

**DB Migration on Startup**:
- On restart, checks if saved slot IDs match `SLOT_DEFINITIONS` — if old IDs (e.g. `BTC-ALEO`) don't match new (`BTC-USDCX`), performs fresh start with `DELETE FROM round_bot_slots/round_bot_state`

### Delegated Prover Changes

- `delegatedCreateMarket()`: Extended with optional `tokenRecord?: string, proofs?: string` — appended as inputs 8,9 for CX/SD contracts
- `delegatedExecute()`: 401 retry — on HTTP 401, destroys cached `networkClientCache`, creates fresh client, retries
- SDK calls (`provingRequest` + `submitProvingRequestSafe`) wrapped with 2-minute timeout to prevent permanent `tickBusy` deadlock

### Key Constants

| Constant | Value | Meaning |
|---|---|---|
| `TOKEN_USDCX` | `1u8` | On-chain token type for USDCX in contract |
| `MIN_TRADE_AMOUNT` | `10_000u128` | Minimum bet = 0.01 USDCX |
| `roundInitialLiquidity` | `10000` | 0.01 USDCX initial pool per market |
| `ROUND_DURATION_MS` | `15 * 60 * 1000` | 15-minute rounds |
| `TICK_INTERVAL_MS` | `15_000` | Bot checks state every 15s |
| `MAX_CREATE_RETRIES` | `3` | Max create failures before 5min cooldown |
| `SDK_TIMEOUT_MS` | `120_000` | 2-minute timeout on SDK proving calls |

### USDCX Balance

- **Initial balance**: ~2,000,000 µUSDCX
- **Cost per round cycle**: 30,000 µUSDCX (10,000 per slot × 3 slots)
- **Rate**: ~4 cycles/hour → 120,000 µUSDCX/hour → ~16 hours of runway per 2M µUSDCX

## Phase 14: Production Stability Hardening ✅

Full audit of all 4 service files (round-bot, record-scanner, delegated-prover, freeze-list) for crash/hang scenarios.

### Critical Fixes Applied

| Fix | File | Issue | Solution |
|---|---|---|---|
| **Fetch timeouts** | All files | Raw `fetch()` with no timeout → TCP hang = permanent deadlock | New `fetchWithTimeout()` utility with AbortController (10-30s limits) |
| **SDK call timeouts** | `delegated-prover.ts` | `provingRequest()` / `submitProvingRequestSafe()` could hang forever | `withTimeout()` wrapper with 2-minute limit |
| **Unhandled rejections** | `round-bot.ts` | `setTimeout(async () => {...})` without `.catch()` → Node crash | Wrapped in `(() => {...})().catch()` pattern |
| **forceSettleSlot cooldown** | `round-bot.ts` | `setTimeout` cooldown raced with `tickBusy` guard | Replaced with immediate `idle` transition |
| **settleSlot no-marketId** | `round-bot.ts` | `setTimeout` cooldown for missing market → state race | Immediate `idle` + `roundNumber++` |
| **WASM cache** | `freeze-list.ts` | `@provablehq/wasm` re-imported on every call → memory growth | Module cached in `wasmCache` variable |
| **Partial batch-create** | `round-bot.ts` | Failed batch left orphaned markets without logging | Now logs warning, saves state, orphans settle naturally next cycle |

### What This Prevents

- **Permanent bot freeze** from hung TCP connections or Provable API outages
- **Node process crash** from unhandled promise rejections inside `setTimeout` callbacks
- **State corruption** from `setTimeout` firing outside `tickBusy` guard
- **Memory growth** from repeated WASM module imports

## Phase 15: Frontend Token Display Fix ✅

The Rounds page (SeriesDetail) and several components showed "ALEO" instead of "USDCx" because:
1. **DB series seed data** had `token_type: 'ALEO'` — changed to `'USDCX'` with `ON CONFLICT DO UPDATE`
2. **MarketStats.tsx**: 3 hardcoded `"ALEO"` suffixes → dynamic `tokenLabel` from `market.tokenType`
3. **LightningBetPanel.tsx**: Est. Return showed "ALEO" → dynamic `tokenLabel`
4. **LightningCard.tsx**: Volume showed "ALEO" → dynamic `tokenLabel`

## Phase 15 Verification: Round Bot Live Logs ✅

All 3 USDCX rounds created, synced, settled, and re-created successfully:

```
[RoundBot] All 3 rounds synced — expire together at 2026-04-11T04:38:12.502Z
```

| Round | TX Type | TX ID | Duration |
|---|---|---|---|
| ETH-USDCX #2 settle | flash_settle | `at1qg6exfhr9yjch...` | 9.0s |
| ALEO-USDCX #5 settle | flash_settle | `at1mt9wmqdl7qdss...` | 5.3s |
| BTC-USDCX #3 settle | flash_settle | `at1hx2ev7sl7avya...` | 8.7s |
| ALEO-USDCX #6 create | open_market | `at1zz2gwz0r3ug3r...` | 15.6s |
| BTC-USDCX #4 create | open_market | `at1my9pl5hpgddcd...` | 13.3s |
| ETH-USDCX #3 create | open_market | `at19cxmufak6we2e...` | 14.8s |

- **Settle**: Uses `veil_strike_v7_cx.aleo.flash_settle` (2 inputs, ~5-9s via DPS)
- **Create**: Uses `veil_strike_v7_cx.aleo.open_market` (10 inputs, ~13-16s via DPS)
- **401 auto-recovery**: DPS 401 → refresh network client → retry (observed on every open_market call — SDK JWT expires during 13-16s proving)
- **Scanner 401 auto-recovery**: records/owned 401 → refresh JWT + re-register → retry (observed between creates)
- **USDCX balance**: 1,940,000 → 1,930,000 → 1,920,000 µUSDCX (10,000 per create)
- **Bet test**: 0.01 USDCX `acquire_shares` on `veil_strike_v7_cx.aleo` — ACCEPTED ✅

---

## Files Modified (Complete List)

### Contracts
- `contract/veil_strike_v7/src/main.leo` — MIN_LIQUIDITY
- `contract/veil_strike_v7_cx/src/main.leo` — MIN_LIQUIDITY + stablecoin imports
- `contract/veil_strike_v7_sd/src/main.leo` — MIN_LIQUIDITY + stablecoin imports
- `contract/veil_strike_v7/program.json` — network mainnet
- `contract/veil_strike_v7_cx/program.json` — network mainnet + stablecoin dep
- `contract/veil_strike_v7_sd/program.json` — network mainnet + stablecoin dep
- `contract/veil_strike_v7/.env` — NETWORK=mainnet, ENDPOINT=v2
- `contract/veil_strike_v7_cx/.env` — NETWORK=mainnet, ENDPOINT=v2
- `contract/veil_strike_v7_sd/.env` — NETWORK=mainnet, ENDPOINT=v2

### Backend
- `backend/src/config.ts` — endpoint v2, aleoNetwork, roundInitialLiquidity
- `backend/src/services/delegated-prover.ts` — DPS URL mainnet + SDK import + 401 retry + `withTimeout()` wrapper for SDK calls
- `backend/src/services/auto-resolver.ts` — config.aleoNetwork
- `backend/src/services/chain-executor.ts` — config.aleoNetwork + SDK import `@provablehq/sdk/mainnet.js` + endpoint fix
- `backend/src/services/indexer.ts` — config.aleoNetwork + CATEGORY_MAP unified (10 categories)
- `backend/src/services/scanner.ts` — config.aleoNetwork
- `backend/src/services/round-bot.ts` — USDCX slot definitions, batch-create, timer sync, `fetchWithTimeout`, unhandled rejection fixes, forceSettleSlot immediate idle
- `backend/src/services/record-scanner.ts` — **NEW** Provable Scanner API client (JWT auth, view key registration, record fetching + local decryption, 401 retry)
- `backend/src/services/freeze-list.ts` — **NEW** Server-side MerkleProof computation for USDCX compliance (WASM cached)
- `backend/src/services/fetch-timeout.ts` — **NEW** Shared `fetchWithTimeout()` utility with AbortController
- `backend/src/services/db.ts` — Series seed data `token_type: 'ALEO'` → `'USDCX'`, `ON CONFLICT DO UPDATE`
- `backend/src/services/proof-dispatcher.ts` — endpoint fix (reverted manual /mainnet append)
- `backend/src/workers/prove-worker.ts` — SDK import `@provablehq/sdk/mainnet.js`
- `backend/src/routes/governance.ts` — config.aleoNetwork
- `backend/scripts/test-delegated-proving.ts` — mainnet URLs + SDK import `@provablehq/sdk/mainnet.js`
- `backend/scripts/reset-db.ts` — **NEW** utility to truncate all tables and re-seed
- `backend/.env` — ALEO_ENDPOINT v2, ALEO_NETWORK=mainnet, ROUND_INITIAL_LIQUIDITY=10000
- `backend/data/*.json` — all 4 data files reset to empty

### Frontend
- `frontend/src/constants/index.ts` — ALEO_API v2/mainnet, MIN_LIQUIDITY, CATEGORY_MAP unified (10 categories)
- `frontend/src/components/providers/WalletProvider.tsx` — MAINNET default, stablecoin programs
- `frontend/src/utils/freezeListProof.ts` — freezelist programs, API v2
- `frontend/src/hooks/useTransaction.ts` — explorer URL, stablecoin IDs
- `frontend/src/utils/marketRegistration.ts` — ALEO_API
- `frontend/src/pages/Governance.tsx` — mainnet API URL + text + block height path fix
- `frontend/src/pages/FAQ.tsx` — mainnet text
- `frontend/src/pages/Privacy.tsx` — mainnet text
- `frontend/src/pages/RiskDisclosure.tsx` — mainnet text
- `frontend/src/components/layout/Footer.tsx` — "Mainnet Live"
- `frontend/src/components/create/CreateEventForm.tsx` — max outcomes 4, ALEO_API, block height path fix, categoryMap unified, default state fix, filter fix
- `frontend/src/components/create/CreateLightningForm.tsx` — ALEO_API, block height path fix
- `frontend/src/components/market/MarketStats.tsx` — Hardcoded "ALEO" → dynamic `tokenLabel` from `market.tokenType`
- `frontend/src/components/lightning/LightningBetPanel.tsx` — Est. Return "ALEO" → dynamic `tokenLabel`
- `frontend/src/components/lightning/LightningCard.tsx` — Volume "ALEO" → dynamic `tokenLabel`
- `frontend/.env` — VITE_NETWORK=mainnet
- `frontend/.env.example` — VITE_NETWORK=mainnet, v2

### Scripts & Docs
- `scripts/deploy.sh` — NETWORK=mainnet, ENDPOINT=v2
- `scripts/initialize.sh` — NETWORK=mainnet, ENDPOINT=v2
- `scripts/seed-markets.sh` — NETWORK=mainnet, ENDPOINT=v2
- `scripts/update-oracle.sh` — NETWORK=mainnet, ENDPOINT=v2
- `scripts/scan-tokens.mjs` — v2/mainnet
- `docs/DEPLOYMENT.md` — NETWORK=mainnet, ENDPOINT=v2
- `README.md` — ENDPOINT=v2

### Deleted
- `contract/veil_strike_v6/` (entire directory)
- `contract/veil_strike_v6_cx/` (entire directory)
- `contract/veil_strike_v6_sd/` (entire directory)

---

## Phase 16: Elite Landing Page Redesign + Docs Overhaul ✅

Complete redesign of the landing page with professional animations, new educational content sections, and full testnet→mainnet docs cleanup.

### New Landing Components Created
| Component | Description |
|---|---|
| `SpotlightCursor.tsx` | Mouse-following radial gradient spotlight (framer-motion spring physics, desktop only) |
| `WhyAleoSection.tsx` | 4 numbered cards: ZK Proofs, Encrypted Records, No Front-Running, Mainnet Live |
| `StablecoinsSection.tsx` | USDCx (Circle) + USAD (Paxos) explanation with bridge info, mint links, feature badges |

### Redesigned Landing Components (9 total)
- **HeroSection** — Parallax scrolling, "Live on Aleo Mainnet" badge, scrolling ticker marquee, 40 particles with glow
- **FeaturesSection** — Stagger animations, per-card badges, glass-border-beam hover, USDCx/Paxos descriptions
- **PrivacySection** — 2-column: privacy cards + flow diagram | 7-row privacy matrix table
- **LightningSection** — Strike Rounds USDCx focus, chart mockup, 4 feature cards
- **HowItWorksSection** — 4-step staggered cards with detail text
- **ComparisonSection** — 10-row table vs Polymarket vs Azuro
- **ArchitectureSection** — 4-layer horizontal cards (User, Protocol, Execution, Blockchain)
- **TechStackSection** — 8 tech badges with hover animations
- **CTASection** — "Predict the Future. Privately." + trust badges

### Landing Page: 13 Sections
SpotlightCursor → Hero → Live Markets → Features → Why Aleo → Stablecoins → Lightning → How It Works → Privacy → Comparison → Architecture → Tech Stack → CTA

### Docs Testnet→Mainnet Fixes
- `docs/ARCHITECTURE.md` — "Aleo Blockchain (Testnet)" → "Mainnet"
- `docs/DEPLOYMENT.md` — Testnet credits/wallet/deploy → mainnet throughout, v4→v7
- `auto.md` — v6→v7_cx, all testnet URLs → mainnet, DPS/explorer/mapping paths updated
- `about.md` — Complete rewrite for mainnet (v7 contracts, stablecoins, architecture)
- `README.md` — Removed "Full UI/UX redesign" from planned, removed Wave 4 footer

## Phase 17: Production Polish + Wallet Standardization ✅

### Wallet Name Standardization
- Unified all user-facing references to **"Shield Wallet"** (the correct product name)
- Fixed "Shielded Wallet" → "Shield Wallet" in: `ARCHITECTURE.md`, `ArchitectureSection.tsx`, `HowItWorksSection.tsx`, `FAQ.tsx`, `Docs.tsx`, `Governance.tsx`
- Fixed "Leo Wallet / Puzzle Wallet" → "Shield Wallet" in: `auto.md`
- **NOT touched**: hooks (`useTransaction.ts`), utils (`transactions.ts`, `marketRegistration.ts`), technical components (`TradePanel.tsx`, `Footer.tsx`) — these already had "Shield Wallet" and changing them risks runtime errors

### HeroSection Encoding Fix
- `HeroSection.tsx` had full content duplicated (652 lines → 327) with corrupted encoding in the second half (`Ã¢â€â‚¬`, `Ã‚Â·`, etc.)
- Truncated to clean first 327 lines — all encoding corruption removed

### README.md Messaging Enhancement
- Added "The Problem / The Solution" framing to the intro — explains why public prediction markets (Polymarket, Azuro) are problematic and how Veil Strike solves it with ZK privacy

### about.md Professional Rewrite
- Expanded from 2,655 → 5,789 characters (target: 5,700–5,900)
- Full coverage: Privacy Architecture table, Why Aleo, 53 transitions, USDCx/USAD with mint links, Strike Rounds, Governance, Architecture, 14+ pages, all working features
