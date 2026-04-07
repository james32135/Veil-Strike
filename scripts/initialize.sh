#!/bin/bash
# Veil Strike - Initialize Protocol
# Calls the initialize() transition to set admin and protocol params
set -euo pipefail

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "ERROR: PRIVATE_KEY environment variable is required."
  exit 1
fi

NETWORK="${NETWORK:-mainnet}"
ENDPOINT="${ENDPOINT:-https://api.provable.com/v2}"

echo "Initializing Veil Strike protocol..."

snarkos developer execute \
  veil_strike_v4.aleo \
  initialize \
  --private-key "$PRIVATE_KEY" \
  --query "$ENDPOINT" \
  --broadcast "$ENDPOINT/$NETWORK/transaction/broadcast" \
  --priority-fee 100000

echo "Protocol initialized successfully!"
echo "Admin address set to the deployer's address."
