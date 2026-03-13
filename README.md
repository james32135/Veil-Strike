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
│          veil_strike_v1.aleo                 │
│    20 Transitions │ 7 Records │ ~40 Mappings │
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
cd contract/veil_strike_v1
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
│   └── veil_strike_v1/
│       ├── src/main.leo          # Core smart contract
│       ├── program.json          # Leo program config
│       ├── .env.example          # Deployment env vars
│       └── inputs/               # Test inputs
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

The Leo smart contract (`veil_strike_v1.aleo`) implements:

### Transitions (20 total)

| Transition | Description |
|---|---|
| `initialize` | Set admin address and protocol params |
| `update_oracle_prices` | Update BTC/ETH/ALEO prices (admin) |
| `create_event_market` | Create a new prediction market |
| `create_lightning_market` | Create fast-resolving market |
| `buy_shares_private` | Buy outcome shares privately |
| `sell_shares` | Sell shares back to the pool |
| `add_liquidity` | Provide liquidity to a market |
| `remove_liquidity` | Withdraw LP position |
| `close_market` | Stop trading on a market |
| `resolve_market` | Set the winning outcome |
| `resolve_lightning` | Auto-resolve via oracle |
| `finalize_market` | Complete market settlement |
| `dispute_resolution` | Challenge a resolution |
| `redeem_shares` | Claim winnings |
| `claim_refund` | Get refund for disputed/cancelled |
| `create_pool` | Create prediction pool |
| `join_pool` | Join an existing pool |
| `settle_pool` | Settle pool after markets resolve |
| `claim_pool_winnings` | Claim share of pool winnings |
| `update_streak` | Update win streak record |

### Record Types (7)

- `SharePosition` — Owned shares in a market outcome
- `PoolMembership` — Pool member receipt
- `LPReceipt` — Liquidity provider receipt
- `WinReceipt` — Winning redemption proof
- `RefundReceipt` — Refund claim proof
- `StreakRecord` — Win streak tracker
- `DisputeBond` — Dispute collateral receipt

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
