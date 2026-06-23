# Voice/Chat Agent Handoff Plan

> **Version**: 1.0
> **Date**: 2026-06-23

## Purpose

Define the AI voice/chat agent handoff status for the Commercial/Social demo.

## Architecture

```
Tanaghum STITCH Core
    → Capability Resolution
    → SAIF Approval Gateway
    → MCP Connector Layer
    → Voice/Chat Agent API
```

## Current Status (Demo)

| Feature | Status | Label |
|---|---|---|
| AI voice agent handoff | Mock/Planned | Not connected |
| AI chat agent handoff | Mock/Planned | Not connected |
| Real voice calls | ❌ Blocked | No real calls |
| Real chat triggers | ❌ Blocked | No real chat |
| Real WhatsApp | ❌ Blocked | No real messages |

## Demo Path

1. Campaign generates content
2. Voice/chat handoff prepared (mock)
3. Agent handoff package created (mock)
4. **No real voice calls triggered**
5. **No real chat sessions started**

## Voice/Chat Agent Rules

1. **Voice/chat agent is only an external engagement surface** — Not source of truth
2. **No real voice calls** — Unless explicitly using safe test sandbox
3. **No real chat triggers** — Unless explicitly authorized
4. **No real WhatsApp** — Blocked by design
5. **Behind explicit environment flags** — Default OFF
6. **MCP mediation required** — No direct API calls

## Environment Flags

| Flag | Default | Description |
|---|---|---|
| `VOICE_AGENT_ENABLED` | `false` | Enable voice agent |
| `CHAT_AGENT_ENABLED` | `false` | Enable chat agent |
| `VOICE_SANDBOX_MODE` | `true` | Use sandbox mode |
| `CHAT_SANDBOX_MODE` | `true` | Use sandbox mode |

## Integration Roadmap

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Mock handoff preparation | ✅ Current |
| Phase 5 | AI voice/chat agent handoff | ⏳ Planned |
