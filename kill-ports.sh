#!/bin/bash

# Kill processes running on ports used by Sogni Demo Superapp
# Server: 3001, Frontend: 5173

echo "🔍 Checking for processes on ports 3001 and 5173..."

# Function to kill process on a specific port
kill_port() {
  local port=$1
  local pids=$(lsof -ti:$port 2>/dev/null)

  if [ -n "$pids" ]; then
    echo "💀 Killing process(es) on port $port: $pids"
    kill -9 $pids 2>/dev/null
    sleep 1

    # Verify the port is free
    local remaining=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$remaining" ]; then
      echo "⚠️  Warning: Some processes on port $port may still be running"
    else
      echo "✅ Port $port is now free"
    fi
  else
    echo "✅ Port $port is already free"
  fi
}

# Kill processes on both ports
kill_port 3001
kill_port 5173

echo "🎉 Port cleanup complete!"
