# Pilot Scope

> **Version**: v0.1-stitch-foundation-demo

## What the Pilot Will Test

- End-to-end campaign workflow (mock mode)
- SAIF decision framework with 10 evaluation dimensions
- Approval routing with risk-based rules
- Capability resolution pipeline
- MCP mediation boundary enforcement
- SPINE execution lineage
- Observability and audit trail
- Publishing preparation with readiness checks
- Mock analytics and learning signals
- Demo UI navigation

## What Remains Mock

| System | Status |
|---|---|
| Postiz publishing | Mock provider |
| Analytics pulls | Mock provider |
| CRM lead creation | Mock provider |
| WhatsApp messaging | Mock provider |
| Rendering/image generation | Mock provider |
| ResourceSpace | External reference only |
| Paperclip | Operating surface only |

## What Is Not Allowed

- Real publishing to social platforms
- Real customer messaging (WhatsApp, email)
- Real CRM writes
- Real analytics data pulls
- Real rendering/file generation
- M5 write-enabled execution
- Direct external API calls
- Automatic strategy changes

## Who Should Review

| Reviewer | Focus Area |
|---|---|
| Product Owner | Demo flow, stakeholder value |
| CCO | Governance, approval workflow |
| Security Lead | Kill switches, JWT, demo safety |
| Engineering Lead | Architecture, technical debt |
| Stakeholders | Understanding, feedback |

## Success Criteria

- All demo flows complete without errors
- Stakeholders understand the platform value
- No real external calls occur
- M5 execution remains blocked
- Audit trail is complete
- Feedback is collected for next phase

## Risks

| Risk | Mitigation |
|---|---|
| Demo data confusion | Clearly label mock data |
| Stakeholder expectation of live features | Walkthrough explains limitations |
| Technical issues during demo | Smoke tests pass beforehand |
| Security concerns | Kill switches and demo mode verified |

## Data Boundaries

- No real customer PII
- No real phone numbers or emails
- No real API keys or secrets
- All data is placeholder/demo only

## Approval Boundaries

- Demo approvals are simulated
- Real approval workflow will use governance agents
- CCO authority is preserved in demo

## M5 Authorization (Future Phase)

For real execution, M5 authorization will require:
1. Explicit environment flag
2. SAIF decision approval
3. Human authority confirmation
4. MCP mediation approval
5. SPINE execution record
