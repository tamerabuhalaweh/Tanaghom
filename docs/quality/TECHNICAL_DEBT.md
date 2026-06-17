# Technical Debt Register

> **Version**: v0.1-stitch-foundation-demo

## Accepted Demo Findings

| Item | Status | Impact | Priority |
|---|---|---|---|
| Lightweight secret scan (grep-based) | Accept for demo | Use gitleaks/trufflehog before production | Medium |
| Docker Prisma install (`npm install --no-save prisma`) | Accept for demo | Use migration image/stage for production | Medium |
| Compose UX (`JWT_SECRET` expands to blank if not exported) | Accept for demo | Use `${JWT_SECRET:?required}` for production | Low |
| Security tests are assertion-only fixtures | Accept for demo | Import real validators/middleware in tests | Low |
| UI is demo shell, not production app | Accept for demo | Build production dashboard in future phase | High |
| Backend modules are service/data-model-first | Accept for demo | Expose all routes via API | Medium |
| No real MCP servers yet | Known gap | Implement MCP providers for each connector | High |
| No M5 authorization process yet | Known gap | Implement governance-gated M5 execution | High |
| Repository mappers use `Record<string, unknown>` | Known gap | Add proper Prisma types | Low |
| BullMQ Redis connection type cast | Known gap | Fix ioredis type alignment | Low |

## Future Production Requirements

| Item | Description |
|---|---|
| Real MCP servers | Postiz, ResourceSpace, analytics, rendering connectors |
| M5 authorization process | Governance-gated execution with explicit approval |
| Production deployment scripts | CI/CD pipeline for staging/production |
| Dashboard/UI | Full production frontend |
| Real integrations | Postiz, CRM, WhatsApp, analytics through MCP mediation |
| Monitoring/alerting | Grafana dashboards, alert rules |
| Backup/restore | Database backup strategy |
| Rate limiting | Production-grade rate limiting |
| Secret management | Proper secrets manager integration |
