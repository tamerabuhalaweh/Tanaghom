# Postiz Sandbox Readiness

> **Version**: 1.0
> **Date**: 2026-06-23

## Purpose

Define the Postiz integration status and sandbox deployment readiness for the Commercial/Social demo.

## Architecture

Postiz is an **execution/scheduling surface**, not the intelligence brain.

```
Tanaghum STITCH Core
    → Capability Resolution
    → SAIF Approval Gateway
    → MCP Connector Layer
    → Postiz (scheduling/publishing surface)
```

**Tanaghum owns**: strategy, AI recommendations, approval, audit, learning signals, platform scoring, reach/readiness intelligence.

**Postiz provides**: scheduling/publishing preparation, possibly analytics where available, external publishing surface later.

## Current Status

| Feature | Status |
|---|---|
| Publishing preparation package | ✅ Working |
| Readiness checks | ✅ Working |
| Mock Postiz provider | ✅ Active |
| Real Postiz connection | ❌ Blocked |
| Real post publishing | ❌ Blocked |
| Real scheduling | ❌ Blocked |

## Sandbox Deployment (Optional)

If credentials are provided, Postiz can be deployed as a sandbox:

```bash
# Add to docker-compose.demo.yml
# POSTIZ_API_KEY=your-sandbox-key
# POSTIZ_URL=https://sandbox.postiz.com
```

**Rules:**
- Default: mock/sandbox status only
- No real posts published unless explicitly authorized
- No real scheduling unless explicitly authorized
- Credentials must be provided by operator
- Environment flag: `POSTIZ_SANDBOX_ENABLED=false` (default)

## Demo UI Labels

| Label | Meaning |
|---|---|
| Mock Provider | Using mock Postiz provider |
| Sandbox Ready | Postiz sandbox available but not connected |
| Blocked | Real publishing blocked |
| Human Approval Required | Publishing requires human approval |
| M5 Disabled | M5 write execution disabled |

## Integration Roadmap

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Demo/mock analytics and publishing preparation | ✅ Current |
| Phase 3 | Approval-gated Postiz scheduling | ⏳ Planned |
