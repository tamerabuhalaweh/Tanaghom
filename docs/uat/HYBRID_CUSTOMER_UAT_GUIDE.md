# Tanaghum Hybrid Customer UAT Guide

**Environment:** Temporary production / customer UAT  
**Application:** https://tanaghum-backup.155-117-45-45.sslip.io  
**Prepared:** 2026-08-02  
**Scope:** Hybrid only. This guide does not apply to the isolated A/B application.

## 1. Purpose

This guide lets a first-time customer tester validate Tanaghum from annual commercial learning and planning through event execution, content, governed approvals, sales, GoHighLevel (GHL), reporting, and Stitchi.

The test is designed to answer five questions:

1. Can each user see only the work appropriate to their role?
2. Can the commercial team learn from historical evidence and turn it into an annual plan?
3. Can monthly initiatives become governed execution plans and event operations?
4. Can content and CRM actions move through human approval without hidden external execution?
5. Does Tanaghum show verified evidence and honest missing-data states instead of invented results?

## 2. Important UAT Rules

- Use only the temporary UAT accounts in the private customer copy of this guide.
- Do not use real customer names, phone numbers, payment details, or campaign secrets.
- Prefix records with `Customer UAT -` so they are easy to identify and remove.
- Use AED unless another currency is intentionally required.
- Never approve a card whose customer, amount, pipeline, stage, date, or channel is incorrect.
- A Stitchi proposal is not execution. A human must approve the action card, and external operations have a second exact-command approval.
- Do not mark a connector test as passed merely because a credential was saved. Require validation or provider read-back.
- Do not test WhatsApp sending as successful. The customer GHL location has not connected WhatsApp yet.
- Do not test Postiz publishing as successful until an eligible customer social channel is connected and live scheduling acceptance passes.

## 3. Temporary UAT Roles

Passwords and access details are distributed only in the private customer copy. They are intentionally excluded from GitHub.

| UAT identity | Internal role | Responsibility | MFA |
|---|---|---|---|
| UAT Administrator | `admin` | User setup, integrations, operations, audit and full acceptance | Enroll on first login |
| UAT Chief Commercial Officer | `cco` | Approve annual plans, strategic KPIs, executive reports and governed actions | Enroll on first login |
| UAT Commercial Manager | `department_head` | Assess, plan, operate monthly initiatives, execution plans and events | Enroll on first login |
| UAT Sales & Leads Manager | `department_head` | Operate leads, GHL customer actions, meetings and sales evidence | Enroll on first login |
| UAT Content Specialist | `specialist` | Prepare briefs, AI ideas and content drafts | Not required for UAT |
| UAT Content Reviewer | `reviewer` | Review submitted content and record decisions | Not required for UAT |
| UAT Executive Viewer | `viewer` | Read dashboards and evidence without changing records | Not required for UAT |

Privileged testers must enroll their own authenticator. Passwords, MFA codes and recovery codes must never be shared with the delivery team.

## 4. Test Evidence

For every test case record:

- tester name and role;
- date and time;
- test case ID;
- record name or ID;
- expected result;
- actual result;
- Pass, Fail or Blocked;
- screenshot for any failure;
- browser console and request ID when an error appears.

Use **Blocked** only for an identified external dependency, such as missing customer WhatsApp or Postiz channel access. A broken UI or server error is **Fail**, not Blocked.

## 5. First Login and MFA

### UAT-LOGIN-01: Normal login

**Who:** Every tester  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/login

1. Open the page in a private browser window.
2. Enter the assigned temporary email and password.
3. Select **Sign in**.
4. Confirm the application opens without an Internal Server Error.
5. Confirm the account name and business role appear under **My Account**.

**Pass:** The correct workspace opens and no other tester's identity appears.

### UAT-LOGIN-02: Privileged MFA enrollment

**Who:** Administrator, CCO, Commercial Manager and Sales & Leads Manager

1. After first login, follow the MFA enrollment screen.
2. Scan the QR code using Microsoft Authenticator, Google Authenticator, 1Password or another TOTP application.
3. Enter the current six-digit authenticator code in the visible code field.
4. Select **Verify and enable MFA**.
5. Save the recovery codes privately.
6. Sign out, sign in again, and enter a fresh authenticator code when prompted.

**Pass:** The user can complete enrollment and later sign in using password plus authenticator code.  
**Fail:** A code is requested but no code field is shown, or the enrollment loop cannot be completed.

## 6. Navigation and Role Boundaries

### UAT-NAV-01: Customer navigation

