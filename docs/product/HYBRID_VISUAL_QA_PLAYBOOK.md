# Hybrid Visual QA Playbook

Status: Active for customer-facing Hybrid releases.
Purpose: Verify that the product is usable for non-technical marketing and sales users before deployment.

## Required Personas

Run the browser walkthrough with:

- Admin
- Marketing manager
- Sales manager
- Social media manager
- Viewer

Each role must see only the pages that belong to the role.

## Required Viewports

- Desktop: 1440 x 900
- Laptop: 1280 x 800
- Tablet: 768 x 1024
- Mobile: 390 x 844

## Pages To Capture

1. Home
2. Events
3. Event Workspace - Overview
4. Event Workspace - Plan
5. Event Workspace - KPIs
6. Event Workspace - Leads
7. Event Workspace - Risks
8. Event Workspace - Learning
9. Content
10. Review
11. Scheduling
12. Performance
13. Integrations

## Pass Criteria

For each page:

- No console errors.
- No failed API responses except known permission-hidden requests.
- No horizontal page overflow.
- No overlapping cards.
- No clipped primary buttons.
- Text wraps inside cards and status badges.
- Tables scroll horizontally inside their own container only.
- Empty states explain what the user should do next.
- The primary action is visible without needing architecture knowledge.

## Customer Workflow Walkthrough

1. Log in as a marketing manager.
2. Open Home.
3. Confirm next actions are understandable.
4. Open Events.
5. Select an event.
6. Review Overview.
7. Open Plan and confirm the event strategy is readable.
8. Open KPIs and confirm data-source guidance is clear.
9. Open Leads and confirm CRM/GHL status is understandable.
10. Open Risks and confirm blockers are readable.
11. Open Learning and confirm closeout evidence is readable.
12. Open Content.
13. Generate or review campaign ideas.
14. Confirm saved content is visible in Content Library.
15. Open Integrations.
16. Select GoHighLevel.
17. Confirm setup steps are clear and secrets are not displayed.
18. Select Postiz.
19. Confirm channel and analytics-test guidance is clear.

## Release Decision

Do not deploy as a customer release if:

- the main workflow requires opening Admin/Ops pages,
- a normal role sees hidden technical runtime pages,
- any customer-facing page uses STITCH, SAIF, MCP, M5, agentgateway, AgentScope, or OpenClaw language,
- a card overlaps another card,
- charts render at zero or negative size,
- the user cannot identify the next action in under 10 seconds.

## Evidence To Keep

For each release candidate, keep:

- frontend lint/build output,
- backend lint/typecheck/test/build output when backend changed,
- browser screenshots,
- console log summary,
- deployed URL,
- commit SHA,
- known blockers and customer-owned prerequisites.
