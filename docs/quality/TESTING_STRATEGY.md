# TESTING_STRATEGY.md — Testing Approach

> **Version**: 1.0
> **Date**: 2026-06-14

## Test Types

| Type | Purpose | Tool | When |
|---|---|---|---|
| Unit | Validate pure logic inside services | Vitest | Every commit |
| Repository | Validate database queries and migrations | Vitest + test DB | Every commit |
| API | Validate endpoint contracts | Vitest + supertest | Every commit |
| Permission | Ensure roles cannot do unauthorized actions | Vitest | Every commit |
| Integration | Validate module-to-module behavior | Vitest | Every commit |
| E2E | Validate full user journeys | Playwright | Before merge to main |
| Security | Validate safe handling of secrets and prompts | Vitest + custom | Sprint security review |

## Test Organization

```
/modules/[module]/tests/
├── service.test.ts        # Unit tests for service logic
├── controller.test.ts     # API endpoint tests
├── repository.test.ts     # Database query tests
├── permissions.test.ts    # Role-based access tests
└── integration.test.ts    # Cross-module tests
```

## Conventions

- Test files live in the module's `tests/` directory
- One test file per concern (service, controller, permissions)
- Use descriptive test names: `should reject draft when risk score exceeds threshold`
- Mock external providers (LLM, Postiz, Messaging, CRM, Analytics) in all tests
- Use a dedicated test database (not development)
- Clean up test data after each test (use transactions or cleanup hooks)
- Test both success and failure paths
- Test permission boundaries: what each role CANNOT do

## Test Coverage Targets

| Area | Target |
|---|---|
| Service logic | ≥ 90% branch coverage |
| Controllers/API | All endpoints tested, all status codes covered |
| Permissions | Every role × every action matrix entry |
| State machines | Every valid transition + every invalid transition rejected |
| Error handling | All error types returned correctly |

## Running Tests

```bash
# All tests
npm run test

# Single module
npm run test -- --filter campaigns

# Single file
npm run test -- modules/campaigns/tests/service.test.ts

# With coverage
npm run test -- --coverage

# E2E tests
npm run test:e2e

# Watch mode
npm run test -- --watch
```

## Integration Test Prerequisites

- PostgreSQL test database running (via Docker Compose)
- Redis running (via Docker Compose)
- All external providers mocked
- Test data seeded via fixtures

## Security Test Cases

- Prompt injection content cannot override system rules
- Unprivileged user cannot access admin endpoints
- Agent cannot bypass approval workflow
- Secrets not exposed in API responses or logs
- SQL injection attempts blocked by parameterized queries
- Rate limiting enforced on public endpoints