The main navigation is organized by business workflow:

- **Today:** priority actions and operational status;
- **Plans:** Assessment, Annual Plan, Execution Plans, Discipline Workspaces and Event Operations;
- **Content:** brief, AI direction, draft, review and scheduling;
- **Sales & Leads:** lead pipeline, follow-up and governed GHL actions;
- **Performance / CEO Dashboard:** verified commercial results and reporting;
- **Stitchi:** conversational assistant that prepares governed work;
- **Settings / Setup & More:** profile, MFA, AI and customer-owned integrations.

### UAT-NAV-02: Role isolation

1. Sign in as UAT Content Specialist.
2. Confirm admin pages such as **Users & Roles**, **Workspace Admin**, **Operations**, and **Activity Log** are not presented as operating tasks.
3. Sign in as UAT Executive Viewer.
4. Open pages and confirm create, approve, delete, publish and CRM execution controls are absent or disabled.
5. Sign in as UAT Administrator and confirm setup/admin pages are available under **Setup & More**.

**Pass:** Normal users are not shown administrator controls, and direct restricted access is rejected without exposing another tenant's data.

## 7. Today

### Purpose

**Today** is the starting point for daily work. It summarizes plans, events, leads, decisions, data readiness and the next action without requiring the user to inspect every module.

### UAT-TODAY-01

**Who:** Commercial Manager, Sales Manager, CCO and Viewer  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/command-center

1. Open **Today**.
2. Review the priority/next-action area.
3. Confirm cards contain business language, not sprint names or developer terminology.
4. Select one next action and confirm it opens the relevant page.
5. Confirm missing connector data is identified as missing, not represented as a real KPI.
6. Select **Ask Stitchi** and ask: `What should I focus on today?`

**Pass:** Navigation works, the answer is role-aware, and Stitchi does not claim unverified external activity.

## 8. Historical Assessment

### Purpose

Historical Assessment freezes evidence from previous commercial plans, completed events, verified KPIs, GHL lead outcomes, campaigns and recorded barriers. AI may propose findings, but only CCO/admin approval turns a finding into reusable learning.

### UAT-ASSESS-01: Review available evidence

**Who:** Commercial Manager  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/commercial-assessment

1. Open **Plans**, then **Assessment**.
2. Enter title `Customer UAT - Historical Assessment`.
3. Select the relevant business/revenue line, or all configured lines.
4. Choose a historical **From** and **To** period.
5. Optionally refine by completed event, campaign, audience text or channel.
6. Select **Review available evidence**.
7. Inspect the evidence count, recorded operating actuals, event comparison and missing-data list.

**Pass:** The preview is read-only, tenant-scoped, and identifies whether GHL, events, KPIs or campaign evidence is missing.

### UAT-ASSESS-02: Save and generate findings

1. Select **Save assessment snapshot**.
2. Open the saved assessment from **Assessment history**.
3. Select **Generate AI findings**.
4. Confirm every finding cites evidence and remains proposed/pending.
5. Reject any finding that invents a sale, result or causal claim not supported by the evidence.

**Pass:** An immutable snapshot is saved and AI findings are proposals, not approved truth.

### UAT-ASSESS-03: Approve learning

**Who:** CCO or Administrator

1. Sign in as CCO.
2. Open the same assessment.
3. Review each finding and its evidence.
4. Select **Approve** only for supported findings; select **Reject** for unsupported findings.
5. Confirm approved findings appear under **Approved learning**.

**Pass:** Only CCO/admin can approve and only approved learning becomes available to planning.

## 9. Annual Planning

### Purpose

Annual Planning turns approved learning into a yearly strategy, AED budget/revenue targets and a twelve-month product/event portfolio. It is the normal parent for execution plans.

### UAT-ANNUAL-01: Create draft annual plan

**Who:** Commercial Manager  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/commercial-planning

1. Open **Plans**, then **Annual Plan**.
2. Choose year **2026**.
3. If the visible 2026 scenario is archived, select **Create new draft scenario**. Do not try to edit an archived scenario.
4. Enter:
   - title: `Customer UAT - 2026 Commercial Growth Plan`;
   - currency: `AED`;
   - annual budget: `600000`;
   - annual revenue target: `3600000`;
   - strategy: `Grow live-event and course revenue using approved learning, segmented acquisition, CRM follow-up and measurable outcomes.`
5. Select approved historical learning if available.
6. Select **Create annual plan**.
7. Confirm cards show annual budget, allocated, unallocated and revenue target.

