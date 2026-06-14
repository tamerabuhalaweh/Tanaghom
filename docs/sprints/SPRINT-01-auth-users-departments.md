# SPRINT-01: Auth, Users & Departments

> **Sprint**: 1
> **Status**: Complete (pending review)
> **Goal**: Auth module, users/departments module, seed Tanaghum departments, roles, permissions, login/session, RBAC tests.

## Deliverables

| Deliverable | Status | Description |
|---|---|---|
| Prisma schema update | ✅ | Role enum updated to: admin, cco, department_head, specialist, reviewer, viewer |
| prisma/seed.ts | ✅ | Seeds 8 Tanaghum departments + admin user + 5 sample users (one per non-admin role) |
| shared/auth/middleware.ts | ✅ | Express middleware: authenticate (JWT), requireRole (role gate) |
| modules/auth/ | ✅ | Full module: types, validators, events, repository, service, controller, 2 test files |
| modules/users-departments/ | ✅ | Full module: types, validators, events, repository, service, controller, 2 test files |
| RBAC permission tests | ✅ | 30+ test cases proving 6 roles × 5 permissions matrix |

## Tanaghum Departments Seeded

1. CCO — Final visibility and approval for sensitive/strategic campaigns
2. Brand & Positioning — Voice, identity, positioning, PR sensitivity
3. Acquisition — Reach, SEO, algorithm fit, hashtags, timing
4. Conversion & Closing — CTA, WhatsApp flow, landing pages, objection handling
5. Growth & Retention — Upsell, re-engagement, community, loyalty
6. Commercial Operations — CRM tagging, reporting, attribution, dashboards
7. Production & Design — Creative assets, reels, carousels, videos, visuals
8. Event Operations & Logistics — Event content, venue, scheduling, logistics

## System Roles Implemented

| Role | users:read | users:create | users:update | departments:read | departments:manage |
|---|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| cco | ✅ | ❌ | ❌ | ✅ | ❌ |
| department_head | ✅ | ❌ | ❌ | ✅ | ❌ |
| specialist | ✅ | ❌ | ❌ | ✅ | ❌ |
| reviewer | ✅ | ❌ | ❌ | ✅ | ❌ |
| viewer | ✅ | ❌ | ❌ | ✅ | ❌ |

## API Endpoints Added

| Method | Path | Auth | Min Role | Description |
|---|---|---|---|---|
| POST | /auth/login | No | — | Authenticate, returns JWT + user |
| GET | /auth/session | Bearer | Any | Get current session |
| GET | /users | Bearer | Any | List users |
| GET | /users/:id | Bearer | Any | Get user |
| POST | /users | Bearer | admin | Create user |
| PUT | /users/:id | Bearer | admin | Update user |
| GET | /departments | Bearer | Any | List departments |
| GET | /departments/:id | Bearer | Any | Get department |
| POST | /departments | Bearer | admin | Create department |
| PUT | /departments/:id | Bearer | admin | Update department |

## Files Created/Modified

### New Files
- `prisma/seed.ts`
- `shared/auth/middleware.ts`
- `modules/auth/types.ts`
- `modules/auth/validators.ts`
- `modules/auth/events.ts`
- `modules/auth/repository.ts`
- `modules/auth/service.ts`
- `modules/auth/controller.ts`
- `modules/auth/tests/validators.test.ts`
- `modules/auth/tests/service.test.ts`
- `modules/users-departments/types.ts`
- `modules/users-departments/validators.ts`
- `modules/users-departments/events.ts`
- `modules/users-departments/repository.ts`
- `modules/users-departments/service.ts`
- `modules/users-departments/controller.ts`
- `modules/users-departments/tests/validators.test.ts`
- `modules/users-departments/tests/rbac.test.ts`

### Modified Files
- `prisma/schema.prisma` — Role enum updated
- `shared/auth/index.ts` — Added authenticate export
- `modules/auth/README.md` — Updated with Sprint 1 content
- `modules/users-departments/README.md` — Updated with Sprint 1 content
- `CONTEXT.md` — Updated to Sprint 1

## Acceptance Criteria

| Criteria | Status |
|---|---|
| 8 Tanaghum departments seeded | ✅ |
| 6 system roles created | ✅ |
| Users can authenticate | ✅ |
| Role-based permissions work | ✅ |
| Permission tests prove roles cannot act outside their scope | ✅ |
| No business workflow implemented | ✅ |
| CI still passes | ✅ |

## Not Implemented (Deferred)

- Campaign logic
- Approval workflow
- AI generation
- Algorithm MCP
- Postiz publishing
- Analytics
- Learning engine
- CRM/WhatsApp
- Production requests
