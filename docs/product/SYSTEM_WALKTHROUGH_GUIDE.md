# Tanaghum Commercial/Social Platform — System Walkthrough Guide

## Environment

Current deployed URL:

- Frontend: `https://tanaghum.163-123-180-104.sslip.io`
- Backend API through Caddy: `https://tanaghum.163-123-180-104.sslip.io/api`

Credentials should be provided securely outside this document.

## Before Testing

Confirm these basics:

- You have a valid user account.
- If MFA is enabled for your account, you have your authenticator or recovery code.
- If you want real AI generation, an admin must configure an AI provider key.
- If you want real scheduling, the customer must connect a supported social channel in Postiz and authorize scheduling.

## Walkthrough 1 — Sign In

1. Open `https://tanaghum.163-123-180-104.sslip.io`.
2. The login page should show **Enter Commercial Workspace**.
3. Enter email and password.
4. If MFA is required, enter the authenticator or recovery code.
5. Click **Open Command Center**.
6. Expected result: the system opens the **Dashboard**.

## Walkthrough 2 — Dashboard

Purpose: understand the current Commercial/Social workspace at a glance.

1. Open **Dashboard** from the sidebar.
2. Review **Social Growth Control Room**.
3. Confirm these cards are visible:
   - Course Campaigns
   - Posts Prepared
   - Scheduling Packages
   - Qualified Leads
   - Growth Readiness
4. Review the status grid:
   - Workflow run
   - AI model
   - Scheduling service
   - Social channels
5. Review **Quick Setup** if any item needs attention.
6. Review **Growth Engine Next Actions** if shown.
7. Review **Your Content Workflow**.
8. Review **Content Journey**.
9. Review **Performance & Results**.

Expected result:

- A non-technical manager should understand the current next action without reading architecture documents.
- If the AI model or social channel is missing, the Dashboard should direct the user to setup.

## Walkthrough 2A â€” Growth Engine

Purpose: understand whether social content is turning into course-sales output.

1. Open **Growth Engine** from the sidebar.
2. Review **Course Sales Command Center**.
3. Confirm the KPI cards are visible:
   - Campaigns
   - Posts Prepared
   - Qualified Leads
   - Growth Readiness
4. Review **What this system improves for the customer**.
5. Review **Course Sales Funnel**.
6. Review **Next Best Actions**.
7. Review **Course Campaign Templates**.
8. Select one template, such as **Course Launch Waitlist** or **Lead Magnet / Comment Keyword**.
9. Click **Create Selected Campaign** if your role allows campaign creation.
10. Review **Social Algorithm Knowledge Pack**.

Expected result:

- The user understands how the system supports course launches, lead magnets, events, testimonials, and book/app-to-course conversion.
- The product does not claim private social algorithm access.
- If official analytics, GHL, SmartLabs, or Postiz are missing, the page should show setup requirements instead of fake data.

## Walkthrough 3 — Create Campaign Ideas

Purpose: use AI to propose campaign directions.

1. Open **Content Creator**.
2. Confirm the page title is **Content Creator**.
3. If the page says **Connect AI Model**, open **AI Settings** first.
4. Fill the campaign brief:
   - Campaign name
   - Goal
   - Audience
   - Location
   - Tone
   - Call to action
   - Offer
   - Posting window
   - Content category
   - Platforms
5. Click **Generate Campaign Ideas**.
6. Review generated ideas.
7. Choose an idea.
8. Click **Create Campaign From Idea**.

Expected result:

- The system creates a campaign from a human-selected idea.
- The workflow does not create campaigns from autonomous AI decisions without user selection.

## Walkthrough 4 — Campaigns

Purpose: create/select campaigns and move through content preparation.

1. Open **Campaigns**.
2. Review **What this workspace does**.
3. Review **Course Sales Starters**.
4. Select a campaign template if the campaign is course-sales related.
5. Click **Create From Template**, or click **New Campaign** if creating a custom campaign manually.
6. Fill the campaign brief if using manual creation.
7. Click **Create Campaign**.
8. Select the campaign from **Campaign Queue**.
9. Review **Campaign Brief**.
10. Click **Generate Drafts**.
11. Review **Platform Drafts**.
12. Select or edit the strongest draft.
13. Click **Review Quality**.
14. Review score, quality notes, and risk/compliance indicators.
15. Click **Send for Review**.

