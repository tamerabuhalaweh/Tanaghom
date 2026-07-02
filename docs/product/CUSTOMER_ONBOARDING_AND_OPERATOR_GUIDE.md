# Customer Onboarding and Operator Guide

## Purpose

This guide explains how a customer team operates the Tanaghum Commercial/Social product after onboarding.

The product principle is:

**AI prepares. Human approves. The system records. External execution requires customer-owned credentials and explicit authorization.**

Tanaghum is the operating system for campaign strategy, content preparation, approval, lead tracking, evidence, and reporting. External tools such as Postiz, Meta, YouTube, Formaloo, GoHighLevel, WhatsApp, Telegram, and SmartLabs remain customer-owned systems that must be configured by the tenant before production connector flows can run.

For the required accounts and credentials, use the [Customer-Owned Credential Checklist](../integrations/CUSTOMER_OWNED_CREDENTIAL_CHECKLIST.md).

## Product Roles

| Role | Main Responsibility | Typical Pages |
|---|---|---|
| Admin | Workspace setup, users, credentials, tenant controls, security, operations | Users & Roles, Tenant Admin, Credentials, Integrations, Operations, Security |
| Marketing/Sales Manager | Event strategy, campaign planning, lead funnel review, sales outcomes | Dashboard, Growth Engine, Campaigns, Performance |
| Social Media Manager | Daily content creation, draft editing, review submission, scheduling preparation | Campaigns, Content Creator, Scheduling |
| Reviewer / Approver | Human approval before publishing preparation | Review & Approve |
| Sales Manager | Lead lifecycle, meetings, no-shows, purchases, follow-ups | Performance, Leads, event dashboard |
| Lead Qualification Manager | Lead quality, temperature, next action, CRM handoff readiness | Performance, Leads, Growth Engine |
| Viewer | Read-only visibility into dashboards and evidence | Dashboard, Performance, Activity Log |

## Before First Use

The customer or tenant admin should prepare:

- The production user list and role assignments.
- The first event name, event date, location, revenue target, expected attendance, and budget.
- The campaign start date, normally around one month before the event.
- The AI model provider choice and tenant-owned API key if real AI generation is required.
- Postiz workspace access if scheduling preparation should connect to social channels.
- Business social accounts, such as Meta/Instagram professional or business accounts, when the provider requires them.
- GoHighLevel, Formaloo, WhatsApp, Telegram, SmartLabs, Meta, and YouTube credentials only if those connectors will be activated.
- An agreed rule for which external actions are allowed in sandbox and which remain blocked.

Do not send raw credentials in email, chat, or this guide. Configure them only through the approved application credential screens or the agreed secret-management process.

## First Login

1. Open the Tanaghum production URL.
2. Sign in with the user email and password.
3. Complete MFA if the account requires it.
4. Land on **Dashboard**.
5. Confirm the sidebar shows the user role and the pages allowed for that role.

If login fails, the Admin should verify that the user exists, the user is active, the password or invite flow was completed, and the correct tenant workspace is being used.

## Admin Onboarding Workflow

### 1. Confirm Workspace

Open **Tenant Admin**.

Confirm:

- Workspace name and tenant key.
- Subscription and entitlement status.
- Tenant export readiness.
- Deletion controls are protected and not available as casual browser hard-delete.

### 2. Add Users and Roles

Open **Users & Roles**.

For each user:

1. Create or invite the user.
2. Assign the correct business role.
3. Confirm the user has a work profile.
4. Confirm the user can only see the pages and actions needed for their role.

Recommended starting roles:

- Admin: workspace owner or technical owner.
- Marketing/Sales Manager: Amro or campaign owner.
- Social Media Manager: daily content operator.
- Reviewer / Approver: person responsible for human approval.
- Sales Manager or Lead Qualification Manager: lead follow-up and revenue tracking.

### 3. Configure AI Model

Open **AI Settings**.

1. Select the provider supported by the tenant, such as OpenAI, Claude, DeepSeek, or another configured provider.
2. Enter the tenant-owned API key using the secure setup form.
3. Save.
4. Verify the page shows configured status only.

Expected behavior:

- Raw API keys are never displayed after saving.
- If no provider is configured, real AI generation remains unavailable and the UI should explain what is missing.

### 4. Configure Optional Connectors

Open **Credentials** and **Integrations**.

Configure only the connectors the customer has approved:

- Postiz for scheduling channel visibility and approved scheduling payloads.
- Meta/Instagram and YouTube for official analytics.
- Formaloo for form and lead data.
- GoHighLevel for CRM handoff.
- WhatsApp and Telegram for messaging paths.
- SmartLabs for voice/chat handoff.

Each connector should show:

- Missing, configured, or validated state.
- Required customer credential.
- Data accessed.
- Whether it can write externally.
- Whether approval is required.
- Whether execution is blocked.

## Daily Workflow for Amro

### Morning Review

1. Open **Dashboard**.
2. Review campaign progress, prepared posts, scheduling packages, qualified leads, and growth readiness.
3. Open **Growth Engine**.
4. Review the course-sales funnel and next best actions.
5. Check whether any connector or AI model setup is blocking the workflow.

### Event Strategy

