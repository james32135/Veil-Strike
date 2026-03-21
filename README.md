<div align="center">

# ⚔️ VEIL STRIKE

### Privacy-First Prediction Markets on Aleo

[![Aleo](https://img.shields.io/badge/Aleo-Testnet-00D4B8?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiPjwvc3ZnPg==)](https://testnet.aleoscan.io)
[![Leo](https://img.shields.io/badge/Leo-Smart%20Contract-E2B33E?style=for-the-badge)](https://leo-lang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

**Trade outcomes. Stay private. Win on-chain.**

[Live App](https://veil-strike.netlify.app) · [Explorer](https://testnet.aleoscan.io/program?id=veil_strike_v4.aleo) · [API](https://veil-strike-api.onrender.com/api/health)

</div>

---

## What is Veil Strike?

Veil Strike is a **zero-knowledge prediction market protocol** built on **Aleo**. Users bet on real-world outcomes — crypto prices, sports, politics, science — with **full privacy** powered by ZK proofs. The protocol uses a **Fixed Product Market Maker (FPMM)** with complete-set minting, supports **dual tokens** (ALEO + USDCx stablecoin), features **lightning-fast 5-minute rounds** resolved by on-chain oracles, and includes a **4-hour dispute resolution window** to prevent fraud.

Every trade generates a zero-knowledge proof. Your identity, position size, and payout are encrypted on-chain — only you can decrypt them.

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🔒 **ZK Privacy** | Positions, payouts, and trader identities are encrypted via Aleo's ZK proofs |
| ⚡ **Lightning Markets** | 5-min to 4-hour price rounds on BTC, ETH, ALEO with live oracle feeds |
| 💰 **Dual Token** | Trade with ALEO (fully private) or USDCx stablecoin (private payouts) |
| 📊 **FPMM AMM** | Automated market maker with dynamic pricing and complete-set minting |
| 🏛️ **Dispute System** | 4-hour challenge window with 5 ALEO bond to dispute false resolutions |
| 🎯 **Multi-Outcome** | Support for 2, 3, or 4 outcome markets (Yes/No, multi-choice) |
| 💧 **LP Rewards** | 1% LP fee on every trade, proportional withdrawal from resolved markets |
| 📈 **Live Oracles** | Multi-source price feeds: CoinGecko → Binance → CoinCap → CryptoCompare |

---

## Architecture

```
┌────────────────┐     ┌────────────────┐     ┌──────────────────────┐
│    Frontend    │────►│    Backend     │────►│   Aleo Blockchain    │
│  React + Vite  │     │  Express + TS  │     │                      │
│  Tailwind CSS  │     │  Oracle Feeds  │     │  veil_strike_v4.aleo │
│  Shield Wallet │     │  Cron Indexer  │     │  24 transitions      │
│  Zustand       │     │  Resolver      │     │  2,000+ lines Leo    │
└────────────────┘     └────────────────┘     │  9 mappings          │
                                              │  4 record types      │
                                              └──────────────────────┘
```

---

## Smart Contract

**Program:** `veil_strike_v4.aleo` — Deployed on Aleo Testnet

### 24 Transitions

#### Trading (8)
| Transition | Token | Privacy |
|-----------|-------|---------|
| `create_market` | ALEO | Private credits input |
| `buy_shares_private` | ALEO | **Fully private** (private in, private out) |
| `sell_shares` | ALEO | Private shares → private credits |
| `add_liquidity` | ALEO | Private credits → private LP token |
| `create_market_usdcx` | USDCx | Public input (compliance token) |
| `buy_shares_usdcx` | USDCx | Public input → private shares |
| `sell_shares_usdcx` | USDCx | Private shares → **private USDCx payout** |
| `add_liquidity_usdcx` | USDCx | Public input → private LP token |

#### Lifecycle (4)
`close_market` · `resolve_market` · `finalize_resolution` · `cancel_market`

#### Disputes (2)
`dispute_resolution` (5 ALEO bond) · `claim_dispute_bond`

#### ALEO Redemption (5)
`redeem_shares` · `claim_refund` · `withdraw_lp_resolved` · `claim_lp_refund` · `withdraw_creator_fees`

#### USDCx Redemption (5) — All payouts private via `transfer_public_to_private`
`redeem_shares_usdcx` · `claim_refund_usdcx` · `withdraw_lp_resolved_usdcx` · `claim_lp_refund_usdcx` · `withdraw_fees_usdcx`

### Fee Structure
| Fee | Rate | Recipient |
|-----|------|-----------|
| Protocol | 0.5% | Protocol treasury |
| Creator | 0.5% | Market creator |
| LP | 1.0% | Liquidity providers |
| **Total** | **2.0%** | |

---

## Privacy Model

| Layer | ALEO | USDCx |
|-------|------|-------|
| **Deposit (buy)** | ✅ Private (credits record) | ⚠️ Public (compliance token) |
| **Position (shares)** | ✅ Private (encrypted record) | ✅ Private (encrypted record) |
| **Payout (sell/redeem)** | ✅ Private (credits record) | ✅ Private (v3 upgrade) |

> **Next Wave:** USDCx buy-side will become fully private via `transfer_private_to_public` with MerkleProof from the compliance authority.

---

## Live Markets (12)

### Prediction Markets (ALEO)
- 🔮 Bitcoin reach $200K by 2026?
- 🔮 Ethereum surpass 1M TPS by Q4 2026?
- 🎬 AI-generated film wins Oscar by 2027?
- ⚽ FIFA World Cup 2026 Winner (4 outcomes)
- 🚀 SpaceX land humans on Mars by 2026?
- 📉 Fed rate below 3% by mid-2026?

### Lightning Markets
- ⚡ BTC Up/Down (ALEO + USDCx)
- ⚡ ETH Up/Down (ALEO + USDCx)
- ⚡ ALEO Up/Down (ALEO + USDCx)

---

## Tech Stack

### Frontend
| Package | Version |
|---------|---------|
| React | 18.3.1 |
| Vite | 6.0.5 |
| TypeScript | 5.7.2 |
| Tailwind CSS | 3.4.16 |
| Zustand | 5.0.2 |
| Framer Motion | 11.15.0 |
| Shield Wallet | 0.3.0-alpha.3 |

### Backend
| Package | Version |
|---------|---------|
| Express | 4.18.2 |
| TypeScript | 5.3.3 |
| node-cron | 3.0.3 |

### Design
- **Fonts:** Bodoni Moda (headings) · Inter (body) · Source Code Pro (mono)
- **Accent:** Gold `#E2B33E`
- **Theme:** Dark glass-morphism with teal/gold accents

---

## Project Structure

```
VEIL-STRIKE/
├── contract/
│   └── veil_strike_v2/
│       └── src/main.leo          # 2,000+ lines, 24 transitions
├── frontend/
│   └── src/
│       ├── pages/                # 10 route pages
│       ├── components/           # 75+ React components
│       ├── stores/               # 7 Zustand stores
│       ├── hooks/                # 3 custom hooks
│       ├── utils/                # FPMM math, transactions, formatting
│       └── constants/            # Program ID, transitions, config
├── backend/
│   └── src/
│       ├── routes/               # 5 API route modules
│       └── services/             # Indexer, Oracle, Resolver
├── docs/                         # API, Architecture, Privacy, Deployment
└── scripts/                      # Build, deploy, seed automation
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- [Leo](https://developer.aleo.org/leo/) (for contract compilation)
- [Shield Wallet](https://shieldwallet.io/) browser extension

### Development

```bash
# Clone
git clone https://github.com/james32135/Veil-Strike.git
cd Veil-Strike

# Backend
cd backend
npm install
npm run dev    # http://localhost:3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev    # http://localhost:5173

# Contract (optional — already deployed)
cd contract/veil_strike_v2
leo build
```

### Environment Variables

**Frontend** (`frontend/.env`)
```
VITE_API_URL=http://localhost:3001
VITE_PROGRAM_ID=veil_strike_v4.aleo
VITE_NETWORK=testnet
```

**Backend** (`backend/.env`)
```
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/markets` | All markets |
| `GET` | `/api/markets/:id` | Single market |
| `POST` | `/api/markets/refresh` | Force chain refresh |
| `GET` | `/api/oracle` | BTC/ETH/ALEO prices |
| `GET` | `/api/lightning` | Active lightning rounds |
| `GET` | `/api/stats` | Protocol statistics |

---

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Netlify | `https://veil-strike.netlify.app` |
| Backend | Render | `https://veil-strike-api.onrender.com` |
| Contract | Aleo Testnet | `veil_strike_v4.aleo` |

---

## Roadmap

- [x] FPMM prediction markets with ZK privacy
- [x] Dual-token support (ALEO + USDCx)
- [x] Lightning markets with oracle price feeds
- [x] On-chain dispute resolution
- [x] USDCx private payouts (v3)
- [ ] Full USDCx privacy (private buy via MerkleProof)
- [ ] Mainnet deployment
- [ ] Mobile-optimized UI
- [ ] Additional token support (USAD)

---

<div align="center">

**Built with ❤️ on Aleo**

*Zero-knowledge proofs • Privacy by default • On-chain fairness*

</div>
