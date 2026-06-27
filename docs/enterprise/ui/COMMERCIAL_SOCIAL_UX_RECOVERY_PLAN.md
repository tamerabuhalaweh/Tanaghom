# Commercial/Social UX Recovery Plan

## Diagnosis

The current frontend passes tests, but it still feels like an internal control room. The main path exposes too many status badges, technical labels, readiness panels, and architecture concepts. The customer sees the system explaining itself instead of helping a marketing operator run work.

The product failure is not lack of backend capability. The failure is information architecture, hierarchy, and customer-facing workflow clarity.

## What Is Wrong

- The navigation is too broad for a first customer-facing product module.
- Admin and technical surfaces compete with the core marketing workflow.
- Command Center shows too much system status and not enough "what should I do next?"
- Safety and sandbox language is accurate but too dominant.
- Several screens feel like evidence dashboards rather than workspaces.
- Main-path labels still use demo, mock, M5, MCP, STITCH, and implementation language too often.
- Visual design relies on many small badges, borders, dark panels, and tiny labels.
- Leads and handoff content reads like readiness documentation instead of business pipeline work.
- Publishing readiness is split from approvals, even though the operator experiences them as one governed workflow.

## Customer-Facing Pages

Only these belong in the primary navigation:

- Command Center
- Campaigns
- AI Draft Studio
- Approvals & Publishing
- Analytics & Leads

## Admin / Technical Pages

These must be secondary and should not lead the customer walkthrough:

- AI Provider
- Users/Roles
- Agent Skills
- GHL Setup
- Credentials
- GHL Evidence
- Safety Gates
- MCP / Integrations
- Evidence / Audit

## Main Persona

The primary user is a marketing manager running campaign operations. They care about campaign objective, content quality, approval progress, publishing preparation, performance intelligence, qualified leads, and the next action.

They should not need to understand the internal architecture to complete the workflow.

## Main Workflow

1. Open Command Center.
2. See active campaign and next action.
3. Open Campaigns.
4. Review objective, audience, platforms, tone, CTA, and offer.
5. Generate AI drafts.
6. Select one draft.
7. Score and optimize the selected draft.
8. Send it for approval.
9. Approver approves or requests changes.
10. Publishing package becomes ready.
11. Postiz payload is visible.
12. Analytics shows performance intelligence.
13. Leads show qualified opportunities.
14. GHL and voice/chat handoff packages are visible but gated.
15. Evidence is available behind secondary/technical access.

## Required Screens

### Command Center

Purpose: answer what is active, what needs action, what is ready, what is performing, what leads came in, and what to do next.

Content:

- Active campaign summary.
- Next best action.
- Approval queue count.
- Publishing readiness state.
- Performance summary.
- Qualified leads summary.
- Compact sandbox environment indicator.

### Campaigns

Purpose: run the campaign workflow.

Content:

- Campaign selector.
- Campaign brief.
- Platform-specific draft generation.
- Draft editor/selection.
- Readiness score and recommendations.
- Submit for approval action.
- Create publishing package after approval.

### AI Draft Studio

Purpose: create campaign ideas and convert selected idea into a campaign.

Content:

- Business goal.
- Audience.
- Platform selection.
- Generated ideas.
- Human selection checkpoint.
- Convert to campaign action.

### Approvals & Publishing

Purpose: review human decisions and publishing preparation in one place.

Content:

- Pending approval packages.
- Approve, reject, request changes actions.
- Prepared publishing packages.
- Postiz-ready payload summary.
- Scheduling disabled reason.

### Analytics & Leads

Purpose: show business intelligence from campaign performance and lead outcomes.

Content:

- Reach, impressions, engagement, best platform, best time.
- Learning signal.
- Qualified lead queue.
- GHL payload preview.
- Voice/chat follow-up package preview.
- Gated actions with customer-facing reasons.

## Remove From Main Path

- Raw JSON.
- Raw IDs as primary text.
- Lead A / Lead B / Lead C.
- Repeated "Demo Data" labels.
- Repeated "Mock Provider" labels.
- M5.
- STITCH.
- SAIF.
- MCP.
- SPINE.
- Engineering object names.
- Integration readiness walls.
- Safety cards as the dominant visual element.

## Sandbox And Safety Placement

Safety must remain visible but calm:

- One compact top environment bar: Sandbox Workspace, External Writes Off, Scheduling Disabled.
- Inline disabled actions with short reasons.
- Technical evidence available in Admin / Evidence.
- Do not repeat safety warnings on every card.

## Visual Direction

- Use a clean SaaS workspace style with a neutral light product canvas and dark navigation.
- Reduce neon color, border density, and badge count.
- Use larger section titles and readable body copy.
- Use stable card sizes and responsive grids.
- Prefer tables/lists for queues and business records.
- Use one primary action per workflow step.
- Use customer-facing status labels: Approval Required, Package Ready, Requires Authorization, Sandbox Scheduling Disabled, CRM Handoff Ready, Voice Follow-up Ready.

## Acceptance Checklist

- Primary navigation has only five customer-facing items.
- Admin/technical items are secondary.
- Command Center answers business questions immediately.
- Campaign workflow is usable without architecture explanation.
- Approvals and publishing feel like one governed workflow.
- Analytics and leads feel like business intelligence.
- No raw JSON or raw IDs dominate customer screens.
- Technical architecture language is not in the main path.
- Safety is visible but not dominant.
- Playwright customer walkthrough passes.
- Frontend build passes.
- Backend tests remain green.
