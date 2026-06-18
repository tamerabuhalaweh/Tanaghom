# Stakeholder Walkthrough

> **Version**: v0.1-stitch-foundation-demo
> **Audience**: Non-technical stakeholders

## What You're Looking At

This is a **controlled demo** of the Tanaghum AI Commercial Automation Platform. Everything you see runs safely — no real messages are sent, no real posts are published, no real customers are contacted.

## The Journey

### 1. Login & Identity
When a team member logs in, the system creates an **AgentRep** — a digital delegate that acts on their behalf. Every action is traced back to the human who started it.

### 2. Campaign Creation
A team member creates a campaign request — for example, "Promote our new wellness course on LinkedIn."

### 3. AI Draft Generation
The AI (running in safe mock mode) generates a draft post optimized for the platform. You can see the draft, but nothing is published.

### 4. Algorithm Evaluation
The system evaluates the draft for reach potential — hashtags, timing, format, engagement signals. This is a readiness score, not a guarantee.

### 5. SAIF Decision
A structured decision record is created with 10 evaluation dimensions. Three are critical: Security, Human Oversight, and Compliance. These must pass before anything moves forward.

### 6. Approval Routing
Based on risk level, the draft routes to the right reviewers. Low-risk content needs one approval. High-risk content needs three, including the CCO.

### 7. Capability Resolution
The system resolves the full chain: Intent → Objective → Capability → ExecutionPattern → Resource → Implementation. This ensures every action is traceable and governed.

### 8. MCP Mediation
External systems (like Postiz for publishing) are accessed through mediated connectors — never directly. This is a safety boundary.

### 9. SPINE Lineage
Every execution produces a **SPINE** — a record of what happened, what was produced, and why. This is the audit trail.

### 10. Observability
All events are recorded — who did what, when, and with what result. Learning signals capture patterns that may inform future decisions.

### 11. Publishing Preparation
A publishing package is created with all readiness checks. The system confirms everything is safe before anything could go live. In this demo, **publishing is blocked by design**.

### 12. Mock Postiz
The publishing system (Postiz) runs in mock mode — it accepts the package but doesn't actually post anything.

### 13. Analytics (Mock)
Mock analytics show what the system would track — impressions, reach, engagement. No real data is pulled.

### 14. Learning Review
Learning signals are created from mock data. They go through a review process before any knowledge is updated.

### 15. CRM/WhatsApp (Mock)
Lead capture and handoff requests are prepared but no real messages are sent.

### 16. Production/Rendering (Mock)
Creative briefs and rendering packages are prepared. M5 rendering is blocked by design.

### 17. Safety Status
The Safety Status page shows all gates — what's blocked, what's allowed, and why.

## What's Safe

- ✅ No real publishing
- ✅ No real messaging
- ✅ No real CRM writes
- ✅ No real analytics pulls
- ✅ No real rendering
- ✅ M5 execution blocked
- ✅ All external calls mediated
- ✅ Full audit trail

## What's Not Yet Ready

- ❌ Real Postiz integration
- ❌ Real CRM/WhatsApp
- ❌ Real analytics
- ❌ Real rendering
- ❌ Dashboard/UI polish
- ❌ Production deployment

## Questions?

This is a foundation demo. The architecture is built. The next phase connects real systems with the same safety guarantees.
