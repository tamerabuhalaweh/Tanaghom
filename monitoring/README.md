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
- Hybrid target: `tanaghum-hybrid-app:4000`

Grafana is available on port `3001` by default.

## External Alert Routing

Alertmanager is intentionally a separate production overlay because its webhook destination is customer/operations owned.

Create the server-only destination file:

```bash
printf '%s' "$ALERT_WEBHOOK_URL" > monitoring/secrets/alert_webhook_url
chmod 600 monitoring/secrets/alert_webhook_url
```

Then start the alerting overlay:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.alerting.yml \
  up -d prometheus alertmanager grafana
```

Do not claim alert delivery is complete until a controlled firing and resolved notification reaches the approved external destination.

## Go-Live Requirement

Before production go-live, record evidence for:

- Prometheus scraping backend metrics.
- Grafana dashboard screenshots.
- Alert destination configured.
- Uptime monitor configured for `/health`.
- Restore drill completed for the latest PostgreSQL backup.
- Hybrid external uptime workflow is green.
- HSTS is present on the Hybrid root and API responses.
