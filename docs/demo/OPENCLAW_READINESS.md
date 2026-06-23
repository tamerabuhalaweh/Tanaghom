# OpenClaw Readiness

> **Version**: 1.0
> **Date**: 2026-06-23

## Purpose

Define the OpenClaw architecture integration status for the Commercial/Social demo.

## Architecture

OpenClaw is an **adjacent channel/orchestration layer**, not a source of truth.

```
Tanaghum STITCH Core
    → Capability Resolution
    → SAIF Approval Gateway
    → MCP Connector Layer
    → OpenClaw / Postiz / Social APIs
```

## Rules

1. **OpenClaw must NOT become source of truth** — STITCH Core remains authoritative
2. **OpenClaw must NOT trigger publishing** — Requires SAIF approval + MCP mediation
3. **OpenClaw must NOT trigger CRM** — Requires explicit authorization
4. **OpenClaw must NOT trigger WhatsApp** — Requires explicit authorization
5. **OpenClaw must NOT trigger voice** — Requires explicit authorization
6. **OpenClaw must NOT trigger M5** — M5 blocked by design
7. **No autonomous execution** — All actions require human approval
8. **No direct external API calls** — All access through MCP mediation

## Current Status

| Feature | Status |
|---|---|
| Architecture defined | ✅ |
| MCP connector layer | ✅ Defined |
| OpenClaw integration | ⏳ Planned |
| Channel orchestration | ⏳ Planned |
| Direct external access | ❌ Blocked |

## Demo UI Label

"OpenClaw-ready channel orchestration: planned / blocked until authorized."

## Integration Roadmap

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Architecture defined | ✅ Current |
| Phase 5 | AI voice/chat agent handoff | ⏳ Planned |
