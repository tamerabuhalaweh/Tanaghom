# Environment Variables

> **Version**: v0.1-stitch-foundation-demo

## Required Variables

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | JWT signing secret (32+ chars, no defaults) | `your-strong-secret-at-least-32-characters-long` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/tanaghum` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `NODE_ENV` | Environment | `development` / `demo` / `production` |
| `DEMO_MODE` | Legacy controlled-mode flag. Use only for non-production controlled environments. | `false` |
| `SECRET_VAULT_ENCRYPTION_KEY` | 32+ character secret used to encrypt tenant-owned credentials and MFA secrets | `replace-with-secret-manager-value` |
| `CORS_ORIGIN` | Exact frontend origin(s), comma-separated when needed | `https://app.example.com` |
| `OPERATIONS_METRICS_TOKEN` | 24+ character bearer token for `/ops/prometheus` scraping | `replace-with-secret-manager-value` |

## Optional Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend server port |
| `LOG_LEVEL` | `info` | Logging level |
| `CORS_ORIGIN` | `http://localhost:3000` | Frontend URL for CORS |
| `REQUEST_BODY_LIMIT` | `1mb` | Request body limit |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Rate-limit window |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Requests per window |
| `DATABASE_BACKUP_DIR` | unset | Local PostgreSQL backup directory |
| `DATABASE_BACKUP_CRON` | unset | Documented backup schedule |
| `BACKUP_STORAGE_TARGET` | unset | Off-server backup target description |
| `ALERT_WEBHOOK_URL` | unset | Operations alert webhook |
| `OPERATIONS_ALERT_EMAIL` | unset | Operations alert email |
| `PUBLIC_HEALTH_URL` | unset | Public uptime-monitor URL for `/health` |
| `LATEST_RESTORE_DRILL_AT` | unset | ISO timestamp after successful restore drill |
| `MFA_RECOVERY_CODE_PEPPER` | falls back to server secret | Stable pepper for hashing MFA recovery codes |
| `EMAIL_DELIVERY_ENABLED` | `false` | Enables SMTP invite/password-reset email delivery |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | unset | SMTP delivery settings |
| `SMARTLABS_READ_ENABLED` | `false` | Allows tenant-owned SmartLabs read tests for agents/voices |
| `SMARTLABS_LIVE_ENABLED` | `false` | Allows SmartLabs conversation/TTS execution after all other policy gates pass |
| `VOICE_CHAT_LIVE_ENABLED` | `false` | Required for SmartLabs execution and other voice/chat actions |

## Execution Kill Switches

All default to `false`. **Must remain `false` for this release.** Demo mode will fail startup if any live flag is enabled.

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
2. **Controlled mode blocks live flags**: Enabling any live flag in controlled mode causes startup failure
3. **No secrets in code**: Use `.env` file (never commit) or secrets manager
4. **Rotate secrets**: Change JWT_SECRET for each environment
