# Commercial/Social UI Shell Rebuild Spec

Status: Sprint 35 implementation guide

## Decision

The Commercial/Social MVP uses `satnaing/shadcn-admin` as the reference shell and interaction model. The repo does not vendor or copy the full upstream app. The local implementation adapts its proven patterns:

- grouped sidebar navigation
- clear product/admin separation
- fixed, responsive app shell
- consistent page header rhythm
- card/table/form primitives
- restrained radius, spacing, and badge usage
- readable dashboard hierarchy
- technical screens secondary to the product workflow

Tremor may be used only for analytics/dashboard visualization components. HeroUI and TailAdmin are not used in this rebuild to avoid mixing design systems.

## Product Direction

The UI must present Tanaghum as a working Commercial/Social AI operating module:

1. AI prepares.
2. Human users approve.
3. The system records evidence.
4. External scheduling, CRM, messaging, voice/chat, and write actions remain governed and authorization-gated.

The customer-facing journey is:

Campaign Brief -> AI Drafts -> Optimization -> Approval -> Publishing Package -> Analytics -> Lead Handoff -> Evidence

## Navigation Rules

Primary navigation must show only customer-facing work areas:

- Command Center
- Campaigns
- AI Draft Studio
- Approvals & Publishing
- Analytics & Leads

Secondary navigation must contain admin/settings/evidence:

- AI Provider
- Users & Roles
- Agent Skills
- Integrations
- Credentials
- Safety Gates
- Evidence

Admin/technical screens must not dominate the first viewport or main customer flow. They exist for setup, governance, and audit.

## Role Visibility Rules

The frontend hides navigation items that do not match the signed-in user's role where role data is available. Backend authorization remains authoritative.

Required roles:

- Admin
- Department Manager
- Social Media Manager
- Social Media Specialist
- Marketing Manager
- Sales Manager
- Lead Qualification Manager
- Approver / Final Publisher
- Viewer / Executive

Unknown or demo users default to a broad sandbox view so the demo account does not lose access accidentally.

## Component Rules

All customer-facing pages must use the shared product UI primitives:

- `ProductPage`
- `ProductCard`
- `MetricCard`
- `WorkflowRail`
- `ProductStatus`
- `PrimaryAction`
- `SecondaryAction`
- `DetailGrid`
- `ReadableQueue`
- `ProductTable`
- `Field`
- `Notice`
- `EmptyProductState`

Rules:

- One max content width.
- One page header pattern.
- One card radius and border style.
- One button style.
- One badge/status style.
- One table style.
- One form field style.
- One empty/loading/error/success pattern.
- No page-specific card systems in the customer path.
- No nested cards unless the inner card is a repeated data item.
- No raw JSON in the main path.
- No raw UUIDs in customer-facing content.
- No scattered badge overload.

## Wording Rules

Use customer-facing business language:

- Approval Required
- Ready for Review
- Package Prepared
- Publishing Package Ready
- Sandbox Scheduling Off
- CRM Handoff Ready
- Voice Follow-up Ready
- Requires Authorization
- Requires Credentials
- External Writes Off
- Human Approval Required

Avoid primary customer-facing jargon:

- STITCH
- SAIF
- MCP
- M5
- internal module names
- raw connector IDs
- raw object IDs
- fake labels such as Lead A / Lead B

Technical names may appear only inside Admin / Evidence screens where they help implementation teams.

## Page Rules

### Command Center

Purpose: executive/product operator landing page.

Must show:

- current campaign
- next action
- workflow progress
- readiness score
- publishing package status
- lead handoff status
- safe external execution summary

Must not become an architecture dashboard.

### Campaigns

Purpose: marketing operator workspace.

Must show:

- campaign queue
- campaign brief
- platform drafts
- optimization
- approval handoff
- publishing package preparation
- Postiz payload preview after approval

### AI Draft Studio

Purpose: create campaign ideas and convert selected idea into a campaign.

Must show:

- business goal
- audience
- platform selection
- generated ideas
- human selection
- campaign creation

### Approvals & Publishing

Purpose: human approval and publishing package review.

Must show:

- pending approval queue
- approve/reject/request changes
- prepared package status
- clear Postiz scheduling gate

### Analytics & Leads

Purpose: performance intelligence and lead handoff.

Must show:

- reach/impressions/engagement/lead metrics
- learning signal
- lead queue
- lead details
- GHL handoff package
- voice/chat handoff package
- blocked execution state

## Safety Presentation

Safety must be visible but not visually dominant. The main product message is capability plus governance, not fear.

Customer-facing labels should say:

- External Writes Off
- Requires Authorization
- Sandbox Scheduling Off
- Human Approval Required
- Requires Credentials

Admin/evidence screens can use deeper technical labels.

## Acceptance Criteria

- Product no longer feels like scattered demo/admin pages.
- All five customer-facing pages look like one product.
- Navigation is simple and business-focused.
- Admin/technical concepts are secondary.
- No raw UUIDs in the customer path.
- No STITCH/SAIF/MCP/M5 jargon in the customer path.
- Safety is visible without dominating the UI.
- Campaign workflow is usable by a non-technical marketing manager.
- Playwright customer walkthrough passes.
- Frontend build passes.
- Backend tests remain green.

Tests passing alone is not sufficient. Completion requires visible product consistency across the live customer path.
