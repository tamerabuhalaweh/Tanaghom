# Customer Demo Script

> **Version**: 1.0
> **Date**: 2026-06-23
> **Sprint**: 27
> **Duration**: ~20 minutes

## Pre-Demo Setup

1. Start demo stack: `docker compose -f docker-compose.demo.yml up -d`
2. Wait 30 seconds for services to start
3. Verify: `curl http://localhost:4000/health`
4. Open browser: `http://localhost:3000`

## Demo Script

### Opening (2 minutes)

> "Welcome to the Tanaghum AI Enterprise Platform demo. Today I'll show you the Commercial / Social Media module — the first completed business model.
>
> The key principle: **AI prepares, human approves, system records, external execution remains blocked.**
>
> Everything you'll see is safe. No real posts are published, no real messages are sent, no real data is pulled. This is a controlled demo of the platform's capabilities."

### Step 1: Login (1 minute)

> "Let me log in as a demo Commercial user."

- Navigate to `http://localhost:3000`
- Login as `demand.specialist@tanaghum.com`
- Point out: "The system has created an AgentRep for this user — a digital delegate that acts on their behalf. Every action will be traced back to this human."

### Step 2: Dashboard (2 minutes)

> "This is the Commercial / Social dashboard. It shows the current state of our operations."

- Point out the 9 status cards
- Highlight: "You can see we have 2 active campaigns, 1 pending approval, 3 AI drafts generated."
- Point to Safety Status: "11 safety gates — 9 are blocked for safety, 2 are clear. M5 execution is blocked by design."

### Step 3: Campaign Selection (1 minute)

> "Let me select a campaign to demonstrate the workflow."

- Click on "Summer Wellness Launch"
- Show campaign details: goals, audience, platforms
- "This campaign targets health-conscious professionals on LinkedIn and Instagram."

### Step 4: AI Draft Generation (2 minutes)

> "Now I'll ask the AI to generate a social media post draft."

- Click "Generate Draft"
- Show the generated content
- "The AI has created platform-specific content using our brand voice. Notice the professional tone for LinkedIn."
- Point to label: **"Mock LLM Provider — External execution blocked"**
- "This is running through a mock provider. No real AI API was called."

### Step 5: Platform Adaptation (2 minutes)

> "The system adapts the draft for each platform."

- Show LinkedIn version: "Professional tone, 1300 characters, 3-5 hashtags"
- Show Instagram version: "Visual-first, Reels format suggestion"
- Show X version: "280 characters, thread structure"
- "Each adaptation follows platform-specific rules from our Algorithm Intelligence module."

### Step 6: Reach/Readiness Scoring (2 minutes)

> "Before any content goes forward, it gets a Reach Readiness Score."

- Click "Evaluate Reach"
- Show score: 78/100
- Show breakdown: "Hook: 85, Format: 80, Hashtags: 75, Timing: 70, CTA: 80, Compliance: 75"
- "This is deterministic scoring based on platform rules, not prediction. The score tells us the content is ready for review."
- Point to label: **"Algorithm Intelligence — deterministic scoring"**

### Step 7: Submit to Approval (1 minute)

> "The content is ready. Now I'll submit it for human approval."

- Click "Submit for Approval"
- Show approval request created
- "Risk assessment: Medium. Required approvers: 2. SLA: 24 hours."
- Point to label: **"Approval workflow — human decision required"**

### Step 8: Approval Decision (2 minutes)

> "Let me switch to the approver view."

- Login as `brand.head@tanaghum.com`
- Show approval queue
- Review the draft, score, risk assessment
- "I can approve, reject, or request changes. Every decision is recorded."
- Click "Approve"
- "The system has recorded my decision with timestamp and rationale."

### Step 9: Publishing Preparation (2 minutes)

> "After approval, the system prepares a publishing package."

- Show publishing package
- "Readiness checks: content approved ✓, brand validated ✓, compliance checked ✓, schedule confirmed ✓"
- Point to label: **"Publishing preparation only — no live publishing"**
- "This package is ready, but nothing is published. The Postiz integration is a mock provider."

### Step 10: Analytics Demo (1 minute)

> "Here's what the analytics view looks like."

- Show analytics dashboard
- "12,500 impressions, 8,900 reach, 3.56% engagement rate"
- Point to label: **"Demo analytics — no real data pulled"**
- "These are demo metrics. In production, this would pull real analytics through MCP mediation."

### Step 11: CRM/WhatsApp Preparation (1 minute)

> "The system also prepares CRM handoff."

- Show CRM handoff preparation
- "Lead capture record created. CRM provider: mock. WhatsApp provider: mock."
- Point to label: **"CRM/WhatsApp preparation only — no real messages sent"**

### Step 12: Production Request (1 minute)

> "And production/design requests."

- Show production request
- "Creative brief generated, asset requirements defined."
- Point to label: **"Production preparation only — no real rendering"**

### Step 13: Audit Trail (1 minute)

> "Finally, let me show you the audit trail."

- Show SPINE timeline
- "Every action is recorded: who did what, when, with what result."
- Show Observability events
- "Full lineage from intent to execution to artifact."

### Closing (2 minutes)

> "That's the Commercial / Social Media golden path. Let me summarize:
>
> - **AI prepares**: Draft generation, platform adaptation, reach scoring
> - **Human approves**: Risk-based approval workflow with SLA
> - **System records**: Full audit trail, SPINE lineage, observability
> - **External execution blocked**: No real publishing, no real messages, no real data pulls
>
> This is the first completed business model. The architecture supports Finance, HR, Procurement, and more — but those require separate approval and implementation.
>
> What you've seen today is safe, controlled, and ready for your review."

## Post-Demo Q&A

### Common Questions

**Q: Is this live?**
A: No. All external integrations are mock providers. No real posts are published, no real messages are sent.

**Q: When will live publishing work?**
A: That requires separate approval and implementation. The architecture supports it through MCP mediation.

**Q: What about other departments?**
A: The platform supports Finance, HR, Procurement, Inventory, Purchase Management, and Supply Chain. Each requires separate approval and implementation.

**Q: Is the AI actually generating content?**
A: In this demo, it's using a mock LLM provider. In production, it would call a real LLM through MCP mediation.

**Q: What happens if someone tries to publish without approval?**
A: The system blocks it. The approval workflow is a strict state machine. No content can be published without all required approvals.

**Q: What about security?**
A: 9 kill switches control all external access. M5 execution is blocked by design. All actions are audited. JWT authentication is required.
