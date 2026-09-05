#!/bin/bash
# Watchdog script to keep the Next.js server running
LOG="/tmp/next-standalone.log"
STANDALONE_DIR="/home/z/my-project/.next/standalone"

echo "[$(date)] Starting server watchdog..." >> "$LOG"

# Kill any existing server
pkill -f "node server.js" 2>/dev/null
sleep 1

start_server() {
  echo "[$(date)] Starting server..." >> "$LOG"
  cd "$STANDALONE_DIR"
  PORT=3000 node server.js >> "$LOG" 2>&1 &
  SERVER_PID=$!
  echo "[$(date)] Server PID: $SERVER_PID" >> "$LOG"
  echo "$SERVER_PID" > /tmp/next-server-pid
}

start_server

# Watchdog loop - restart if server dies
while true; do
  sleep 5
  if ! kill -0 $(cat /tmp/next-server-pid 2>/dev/null) 2>/dev/null; then
    echo "[$(date)] Server died, restarting..." >> "$LOG"
    pkill -f "node server.js" 2>/dev/null
    sleep 1
    start_server
  fi
done