1. Open **Campaigns** or the event dashboard once the event has been created.
2. Confirm:
   - event date
   - location
   - target audience
   - revenue target
   - expected attendance
   - planned budget
   - campaign start date
   - FOMO angle
   - upsell plan
   - planned channels
3. Use templates when appropriate:
   - course launch waitlist
   - lead magnet or comment keyword
   - live event conversion
   - transformation story
   - book/app-to-course bridge

### Content Preparation

1. Open **Content Creator**.
2. Enter the brief for the event or campaign.
3. Generate campaign ideas when the AI model is configured.
4. Select the strongest idea.
5. Create the campaign.
6. Generate platform-specific drafts for LinkedIn, Instagram, and X/Twitter.
7. Edit drafts as needed.

### Human Review

1. Send the selected draft to **Review & Approve**.
2. The reviewer checks:
   - audience fit
   - offer clarity
   - CTA strength
   - risk notes
   - platform fit
   - quality score
3. The reviewer chooses:
   - Approve
   - Request changes
   - Reject

No content should move to scheduling preparation without human approval.

### Scheduling Preparation

1. Open **Scheduling**.
2. Select the approved package.
3. Review the Postiz-ready payload.
4. Confirm whether Postiz channel visibility is available.
5. If scheduling is not enabled, follow the page instructions.

Production scheduling requires a customer-owned Postiz workspace, connected channel, approval, and execution authorization. The platform must not silently publish or schedule to customer accounts.

### Lead and Sales Follow-Up

1. Open **Performance** or the event dashboard.
2. Review:
   - new leads
   - form completions
   - booked meetings
   - attended meetings
   - no-shows
   - purchases
   - revenue
3. Update lead status as the sales team works.
4. Add next action and follow-up date.
5. Mark meeting and purchase outcomes when they happen.

If GoHighLevel is configured, the CRM handoff path can be validated according to the approved integration level. Without customer-owned GHL credentials, the platform should show readiness and payload previews only.

### End-of-Day Review

1. Review campaign and event KPIs.
2. Review open barriers or problems.
3. Review recommendations when available.
4. Confirm tomorrow's next actions.
5. Capture lessons learned for future events.

## Event Lifecycle

### 1. Draft

The event exists but strategy is not final.

### 2. Planning

The campaign plan, content requirements, lead plan, sales tasks, and connector readiness are being prepared.

### 3. Active

The event campaign is running. Leads, meetings, content, spend, and performance are actively tracked.

### 4. Completed

The event has finished. The team reviews closeout reporting and captures learning signals.

### 5. Cancelled

The event is no longer active. Historical evidence remains preserved.

## How to Read Dashboards

### Dashboard

Use this as the daily command center. It should answer:

- What is happening today?
- Which campaign or event needs attention?
- Are content, approval, scheduling, and leads moving?
- What is blocked by missing credentials or authorization?

### Growth Engine

Use this to understand whether content is helping sell courses or events.

It should show:

- course campaign progress
- lead generation readiness
- content velocity
- next best actions
- social algorithm knowledge pack status

The product does not claim private or unofficial social algorithm access. It uses governed rules, public best practices, official analytics where configured, and customer-owned performance data.

### Performance

Use this for lead and revenue health.

It should show:

- leads by lifecycle stage
- lead temperature
- meetings booked and attended
- no-shows
- purchases
- revenue
- channel attribution

## Customer-Owned Connector Responsibilities

The customer is responsible for providing and maintaining:

- social media accounts and business account eligibility
- Postiz workspace and connected channels
- GHL workspace/API credentials
- Formaloo form access
- Meta and YouTube official analytics access
- WhatsApp and Telegram credentials
- SmartLabs API key and agent ID
- consent, compliance, and approved messaging templates where applicable

Tanaghum should store only tenant-owned credential references and encrypted secrets through the approved credential flow. It should not hardcode customer credentials or share one customer's credentials across tenants.

## What Remains Controlled by Default

The following must remain blocked until the tenant explicitly configures credentials and authorizes the action:

- real social scheduling
- real publishing
- CRM writes
- WhatsApp messages
- Telegram messages
- SmartLabs voice/chat execution
- external write-back jobs
- M5/write-enabled execution

If a page shows a blocked state, that should be treated as a safety control, not a product failure. The page must explain exactly what is required to unlock the action.

## Escalation Rules

Escalate to Admin or Operations when:

- a user cannot access the expected workspace
- a role appears over-permissioned
- a credential is missing or expired
- a connector shows failed validation
- scheduling is requested for a real channel
- CRM or messaging execution is requested
- dashboard data appears incomplete
- backup, monitoring, or security readiness is not green

## Acceptance Checklist

Before customer sign-off, confirm:

- Admin can sign in and see workspace controls.
- Amro or Marketing/Sales Manager can see the event and campaign workflow.
- Social Media Manager can create or edit campaign content.
- Reviewer can approve, reject, or request changes.
- Lead/Sales role can update lead lifecycle and outcomes.
- Dashboard and Growth Engine show real tenant/event data, not static fake data.
- Connector pages explain missing customer credentials.
- No raw secret is displayed.
- External execution remains blocked unless approved.
- Activity/audit records are visible for important actions.
