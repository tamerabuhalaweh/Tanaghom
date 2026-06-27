# Demo Deployment Readiness

> **Version**: 1.0
> **Date**: 2026-06-23

## Deployment Architecture

```
Frontend (Vercel) → Backend (VPS/Container) → PostgreSQL + Redis
```

## Frontend Deployment (Vercel)

### Configuration

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API URL | `https://api.tanaghum.com` |

### CORS Configuration

Backend must allow the Vercel demo domain:

```typescript
// src/index.ts
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
// For production: CORS_ORIGIN=https://tanaghum.vercel.app
```

## Backend Deployment (VPS/Container)

### Requirements

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker (optional)

### Docker Compose (Production)

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:pass@postgres:5432/tanaghum
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      LLM_PROVIDER: mock  # or openai, claude, deepseek
      CORS_ORIGIN: https://tanaghum.vercel.app
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tanaghum
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: tanaghum
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  postgres_data:
```

### Deployment Steps

```bash
# 1. Clone repository
git clone https://github.com/tamerabuhalaweh/Tanaghom.git
cd Tanaghom

# 2. Set environment variables
export JWT_SECRET="your-strong-secret-at-least-32-characters-long"
export POSTGRES_PASSWORD="your-postgres-password"
export CORS_ORIGIN="https://tanaghum.vercel.app"

# 3. Build and start
docker compose up -d

# 4. Run migrations
docker compose exec app npx prisma migrate deploy

# 5. Seed demo data
docker compose exec app npx prisma db seed

# 6. Verify
curl https://api.tanaghum.com/health
```

## Deployed Smoke Test Checklist

| Check | Expected | Status |
|---|---|---|
| Frontend loads | Page renders | ⬜ |
| Login works | Token received | ⬜ |
| Campaign select | Campaigns listed | ⬜ |
| Draft generation | Draft created | ⬜ |
| Scoring | Score displayed | ⬜ |
| Approval submit | Approval created | ⬜ |
| Approval decision | Status updated | ⬜ |
| Analytics demo | Metrics shown | ⬜ |
| Safety headers | X-Demo-Mode present | ⬜ |
| No live external calls | Mock providers only | ⬜ |
| M5 blocked | X-M5-Blocked present | ⬜ |

## AI Provider Configuration

| Provider | Env Variables | Default |
|---|---|---|
| Mock | `LLM_PROVIDER=mock` | ✅ Default |
| OpenAI | `LLM_PROVIDER=openai` + `OPENAI_API_KEY` | ❌ |
| Claude | `LLM_PROVIDER=claude` + `CLAUDE_API_KEY` | ❌ |

| DeepSeek | `LLM_PROVIDER=deepseek` + `DEEPSEEK_API_KEY`, or user-owned credential vault entry | Not default |

## Security Rules

1. API keys in environment variables only
2. Never display raw keys in UI
3. Mock remains default
4. All model calls through STITCH backend
5. No direct external API access
6. M5 blocked by default
