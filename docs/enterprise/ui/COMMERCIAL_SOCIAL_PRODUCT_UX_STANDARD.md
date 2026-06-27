# Commercial/Social Product UX Standard

## Product Principle

Commercial/Social AI Operating System is a customer-facing workspace for marketing operators. The primary experience must feel like a usable product for campaign work, not a demo shell, engineering console, or architecture presentation.

The customer-facing story is:

1. AI prepares campaign content.
2. Human operators review and approve.
3. The system records evidence.
4. External writes remain governed and disabled unless explicitly authorized.

## Target User

The default persona is a marketing manager responsible for planning campaigns, preparing social content, routing approvals, reviewing performance signals, and preparing CRM or voice/chat handoff packages.

## Top Workflows

1. Review today's Commercial Command Center and identify the next required action.
2. Select or create a campaign brief with objective, audience, platforms, tone, CTA, offer, and risk category.
3. Generate LinkedIn, Instagram, and X/Twitter drafts through the backend AI provider.
4. Score the selected generated draft and review best platform, best time, best format, hook quality, CTA strength, hashtag hygiene, and compliance notes.
5. Submit for approval, record the human decision, unlock publishing preparation, preview the Postiz-ready payload, prepare lead intelligence, and review evidence.

## Page Map

Customer-facing navigation:

- Command Center
- Campaigns
- AI Draft Studio
- Approvals
- Publishing
- Analytics
- Leads
- Integrations
- Evidence

Admin and technical navigation:

- AI Provider
- Users/Roles
- Agent Skills
- MCP/Connectors
- Safety Gates
- Technical Evidence

## Component Map

- KPI cards answer what changed and what needs attention.
- Action queue cards show the next operational action.
- Workflow rail shows state movement from brief to evidence.
- Draft cards show editable platform-specific content.
- Score panels show real readiness outputs for the selected draft.
- Approval panels show human decision state and available decisions.
- Publishing panels show Postiz status, payload summaries, and blocked write actions.
- Lead panels show realistic sandbox lead records, qualification scores, next action, owner, and payload status.
- Evidence panels show readable audit and event summaries, not raw JSON.

## Data Required Per Page

- Command Center: campaigns, approvals, publishing packages, integration status, lead captures, safety status, analytics summary.
- Campaigns / AI Draft Studio: campaign brief, generated drafts, selected draft, scoring result, approval package.
- Publishing: approved package, platform payloads, Postiz sandbox health, scheduling payload, write gate reason.
- Leads: lead records, campaign attribution, qualification score, GHL payload preview, voice/chat payload preview.
- Evidence: audit records, observability events, approval decisions, package creation events.

## Visual Hierarchy

- The first screen must prioritize business work: active campaign, approvals, publishing readiness, performance signal, leads, and next action.
- Technical architecture must not dominate the main path.
- Safety status belongs in a compact top bar and inline blocked-action explanations.
- Dashboards should use dense, scannable sections with stable dimensions, not oversized marketing hero blocks.

## Copywriting Rules

Use customer-facing language:

- Approval required
- Package prepared
- External write blocked
- Sandbox credentials missing
- Ready for review
- Ready for scheduling package
- CRM payload prepared

Avoid main-path architecture language:

- STITCH
- SAIF
- MCP
- SPINE
- M5
- AgentRep

Those terms may appear in Admin, Evidence details, and technical documentation.

## Integration Status Labels

Use only these labels in the product UI:

- Live Provider Active
- Sandbox Connected
- Sandbox Ready
- Mock Provider
- Requires Credentials
- Requires Authorization
- Blocked
- M5 Disabled

Do not show "connected" unless the backend has verified the health or credential state.

## Safety Label Placement

- Top environment bar: Sandbox Workspace, External Writes OFF, M5 Disabled, Postiz Sandbox Ready or Requires Credentials.
- Inline action buttons: disabled reason must explain the missing gate.
- Evidence area: show exactly what was recorded and what was blocked.

Safety labels should reassure; they should not turn the whole screen into a compliance dashboard.

## Main Customer Path Must Never Show

- Raw JSON
- Lead A / Lead B / Lead C
- Fake demo naming as the main identity
- Generic architecture readiness cards
- Future enterprise module navigation
- Finance, HR, procurement, inventory, supply chain, ERP, or unrelated departments
- Debug-only IDs as primary text

IDs may appear as secondary evidence details.

## Accessibility Requirements

- All interactive elements must be keyboard reachable.
- Buttons must use clear command labels.
- Disabled buttons must include a visible reason.
- Color must not be the only indicator of status.
- Text must fit in cards at desktop and mobile widths without overlap.

## Responsive Requirements

- Primary workflow remains usable at laptop width.
- Cards wrap before text overlaps.
- Side navigation may compact, but customer-facing page names must remain understandable.
- Fixed-format elements such as workflow rails, KPI cards, and gauges must have stable dimensions.

## Playwright Review Checklist

- Login succeeds.
- Command Center loads as the first product workspace.
- Campaign can be selected.
- Drafts generate for platform-specific output.
- Selected draft can be scored.
- Approval can be submitted and decided.
- Publishing package is unavailable before approval and available after approval.
- Postiz payload/status is readable without raw JSON.
- Leads show realistic sandbox records.
- GHL and voice/chat payloads are previewable and write actions remain blocked unless authorized.
- Evidence timeline is readable.
- No raw JSON appears in the main customer path.
- Frontend build, backend tests, and Playwright walkthrough pass.

## Before / After Direction

Before: The interface looked like a demo/control-plane with many readiness panels and architecture terms.

After: The interface behaves like a Commercial/Social operating workspace. Architecture remains present as governed evidence and admin controls, but the customer path is campaign work first.
