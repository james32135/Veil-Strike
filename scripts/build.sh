#!/bin/bash
# Veil Strike - Build Everything
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

echo "============================================"
echo "  Veil Strike - Full Build"
echo "============================================"
echo ""

# Build Leo contract
echo "[1/3] Building Leo contract..."
cd "$ROOT_DIR/contract/veil_strike_v4"
leo build
echo "  ✓ Contract built"

# Build backend
echo "[2/3] Building backend..."
cd "$ROOT_DIR/backend"
npm install
npm run build
echo "  ✓ Backend built"

# Build frontend
echo "[3/3] Building frontend..."
cd "$ROOT_DIR/frontend"
npm install
npm run build
echo "  ✓ Frontend built"

echo ""
echo "============================================"
echo "  Build complete!"
echo "============================================"