**Pass:** The plan is a Draft and amounts are in AED. Existing intentionally stored USD records remain separate and are not silently converted.

### UAT-ANNUAL-02: Add a monthly initiative

1. Select **August** in the month tabs.
2. Select **Add initiative**.
3. Enter:
   - title: `Customer UAT - August Leadership Course`;
   - revenue line: Online Courses or another configured line;
   - budget allocation: `50000`;
   - revenue target: `300000`;
   - objective, audience, offer and owner;
   - optional linked event only if this initiative needs event operations.
4. Save the initiative.
5. Confirm August shows the initiative and annual allocated/unallocated values update.

**Pass:** The initiative is visible under August and cannot allocate beyond governed annual limits without a controlled exception.

### UAT-ANNUAL-03: Approval lifecycle

1. As Commercial Manager, select **Submit for approval**.
2. Sign out and sign in as CCO.
3. Open the same plan and inspect strategy, learning, budget and monthly allocations.
4. Select **Approve**, or request changes if any value is wrong.

**Pass:** A Commercial Manager cannot self-approve a strategic plan reserved for CCO; the status and audit history change after CCO decision.

## 10. Execution Plans

### Purpose

Execution Plans contain detailed objectives, audiences, budgets and actions for one product, event or campaign. The default path is from an annual monthly initiative. A standalone plan is an explicit exception requiring a business reason.

### UAT-EXEC-01: Create from annual plan

**Who:** Commercial Manager

1. Return to **Annual Plan** and select August.
2. Open the saved monthly initiative.
3. Select **Create execution plan**.
4. Confirm inherited values: annual plan, month, revenue line, AED currency, budget, revenue target, optional event and approved learning.
5. Add missing objective, audience and action plan.
6. Select **Create and link execution plan**.
7. Open **Plans**, then **Execution Plans**.
8. Confirm the record says it belongs to the 2026 annual plan and August initiative.

**Pass:** Parent/child linkage is visible and inherited values are preserved.

### UAT-EXEC-02: Standalone exception

1. Open **Execution Plans**.
2. Select **Create standalone exception** only to verify the exceptional path.
3. Confirm the form requires a reason explaining why the work cannot belong to an annual month.
4. Cancel unless the customer has a legitimate exception to test.

**Pass:** Standalone creation is not presented as the normal planning route.

## 11. Discipline Workspaces

### Purpose

Discipline Workspaces let teams manage the work that supports commercial outcomes without mixing every department into one page. Current workspaces include brand positioning, acquisition, retention, sales conversion and event sales.

### UAT-DISC-01

**Who:** Commercial Manager or Specialist  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/disciplines

1. Open **Plans**, then **Discipline Workspaces**.
2. Choose one discipline.
3. Review active, blocked, completed and high-priority counts.
4. Select **Create work item**.
5. Enter a `Customer UAT -` title, category, priority, owner, due date and business note.
6. Link it to a revenue line or execution plan when relevant.
7. Save it and confirm it appears in the discipline record list.
8. Change the status to Active, Blocked or Completed and save.

**Pass:** The work item remains in the selected discipline and links to commercial context. Reviewer/viewer accounts cannot create or alter it.

## 12. Event Operations

### Purpose

Event Operations manages event-specific execution. Commercial plans set direction; this workspace handles event strategy, work packages, actual KPI evidence, leads, risks and closeout learning.

**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/events

### UAT-EVENT-01: Select or create event

**Who:** Commercial Manager

1. Open **Plans**, then **Event Operations**.
2. Select an existing UAT event or select **Create Event**.
3. For a new record enter `Customer UAT - Leadership Event`, event date, location, planned budget, audience and revenue target.
4. Confirm the event opens in the six-tab workspace.

### UAT-EVENT-02: Overview

1. Select **Overview**.
2. Review what needs attention, event health and risks.
3. Confirm recorded work and verified data drive the cards.

### UAT-EVENT-03: Plan

1. Select **Plan**.
2. Review the event strategy, email plan, WhatsApp plan, upsell plan, content requirements and sales tasks.
3. Add or update one planning item if the role allows it.
4. Treat WhatsApp planning as a plan only; do not claim message delivery.

### UAT-EVENT-04: KPIs

1. Select **KPIs**.
2. Review reach, impressions, interactions, forms, leads, meetings, purchases, no-shows and spend.
3. Confirm the source identifies connector, approved import or fallback correction.
4. Do not accept zero or placeholder values as proof of a real campaign result.

**Important:** Strategic KPI targets belong to planning. Actual KPI results belong here. Customer connector data should populate results in production; manual data is a governed correction/fallback.

