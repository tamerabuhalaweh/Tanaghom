# Sprint 22 — Deployment & Security Hardening

> **Date**: 2026-06-17
> **Status**: ✅ Complete
> **PR**: #23 (f83773f)

## Goal

Prepare the platform for controlled demo deployment. Docker packaging, environment validation, kill switches, CI pipeline, and security hardening.

## Deliverables

| Item | Status |
|---|---|
| Dockerfile (backend) | ✅ |
| docker-compose.dev.yml | ✅ |
| docker-compose.demo.yml | ✅ |
| Environment validation | ✅ |
| 9 execution kill switches | ✅ |
| Rate limiting | ✅ |
| Demo mode headers | ✅ |
| tsup backend bundler | ✅ |
| CI pipeline (4 jobs) | ✅ |
| 30 new tests | ✅ |

## CI Jobs

| Job | Purpose |
|---|---|
| backend | lint, typecheck, test, build, smoke |
| frontend | install, lint, build |
| docker | build, validate, startup |
| security | secret scan, demo safety |

## Accepted Demo Findings

1. Lightweight secret scan (grep-based)
2. Docker Prisma install in runtime
3. Compose JWT_SECRET expands blank
4. Security tests are assertion-only

## Technical Notes

- tsup is the correct backend bundler for Node ESM with path aliases
- `tsc-alias` does NOT work with directory imports
- `assertDemoSafe()` must be called at startup
- JWT_SECRET must be required at module load time

## Tests

856 tests pass. 30 new tests for deployment and security.
