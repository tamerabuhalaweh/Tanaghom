# Lead Generation & GoHighLevel Handoff Plan

> **Version**: 1.0
> **Date**: 2026-06-23

## Purpose

Define the lead generation and GoHighLevel CRM handoff status for the Commercial/Social demo.

## Architecture

```
Social Campaign → Lead Capture → Qualification → GoHighLevel CRM Handoff
```

## Current Status (Demo)

| Feature | Status | Label |
|---|---|---|
| Lead capture from social campaign | Mock/Planned | Demo data |
| Lead qualification score | Mock/Planned | Demo data |
| Campaign attribution | Mock/Planned | Demo data |
| GoHighLevel CRM handoff | Mock/Planned | Not connected |
| Real CRM writes | ❌ Blocked | No real data |

## Demo Path

1. Social campaign generates engagement
2. Lead capture record created (mock)
3. Lead qualification score calculated (mock)
4. Campaign attribution recorded (mock)
5. GoHighLevel handoff prepared (mock)
6. **No real CRM writes occur**

## GoHighLevel Integration Rules

1. **GoHighLevel is only the CRM/lead surface** — Not source of truth
2. **No real CRM writes** — Unless explicitly authorized
3. **No real lead data** — Demo data only
4. **Behind explicit environment flags** — Default OFF
5. **MCP mediation required** — No direct API calls

## Environment Flags

| Flag | Default | Description |
|---|---|---|
| `GHL_SANDBOX_ENABLED` | `false` | Enable GoHighLevel sandbox |
| `GHL_API_KEY` | (empty) | GoHighLevel API key |
| `GHL_WRITE_ENABLED` | `false` | Enable real CRM writes |

## Integration Roadmap

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Mock lead capture and qualification | ✅ Current |
| Phase 4 | GoHighLevel lead capture and qualification | ⏳ Planned |