### UAT-EVENT-05: Leads and GHL

1. Select **Leads**.
2. Choose `Tanaghum UAT Customer` or another clearly controlled UAT contact.
3. Confirm the source says GoHighLevel when mirrored from GHL.
4. Review status, temperature, meetings, payment/purchase and next action.
5. Use the GHL acceptance cases in section 18 before approving any live CRM operation.

### UAT-EVENT-06: Risks

1. Select **Risks**.
2. Create a barrier such as `Customer UAT - Creative delivery delay`.
3. Choose category, severity and owner.
4. Save, then transition it through Investigating and Resolved if permitted.

### UAT-EVENT-07: Learning

1. Select **Learning**.
2. Review event closeout, what worked, recommendations, data completeness and open follow-ups.
3. Confirm recommendations are evidence-backed and advisory.

**Overall pass:** All tabs remain aligned and usable; no cards overlap; event evidence is linked without pretending missing customer data exists.

## 13. Content Workspace

### Purpose

Content moves through three visible stages: a focused brief, AI-generated directions, and a platform draft prepared for human review.

### UAT-CONTENT-01: Brief and ideas

**Who:** Content Specialist  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/ideas

1. Open **Content**.
2. Select **New Content**.
3. Complete the Campaign Brief:
   - campaign name: `Customer UAT - Leadership Content`;
   - objective, audience, offer, tone and call to action;
   - select target platforms.
4. Confirm the AI status says connected/ready. If it says Setup Required, stop and report Blocked.
5. Select **Generate Ideas**.
6. Compare the returned directions and select one.
7. Confirm the selected direction before creating a campaign.

**Pass:** Ideas are relevant to the brief and no fake performance promise is added.

### UAT-CONTENT-02: Draft and quality

1. Convert the selected direction to a campaign.
2. Generate platform drafts.
3. Select a platform tab and edit the draft.
4. Add a clear call to action.
5. Select **Save Draft**.
6. Select **Review Quality**.
7. Review quality and risk notes; do not treat the score as guaranteed reach.
8. Select **Send For Review** only after the content is acceptable.

**Pass:** The draft is saved, quality evidence is displayed, and an approval record is created.

### UAT-CONTENT-03: Recent Content

1. Use search, status and platform filters under **Recent Content**.
2. Find `Customer UAT - Leadership Content`.
3. Select **Continue** and confirm the saved campaign/draft reloads.

## 14. Review Content

### Purpose

Review is the human decision gate. The reviewer sees the draft, quality, risk, comments and publishing impact together.

### UAT-REVIEW-01

**Who:** Content Reviewer or authorized approver  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/approvals

1. Open **Content**, then **Review Queue**.
2. Select the Customer UAT draft.
3. Read the full content, quality score, risk notes and CTA.
4. Add a reviewer comment.
5. Choose one test outcome:
   - **Request Changes** if correction is needed;
   - **Approve** only when ready;
   - **Reject** only when the content should not proceed.
6. Confirm the decision, reviewer and timestamp are recorded.

**Pass:** The decision persists and only approved content can proceed to scheduling.

## 15. Scheduling

### Purpose

Scheduling associates approved content with a customer-owned social account/channel and desired publication time while retaining approval evidence.

### UAT-SCHEDULE-01

**Who:** Commercial Manager or authorized publisher  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/publishing

1. Open **Content**, then **Scheduling**.
2. Select the approved Customer UAT content.
3. Review available social account/channel and scheduled time.
4. If no eligible Postiz channel is connected, confirm the page clearly says setup is required.
5. Do not approve or claim real publication until Postiz channel discovery and one controlled live scheduling/read-back test pass.

**Current expected result:** Honest Blocked/Setup Required for real Postiz publication unless customer channel setup has since been completed and accepted.

## 16. Sales & Leads

### Purpose

Sales & Leads is the operating view over GHL-owned CRM data and Tanaghum internal records. It shows who needs attention, follow-up, meetings, purchases, no-shows and verified performance.

### UAT-SALES-01: Pipeline

**Who:** Sales & Leads Manager  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/analytics

1. Open **Sales & Leads**.
2. Review totals, source, status and lead temperature.
3. Open the pipeline/lead view.
4. Select `Tanaghum UAT Customer`.
5. Confirm its source is GoHighLevel and the mirrored customer details are visible.
6. Open the follow-up queue and performance/data-readiness views.

**Pass:** The selected customer stays in context and missing analytics remain clearly identified.

