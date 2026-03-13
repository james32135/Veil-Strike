# Deployment Guide

## Prerequisites

- [Leo CLI](https://developer.aleo.org/leo/) (latest version)
- [snarkOS](https://github.com/AleoHQ/snarkOS) (for deployment commands)
- [Node.js](https://nodejs.org/) v18+
- Aleo testnet private key with sufficient credits

## Step 1: Get Testnet Credits

```bash
# Option 1: Aleo Faucet
# Visit: https://faucet.aleo.org/

# Option 2: Discord Faucet Bot
# Join: https://discord.gg/aleo
# Channel: #faucet
# Command: /sendcredits <your_address>
```

## Step 2: Configure Environment

```bash
# Set your private key
export PRIVATE_KEY="APrivateKey1..."
export NETWORK="testnet"
export ENDPOINT="https://api.explorer.provable.com/v1"
```

## Step 3: Build & Deploy Contract

```bash
# Build the Leo program
cd contract/veil_strike_v1
leo build

# Deploy to testnet
cd ../..
./scripts/deploy.sh
```

Wait for the deployment transaction to confirm (~30 seconds).

## Step 4: Initialize Protocol

```bash
./scripts/initialize.sh
```

This sets the deployer as the protocol admin and initializes default parameters.

## Step 5: Seed Initial Markets

```bash
./scripts/seed-markets.sh
```

Creates 3 initial markets (2 event markets + 1 lightning market).

## Step 6: Start Backend

```bash
cd backend
npm install
npm run dev
```

The backend will:
- Start Express server on port 3001
- Fetch initial market data
- Start oracle price feed (CoinGecko)
- Start market resolver cron job

## Step 7: Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Step 8: Connect Shield Wallet

1. Install Shield Wallet browser extension
2. Create or import an Aleo account
3. Switch to testnet
4. Fund your account with testnet credits
5. Click "Connect Wallet" on the Veil Strike app

## Production Deployment

### Frontend (Vercel/Netlify)

```bash
cd frontend
npm run build
# Deploy dist/ folder to your hosting provider
```

Set environment variables:
```
VITE_API_BASE=https://your-api-domain.com/api
VITE_PROGRAM_ID=veil_strike_v1.aleo
```

### Backend (Railway/Render/VPS)

```bash
cd backend
npm run build
npm start
```

Set environment variables:
```
PORT=3001
ALEO_ENDPOINT=https://api.explorer.provable.com/v1
CORS_ORIGIN=https://your-frontend-domain.com
```

### Oracle Automation

For production, set up a dedicated oracle service:

```bash
# Run as a cron job or systemd service
./scripts/update-oracle.sh
```

Recommended: Run every 1 minute for lightning markets.

## Verification

After deployment, verify:

1. Contract deployed: Check on [Aleo Explorer](https://explorer.aleo.org/)
2. Backend health: `curl http://localhost:3001/api/health`
3. Oracle working: `curl http://localhost:3001/api/oracle`
4. Markets loaded: `curl http://localhost:3001/api/markets`
5. Frontend rendering: Open http://localhost:5173
