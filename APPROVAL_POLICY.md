# APPROVAL_POLICY.md — Human Approval & Risk Categories

> **Purpose**: Define when human approval is required, who approves, and escalation rules.
> **Rule**: No post may be published without explicit human approval in MVP.

## Approval Principles

1. **Draft-first mode**: All content created as drafts, never auto-scheduled in MVP
2. **Risk-scored**: Every draft receives a risk score from the Brand & Compliance Reviewer
3. **Department routing**: Content routes to the correct department approver based on category and risk
4. **SLA enforcement**: Pending approvals trigger reminders after configurable SLA (default 24h)
5. **Audit trail**: Every approval decision logged with reviewer, decision, comments, and timestamp

## Risk Categories

### Low Risk — Auto-Route to Content Reviewer

- Educational health content (general wellness tips)
- Product feature announcements (non-medical claims)
- Company culture / team posts
- Evergreen content reuse (previously approved)
- Event announcements (non-sensitive)

**Required approvals**: 1 (Content Reviewer from relevant department)

### Medium Risk — Route to Department Head + Brand

- Health claims with supporting evidence
- Testimonials and case studies
- Promotional offers and pricing
- Partnership announcements
- Platform-specific campaigns with paid amplification

**Required approvals**: 2 (Department Head + Brand & Positioning)

### High Risk — Route to CCO + Brand + Compliance

- Medical/health claims (diagnostic, treatment-related)
- Legal statements, disclaimers, terms
- Financial claims, pricing guarantees
- Public relations / crisis communications
- Competitor comparisons
- Regulatory or compliance-related content
- Content involving patient data or testimonials with identifiable information

**Required approvals**: 3 (CCO + Brand & Positioning + Compliance/Legal)

## Department Approval Matrix

| Department | Reviews | Cannot |
|---|---|---|
| CCO | Final visibility for sensitive, high-budget, public, strategic campaigns | Bypass any department review |
| Brand & Positioning | Voice, identity, positioning, PR sensitivity, visual/message alignment | Approve technical claims |
| Acquisition | Reach, SEO, algorithm fit, hashtags, timing, amplification | Approve brand messaging |
| Conversion & Closing | CTA, WhatsApp flow, landing pages, objection handling | Approve content strategy |
| Growth & Retention | Upsell, re-engagement, community, loyalty | Approve new campaigns |
| Commercial Operations | CRM tagging, reporting, attribution, dashboards | Approve content |
| Production & Design | Creative assets, reels, carousels, videos, visuals | Approve commercial strategy |
| Event Operations & Logistics | Event content, venue, scheduling, logistics | Approve brand messaging |

## Approval Workflow

```
Draft Created
    ↓
Risk Score Assigned (by AI)
    ↓
Route to Approvers (based on risk + category)
    ↓
Each Approver: Approve / Reject / Edit / Request Changes
    ↓
All Approvals Collected?
    ├── No → Wait + Reminder after SLA
    └── Yes → Promote to Scheduled
    ↓
Postiz Schedules Post
    ↓
Audit Log Entry Created
```

## Approval Actions

| Action | Who Can Do It | Effect |
|---|---|---|
| Approve | Assigned approver | Moves to next approval step or to Scheduled |
| Reject | Assigned approver | Moves to Rejected. Requires reason. |
| Edit | Assigned approver, Content Reviewer | Modifies draft. Creates new version. Resets approvals. |
| Request Changes | Any approver | Moves to Needs Edits. Returns to Content Writer. |
| Expire | System (after SLA) | Moves to Expired. Alerts approvers and escalation contact. |

## Escalation Rules

| Condition | Action |
|---|---|
| Approval pending > 24h | Send reminder to approver via messaging channel |
| Approval pending > 48h | Escalate to department head |
| Approval pending > 72h | Escalate to CCO |
| Campaign deadline approaching (< 24h) | Priority alert to all pending approvers |
| Approver unavailable | Backup approver designated per department |

## Sensitive Topics (Always High Risk)

- Medical claims or health outcomes
- Legal statements or disclaimers
- Financial claims, pricing, guarantees
- Crisis communications
- Public statements on behalf of SmartLabs
- Content involving patient data
- Competitor comparisons
- Regulatory or compliance topics
- Political or social issue statements

## Backup Approvers

Each department should designate a backup approver. If the primary approver is unavailable for > 24h, the backup receives the approval request.

| Department | Primary | Backup |
|---|---|---|
| CCO | TBD | TBD |
| Brand & Positioning | TBD | TBD |
| Acquisition | TBD | TBD |
| Conversion & Closing | TBD | TBD |
| Growth & Retention | TBD | TBD |
| Commercial Operations | TBD | TBD |
| Production & Design | TBD | TBD |
| Event Operations & Logistics | TBD | TBD |

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation from SmartLabs requirements | Sprint 0A |
