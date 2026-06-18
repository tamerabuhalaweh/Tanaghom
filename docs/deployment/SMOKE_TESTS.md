# Smoke Tests

> **Version**: v0.1-stitch-foundation-demo

## Quick Verification

```bash
# Backend health check
curl http://localhost:4000/health

# Frontend loads
curl -s http://localhost:3000 | grep -q "Tanaghum" && echo "Frontend OK"

# Demo mode headers present
curl -sI http://localhost:4000/health | grep -q "X-Demo-Mode" && echo "Demo mode active"

# M5 blocked header present
curl -sI http://localhost:4000/health | grep -q "X-M5-Blocked" && echo "M5 blocked"
```

## Full Smoke Test Script

```bash
#!/bin/bash
set -e

echo "=== Tanaghum Demo Smoke Test ==="

# 1. Build backend
echo "Building backend..."
npm ci && npm run build

# 2. Build frontend
echo "Building frontend..."
cd frontend && npm ci && npm run build && cd ..

# 3. Validate compose config
echo "Validating compose config..."
docker compose -f docker-compose.demo.yml config > /dev/null && echo "Compose config OK"

# 4. Check environment
echo "Checking environment..."
if [ -z "$JWT_SECRET" ]; then
  echo "FAIL: JWT_SECRET not set"
  exit 1
fi
if [ ${#JWT_SECRET} -lt 32 ]; then
  echo "FAIL: JWT_SECRET too short (need 32+ chars)"
  exit 1
fi

# 5. Start demo stack (if Docker available)
if command -v docker &> /dev/null; then
  echo "Starting demo stack..."
  docker compose -f docker-compose.demo.yml up -d
  sleep 30

  # 6. Verify backend health
  echo "Checking backend health..."
  curl -sf http://localhost:4000/health && echo "Backend health OK"

  # 7. Verify frontend
  echo "Checking frontend..."
  curl -sf http://localhost:3000 > /dev/null && echo "Frontend OK"

  # 8. Verify demo headers
  echo "Checking demo headers..."
  curl -sI http://localhost:4000/health | grep -q "X-Demo-Mode" && echo "Demo mode active"
  curl -sI http://localhost:4000/health | grep -q "X-M5-Blocked" && echo "M5 blocked"

  # 9. Stop demo stack
  echo "Stopping demo stack..."
  docker compose -f docker-compose.demo.yml down
else
  echo "Docker not available - skipping container tests"
  echo "PASS: Build and validation completed"
fi

echo "=== Smoke Test Complete ==="
```

## Expected Results

| Check | Expected |
|---|---|
| Backend build | `dist/index.js` created |
| Frontend build | `frontend/dist/index.html` created |
| Compose config | No errors |
| Backend health | Returns JSON with status |
| Frontend loads | HTML with "Tanaghum" |
| Demo headers | `X-Demo-Mode: true` |
| M5 header | `X-M5-Blocked: true` |
