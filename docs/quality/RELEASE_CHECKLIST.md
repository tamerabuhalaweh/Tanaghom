# RELEASE_CHECKLIST.md — Production Readiness Checklist

> **Version**: 1.0
> **Date**: 2026-06-17
> **Sprint**: 20 — End-to-End QA, Security Hardening & Production Readiness

## Current Platform Status

| Item | Status |
|---|---|
| Architecture foundation | ✅ Complete (STITCH operating substrate) |
| All integrations | Mock/provider-based only |
| Real external systems connected | ❌ None |
| M5 execution | ❌ Blocked by design |
| Production live execution | ❌ Not enabled |
| Ready for controlled demo/pilot | ✅ Yes |

## Pre-Release Checklist

### CI & Testing
- [x] CI pipeline green
- [x] Lint passes
- [x] Typecheck passes
- [x] All tests pass (793+)
- [x] E2E boundary tests exist
- [x] Security boundary tests exist

### Database
- [x] Prisma migrations present and version-controlled
- [x] Baseline migration includes all tables
- [x] Seed data marked development-only

### Security
- [x] No real secrets in repository
- [x] `.env.example` with placeholders only
- [x] JWT secret is placeholder
- [x] No real customer PII stored
- [x] Credential binding placeholders only
- [x] No raw webhook/API payloads stored

### M5 Gates Verified
- [x] M5 publishing blocked
- [x] M5 rendering blocked
- [x] M5 CRM/WhatsApp blocked
- [x] Direct external access blocked

### Mock Providers Verified
- [x] MockPostizProvider deterministic
- [x] MockAnalyticsProvider deterministic
- [x] MockCrmProvider deterministic
- [x] MockMessagingProvider deterministic
- [x] MockRenderingProvider deterministic

### Documentation
- [x] README.md updated
- [x] CONTEXT.md updated
- [x] SECURITY_MODEL.md updated
- [x] MODULE_BOUNDARIES.md updated
- [x] DATA_MODEL.md updated
- [x] Pilot/demo guide exists
- [x] Technical debt register exists

## Known Technical Debt

| Item | Impact | Priority |
|---|---|---|
| Repository mappers use `Record<string, unknown>` | Type safety | Low |
| No real MCP servers implemented | Integration | Medium |
| No real Postiz integration | Publishing | Medium |
| No real analytics pulls | Reporting | Medium |
| No UI/dashboard yet | UX | Medium |
| No real Paperclip/ResourceSpace integration | Asset management | Low |
| No real M5 authorization process | Governance | High |
| No production deployment scripts | Operations | High |
| BullMQ Redis connection type cast | Type safety | Low |

## Pilot Limitations

- All external integrations are mock/provider-based
- No real publishing, scheduling, or messaging
- No real CRM or analytics
- No real rendering or file uploads
- M5 execution blocked by design
- Dashboard/UI not yet built

## Next Steps Before Real Execution

1. Implement real MCP servers for Postiz, analytics
2. Implement M5 authorization process with governance approval
3. Build dashboard/UI for stakeholder interaction
4. Add production deployment scripts
5. Integrate real ResourceSpace for asset management
6. Enable real CRM/WhatsApp through MCP mediation
7. Add monitoring and alerting for production

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/tanaghum` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret (change in production) | `dev-secret-change-in-production` |
| `NODE_ENV` | Environment | `development` / `test` / `production` |

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-17 | Initial creation | Sprint 20 |
