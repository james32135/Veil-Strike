<div align="center">

# ⚔️ VEIL STRIKE

### Privacy-First Prediction Markets on Aleo

[![Aleo](https://img.shields.io/badge/Aleo-Testnet-00D4B8?style=for-the-badge)](https://testnet.aleoscan.io)
[![Leo](https://img.shields.io/badge/Leo-Smart%20Contract-E2B33E?style=for-the-badge)](https://leo-lang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

**Trade outcomes. Stay private. Win on-chain.**

[🌐 Live App](https://veil-strike.netlify.app) · [🔍 Explorer](https://testnet.aleoscan.io/program?id=veil_strike_v6.aleo) · [⚡ API](https://veil-strike-api.onrender.com/api/health)

</div>

---

## What is Veil Strike?

Veil Strike is a **zero-knowledge prediction market protocol** built on **Aleo**. Users bet on real-world outcomes — crypto prices, sports, politics, science — with **full privacy** powered by ZK proofs. The protocol uses a **Fixed Product Market Maker (FPMM)**, supports three tokens (ALEO, USDCx, USAD), features **Strike Rounds** with 24h–30d durations resolved by admin oracle, and includes a 12-hour dispute window to prevent fraud.

Every trade generates a zero-knowledge proof. Your identity, position size, and payout are encrypted on-chain — only you can decrypt them.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────── ┐
│                     Veil Strike v6 Protocol                     │
│                                                                  │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ veil_strike_v6   │  │veil_strike_v6_cx│  │veil_strike_v6_sd││
│  │  ALEO + Govern.  │  │     USDCx       │  │      USAD      │ │
│  │  17 transitions  │  │  15 transitions │  │ 15 transitions │ │
│  │   919,704 vars   │  │ 1,095,849 vars  │  │ 1,095,373 vars │ │
│  └──────────────────┘  └─────────────────┘  └────────────────┘ │
│              Total: 47 transitions · 3,110,926 variables        │
└─────────────────────────────────────────────────────────────────┘
          ▼                        ▼
┌──────────────────┐     ┌──────────────────────────────────────┐
│  React + Vite    │────▶│         Express Backend               │
│  TypeScript      │     │  Oracle · Indexer · Auto-Resolver    │
│  Tailwind CSS    │     │  7-source price feeds (fallback chain)│
│  Zustand stores  │     │  Scanner · Lightning Manager          │
│  14 pages        │     │  Persistent prove-worker thread       │
│  Shield Wallet   │     └──────────────────────────────────────┘
└──────────────────┘
```

---

## Smart Contracts

Three independent Leo programs deployed on Aleo Testnet — split to stay under the 2.1M variable limit.

### Program IDs

| Program | Token | Transitions | Deploy TX |
|---------|-------|-------------|-----------|
| `veil_strike_v6.aleo` | ALEO + Governance | 17 | `at1459u3ehmatrnk8huk5wj4dtfw668fml6kga62rkw0m4wpnfrxvqs79ey84` |
| `veil_strike_v6_cx.aleo` | USDCx | 15 | `at1g4py5xd8htpnalkm07axnahp5gyxj57jgm5cj9dqfxeeqckdzs8qpguzw9` |
| `veil_strike_v6_sd.aleo` | USAD | 15 | `at1yupukl8wynnu748u95scnqztqk33nwema3lxy7dfw7jm694cucyshswksx` |

### Transitions Overview

#### veil_strike_v6.aleo — ALEO Market + Governance (17)

| # | Transition | Description |
|---|-----------|-------------|
| 1 | `open_market` | Create ALEO prediction market with initial liquidity |
| 2 | `acquire_shares` | Buy outcome shares (private credits in, private shares out) |
| 3 | `dispose_shares` | Sell shares back to AMM (private shares in, private credits out) |
| 4 | `fund_pool` | Add liquidity to AMM pool (returns encrypted LP token) |
| 5 | `lock_market` | Close market after trading deadline |
| 6 | `render_verdict` | Submit initial resolution with winning outcome |
| 7 | `ratify_verdict` | Finalize after 12-hour challenge window |
| 8 | `void_market` | Cancel market (creator or emergency) |
| 9 | `flash_settle` | **Strike Rounds** — instant resolver-only settlement (no challenge) |
| 10 | `contest_verdict` | Dispute resolution with 5 ALEO bond |
| 11 | `recover_bond` | Reclaim dispute bond after finalization |
| 12 | `harvest_winnings` | Redeem winning shares for ALEO |
| 13 | `harvest_refund` | Claim refund from cancelled market |
| 14 | `withdraw_pool` | Remove LP liquidity (after resolution) |
| 15 | `harvest_fees` | Withdraw accumulated creator fees |
| 16 | `submit_proposal` | Create on-chain governance proposal |
| 17 | `cast_vote` | Vote on governance proposal |

#### veil_strike_v6_cx.aleo (USDCx) · veil_strike_v6_sd.aleo (USAD) — 15 each
Same market flow as the main program but handling USDCx and USAD respectively. Missing: `flash_settle`, `submit_proposal`, `cast_vote` (governance lives in main program only).

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

### Strike Round Flow (admin-resolved)

```
1. Admin: open_market(question="BTC Strike Round", num_outcomes=2, deadline=far_future, resolver=admin)
   → Creates market with UP(1) / DOWN(2) outcomes. Oracle records the start price at this moment.

2. User: acquire_shares(market_id, outcome=1or2, amount, ...)
   → Encrypted OutcomeShare record (UP or DOWN position)

3. [Round duration passes: 24h / 2d / 7d / 30d]

4. Admin: visits /admin page
   → Sees oracle startPrice (at creation) vs live endPrice for each round
   → Reads price direction (up or down) and chooses outcome
   → Wallet signs flash_settle(market_id, winning_outcome) — 1=UP, 2=DOWN
   → No challenge window. Instant on-chain finalization.

5. Admin: visits /create page
   → Creates the next Strike Round manually (same question, new nonce, new start price)
   → Scanner indexes it and the round appears in /rounds

6. Winner: harvest_winnings(outcome_share, expected_payout)
   → Receives private ALEO, USDCx, or USAD credits (1:1)
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

## Admin Resolution

The resolver address (`aleo19za49scmhufst9q8lhwka5hmkvzx5ersrue3gjwcs705542daursptmx0r`) is the only address authorized to call `flash_settle` and `render_verdict`.

### Admin Panel — Strike Rounds (`/admin`)
1. Admin visits `/admin` — only accessible to the deployer wallet address
2. Each Strike Round shows oracle data: `startPrice` (recorded at creation) vs live `endPrice`
3. Admin reads price direction and picks outcome: UP (1) or DOWN (2)
4. Admin clicks Resolve → Shield Wallet signs `flash_settle(market_id, winning_outcome)` directly on the client
5. No backend involvement — the wallet generates the ZK proof and broadcasts the transaction
6. After the market is finalized, admin visits `/create` and opens the next Strike Round manually

### Backend Auto-Resolver — Event Markets Only
The `services/auto-resolver.ts` cron runs every 2 minutes and handles event market lifecycle:
- Stage 1 (past deadline): calls `close_market` automatically (uses backend `RESOLVER_PRIVATE_KEY`)
- Stage 2 (closed): calls `render_verdict` automatically
- Stage 3 (past 2,880-block challenge window): calls `ratify_verdict` automatically

> Strike Rounds use `flash_settle` which is exclusively a manual admin wallet action. The backend has no role in Strike Round resolution or replacement creation.

---

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Hero, features, architecture, how-it-works, comparison |
| `/markets` | Markets | Browse all prediction markets with filters |
| `/markets/:id` | Market Detail | Chart, trade panel, buy/sell/LP |
| `/rounds` | Strike Rounds | 24h–30d price rounds with live oracle feed |
| `/portfolio` | Portfolio | Your encrypted positions, history, PnL |
| `/create` | Create | Create event market or Strike Round |
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
| Lightning Mgr | `services/lightning-manager.ts` | Tracks active Strike Rounds, auto-creates replacements |
| Proof Dispatcher | `services/proof-dispatcher.ts` | Persistent worker thread for ZK proof generation |
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
| POST | `/api/lightning/admin/resolve` | Settle a market (flash_settle) |
| POST | `/api/lightning/admin/create-round` | Create new strike round |
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
ALEO_ENDPOINT=https://api.explorer.provable.com/v1
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
├── veil_strike_v6/        ← ALEO + Governance (17 transitions)
│   └── src/main.leo
├── veil_strike_v6_cx/     ← USDCx (15 transitions)
│   └── src/main.leo
└── veil_strike_v6_sd/     ← USAD (15 transitions)
    └── src/main.leo
```

---

## Status & Roadmap

**Deployed & Working:**
- ✅ 3 Leo programs deployed on Aleo Testnet (47 transitions)
- ✅ Event prediction markets (2–4 outcomes, any category)
- ✅ Strike Rounds — 24h / 2-day / 7-day / 30-day durations
- ✅ FPMM AMM with complete-set minting
- ✅ Dispute system (contest_verdict + recover_bond)
- ✅ On-chain governance (submit_proposal + cast_vote)
- ✅ Full backend with oracle, indexer, scanner, auto-resolver, lightning manager
- ✅ React frontend (14 pages, all working)
- ✅ Portfolio with encrypted position tracking

**In Progress / Planned:**
- 🔄 Governance: quorum rules, timelock, stronger execution guards
- 🔄 Admin UX: streamline resolution flow
- 🔄 Full UI/UX redesign
- 🔄 Stronger privacy: full USDCx/USAD deposit privacy via compliance proofs
- 🔄 Mainnet deployment

---

<div align="center">
  Built for <strong>Aleo Developer Program — Wave 4</strong><br/>
  <sub>All tokens are testnet tokens with no real-world value.</sub>
</div>