### UAT-SALES-02: Manual lead fallback

1. Select **Add Lead**.
2. Confirm the page explains that this is only for a lead that did not arrive from CRM/form integrations.
3. Cancel the form unless a controlled fallback test is required.

## 17. Stitchi

### Purpose

Stitchi is the conversational operating assistant. It knows the signed-in user and the selected commercial/event/customer context. It can explain, analyze and prepare governed work. It cannot bypass role permissions, approval or external connector controls.

### UAT-STITCHI-01: Read-only guidance

**Who:** Any role  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/stitchi

1. Ask: `What should I focus on today?`
2. Ask: `Summarize the current annual plan, open event risks and leads needing follow-up.`
3. Confirm the answer matches visible data and identifies missing sources.

### UAT-STITCHI-02: Commercial operator

**Who:** Commercial Manager

1. Ask:

   `Prepare an Online Courses execution plan for a leadership course. Objective: sell to entrepreneurs. Audience: warm followers and previous buyers. Budget target: AED 5,000. Revenue target: AED 30,000. Action plan: content, ads, GHL follow-up and WhatsApp reminders. Link it to the August annual initiative if suitable. Do not save until I approve.`

2. Confirm Stitchi asks one focused follow-up if critical information is missing.
3. Review the action card.
4. Select **Approve & Save** only if the annual/monthly linkage and all values are correct.
5. Return to Execution Plans and confirm the saved record appears.

**Pass:** AI enriches the proposal, deterministic validation protects the save, and nothing changes before approval.

### UAT-STITCHI-03: Selected customer CRM action

**Who:** Sales & Leads Manager or CCO

1. Open an event's **Leads** tab or **Sales & Leads**.
2. Select `Tanaghum UAT Customer`.
3. Confirm **Working with selected customer** shows the name and email.
4. Select **Continue with Stitchi**, or open Stitchi while preserving the selected customer context.
5. Ask:

   `Prepare a governed GoHighLevel action for the selected customer. Add the tag tanaghum-moaaskar-uat. Do not execute it yet. Show me the action for approval.`

6. Confirm the proposal identifies the selected customer without asking for a missing contact ID.
7. Approve the Stitchi preparation card only if correct.
8. Follow the downstream exact-command review in section 18.

**Pass:** Selected customer context is preserved and Stitchi prepares, but does not silently execute, the external action.

## 18. Governed GoHighLevel Operations

### Current accepted scope

- Customer/contact upsert: live accepted, including through Stitchi.
- Tag add/remove: live accepted.
- Sale and payment/opportunity upsert: live accepted.
- Meeting/appointment upsert: live accepted.
- WhatsApp: pending because the customer GHL location has no connected WhatsApp channel.

### Approval pattern

Every live GHL test follows:

1. select the controlled customer;
2. choose Customer, Tags, Sale & payment, or Meeting;
3. enter exact values;
4. select **Review change**;
5. inspect the preview;
6. approve using an MFA-authenticated Admin/CCO when required;
7. observe **Approved and queued**;
8. wait for automatic status refresh;
9. require **Reconciled / Confirmed** or record **Failed** with the reason;
10. expand **Recent customer actions** and confirm provider ID/read-back and audit evidence.

Do not repeatedly click approval while a command is Queued or Processing.

### UAT-GHL-01: Customer

1. Select `Tanaghum UAT Customer`.
2. Open **Customer**.
3. Review name, email and phone; do not change real customer data.
4. Select **Review change**, approve and wait for Reconciled.

### UAT-GHL-02: Tags

1. Open **Tags**.
2. Select approved tag `tanaghum-moaaskar-uat`.
3. If it says **mapping required**, stop and Fail the case; do not type an arbitrary tag.
4. Review, approve and wait for Reconciled.

### UAT-GHL-03: Sale & payment

1. Open **Sale & payment**.
2. Verify the controlled values before approval:
   - Pipeline: Marketing Pipeline;
   - Stage: Sale;
   - Status: Won;
   - Total sale value: 1000;
   - Amount paid: 400;
   - Ticket quantity: 1;
   - Payment status: Partially paid;
   - Payment date: 2026-07-27.
3. Select **Review change**.
4. Approve only if all values are exact.
5. Wait for Reconciled and confirm provider read-back.

### UAT-GHL-04: Meeting

1. Open **Meeting**.
2. Select a configured GHL calendar.
3. Enter a future start/end time and title `Customer UAT - Sales consultation`.
4. Choose Confirmed.
5. Review, approve and wait for Reconciled.
6. Confirm the action says whether it created or updated an existing appointment.

