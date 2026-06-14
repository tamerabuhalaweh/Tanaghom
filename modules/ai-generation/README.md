# ai-generation Module — Sprint 3

## Implemented

- `types.ts` — Platform constraints (7 platforms), draft types, Zod schemas, brand voice constants
- `validators.ts` — Generate/revise draft input validation
- `events.ts` — Draft event definitions (generated, revised, generation_failed)
- `repository.ts` — Content item creation, draft versioning, campaign content retrieval
- `service.ts` — Draft generation with platform adaptation, brand voice, revision support, mock LLM, audit logging
- `controller.ts` — REST endpoints (POST /generate, POST /revise)
- `tests/validators.test.ts` — 11 validation tests
- `tests/permissions.test.ts` — 18 RBAC tests (6 roles × 3 permissions)
- `tests/platform-adaptation.test.ts` — 9 platform constraint tests
- `tests/provider-failure.test.ts` — 6 mock provider and failure handling tests
- `README.md` — Updated

## Draft Generation Permissions

| Role | drafts:generate | drafts:revise | drafts:read |
|---|---|---|---|
| admin | ✅ | ✅ | ✅ |
| cco | ✅ | ✅ | ✅ |
| department_head | ✅ | ✅ | ✅ |
| specialist | ✅ | ❌ | ✅ |
| reviewer | ❌ | ❌ | ✅ |
| viewer | ❌ | ❌ | ✅ |

## API Endpoints

| Method | Path | Auth | Min Role | Description |
|---|---|---|---|---|
| POST | /ai-generation/generate | Bearer | specialist+ | Generate drafts for campaign |
| POST | /ai-generation/revise | Bearer | dept_head+ | Revise existing draft |

## Platform Constraints

| Platform | Max Length | Max Hashtags | Format | Hook Required |
|---|---|---|---|---|
| LinkedIn | 1,300 | 5 | post | Yes |
| Instagram | 2,200 | 5 | reel | Yes |
| X | 280 | 2 | post | Yes |
| Facebook | 5,000 | 3 | post | No |
| TikTok | 300 | 5 | reel | Yes |
| YouTube | 5,000 | 15 | video | Yes |
| Reddit | 10,000 | 0 | post | No |

## Draft Metadata Stored

- platform, contentType, objective, audience, cta, hashtags, rationale, tone, hookType, mediaSuggestions, riskNotes

## LLM Integration

- Uses `LLMProvider` interface (provider-neutral)
- `MockLLMProvider` used by default — returns `[MOCK]` prefixed text
- No real API keys or hardcoded credentials
- Errors wrapped as `ExternalServiceError`
