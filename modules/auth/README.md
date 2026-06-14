# auth Module — Sprint 1

## Implemented

- `types.ts` — Login input/output types, session user type
- `validators.ts` — Login input validation (Zod)
- `events.ts` — Auth event definitions (authenticated, login_failed, session_expired)
- `repository.ts` — User lookup by email and ID
- `service.ts` — Login (password verify + JWT), session retrieval
- `controller.ts` — POST /auth/login, GET /auth/session
- `tests/validators.test.ts` — Login validation tests
- `tests/service.test.ts` — JWT, password hashing, role middleware tests

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/login | No | Authenticate user, returns JWT + user |
| GET | /auth/session | Bearer | Get current session user |

## Test Coverage

- Login input validation (valid, invalid email, empty password, missing fields)
- JWT sign/verify round-trip
- JWT invalid token rejection
- Password hash/compare round-trip
- Password wrong password rejection
- requireRole allows matching role
- requireRole blocks non-matching role
