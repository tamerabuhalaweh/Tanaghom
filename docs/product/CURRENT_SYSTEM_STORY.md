# Tanaghum Commercial/Social Platform — Current System Story

## Executive Summary

Tanaghum is now a production-oriented Commercial/Social AI operating module. It is designed to help a marketing team create campaigns, generate AI-assisted social content, review quality, require human approval, prepare scheduling packages, and record evidence.

The system does not hardcode customer integrations. Each customer tenant brings its own AI provider, Postiz channels, CRM credentials, voice/chat credentials, and social accounts.

## Core System Story

1. A user signs in to a tenant-scoped workspace.
2. The system loads the customer workspace, user role, profile, subscription/entitlement state, and available navigation.
3. The Dashboard summarizes the current Commercial/Social workflow:
   - Campaign count
   - Review load
   - Content package count
   - Customer-interest count
   - Workflow readiness
   - AI model status
   - Scheduling service status
   - Social channel status
   - Course-sales growth readiness
   - Qualified leads and course CTA signals where connected data exists
4. The Growth Engine summarizes the course-sales operating model:
   - course campaign templates,
   - content velocity,
   - course lead funnel,
   - Social Algorithm Knowledge Pack,
   - GoHighLevel and SmartLabs readiness,
   - recommended next actions.
5. A marketing user creates or selects a campaign, including course-sales templates for launch, lead magnet, event, testimonial, or book/app-to-course conversion.
6. If an AI provider is configured, the user can generate campaign ideas and platform-specific drafts.
7. Drafts are saved as content records and can be edited by the user.
8. The selected draft is reviewed for quality and readiness.
9. The Social Algorithm Knowledge Pack supplies approved guidance for hook, CTA, format, hashtag, risk, and platform-fit recommendations.
10. The user submits the draft for human review.
11. A reviewer approves, rejects, or requests changes.
12. Approved content unlocks publishing package preparation.
13. The system prepares a scheduling payload for Postiz-compatible scheduling.
14. Scheduling execution remains controlled until the customer has connected a real channel and authorized scheduling.
15. Performance and customer-interest views show real internal records and connected data sources as they become available.
16. Lead and handoff packages can be prepared for CRM or voice/chat systems when tenant credentials exist.
17. Administrative actions, workflow activity, credentials, and security-sensitive operations are recorded for evidence.

## Current Architecture Behavior

### Tenant and User Model

- Users belong to a tenant workspace.
- Core Commercial/Social records carry tenant ownership.
- Admin users can manage users, roles, onboarding, tenant lifecycle, subscription status, export, and deletion readiness.
- Tenant export redacts secrets, password hashes, API keys, and tokens.
- Tenant deletion is intentionally not a browser hard-delete. It is a controlled offline purge process after archive, export review, and retention approval.

### AI Provider Model

- AI provider calls go through the backend provider adapter.
- Provider keys are stored securely and are not displayed after saving.
- The UI shows provider status and configured/missing state.
- If no provider is configured, generation is blocked and the user is directed to AI Settings.

### Campaign and Content Workflow

- Campaigns are created from user-entered briefs, selected AI-generated ideas, or governed course-sales templates.
- Content drafts are generated per platform.
- Users can edit drafts.
- The system scores/reviews content quality before approval.
- Human approval is mandatory before scheduling preparation.

### Social Growth Intelligence

- The Growth Engine calculates KPIs from real tenant records: campaigns, drafts, approvals, packages, leads, and analytics snapshots.
- Course-sales templates create real campaign records and then use the same AI drafting, scoring, approval, packaging, and handoff workflow.
- The Social Algorithm Knowledge Pack uses official/public references, approved platform rules, and customer-owned analytics when connected.
- The platform does not claim access to private platform algorithms, does not scrape, does not fake engagement, and does not invent social metrics.
- Official social analytics connectors are still required before course CTA clicks, reach, engagement, and platform performance become complete live data.

### Publishing and Postiz

- Postiz is treated as the scheduling surface.
- Tanaghum prepares scheduling payloads.
- Postiz owns provider OAuth and social channel connections.
- Tanaghum can show Postiz status and channel readiness.
- Real scheduling requires:
  - customer-owned Postiz account,
  - connected channel,
  - selected scheduling channel,
  - explicit deployment/runtime authorization,
  - human approval,
  - audit record.

### CRM, Messaging, and Voice

- GoHighLevel, WhatsApp, Telegram, and SmartLabs voice are tenant-configured integration paths.
- The system can store required credentials and prepare handoff payloads.
- External writes and live triggers remain controlled until the customer provides credentials and authorizes execution.

### Operations and Security

- The platform includes request IDs, rate limiting, token revocation, MFA support, tenant export controls, backup status, monitoring status, and safety controls.
- Monitoring stack exists on the VPS.
- Backups are scriptable and locally restorable.
- Off-server backup copy and external alert routing still require customer/operator-provided destinations.

## Current Verification Status

Verified after Sprint 56:

- GitHub CI passed.
- Backend typecheck, lint, test, and build passed.
- Frontend lint and build passed.
- 979 Vitest tests passed locally.
- Product route wiring browser test passed.
- VPS deployment succeeded.
- New Prisma migrations applied successfully on the VPS.
- Backend `/health` is healthy on the VPS.
- Frontend returns 200 with security headers.
- Deployed Dashboard acceptance passed through the production Caddy URL.

## Honest Remaining Production Gaps

The platform is stronger than the previous deployed version, but these remain before a 90%+ production-readiness claim:

- Off-server backup destination is not configured.
- External alert routing destination is not configured.
- Automated billing/payment provider is not connected.
- Postiz real scheduling needs a connected customer social channel and explicit scheduling authorization.
- GoHighLevel writes need customer credentials and acceptance testing.
- WhatsApp, Telegram, SmartLabs voice, and social OAuth need real tenant credentials and acceptance testing.
- OpenClaw, agentgateway, and AgentScope are not full production runtime infrastructure yet.
- Independent penetration test is still required.
- Final browser CSP/security verification should be repeated after customer domain finalization.
