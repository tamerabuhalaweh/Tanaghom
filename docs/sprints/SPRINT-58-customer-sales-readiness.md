# Sprint 58 - Customer Sales Readiness

## Purpose

Align the Commercial/Social product with the target customer reality: a public course and life-coaching creator who needs faster, better social content, stronger engagement readiness, lead capture, CRM handoff, SmartLabs voice/chat handoff, and executive reporting.

This sprint does not enable uncontrolled external execution. Customer-owned accounts and credentials remain required for production connectors.

## Completed

- Replaced stale health-tech AI generation language with a course/coaching creator profile.
- Updated generation prompts for LinkedIn, Instagram, and X/Twitter to focus on course sales, lead magnets, registration, discovery calls, and safe engagement.
- Removed fake-proof and fake-engagement language from the generation path.
- Recorded the actual provider/model used in draft version history instead of always writing `mock-llm`.
- Improved the fallback content provider so internal testing produces useful course-sales copy instead of a placeholder string.
- Returned captured lead name, email, and phone back to the tenant UI.
- Added Performance-page lead details, CRM handoff preview, and SmartLabs voice/chat handoff preview.
- Allowed SmartLabs preview mode to return a setup-required handoff package when tenant agent ID is missing, without making an external call.
- Collapsed admin/configuration navigation behind Admin & Settings so customer-facing product flow is primary.
- Added regression coverage for customer-specific AI generation, lead fields, and handoff UI.

## Still Customer-Owned / Blocked Until Configured

- Real social account OAuth and Postiz channel execution require customer social accounts and Postiz provider setup.
- GoHighLevel writes require tenant-owned GHL credentials and explicit execution authorization.
- SmartLabs execution requires tenant SmartLabs API key, agent ID, execution flags, and approval.
- Official social analytics require official API credentials and approved read-only connector setup.
- OpenClaw, agentgateway, and AgentScope remain runtime infrastructure follow-ups unless separately authorized.

## Verification Required

- Backend tests pass.
- Frontend lint and build pass.
- Product integrity tests pass.
- Browser walkthrough passes with no console errors.
- Deployed smoke test confirms the customer-facing flow remains accessible.
