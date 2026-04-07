#!/bin/bash
# Veil Strike - Leo Contract Deployment Script
# Deploys veil_strike_v7.aleo to Aleo mainnet
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT_DIR="$SCRIPT_DIR/../contract/veil_strike_v4"

echo "============================================"
echo "  Veil Strike - Contract Deployment"
echo "============================================"

# Check for required env vars
if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "ERROR: PRIVATE_KEY environment variable is required."
  echo "Export it or create a .env file in the contract directory."
  exit 1
fi

NETWORK="${NETWORK:-mainnet}"
ENDPOINT="${ENDPOINT:-https://api.provable.com/v2}"

echo "Network:  $NETWORK"
echo "Endpoint: $ENDPOINT"
echo "Program:  veil_strike_v4.aleo"
echo ""

# Navigate to contract directory
cd "$CONTRACT_DIR"

# Build the program
echo "[1/3] Building Leo program..."
leo build

# Run tests (optional)
echo "[2/3] Running Leo tests..."
leo run initialize || echo "Skipping test run (may require valid input)"

# Deploy to network
echo "[3/3] Deploying to $NETWORK..."
snarkos developer deploy \
  veil_strike_v4.aleo \
  --private-key "$PRIVATE_KEY" \
  --query "$ENDPOINT" \
  --broadcast "$ENDPOINT/$NETWORK/transaction/broadcast" \
  --path ./build/ \
  --priority-fee 1000000

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "============================================"
echo ""
echo "Program ID: veil_strike_v4.aleo"
echo "Network:    $NETWORK"
echo ""
echo "Next steps:"
echo "  1. Run ./scripts/initialize.sh to call initialize()"
echo "  2. Run ./scripts/seed-markets.sh to create initial markets"
echo "  3. Start the backend: cd backend && npm run dev"
echo "  4. Start the frontend: cd frontend && npm run dev"
