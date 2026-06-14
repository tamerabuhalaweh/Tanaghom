# USER_ROLES.md — User Roles & Permissions

> **Version**: 1.0
> **Date**: 2026-06-14

## System Roles

### Marketing Owner
- **Owns**: Content strategy, campaign priorities, brand voice, final publishing approval
- **Can**: Approve/reject/edit drafts, schedule approved content, view analytics, manage content calendar
- **Cannot**: Configure infrastructure, rotate keys, install skills

### Content Reviewer
- **Owns**: Tone, accuracy, formatting, platform fit review
- **Can**: Comment on drafts, edit drafts, recommend approval
- **Cannot**: Bypass approval policy, schedule content, configure integrations

### Security/Admin Owner
- **Owns**: Infrastructure, secrets, skills, access policies, incident response
- **Can**: Configure integrations, rotate keys, approve skills, view all logs, trigger kill switch
- **Cannot**: Approve content (unless also assigned as approver)

### Agent Operator
- **Owns**: OpenClaw configuration, memory files, prompt templates, heartbeat tasks
- **Can**: Update agent instructions, configure heartbeat, manage memory files
- **Cannot**: Change secrets without admin, approve content, schedule posts

### Analyst
- **Owns**: Performance review, improvement recommendations
- **Can**: Read analytics, export reports, update KPI thresholds
- **Cannot**: Approve content, schedule posts, configure system

### AI Agent
- **Owns**: Drafting, validating, scheduling approved posts, pulling analytics, proposing insights
- **Can**: Use scoped tool access (Postiz CLI/API, database, messaging, web search, logging)
- **Cannot**: Access production credentials beyond scoped permissions, install skills, bypass approvals

## Department Roles (Tanaghum Structure)

| Department | Approves | Cannot Do |
|---|---|---|
| CCO | Sensitive, high-budget, public, strategic campaigns | Bypass department reviews |
| Brand & Positioning | Voice, identity, positioning, PR, visual alignment | Approve technical claims |
| Acquisition | Reach, SEO, algorithm fit, hashtags, timing | Approve brand messaging |
| Conversion & Closing | CTA, WhatsApp flow, landing pages | Approve content strategy |
| Growth & Retention | Upsell, re-engagement, community | Approve new campaigns |
| Commercial Operations | CRM tagging, reporting, attribution | Approve content |
| Production & Design | Creative assets, reels, carousels, videos | Approve commercial strategy |
| Event Operations & Logistics | Event content, venue, scheduling | Approve brand messaging |

## Permission Matrix

| Action | Marketing Owner | Reviewer | Admin | Operator | Analyst | Agent |
|---|---|---|---|---|---|---|
| Create campaign request | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| Edit draft | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Approve draft | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Schedule post | ✓ | ✗ | ✗ | ✗ | ✗ | ✓* |
| View analytics | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Configure integrations | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Rotate secrets | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Install skills | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Update agent config | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Trigger kill switch | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |

*Agent can only schedule posts that have received all required approvals.

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation | Sprint 0A |
