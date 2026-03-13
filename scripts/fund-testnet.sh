#!/bin/bash
# Veil Strike - Fund Testnet Account
# Gets testnet credits from the Aleo faucet
set -euo pipefail

if [ -z "${ADDRESS:-}" ]; then
  echo "ERROR: ADDRESS environment variable is required."
  echo "Usage: ADDRESS=aleo1... ./scripts/fund-testnet.sh"
  exit 1
fi

echo "Requesting testnet credits for $ADDRESS..."
echo ""
echo "Visit the Aleo testnet faucet:"
echo "  https://faucet.aleo.org/"
echo ""
echo "Or use the Aleo Discord faucet bot:"
echo "  1. Join https://discord.gg/aleo"
echo "  2. Go to #faucet channel"
echo "  3. Type: /sendcredits $ADDRESS"
echo ""
echo "Each request provides 100 testnet credits."
