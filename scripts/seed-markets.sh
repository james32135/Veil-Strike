#!/bin/bash
# Veil Strike - Seed Markets
# Creates initial prediction markets for demo purposes
set -euo pipefail

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "ERROR: PRIVATE_KEY environment variable is required."
  exit 1
fi

NETWORK="${NETWORK:-testnet}"
ENDPOINT="${ENDPOINT:-https://api.explorer.provable.com/v1}"
BROADCAST="$ENDPOINT/$NETWORK/transaction/broadcast"

echo "Creating seed markets..."

# Market 1: Bitcoin price prediction
echo "[1/3] Creating BTC prediction market..."
snarkos developer execute \
  veil_strike_v2.aleo \
  create_market \
  "10000000u64" \
  "2u8" \
  "1750000000u64" \
  "12345field" \
  --private-key "$PRIVATE_KEY" \
  --query "$ENDPOINT" \
  --broadcast "$BROADCAST" \
  --priority-fee 100000

sleep 5

# Market 2: Aleo TVL prediction
echo "[2/3] Creating Aleo TVL market..."
snarkos developer execute \
  veil_strike_v2.aleo \
  create_market \
  "5000000u64" \
  "2u8" \
  "1740000000u64" \
  "67890field" \
  --private-key "$PRIVATE_KEY" \
  --query "$ENDPOINT" \
  --broadcast "$BROADCAST" \
  --priority-fee 100000

sleep 5

# Market 3: Lightning market
echo "[3/3] Creating Lightning market..."
snarkos developer execute \
  veil_strike_v2.aleo \
  create_market \
  "2000000u64" \
  "300u64" \
  "11111field" \
  --private-key "$PRIVATE_KEY" \
  --query "$ENDPOINT" \
  --broadcast "$BROADCAST" \
  --priority-fee 100000

echo ""
echo "Seed markets created successfully!"
echo "Markets should appear on-chain within ~30 seconds."
