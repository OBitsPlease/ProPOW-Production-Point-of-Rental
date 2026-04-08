#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/local/bin:$PATH"
cd "$SCRIPT_DIR"

echo "Starting Vite dev server..."
npm run dev:vite &
VITE_PID=$!

echo "Waiting for Vite to be ready..."
for i in $(seq 1 20); do
  sleep 1
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "Vite ready!"
    break
  fi
done

echo "Launching app..."
"$SCRIPT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" "$SCRIPT_DIR"

# Cleanup vite on exit
kill $VITE_PID 2>/dev/null
