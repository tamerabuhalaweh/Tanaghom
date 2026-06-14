# SPRINT-03: AI Draft Generation

> **Sprint**: 3
> **Status**: Complete (pending review)
> **Goal**: AI draft generation module with platform-specific drafts, versioning, mock LLM, brand voice, revision support.

## Deliverables

| Deliverable | Status | Description |
|---|---|---|
| modules/ai-generation/types.ts | ✅ | Platform constraints (7 platforms), draft types, Zod schemas, brand voice constants |
| modules/ai-generation/validators.ts | ✅ | Generate/revise draft validation |
| modules/ai-generation/events.ts | ✅ | Draft event definitions |
| modules/ai-generation/repository.ts | ✅ | Content item CRUD, draft versioning |
| modules/ai-generation/service.ts | ✅ | Draft generation, platform adaptation, brand voice, revision, mock LLM, audit logging |
| modules/ai-generation/controller.ts | ✅ | POST /generate, POST /revise endpoints |
| modules/ai-generation/tests/validators.test.ts | ✅ | 11 validation tests |
| modules/ai-generation/tests/permissions.test.ts | ✅ | 18 RBAC tests |
| modules/ai-generation/tests/platform-adaptation.test.ts | ✅ | 9 platform constraint tests |
| modules/ai-generation/tests/provider-failure.test.ts | ✅ | 6 mock provider and failure tests |

## How Draft Generation Works

1. User calls POST /ai-generation/generate with campaignRequestId
2. System fetches campaign request from database
3. For each target platform (or overridden platforms):
   a. Build platform-specific prompt with brand voice + campaign context + platform constraints
   b. Call LLMProvider.generateText() (mock by default)
   c. Create ContentItem in database with draft text
   d. Create DraftVersion (version 1) with model metadata
   e. Build and store DraftMetadata (objective, audience, CTA, hashtags, rationale, tone, etc.)
4. Audit log created per draft
5. Domain events emitted per draft

## How Revision Works

1. User calls POST /ai-generation/revise with contentItemId + feedback
2. System fetches content item and latest version
3. Build revision prompt with original draft + feedback + brand voice
4. Call LLMProvider.generateText() (mock by default)
5. Create new DraftVersion (incremented version_no)
6. Update ContentItem draft_text with revised version
7. Audit log and domain event emitted

## Platform-Specific Drafts

Each platform gets a distinct draft adapted to:
- Character limits (280 for X → 10,000 for Reddit)
- Format recommendations (reel for Instagram/TikTok, post for LinkedIn/X)
- Hashtag limits (0 for Reddit → 15 for YouTube)
- Hook requirements (required for most, optional for Facebook/Reddit)
- Platform-specific notes from PLATFORM_RULES.md

## Draft Metadata

Every draft stores:
- platform, contentType, objective, audience, cta
- hashtags (platform-specific count)
- rationale (why this content was generated this way)
- tone, hookType, mediaSuggestions
- riskNotes (risk assessment based on campaign risk category)

## LLM Integration

- Uses `LLMProvider` interface (provider-neutral)
- `MockLLMProvider` used by default — returns `[MOCK]` prefixed text
- No real API keys or hardcoded credentials
- Errors wrapped as `ExternalServiceError`
- Easy to swap to real provider after security review

## Draft Permissions

| Role | drafts:generate | drafts:revise | drafts:read |
|---|---|---|---|
| admin | ✅ | ✅ | ✅ |
| cco | ✅ | ✅ | ✅ |
| department_head | ✅ | ✅ | ✅ |
| specialist | ✅ | ❌ | ✅ |
| reviewer | ❌ | ❌ | ✅ |
| viewer | ❌ | ❌ | ✅ |

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Authenticated user can request AI drafts for existing campaign | ✅ |
| System generates distinct drafts per platform (not cross-posted) | ✅ |
| Drafts saved as versioned records linked to campaign | ✅ |
| Draft metadata stored (platform, CTA, hashtags, rationale, risk notes) | ✅ |
| Uses mock/provider-neutral LLM by default | ✅ |
| Draft generation failure handled gracefully and logged | ✅ |
| Viewer/reviewer cannot generate or revise drafts | ✅ |
| No approval, algorithm, publishing, analytics, learning, CRM, production workflow | ✅ |
| Tests cover validation, permissions, creation, versioning, provider failure | ✅ (44 tests) |
| CI still passes | ✅ |
