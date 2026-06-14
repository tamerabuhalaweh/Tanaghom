# WORKFLOWS.md — Business Workflows

> **Version**: 1.0
> **Date**: 2026-06-14

## 1. Campaign Request Flow

```
User submits content idea via messaging channel
    ↓
Agent classifies request (campaign, announcement, thought leadership, product update, etc.)
    ↓
Agent loads brand voice, platform rules, campaign context, performance insights, approval policy
    ↓
Agent generates platform-native drafts with metadata:
  - Objective, audience, CTA, platform, risk score
  - Proposed publish window, media requirements, hashtags
  - Reach Readiness Score (from Algorithm Intelligence MCP)
    ↓
Drafts stored in database (state: Pending Review)
    ↓
Reviewer receives approval request with drafts, risk reason, edit options
    ↓
Reviewer: Approve / Edit / Reject / Request Changes
    ↓
Approved drafts → Promoted to Scheduled via Postiz
    ↓
Publishing tracked. Failures trigger retry/escalation.
    ↓
Analytics pulled after 48h and 7 days
    ↓
Weekly report + next-week plan generated
```

## 2. Content State Machine

```
Idea → Drafting → Pending Review → Approved → Scheduled → Published → Analytics Pending → Analyzed → Archived
         ↑            ↓                ↓          ↓
         ← Needs Edits  Rejected       Cancelled  Failed → Retry
                                                    ↓
                                              Recycle Candidate → Idea
```

**States and allowed transitions:**

| State | Meaning | Allowed Next |
|---|---|---|
| Idea | Raw content request | Drafting, Rejected |
| Drafting | Agent generating drafts | Pending Review, Failed |
| Pending Review | Ready for human review | Approved, Needs Edits, Rejected, Expired |
| Needs Edits | Reviewer requested changes | Drafting, Rejected |
| Approved | Human approved content + timing | Scheduled, Archived |
| Scheduled | Postiz has scheduled the post | Published, Failed, Cancelled |
| Published | Platform has published | Analytics Pending |
| Analytics Pending | Waiting for data window | Analyzed |
| Analyzed | Analytics ingested, learning extracted | Archived, Recycle Candidate |
| Recycle Candidate | High-performing, eligible for reuse | Idea, Archived |
| Failed | Error in publishing | Retry, Cancelled, Archived |
| Expired | Approval SLA exceeded | Drafting, Rejected |

## 3. Approval Workflow

```
Draft created with risk score
    ↓
Risk category determined (Low / Medium / High)
    ↓
Route to approvers based on category + department:
  - Low: 1 approver (Content Reviewer)
  - Medium: 2 approvers (Dept Head + Brand)
  - High: 3 approvers (CCO + Brand + Compliance)
    ↓
Each approver: Approve / Reject / Edit / Request Changes
    ↓
All approvals collected? 
  - No → Wait + Reminder after SLA (24h → 48h → 72h escalation)
  - Yes → State: Approved → Ready for scheduling
```

## 4. Analytics Learning Loop

```
Post published
    ↓
48h: Pull post-level analytics from Postiz
    ↓
Store normalized metrics in analytics_snapshots table
    ↓
7 days: Pull analytics again for final numbers
    ↓
Learning Engine compares:
  - Predicted Reach Readiness Score vs actual engagement
  - Platform performance vs baseline
  - Content type performance patterns
    ↓
Generate insight records with:
  - Platform, insight type, evidence summary, confidence level
    ↓
Write concise lessons to MEMORY.md (not raw metrics)
    ↓
Weekly: Generate performance report + next-week recommendations
```

## 5. Weekly Report Workflow

```
Every Monday (configurable):
    ↓
Gather: published posts, metrics, insights, platform rule freshness, cost data
    ↓
Generate report sections:
  - Summary (top-line performance, wins, issues)
  - Published Posts (by platform, date, objective, status)
  - Performance (metrics vs baseline)
  - Insights (evidence-backed patterns with confidence)
  - Next Experiments (2-4 recommended tests)
  - Next Week Plan (proposed calendar)
  - Risks/Needs (missing assets, approvals, stale rules)
    ↓
Send report to stakeholders via messaging channel
    ↓
Stakeholders: Approve / Edit / Reject the proposed plan
```

## 6. Content Reuse Workflow

```
Learning Engine identifies high-performing post (Recycle Candidate)
    ↓
Analyst or Marketing Owner reviews reuse eligibility
    ↓
If approved: Create new Idea with reference to original
    ↓
Agent generates updated version (new hook, updated data, different platform)
    ↓
Enters standard approval workflow
```

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-14 | Initial creation from SmartLabs requirements | Sprint 0A |
