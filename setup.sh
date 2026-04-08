#!/bin/bash
# Truck Pack App — First-time setup script
# Run this once: bash setup.sh

set -e

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║     🚛  TRUCK PACK APP  SETUP         ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "❌  Node.js not found."
  echo ""
  echo "  Please install Node.js (v18 or later) from:"
  echo "  👉  https://nodejs.org/en/download"
  echo ""
  echo "  After installing Node.js, run this script again."
  exit 1
fi

NODE_VER=$(node --version)
echo "✅  Node.js found: $NODE_VER"

# Install dependencies
echo ""
echo "📦  Installing dependencies (this may take 2-3 minutes)..."
npm install

echo ""
echo "✅  Setup complete!"
echo ""
echo "  To run the app in development mode:"
echo "  👉  npm run dev"
echo ""
echo "  To build a distributable installer:"
echo "  👉  npm run build:mac    (macOS .dmg)"
echo "  👉  npm run build:win    (Windows .exe installer)"
echo ""
