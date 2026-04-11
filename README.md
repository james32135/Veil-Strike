<div align="center">

# ⚔️ VEIL STRIKE

### Privacy-First Prediction Markets on Aleo

[![Aleo](https://img.shields.io/badge/Aleo-Mainnet-00D4B8?style=for-the-badge)](https://explorer.provable.com)
[![Leo](https://img.shields.io/badge/Leo-Smart%20Contract-E2B33E?style=for-the-badge)](https://leo-lang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

**Trade outcomes. Stay private. Win on-chain.**

[🌐 Live App](https://veil-strike.netlify.app) · [🔍 Explorer](https://explorer.provable.com/program/veil_strike_v7.aleo) · [⚡ API](https://veil-strike-api.onrender.com/api/health)

</div>

---

## What is Veil Strike?

Veil Strike is a **zero-knowledge prediction market protocol** built on **Aleo** — the only Layer-1 blockchain with native ZK privacy. Users bet on real-world outcomes — crypto prices, sports, politics, science — with **complete on-chain privacy** powered by zero-knowledge proofs.

**The Problem:** On Polymarket and Azuro, every bet you place is public. Anyone can see your wallet, your positions, your PnL. Whales get front-run. Strategies get copied. Your financial activity is permanently visible on-chain.

**The Solution:** Veil Strike encrypts everything. Your identity, bet sizes, positions, and payouts are invisible to everyone — including validators, other traders, and MEV bots. The protocol uses a **Fixed Product Market Maker (FPMM)**, supports three tokens (ALEO, USDCx, USAD), features **Strike Rounds** with 15-minute auto-resolved cycles (3 concurrent slots: BTC, ETH, ALEO) using delegated proving, and includes a 12-hour dispute window for event markets.

Every trade generates a zero-knowledge proof. Your identity, position size, and payout are encrypted on-chain — only you can decrypt them.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────── ┐
│                     Veil Strike v7 Protocol                     │
│                                                                  │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ veil_strike_v7   │  │veil_strike_v7_cx│  │veil_strike_v7_sd││
│  │ ALEO+Gov+Resolv  │  │     USDCx       │  │      USAD      │ │
│  │  23 transitions  │  │  15 transitions │  │ 15 transitions │ │
│  │  15 mappings     │  │   9 mappings    │  │  9 mappings    │ │
│  └──────────────────┘  └─────────────────┘  └────────────────┘ │
│          Total: 53 transitions · Leo v4 syntax · @test fn       │
└─────────────────────────────────────────────────────────────────┘
          ▼                        ▼
┌──────────────────┐     ┌──────────────────────────────────────┐
│  React + Vite    │────▶│         Express Backend               │
│  TypeScript      │     │  Oracle · Indexer · Auto-Resolver    │
│  Tailwind CSS    │     │  7-source price feeds (fallback chain)│
│  Zustand stores  │     │  Scanner · Lightning Manager          │
│  SSE real-time   │     │  SSE push · Governance execute        │
│  14 pages        │     │  Persistent prove-worker thread       │
│  Shield Wallet   │     └──────────────────────────────────────┘
└──────────────────┘
```

---

## Smart Contracts

Three independent Leo programs deployed on Aleo Mainnet — split to stay under the 2.1M variable limit.

### Program IDs

| Program | Token | Transitions | Mappings |
|---------|-------|-------------|----------|
| `veil_strike_v7.aleo` | ALEO + Governance + Resolver Registry | 23 | 15 |
| `veil_strike_v7_cx.aleo` | USDCx | 15 | 9 |
| `veil_strike_v7_sd.aleo` | USAD | 15 | 9 |

### Transitions Overview

#### veil_strike_v7.aleo — ALEO Market + Governance + Resolver Registry (23)

| # | Transition | Description |
|---|-----------|-------------|
| 1 | `open_market` | Create ALEO prediction market with initial liquidity |
| 2 | `acquire_shares` | Buy outcome shares (private credits in, private shares out) |
| 3 | `dispose_shares` | Sell shares back to AMM (private shares in, private credits out) |
| 4 | `fund_pool` | Add liquidity to AMM pool (returns encrypted LP token) |
| 5 | `lock_market` | Close market after trading deadline |
| 6 | `render_verdict` | Submit initial resolution (approved resolvers only) |
| 7 | `ratify_verdict` | Finalize after 12-hour challenge window |
| 8 | `void_market` | Cancel market (creator or emergency) |
| 9 | `flash_settle` | **Strike Rounds** — instant settlement (approved resolvers only) |
| 10 | `contest_verdict` | Dispute resolution with 5 ALEO bond |
| 11 | `recover_bond` | Reclaim dispute bond after finalization |
| 12 | `harvest_winnings` | Redeem winning shares for ALEO |
| 13 | `harvest_refund` | Claim refund from cancelled market |
| 14 | `withdraw_pool` | Remove LP liquidity (after resolution) |
| 15 | `harvest_fees` | Withdraw accumulated creator fees |
| 16 | `submit_proposal` | Create on-chain governance proposal |
| 17 | `cast_vote` | Vote on governance proposal |
| 18 | `execute_proposal` | **Execute passed proposal** (quorum 3 + timelock 480 blocks) |
| 19 | `execute_treasury` | **Execute treasury withdrawal** (credits transfer) |
| 20 | `register_resolver` | **Stake 10 ALEO** to become approved resolver |
| 21 | `withdraw_resolver_stake` | Deregister and reclaim staked ALEO |
| 22 | `emergency_pause` | Deployer-only: pause trading |
| 23 | `emergency_unpause` | Deployer-only: resume trading |

#### veil_strike_v7_cx.aleo (USDCx) · veil_strike_v7_sd.aleo (USAD) — 15 each
Same 15-transition market flow as main (1-15) but using stablecoin tokens. Governance, resolver registry, and emergency controls live in the main program only.

### Key Constants

| Constant | Value |
|----------|-------|
| Protocol fee | 0.5% |
| Creator fee | 0.5% |
| LP fee | 1.0% |
| Total fee | 2.0% |
| Challenge window | 2,880 blocks (~12 hours) |
| Min trade | 0.01 ALEO |
| Min liquidity | 1 ALEO |
| Min dispute bond | 5 ALEO |
| Governance quorum | 3 votes |
| Governance timelock | 480 blocks (~2 hours) |
| Min resolver stake | 10 ALEO |

### Privacy Model

| What | Privacy |
|------|---------|
| Trader identity | 🟢 Private — ZK-encrypted via `transfer_private_to_public` |
| Position sizes | 🟢 Private — `OutcomeShare` encrypted record |
| LP positions | 🟢 Private — `LPToken` encrypted record |
| ALEO payouts | 🟢 Private — `transfer_public_to_private` output |
| Dispute bonds | 🟢 Private — `DisputeBondReceipt` encrypted record |
| Market state | 🔴 Public — required for fair AMM pricing |
| Winning outcome | 🔴 Public — revealed at finalization |
| USDCx deposits | 🟡 Public — compliance token limitation (payout is private) |

---

## User Flows

### Event Prediction Market Flow

```
1. Admin/User: open_market(question_hash, category, num_outcomes, deadline, resolver, liquidity, nonce)
   → Returns: market_id (field), LPToken (private record)

2. User: acquire_shares(market_id, outcome, amount_in, expected_shares, share_nonce, credits_record)
   → Returns: OutcomeShare (private record) — no one sees what you bet or how much

3. [Market deadline passes]

4. Resolver: lock_market(market_id)
5. Resolver: render_verdict(market_id, winning_outcome)
   → Sets 12-hour challenge window

6. Anyone: contest_verdict(market_id, proposed_outcome, dispute_nonce, credits_record)
   → Bond of 5 ALEO locked in DisputeBondReceipt

7. [12 hours pass with no valid dispute OR dispute resolved]

8. Anyone: ratify_verdict(market_id)
   → Market finalized, winners can claim

9. Winner: harvest_winnings(outcome_share, expected_payout)
   → Receives private ALEO credits (1:1 for winning outcome)

10. LP: withdraw_pool(lp_token, expected_amount)
    → Receives private ALEO credits (pro-rata + LP fees)
```

### Strike Round Flow (automated via Round Bot)

```
1. Round Bot: open_market(question="BTC Strike Round #N", num_outcomes=2, resolver=bot)
   → Delegated proving (~30s via Provable API). Oracle records start price.
   → 3 concurrent slots: BTC/ALEO, ETH/ALEO, ALEO/ALEO

2. User: acquire_shares(market_id, outcome=1or2, amount, ...)
   → Encrypted OutcomeShare record (UP or DOWN position)
   → 40-second cooldown before next bet (prevents UTXO reuse errors)

3. [15-minute round timer expires]
   → Frontend shows "Settling..." with progress info

4. Round Bot: compare oracle start vs end price → flash_settle via delegated proving
   → ALL markets settled on-chain (including empty ones — ensures clean state)
   → Settlement takes ~5 min (3 settles + 3 creates, each ~20-50s DPS)

5. Round Bot: creates next round automatically (open_market with new nonce + start price)
   → Scanner indexes it and the new round appears in /rounds

6. Winner: harvest_winnings(outcome_share, expected_payout)
   → Receives private ALEO credits (1:1)

Manual override: Admin can still resolve any market via /admin page + wallet flash_settle.
```

### Governance Flow

```
1. User: submit_proposal(action_type, target_market, amount, recipient, token_type, deadline, nonce)
   → Returns: GovernanceReceipt (private record proving vote weight)

2. Others: cast_vote(proposal_id, support=true/false)
   → Returns: GovernanceReceipt per voter

3. [Deadline passes, quorum reached]

4. Protocol executes approved action (resolver approval, fee update, treasury withdrawal)
```

**Action Types:**
- `0` General proposal
- `1` Approve resolver address
- `2` Treasury withdrawal
- `3` Fee update
- `4` Market override

> ⚠️ Governance is live on-chain but still evolving. Quorum requirements, timelock, and execution logic will be improved in future waves.

---

## Resolution

The resolver address (`aleo19za49scmhufst9q8lhwka5hmkvzx5ersrue3gjwcs705542daursptmx0r`) is the only address authorized to call `flash_settle` and `render_verdict`.

### Automated Round Bot — Strike Rounds
The `services/round-bot.ts` automates the full Strike Round lifecycle using **delegated proving** (Provable API):
1. Creates 3 concurrent markets on startup (BTC-ALEO, ETH-ALEO, ALEO-ALEO)
2. Every 15 minutes, the round timer expires
3. Bot compares oracle start vs end price → `flash_settle` via delegated proving (~30s)
4. ALL markets are settled on-chain, including empty ones (ensures clean state)
5. Bot immediately creates the next round
6. Smart recovery on restart: bot adopts existing active rounds (prevents duplicates); expired/transient slots reset to idle
7. Settle retry limit: max 3 failures before skipping round and moving on

### Manual Override (`/admin`)
Admin can still resolve any market manually via the `/admin` page — wallet signs `flash_settle` directly.

### Backend Auto-Resolver — Event Markets Only
The `services/auto-resolver.ts` cron runs every 2 minutes and handles event market lifecycle:
- Stage 1 (past deadline): calls `close_market` automatically (uses backend `RESOLVER_PRIVATE_KEY`)
- Stage 2 (closed): calls `render_verdict` automatically
- Stage 3 (past 2,880-block challenge window): calls `ratify_verdict` automatically

### Delegated Proving
Both the round bot and the proof dispatcher use the **Provable API** for delegated proving. Authorization is built locally (~1s), then the ZK proof is generated on Provable's servers (~15-30s) and broadcast to the network. This replaces the previous local proving (2-5 min) and enables automated sub-minute round resolution.

---

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Hero, features, architecture, how-it-works, comparison |
| `/markets` | Markets | Browse all prediction markets with filters |
| `/markets/:id` | Market Detail | Chart, trade panel, buy/sell/LP |
| `/rounds` | Strike Rounds | 15-min auto-resolved price rounds with live oracle feed |
| `/portfolio` | Portfolio | Your encrypted positions, history, PnL |
| `/create` | Create | Create event market (Strike Rounds are auto-created) |
| `/governance` | Governance | On-chain proposals and voting |
| `/leaderboard` | Leaderboard | Top traders |
| `/pools` | Pools | LP overview |
| `/stats` | Stats | Protocol analytics |
| `/admin` | Admin | Resolver dashboard (flash_settle) |
| `/docs` | Docs | In-app documentation |
| `/faq` | FAQ | Frequently asked questions |
| `/privacy` | Privacy Policy | |

---

## Backend Services

| Service | File | Description |
|---------|------|-------------|
| Oracle | `services/oracle.ts` | 7-source price fallback: CoinGecko → OKX → KuCoin → Gate.io → Binance → CoinCap → CryptoCompare |
| Indexer | `services/indexer.ts` | Fetches market state from Aleo mapping API |
| Scanner | `services/scanner.ts` | Scans chain for new market_ids every minute |
| Resolver | `services/resolver.ts` | Re-fetches market cache after on-chain resolution |
| Auto-Resolver | `services/auto-resolver.ts` | Cron: auto-closes + resolves + finalizes event markets |
| Lightning Mgr | `services/lightning-manager.ts` | Tracks active Strike Rounds, admin resolve/replacement |
| Round Bot | `services/round-bot.ts` | Automated 15-min round lifecycle (create → settle → repeat) |
| Delegated Prover | `services/delegated-prover.ts` | Provable API delegated proving (~30s per tx) |
| Proof Dispatcher | `services/proof-dispatcher.ts` | Routes to delegated prover (fast) or local worker (fallback) |
| Chain Executor | `services/chain-executor.ts` | Aleo SDK transaction execution |

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/markets` | All cached markets |
| GET | `/api/markets/:id` | Single market |
| POST | `/api/markets/register` | Register market metadata |
| GET | `/api/oracle` | Live prices (BTC, ETH, ALEO) |
| POST | `/api/oracle/refresh` | Force price refresh |
| GET | `/api/lightning/active` | Active strike rounds |
| GET | `/api/lightning/bot/status` | Round bot status + slot details |
| GET | `/api/lightning/bot/rounds` | Active bot rounds (for frontend) |
| POST | `/api/lightning/bot/start` | Start the round bot |
| POST | `/api/lightning/bot/stop` | Stop the round bot |
| POST | `/api/lightning/bot/force-settle` | Force-settle a specific slot |
| POST | `/api/lightning/admin/resolve` | Manual settle a market (flash_settle) |
| POST | `/api/lightning/admin/create-replacement` | Replace resolved round |
| GET | `/api/governance` | All governance proposals |
| GET | `/api/stats` | Protocol stats |

---

## Development

```bash
# Backend
cd backend
cp .env.example .env   # set RESOLVER_PRIVATE_KEY
npm install
npm run dev            # port 3001

# Frontend
cd frontend
npm install
npm run dev            # port 5173

# Build all
bash scripts/build.sh
```

### Required ENV (backend/.env)
```
PORT=3001
ALEO_ENDPOINT=https://api.provable.com/v2
CORS_ORIGIN=http://localhost:5173
RESOLVER_PRIVATE_KEY=APrivateKey1...
```

---

## Fee Structure

| Fee | Rate | Recipient |
|-----|------|-----------|
| Protocol | 0.5% | Protocol treasury (`program_credits` mapping) |
| Creator | 0.5% | Market creator address |
| LP | 1.0% | Liquidity providers (pro-rata on withdrawal) |
| **Total** | **2.0%** | |

---

## Contracts Directory

```
contract/
├── veil_strike_v7/        ← ALEO + Governance + Resolver Registry (23 transitions, Leo v4)
│   └── src/main.leo
├── veil_strike_v7_cx/     ← USDCx (15 transitions, Leo v4)
│   └── src/main.leo
└── veil_strike_v7_sd/     ← USAD (15 transitions, Leo v4)
    └── src/main.leo
```

---

## Status & Roadmap

**Deployed & Working:**
- ✅ 3 Leo programs on Aleo Mainnet (53 transitions, Leo v4 syntax)
- ✅ Event prediction markets (2–4 outcomes, any category)
- ✅ Strike Rounds — 15-minute auto-resolved cycles via delegated proving (3 slots: BTC, ETH, ALEO)
- ✅ FPMM AMM with complete-set minting
- ✅ Dispute system (contest_verdict + recover_bond)
- ✅ Executable governance (submit → vote → execute with quorum 3 + timelock)
- ✅ Resolver registry with 10 ALEO staking requirement
- ✅ Emergency pause/unpause controls
- ✅ @test functions for on-chain logic verification
- ✅ SSE real-time market updates (replaces polling)
- ✅ Full backend with oracle, indexer, scanner, auto-resolver, lightning manager
- ✅ React frontend (14 pages, all working)
- ✅ Portfolio with encrypted position tracking + proper win/loss/claimable states
- ✅ Bet cooldown (40s) — prevents UTXO reuse errors across markets
- ✅ Settling UX — "Settling..." status with time estimate when rounds expire
- ✅ Smart restart recovery — bot adopts active rounds, prevents duplicates
- ✅ Friendly error messages for wallet issues (spent records, insufficient balance)

**In Progress / Planned:**
- 🔄 Governance: quorum rules, timelock, stronger execution guards
- 🔄 Admin UX: streamline resolution flow
- 🔄 Stronger privacy: full USDCx/USAD deposit privacy via compliance proofs

---

<div align="center">
  Built for the <strong>Aleo Developer Program</strong><br/>
  <sub>Deployed on Aleo Mainnet. Real tokens with real value — trade responsibly.</sub>
</div>
