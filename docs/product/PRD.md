# PRD.md — Product Requirements Document

> **Version**: 1.0
> **Date**: 2026-06-14
> **Status**: Draft
> **Owner**: Product Owner

## 1. Vision

Build a secure, agent-assisted social media operations platform that helps SmartLabs plan, draft, review, schedule, publish, measure, and improve social content across selected channels with minimal manual coordination and strong human oversight.

## 2. Business Objectives

| Objective | Target KPI | Measurement |
|---|---|---|
| Reduce manual content operations work | 60–80% reduction in idea-to-scheduled-draft time | Workflow logs comparison |
| Increase publishing consistency | 3–5 scheduled posts per priority platform per week | Content calendar audit |
| Improve draft quality | 70% of AI drafts accepted with minor edits after 30 days | Approval edit-distance tracking |
| Improve engagement | 10–20% engagement-rate improvement after 90 days | Platform analytics vs baseline |
| Maintain governance | 100% of sensitive-category posts approved before scheduling | Audit logs |
| Control cost | Monthly LLM/API spend within budget | Token logs, cost dashboard |

## 3. Target Users

| Role | Responsibility | Key Action |
|---|---|---|
| Marketing Owner | Content strategy, campaign priorities, brand voice, final approval | Approve/reject drafts, schedule content |
| Content Reviewer | Tone, accuracy, formatting, platform fit | Edit drafts, recommend approval |
| Security/Admin Owner | Infrastructure, secrets, skills, access, incidents | Configure integrations, rotate keys |
| Agent Operator | OpenClaw configuration, memory, prompts, heartbeat | Update agent instructions |
| Analyst | Performance review, improvement recommendations | Read analytics, export reports |
| AI Agent | Draft, validate, schedule, pull analytics, propose insights | Execute scoped tool calls |

## 4. Departments (Tanaghum Structure)

1. CCO — Final visibility and approval for sensitive/strategic campaigns
2. Brand & Positioning — Voice, identity, positioning, PR sensitivity
3. Acquisition — Reach, SEO, algorithm fit, hashtags, timing
4. Conversion & Closing — CTA, WhatsApp flow, landing pages, objection handling
5. Growth & Retention — Upsell, re-engagement, community, loyalty
6. Commercial Operations — CRM tagging, reporting, attribution, dashboards
7. Production & Design — Creative assets, reels, carousels, videos, visuals
8. Event Operations & Logistics — Event content, venue, scheduling, logistics

## 5. In Scope (MVP)

- Self-hosted Postiz deployment via Docker Compose
- OpenClaw as sandboxed agent runtime
- Postiz CLI/API integration for draft creation, scheduling, analytics
- One primary messaging interface for intake and approvals
- Content calendar, draft queue, approval workflow, audit trail
- Platform-specific content generation for LinkedIn + Instagram + X
- Platform Rules Knowledge Base
- Post-level and platform-level analytics ingestion
- Weekly report and next-week content plan
- Security hardening, prompt-injection defenses, secrets management
- Frontend dashboard for campaign intake, draft review, approvals, calendar, analytics

## 6. Out of Scope (MVP)

- Paid advertising campaign management
- Fully autonomous posting with no approval gate
- Custom AI video/image generation pipeline
- Multi-client / agency tenancy
- Deep social listening beyond Postiz capabilities
- Automated handling of legal, financial, medical, crisis statements

## 7. Success Criteria

- End-to-end flow works: request → draft → review → approve → schedule → publish → analytics → learning
- All sensitive posts require human approval before scheduling
- Weekly reports delivered to stakeholders
- No secrets leaked in code, logs, or documentation
- All audit events logged
- Platform rules are source-linked and reviewed on schedule

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation from SmartLabs requirements | Sprint 0A |
