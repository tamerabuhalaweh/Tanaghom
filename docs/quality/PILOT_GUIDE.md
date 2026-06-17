# PILOT_GUIDE.md — Controlled Demo/Pilot Guide

> **Version**: 1.0
> **Date**: 2026-06-17
> **Sprint**: 20 — End-to-End QA, Security Hardening & Production Readiness

## What Can Be Demonstrated

### Identity & Governance
- HumanUser authentication
- AgentRep delegation and Session Context Lock
- Role-based access control (Admin, CCO, Department Head, Specialist, Reviewer, Viewer)
- Department-based routing (5 RevOps departments + CCO)

### SAIF Decision Framework
- Decision record creation with mandatory evaluation dimensions
- Critical dimension enforcement (Security Posture, Human Oversight, Compliance)
- Decision lifecycle (draft → evaluating → accepted → execution_ready)
- DKS knowledge entries with versioning

### Campaign & Approval Workflow
- Campaign request creation
- AI draft generation (mock)
- Reach readiness scoring (mock)
- Approval routing based on risk category
- Approval actions (approve, reject, request changes)

### Capability Resolution
- Intent → Objective → Capability → ExecutionPattern → Resource → Implementation chain
- MCP mediation requirement enforcement
- M5 execution blocking

### SPINE Execution Lineage
- Run creation and status tracking
- Artifact creation with content hash
- Parent-child run relationships
- Replay bundle reconstruction

### Analytics & Learning (Mock)
- Mock analytics snapshot creation
- Performance report generation
- LearningSignal creation and review
- Governed DKS update workflow

### Production Preparation
- Publishing package creation with readiness checks
- Manifest generation (deterministic hash)
- Creative brief and rendering package preparation

## What Is Mock Only

| System | Status |
|---|---|
| Postiz publishing | Mock provider only |
| Analytics pulls | Mock provider only |
| CRM lead creation | Mock provider only |
| WhatsApp messaging | Mock provider only |
| Rendering/image generation | Mock provider only |
| ResourceSpace | External reference only |
| Paperclip | Operating surface only |

## What Is Blocked by Design

| Action | Reason |
|---|---|
| M5 publishing | Requires explicit M5 authorization process |
| M5 rendering | Requires explicit M5 authorization process |
| M5 CRM/WhatsApp | Requires explicit M5 authorization process |
| Direct external access | MCP mediation required |
| Automatic DKS updates | Requires authority decision |
| LearningSignal auto-approve | Evidence only, cannot execute |

## How to Run Locally

```bash
# Install dependencies
npm ci

# Set up environment
cp .env.example .env
# Edit .env with your database/redis credentials

# Run database migrations
npx prisma migrate deploy

# Seed development data
npx prisma db seed

# Start development server
npm run dev

# Run tests
npm test

# Run lint and typecheck
npm run lint
npm run typecheck
```

## How to Run Tests

```bash
# All tests
npm test

# Lint only
npm run lint

# Typecheck only
npm run typecheck

# Build only
npm run build
```

## How to Explain STITCH to Stakeholders

### What is STITCH?
STITCH is the operating substrate that governs how AI agents, human users, and external systems interact. It ensures every action is traceable, governed, and auditable.

### Key Principles
1. **AgentRep is the delegated identity** — agents act through AgentReps bound to humans
2. **Capabilities are resolved before tools** — Intent → Objective → Capability → Execution
3. **MCP mediates external access** — agents never directly access external systems
4. **SPINE records everything** — every execution has lineage and replay capability
5. **SAIF governs decisions** — structured evaluation with critical dimension enforcement

### What's Ready for Demo
- Full identity and governance workflow
- SAIF decision framework with 10 evaluation dimensions
- Campaign → approval → publishing preparation flow
- Analytics → learning → DKS update workflow
- Asset cognition and production preparation

### What's Not Yet Ready
- Real external system integrations (all mock)
- Dashboard/UI (command-line only)
- M5 execution authorization process
- Production deployment

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-17 | Initial creation | Sprint 20 |
