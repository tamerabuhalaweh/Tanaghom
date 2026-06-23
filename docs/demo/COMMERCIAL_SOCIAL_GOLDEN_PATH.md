# Commercial / Social Media Golden Path

> **Version**: 1.0
> **Date**: 2026-06-23
> **Sprint**: 27

## Purpose

Define the exact demo journey for the Commercial / Social Media module. This path proves the first completed business model.

## Demo Principle

**AI prepares. Human approves. System records. External execution remains blocked.**

## Golden Path Steps

### 1. Login as Demo Commercial User

- Navigate to `http://localhost:3000`
- Login as `demand.specialist@tanaghum.com` (demo password)
- System creates AgentRep for this HumanUser
- Session Context Lock enforced: user can only act through their assigned AgentRep

### 2. Commercial / Social Dashboard

- View dashboard showing:
  - Active campaigns: 2
  - Pending approvals: 1
  - AI drafts generated: 3
  - Reach scores evaluated: 3
  - Safety gates: 11 (9 blocked, 2 clear)
  - M5 status: Blocked

### 3. Create or Select a Campaign

- View campaign list: "Summer Wellness Launch", "Product Feature Announcement"
- Select "Summer Wellness Launch" campaign
- View campaign details: goals, audience, platforms, status

### 4. Generate AI-Assisted Social Post Draft

- Click "Generate Draft" button
- AI generates platform-specific content using mock LLM provider
- View draft with brand voice applied from SOUL.md
- **Label**: "Mock LLM Provider — External execution blocked"

### 5. Adapt Draft for Multiple Platforms

- View platform-specific adaptations:
  - LinkedIn: Professional tone, 1300 chars, 3-5 hashtags
  - Instagram: Visual-first, Reels format, trending audio suggestion
  - X (Twitter): 280 chars, thread structure, link in reply
- Each adaptation shows platform-specific scoring factors
- **Label**: "Platform rules from Algorithm Intelligence module"

### 6. Run Reach/Readiness Scoring

- Click "Evaluate Reach" button
- System calculates Reach Readiness Score (0-100)
- Score breakdown: hook, format, hashtags, timing, CTA, compliance risk
- Scoring band: approve (75+), optimize (60-74), revise (40-59), block (<40)
- **Label**: "Algorithm Intelligence — deterministic scoring, not prediction"

### 7. Submit to Approval Queue

- Click "Submit for Approval" button
- System creates approval request with risk assessment
- Risk level: Medium (health claims with evidence)
- Required approvers: 2 (Department Head + Brand & Market Intelligence)
- SLA: 24h reminder, 48h escalation
- **Label**: "Approval workflow — human decision required"

### 8. Approve / Reject / Request Edit

- Login as `brand.head@tanaghum.com` (approver)
- View approval queue with pending items
- Review draft, reach score, risk assessment
- Actions: Approve / Reject / Request Changes
- Click "Approve" — system records decision with timestamp
- **Label**: "All approval decisions are audited"

### 9. Generate Publishing Preparation Package

- After approval, system generates publishing package
- Package includes: content, platforms, schedule, readiness checks
- Readiness checks: content approved, brand validated, compliance checked, schedule confirmed
- **Label**: "Publishing preparation only — no live publishing"

### 10. Show Mock Publishing Status / Postiz Preparation

- View publishing package status: "Ready for publishing"
- Postiz connector status: "Planned — mock provider active"
- **Label**: "Postiz integration is mock — no real posts published"

### 11. Show Analytics Demo Report

- View analytics dashboard with demo metrics:
  - Impressions: 12,500 (demo data)
  - Reach: 8,900 (demo data)
  - Engagement rate: 3.56% (demo data)
  - Best performing platform: LinkedIn
- **Label**: "Demo analytics — no real data pulled"

### 12. Show CRM/WhatsApp Handoff Preparation

- View CRM handoff preparation:
  - Lead capture record created
  - CRM provider: Mock
  - WhatsApp provider: Mock
- **Label**: "CRM/WhatsApp preparation only — no real messages sent"

### 13. Show Production Request Preparation

- View production request:
  - Creative brief generated
  - Asset requirements defined
  - Rendering provider: Mock
- **Label**: "Production preparation only — no real rendering"

### 14. Show Audit / Lineage / Observability Evidence

- View SPINE timeline: Run records, Artifacts, lineage
- View Observability events: Who did what, when, result
- View Audit records: All actions logged
- **Label**: "Full audit trail — every action recorded"

## Safety Summary

| Feature | Status | Label |
|---|---|---|
| AI draft generation | Mock LLM provider | "External execution blocked" |
| Platform adaptation | Algorithm rules | "Deterministic scoring" |
| Reach scoring | Local calculation | "Not prediction" |
| Approval workflow | Human decision | "All decisions audited" |
| Publishing preparation | Package only | "No live publishing" |
| Postiz integration | Mock provider | "No real posts" |
| Analytics | Demo data | "No real data pulled" |
| CRM/WhatsApp | Mock provider | "No real messages" |
| Production/Rendering | Mock provider | "No real rendering" |
| M5 execution | Blocked | "M5 disabled" |
| External APIs | Blocked | "Kill switches active" |
