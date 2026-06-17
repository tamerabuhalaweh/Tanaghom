# Environment Variables

> **Version**: v0.1-stitch-foundation-demo

## Required Variables

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | JWT signing secret (32+ chars, no defaults) | `your-strong-secret-at-least-32-characters-long` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/tanaghum` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `NODE_ENV` | Environment | `development` / `demo` / `production` |
| `DEMO_MODE` | Enable demo-safe mode | `true` |

## Optional Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend server port |
| `LOG_LEVEL` | `info` | Logging level |
| `CORS_ORIGIN` | `http://localhost:3000` | Frontend URL for CORS |

## Execution Kill Switches

All default to `false`. Set to `true` only with explicit approval.

| Variable | Description |
|---|---|
| `EXTERNAL_EXECUTION_ENABLED` | Master switch for external calls |
| `M5_WRITE_EXECUTION_ENABLED` | Enable M5 write operations |
| `POSTIZ_LIVE_ENABLED` | Enable real Postiz |
| `CRM_LIVE_ENABLED` | Enable real CRM |
| `WHATSAPP_LIVE_ENABLED` | Enable real WhatsApp |
| `RENDERING_LIVE_ENABLED` | Enable real rendering |
| `RESOURCESPACE_LIVE_ENABLED` | Enable real ResourceSpace |
| `PAPERCLIP_SYNC_ENABLED` | Enable real Paperclip |
| `ANALYTICS_LIVE_ENABLED` | Enable real analytics |

## Security Rules

1. **JWT_SECRET must be strong**: 32+ characters, no defaults, no weak values
2. **Demo mode blocks live flags**: Enabling any live flag in demo mode causes startup failure
3. **No secrets in code**: Use `.env` file (never commit) or secrets manager
4. **Rotate secrets**: Change JWT_SECRET for each environment
