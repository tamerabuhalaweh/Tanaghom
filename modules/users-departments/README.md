# users-departments Module — Sprint 1

## Implemented

- `types.ts` — Role enum (6 roles), user/department CRUD schemas (Zod), summary types
- `validators.ts` — Create/update user and department validation
- `events.ts` — User and department event definitions
- `repository.ts` — Full CRUD for users and departments with Prisma
- `service.ts` — Business logic with permission checks, audit logging, event emission
- `controller.ts` — REST endpoints with JWT auth
- `tests/validators.test.ts` — Input validation tests
- `tests/rbac.test.ts` — Full RBAC permission matrix tests (6 roles × 5 permissions)

## System Roles

| Role | users:read | users:create | users:update | departments:read | departments:manage |
|---|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| cco | ✅ | ❌ | ❌ | ✅ | ❌ |
| department_head | ✅ | ❌ | ❌ | ✅ | ❌ |
| specialist | ✅ | ❌ | ❌ | ✅ | ❌ |
| reviewer | ✅ | ❌ | ❌ | ✅ | ❌ |
| viewer | ✅ | ❌ | ❌ | ✅ | ❌ |

## API Endpoints

| Method | Path | Auth | Min Role | Description |
|---|---|---|---|---|
| GET | /users | Bearer | Any | List users (filterable by department, role) |
| GET | /users/:id | Bearer | Any | Get user details |
| POST | /users | Bearer | admin | Create user |
| PUT | /users/:id | Bearer | admin | Update user |
| GET | /departments | Bearer | Any | List departments |
| GET | /departments/:id | Bearer | Any | Get department details |
| POST | /departments | Bearer | admin | Create department |
| PUT | /departments/:id | Bearer | admin | Update department |

## Test Coverage

- Validator tests: create/update user, create/update department (valid, invalid, edge cases)
- RBAC tests: every role × every permission = 30+ test cases proving roles cannot act outside their permissions
- Unknown role has no permissions
- All 6 roles verified to have permission entries
