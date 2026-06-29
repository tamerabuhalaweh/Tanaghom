# Tanaghum Commercial/Social Platform — Current User Stories

## Purpose

This document describes what the current Commercial/Social production module allows each user type to do after Sprint 56. It is written for client, product, QA, and delivery alignment.

The product principle remains:

**AI prepares. Human approves. The system records. External execution requires customer-owned credentials and explicit authorization.**

## Primary Roles

### Platform Admin

The Platform Admin manages the customer workspace, users, AI settings, integration credentials, tenant lifecycle, subscription status, and operational readiness.

As a Platform Admin, I can:

- Sign in to the production workspace.
- View the Dashboard and understand campaign progress, review load, scheduling readiness, customer interest, and workflow readiness.
- Open **Growth Engine** to understand course-sales campaign progress, content velocity, qualified leads, CTA signals, integration readiness, and next best actions.
- Add users from **Users & Roles**.
- Assign business roles such as marketing manager, social media manager, reviewer, analyst, or admin.
- Generate one-time onboarding tokens for new users.
- Verify that every user is connected to a governed work profile.
- Configure AI model provider credentials in **AI Settings**.
- Store provider keys securely without exposing raw API keys back to the browser.
- Configure integration credentials in **Credentials**.
- Review Postiz scheduling status and connected channel requirements.
- Review Social Algorithm Knowledge Pack sources and confirm that no private/social algorithm access is being claimed.
- Review SmartLabs voice connector readiness.
- Review integration and MCP connector registry entries in **Integrations**.
- Manage workspace identity, lifecycle, subscription, entitlements, tenant export, deletion readiness, and deletion review from **Tenant Admin**.
- Review monitoring, backup, and operations status from **Operations**.
- Review safety controls from **Security**.
- Review activity and audit records from **Activity Log**.

### Marketing Manager

The Marketing Manager owns campaign planning, content direction, review coordination, and performance review.

As a Marketing Manager, I can:

- Open the Dashboard to understand the current content workflow status.
- Create a campaign brief from **Campaigns**.
- Create a course-sales campaign from templates such as course launch, lead magnet, live event, testimonial, or book/app-to-course bridge.
- Use **Content Creator** to generate campaign ideas after an AI model is connected.
- Select a preferred idea and convert it into a campaign.
- Generate platform-specific draft content for LinkedIn, Instagram, and X/Twitter.
- Review AI-generated content before sending it for approval.
- Request edits or prepare stronger content directions before review.
- Submit content to the approval queue.
- Track whether content has been approved, rejected, or returned for changes.
- Review approved content packages in **Scheduling**.
- Review customer interest and performance in **Performance**.
- Review Growth Engine next actions to understand what should happen next for course lead generation.

### Social Media Manager

The Social Media Manager focuses on day-to-day content creation, platform adaptation, and scheduling preparation.

As a Social Media Manager, I can:

- View active campaigns assigned to the team.
- Create or select a campaign brief.
- Start from a course-sales campaign template when the goal is registration, lead capture, event signup, testimonial conversion, or book/app-to-course conversion.
- Generate platform-specific content drafts.
- Edit drafts before approval.
- Review quality scoring and recommendations.
- Send content for human review.
- Prepare scheduling packages after approval.
- View scheduling requirements and channel status.
- Understand when a scheduling channel or customer-owned social account is still required.

### Reviewer / Approver

The Reviewer is responsible for final human decision-making before publishing preparation.

As a Reviewer, I can:

- Open **Review & Approve**.
- See content waiting for review.
- Review the campaign context, selected draft, quality/risk notes, and status.
- Approve content.
- Reject content.
- Request changes.
- Record review comments.
- Confirm that approval is required before scheduling preparation.

### Analyst / Lead Manager

The Analyst or Lead Manager focuses on performance, customer interest, qualification, and handoff readiness.

As an Analyst or Lead Manager, I can:

- Open **Performance**.
- See content results and customer-interest indicators as data becomes available.
- Review captured and qualified leads.
- Review course CTA clicks and lead qualification rate when official analytics data is connected.
- Understand whether GHL, SmartLabs voice, WhatsApp, Telegram, or other handoff channels are configured.
- Prepare handoff packages when credentials and authorization exist.
- Confirm that no external CRM, messaging, or voice execution happens without customer-owned credentials and approval.

### Operations / Security Owner

The Operations or Security Owner validates operational readiness and platform controls.

As an Operations or Security Owner, I can:

- Open **Operations** to review monitoring and backup readiness.
- Open **Account Security** to configure MFA for my account.
- Open **Security** to review external-action controls.
- Confirm external writes, publishing, CRM writes, WhatsApp, Telegram, and voice triggers require explicit authorization.
- Confirm tenant export and deletion are controlled processes, not casual UI actions.

## Current Customer Value

The current product provides a usable Commercial/Social operating workflow:

1. Campaign brief creation.
2. AI-assisted campaign idea and draft generation when a provider key is configured.
3. Platform-specific content adaptation.
4. Quality and readiness review.
5. Human approval workflow.
6. Publishing package preparation.
7. Postiz scheduling readiness and channel visibility.
8. Performance and customer-interest view.
9. Lead and handoff readiness.
10. Tenant, user, credential, security, and operations administration.
11. Course-sales Growth Engine with governed algorithm guidance, course campaign templates, lead funnel visibility, and CRM/voice readiness.

## Customer-Owned Prerequisites

The following are not hardcoded by Tanaghum and must be supplied by the customer or tenant admin:

- AI provider key, such as OpenAI, Claude, DeepSeek, or another supported provider.
- Postiz account and connected social channels.
- Meta/Facebook/Instagram business account requirements where applicable.
- GoHighLevel API/MCP credentials if CRM handoff execution is required.
- WhatsApp, Telegram, SmartLabs voice, or other channel credentials.
- Official social analytics access if course CTA clicks, engagement rate, and platform performance should be pulled automatically.
- External alert destination.
- Off-server backup destination.
- Billing/payment-provider decision if automated billing is required.
