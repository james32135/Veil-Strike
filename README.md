# Veil Strike

**Privacy-First Prediction Market Protocol on Aleo**

Built for the Aleo Privacy Buildathon Wave 3

---

## Overview

Veil Strike is a fully private prediction market protocol built on the Aleo blockchain. It uses zero-knowledge proofs to protect trader identities while maintaining transparent market mechanics through a Fixed Product Market Maker (FPMM).

### Key Features

- **Full Privacy**: No trader addresses stored on-chain. All positions are private records.
- **FPMM Market Maker**: Automated pricing using the constant product formula (same as Uniswap).
- **Lightning Markets**: Fast-resolving markets (5min to 1hr) powered by on-chain price oracles.
- **Prediction Pools**: Collaborative trading with pooled capital.
- **Win Streak Tracking**: On-chain streak records with leaderboard.
- **Shield Wallet**: Delegated proving for ~14 second proof generation.

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│        React + TypeScript + Tailwind         │
│           Shield Wallet Integration          │
├─────────────────────────────────────────────┤
│                  Backend                     │
│            Express + TypeScript              │
│     Oracle Service │ Market Resolver         │
├─────────────────────────────────────────────┤
│               Aleo Blockchain                │
│          veil_strike_v2.aleo                 │
│    24 Transitions │ 4 Records │ 9 Mappings   │
└─────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- [Leo CLI](https://developer.aleo.org/leo/) (latest)
- [Node.js](https://nodejs.org/) v18+
- [snarkOS](https://github.com/AleoHQ/snarkOS) (for deployment)

### 1. Clone & Install

```bash
git clone https://github.com/your-repo/veil-strike.git
cd veil-strike

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..
```

### 2. Build the Smart Contract

```bash
cd contract/veil_strike_v2
leo build
```

### 3. Run the Backend

```bash
cd backend
npm run dev
# Server starts on http://localhost:3001
```

### 4. Run the Frontend

```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

### 5. Deploy to Testnet

```bash
export PRIVATE_KEY="your_aleo_private_key"
./scripts/deploy.sh
./scripts/initialize.sh
./scripts/seed-markets.sh
```

## Project Structure

```
VEIL-STRIKE/
├── contract/
│   ├── veil_strike_v1/            # Legacy v1 contract
│   └── veil_strike_v2/
│       ├── src/main.leo          # Core smart contract (v2)
│       ├── program.json          # Leo program config
│       └── build/                # Compiled artifacts
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   │   ├── charts/           # Price & sparkline charts
│   │   │   ├── create/           # Market creation forms
│   │   │   ├── icons/            # SVG icon components
│   │   │   ├── landing/          # Landing page sections
│   │   │   ├── layout/           # Navbar, Footer, Layout
│   │   │   ├── leaderboard/      # Leaderboard & stats
│   │   │   ├── lightning/        # Lightning market components
│   │   │   ├── market/           # Market detail components
│   │   │   ├── pool/             # Prediction pool components
│   │   │   ├── portfolio/        # Portfolio & positions
│   │   │   ├── providers/        # Wallet provider
│   │   │   └── shared/           # Reusable UI components
│   │   ├── constants/            # App constants
│   │   ├── hooks/                # Custom React hooks
│   │   ├── pages/                # Route page components
│   │   ├── stores/               # Zustand state stores
│   │   ├── styles/               # Global CSS
│   │   ├── types/                # TypeScript types
│   │   └── utils/                # Utility functions
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── backend/
│   └── src/
│       ├── index.ts              # Express server entry
│       ├── config.ts             # Server configuration
│       ├── types.ts              # Backend types
│       ├── routes/               # API routes
│       └── services/             # Oracle, indexer, resolver
├── scripts/                      # Deployment & utility scripts
└── docs/                         # Documentation
```

## Smart Contract

The Leo smart contract (`veil_strike_v2.aleo`) implements:

### Transitions (24 total)

| Transition | Description |
|---|---|
| `create_market` | Create a new ALEO prediction market |
| `create_market_usdcx` | Create a USDCx prediction market |
| `buy_shares_private` | Buy outcome shares privately (ALEO) |
| `buy_shares_usdcx` | Buy outcome shares (USDCx) |
| `sell_shares` | Sell shares back to the pool (ALEO) |
| `sell_shares_usdcx` | Sell shares back (USDCx) |
| `add_liquidity` | Provide liquidity (ALEO) |
| `add_liquidity_usdcx` | Provide liquidity (USDCx) |
| `close_market` | Stop trading on a market |
| `resolve_market` | Set the winning outcome |
| `finalize_resolution` | Finalize after challenge window |
| `cancel_market` | Cancel and enable refunds |
| `dispute_resolution` | Challenge a resolution |
| `claim_dispute_bond` | Reclaim dispute bond |
| `redeem_shares` | Claim winnings (ALEO) |
| `redeem_shares_usdcx` | Claim winnings (USDCx) |
| `claim_refund` | Get refund for cancelled (ALEO) |
| `claim_refund_usdcx` | Get refund for cancelled (USDCx) |
| `withdraw_lp_resolved` | Withdraw LP after resolution (ALEO) |
| `withdraw_lp_resolved_usdcx` | Withdraw LP after resolution (USDCx) |
| `claim_lp_refund` | LP refund for cancelled (ALEO) |
| `claim_lp_refund_usdcx` | LP refund for cancelled (USDCx) |
| `withdraw_creator_fees` | Creator claims fees (ALEO) |
| `withdraw_fees_usdcx` | Creator claims fees (USDCx) |
| `claim_refund` | Get refund for cancelled |

### Record Types (4)

- `OutcomeShare` — Owned shares in a market outcome (with share_nonce, token_type)
- `LPToken` — Liquidity provider receipt (with lp_nonce, token_type)
- `DisputeBondReceipt` — Dispute collateral receipt
- `RefundClaim` — Refund claim proof

### Mappings (9)

- `markets` — Market struct data
- `amm_pools` — AMM pool reserves and volumes
- `market_resolutions` — Resolution outcomes and timing
- `market_fees` — Protocol and creator fee tracking
- `share_redeemed` — Prevents double-redemption
- `creator_fees_claimed` — Creator fee claim tracking
- `program_credits` — Protocol treasury balance
- `market_credits` — Per-market credit balance
- `lp_positions` — LP share tracking

### Privacy Model

1. **Deposits**: `credits.aleo/transfer_private_to_public` hides the depositor
2. **Positions**: Private records visible only to the holder
3. **Payouts**: `credits.aleo/transfer_public_to_private` hides the recipient
4. **Market IDs**: BHP256 hash of nonce only (no creator address)
5. **Finalize**: No user addresses passed to finalize (except admin verification)

## FPMM Mathematics

The Fixed Product Market Maker uses constant product formulas:

**Buy shares:**
```
shares_out = (reserve_i + amount) - reserve_i * ∏(reserve_k / (reserve_k + amount))
```

**Sell shares:**
```
reserve_i_new = reserve_i * ∏(reserve_k / (reserve_k - payment))
shares_needed = reserve_i_new - reserve_i + payment
```

**Price calculation:**
```
price_i = ∏(reserve_k for k≠i) / Σ(∏(reserve_k for k≠j) for all j)
```

**Fees:** 0.5% protocol + 0.5% creator + 1.0% LP = 2.0% total

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/markets` | List all markets |
| GET | `/api/markets/:id` | Get market details |
| POST | `/api/markets/refresh` | Refresh from chain |
| GET | `/api/oracle` | Current oracle prices |
| POST | `/api/oracle/refresh` | Force price refresh |
| GET | `/api/stats` | Protocol statistics |

## Design System

- **Background**: `#06080F`
- **Accent**: `#00D4B8` (teal) — only accent color
- **Green**: `#22C55E` (Yes/Up outcomes)
- **Red**: `#EF4444` (No/Down outcomes)
- **Fonts**: Instrument Sans (headings), Inter (body), JetBrains Mono (numbers)
- **No purple, no gradient buttons**

## Tech Stack

- **Blockchain**: Aleo (Leo language)
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Zustand
- **Backend**: Express, TypeScript, node-cron
- **Wallet**: Shield Wallet (Provable)
- **Charts**: lightweight-charts
- **Oracle**: CoinGecko API

## License

MIT