### UAT-GHL-05: WhatsApp

1. Open **WhatsApp**.
2. Confirm setup/connection is required.
3. Do not approve a send and do not mark delivery as passed.

**Expected:** Blocked by customer GHL WhatsApp setup, with an honest explanation.

## 19. Performance and CEO Dashboard

### UAT-PERF-01: Operational performance

**Who:** Commercial Manager or Viewer  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/growth

1. Open **Performance**.
2. Review verified funnel and KPI values.
3. Confirm source/freshness is visible.
4. Confirm missing Meta, YouTube, Formaloo or other data is not estimated.

### UAT-EXEC-DASH-01: Executive dashboard

**Who:** CCO or Administrator  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/executive

1. Open **CEO Dashboard**.
2. Apply date, revenue-line and currency filters.
3. Review currency breakdown, active-product revenue, decisions required, data freshness and channel efficiency.
4. Confirm AED and USD remain separate.
5. Under the report workflow, select recipients/cadence and **Generate preview**.
6. Inspect the preview before selecting **Save schedule**.
7. Confirm the system does not claim delivery if email/WhatsApp delivery is not configured.

**Pass:** Report preview/schedule records are governed and delivery readiness is honest.

## 20. Setup Pages

### My Profile

**Who:** Every user  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/my-agent-rep

Confirm name, role, department and AgentRep context match the signed-in account.

### Account Security

**Who:** Every user  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/account-security

Confirm MFA status and recovery controls. Privileged users must finish enrollment before approving production-sensitive actions.

### AI Model

**Who:** Administrator/authorized manager  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/ai-settings

Confirm an active provider/model is configured without exposing the raw key. Test a short Arabic and English generation through Content or Stitchi, not by revealing credentials.

### Integrations

**Who:** Administrator, CCO or Department Head  
**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/integration-credentials

1. Review business integrations and current readiness.
2. Confirm GHL credential and read/write readiness without displaying raw secrets.
3. Confirm Postiz shows the actual channel/setup state.
4. Treat Meta, YouTube, Formaloo, Kajabi, SmartLabs and WhatsApp as pending until customer-owned access is validated.

## 21. Administrator Acceptance

### Users & Roles

**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/admin-users

Verify user role, department and AgentRep creation. Do not create real customer accounts during UAT without approval.

### Workspace Admin

**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/tenant-admin

Review subscription, lifecycle, retention, export and deletion controls. Do not archive or request tenant deletion during UAT.

### Operations

**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/operations

Review uptime/health, monitoring, backups and operational readiness. Missing external alert/off-server configuration must remain visible.

### Activity Log

**Page:** https://tanaghum-backup.155-117-45-45.sslip.io/observability

Search for one UAT action. Confirm actor, action, timestamp, target and request/correlation evidence are present and secrets are absent.

## 22. End-to-End Customer Scenario

Run this after individual pages pass:

1. Commercial Manager reviews historical evidence and saves an assessment.
2. AI proposes findings; CCO approves only supported learning.
3. Commercial Manager creates a 2026 AED annual plan and an August initiative.
4. CCO approves the annual plan.
5. Commercial Manager creates an execution plan from August.
6. Manager links an event when operational event work is required.
7. Specialist creates content from a brief and sends it for review.
8. Reviewer approves the content.
9. Scheduling remains controlled until an eligible Postiz channel exists.
10. Sales Manager selects the controlled GHL customer.
11. Stitchi prepares a tag or CRM command.
12. Admin/CCO approves the exact downstream command.
13. UI automatically refreshes until GHL reports Reconciled or Failed.
14. Event KPIs and lead outcomes appear only from recorded/imported/connected evidence.
15. CCO reviews the CEO Dashboard and generates a report preview.
16. Activity Log shows the approval and execution chain.

## 23. Release Decision

Customer UAT is accepted only when:

- all P0 workflow cases pass;
- no tenant/role isolation defect exists;
- no hidden 403/500 error appears in normal workflows;
- privileged MFA works;
- annual-to-monthly-to-execution hierarchy is clear;
- Stitchi preserves user/context and cannot bypass approval;
- GHL Customer, Tags, Sale & payment, and Meeting reconcile with provider evidence;
- WhatsApp and Postiz remain honestly pending until customer setup and live acceptance;
- dashboards identify data source and freshness;
- customer agrees on any remaining role, KPI, report or connector definitions.

After UAT, disable all `@tanaghum.test` users and rotate any temporary access details included in the private customer copy.
