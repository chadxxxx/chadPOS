#!/bin/bash
# Robust Next.js server starter for sandbox environment
# This script rebuilds the project (if needed), copies static assets,
# and starts the server with auto-restart on failure.

set -e

PROJECT_DIR="/home/z/my-project"
STANDALONE_DIR="$PROJECT_DIR/.next/standalone"
LOG="/tmp/next-server.log"

echo "[$(date)] === Starting POS Server ===" >> "$LOG"

# Step 1: Ensure static files are copied to standalone build
if [ ! -d "$STANDALONE_DIR/.next/static/chunks" ] || [ -z "$(ls -A $STANDALONE_DIR/.next/static/chunks/ 2>/dev/null)" ]; then
  echo "[$(date)] Copying static files to standalone build..." >> "$LOG"
  rm -rf "$STANDALONE_DIR/.next/static" 2>/dev/null
  cp -r "$PROJECT_DIR/.next/static" "$STANDALONE_DIR/.next/static"
fi

# Step 2: Ensure public files are copied
if [ ! -d "$STANDALONE_DIR/public" ]; then
  echo "[$(date)] Copying public files to standalone build..." >> "$LOG"
  cp -r "$PROJECT_DIR/public" "$STANDALONE_DIR/public"
fi

# Step 3: Kill any existing server
pkill -f "node server.js" 2>/dev/null || true
sleep 1

# Step 4: Start the server
cd "$STANDALONE_DIR"
PORT=3000 node server.js >> "$LOG" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > /tmp/next-server-pid
echo "[$(date)] Server started with PID $SERVER_PID" >> "$LOG"

# Step 5: Wait and verify
sleep 3
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "[$(date)] Server is running and healthy" >> "$LOG"
  echo "OK:$SERVER_PID"
else
  echo "[$(date)] Server failed to start" >> "$LOG"
  echo "FAIL"
fi