Expected result:

- Campaign creation is user-driven.
- Draft generation uses the configured backend AI provider.
- Drafts are reviewed before human approval.

## Walkthrough 5 — Review & Approve

Purpose: require a human decision before scheduling preparation.

1. Open **Review & Approve**.
2. Review the summary cards:
   - To Review
   - Approved
   - Publishing
3. Review **How reviews work**.
4. Open an item in **Review Queue**.
5. Review the content, campaign context, score, risk notes, and package context.
6. Enter a reviewer comment.
7. Choose one:
   - Approve
   - Reject
   - Request Changes

Expected result:

- Approved content can move to scheduling preparation.
- Rejected or change-requested content cannot be scheduled until corrected and approved.

## Walkthrough 6 — Scheduling & Review

Purpose: prepare scheduling payloads without uncontrolled publishing.

1. Open **Scheduling**.
2. Review **Your Approved Content**.
3. Select an approved package.
4. Review **What's Needed Before Scheduling**.
5. Review **Content Package Details**.
6. Open **Scheduling Payload**.
7. Click the payload preparation action if available.
8. Confirm the payload preview is visible.

Expected result:

- The product shows the exact scheduling payload Tanaghum would send to Postiz.
- Scheduling remains blocked unless the customer has connected a channel and authorized scheduling.
- The UI should not imply live publishing is active when it is not.

## Walkthrough 7 — Performance

Purpose: review campaign performance and customer interest.

1. Open **Performance**.
2. Review content performance cards.
3. Review customer journey and leads.
4. Confirm empty states explain what is missing when no connected source exists.

Expected result:

- The page should show real internal records and connected-source data when available.
- It should not show fake social metrics when official social analytics are not connected.

## Walkthrough 8 — AI Settings

Purpose: connect a tenant-owned AI provider.

1. Open **AI Settings**.
2. Choose provider.
3. Enter the tenant-owned API key.
4. Save the connection.
5. Verify the UI shows configured status.
6. Test the provider if the test action is available.

Expected result:

- Raw API keys are never shown after saving.
- The active provider appears in the Dashboard and Content Creator.

## Walkthrough 9 — Users & Roles

Purpose: onboard customer users.

1. Open **Users & Roles**.
2. Click **Create User**.
3. Enter user information.
4. Choose the business role.
5. Create the user and work profile.
6. Generate a one-time onboarding token if needed.
7. Share onboarding details through an approved secure channel.

Expected result:

- Only admins manage users.
- Business roles are mapped to safe internal permissions.
- Each user gets a governed work profile.

## Walkthrough 10 — Tenant Admin

Purpose: manage workspace lifecycle and SaaS controls.

1. Open **Tenant Admin**.
2. Review workspace identity.
3. Review lifecycle controls.
4. Review **Subscription & Entitlements**.
5. Review **Tenant Export**.
6. Review **Deletion Readiness**.
7. Review **Deletion Review Request**.
8. Review isolation findings.

Expected result:

- Tenant export is available and redacts secrets.
- Browser hard-delete is not available.
- Deletion requires controlled review and offline purge.

## Walkthrough 11 — Integrations and Credentials

Purpose: configure customer-owned integration paths.

1. Open **Credentials**.
2. Review credential requirements.
3. Choose an integration to configure.
4. Enter required credentials.
5. Save credentials.
6. Confirm the UI shows configured/missing status only.
7. Open **Integrations** to inspect connector registry and MCP readiness.

Expected result:

- Raw secrets are never displayed after saving.
- Customer credentials are tenant-owned.
- Tooling does not become the source of truth.

## Walkthrough 12 — Operations and Security

Purpose: validate production controls.

1. Open **Operations**.
2. Review monitoring status.
3. Review backup status.
4. Open **Account Security**.
5. Configure MFA if required.
6. Open **Security**.
7. Confirm external actions remain controlled.

Expected result:

- Users can see what is operationally ready.
- Security-sensitive actions require explicit setup and authorization.

## Current Known Blockers

The following are not product UI bugs; they require customer/operator inputs:

- Off-server backup destination.
- External alert destination.
- Customer social channels in Postiz.
- Customer GHL credentials.
- Customer WhatsApp/Telegram credentials.
- Customer SmartLabs voice key if voice execution is required.
- Customer social OAuth provider credentials.
- Payment provider for automated billing.
