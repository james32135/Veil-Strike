#!/bin/bash
# Veil Strike - Oracle Price Update
# Manually updates oracle prices on-chain (admin only)
set -euo pipefail

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "ERROR: PRIVATE_KEY (admin) is required."
  exit 1
fi

NETWORK="${NETWORK:-testnet}"
ENDPOINT="${ENDPOINT:-https://api.explorer.provable.com/v1}"

# Fetch current prices from CoinGecko
echo "Fetching current prices..."
PRICES=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,aleo&vs_currencies=usd")

BTC=$(echo "$PRICES" | grep -o '"bitcoin":{"usd":[0-9.]*' | grep -o '[0-9.]*$')
ETH=$(echo "$PRICES" | grep -o '"ethereum":{"usd":[0-9.]*' | grep -o '[0-9.]*$')
ALEO=$(echo "$PRICES" | grep -o '"aleo":{"usd":[0-9.]*' | grep -o '[0-9.]*$')

# Convert to micro-units (multiply by 1_000_000)
BTC_MICRO=$(echo "$BTC * 1000000" | bc | cut -d. -f1)
ETH_MICRO=$(echo "$ETH * 1000000" | bc | cut -d. -f1)
ALEO_MICRO=$(echo "$ALEO * 1000000" | bc | cut -d. -f1)

echo "BTC: \$$BTC ($BTC_MICRO micro)"
echo "ETH: \$$ETH ($ETH_MICRO micro)"
echo "ALEO: \$$ALEO ($ALEO_MICRO micro)"

echo "Updating oracle prices on-chain..."
snarkos developer execute \
  veil_strike_v3.aleo \
  update_oracle_prices \
  "${BTC_MICRO}u64" \
  "${ETH_MICRO}u64" \
  "${ALEO_MICRO}u64" \
  --private-key "$PRIVATE_KEY" \
  --query "$ENDPOINT" \
  --broadcast "$ENDPOINT/$NETWORK/transaction/broadcast" \
  --priority-fee 100000

echo "Oracle prices updated on-chain!"
