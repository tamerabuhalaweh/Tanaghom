# Production Monitoring Deployment

This folder contains the production monitoring scaffold for Tanaghum.

## Required Secret

Create this file on the server only:

```bash
mkdir -p monitoring/secrets
printf '%s' "$OPERATIONS_METRICS_TOKEN" > monitoring/secrets/ops_metrics_token
chmod 600 monitoring/secrets/ops_metrics_token
```

Do not commit `monitoring/secrets/ops_metrics_token`.

## Start Monitoring

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d prometheus grafana
```

Prometheus scrapes:

- `GET /ops/prometheus`
- Bearer token: `OPERATIONS_METRICS_TOKEN`

Grafana is available on port `3001` by default.

## Go-Live Requirement

Before production go-live, record evidence for:

- Prometheus scraping backend metrics.
- Grafana dashboard screenshots.
- Alert destination configured.
- Uptime monitor configured for `/health`.
- Restore drill completed for the latest PostgreSQL backup.
