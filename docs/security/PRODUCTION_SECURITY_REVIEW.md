# Production Security Review Baseline

## Status

This document is the production security review baseline for the Commercial/Social SaaS platform. It is not a substitute for an external penetration test.

## Implemented Controls

- JWT secret validation.
- Request ID propagation.
- Helmet security headers and CSP baseline.
- Static frontend CSP/security headers in nginx.
- Explicit CORS origin configuration.
- Request body size limit.
- Redis-backed rate limiting in production.
- Redis-backed JWT revocation.
- MFA with TOTP and one-time recovery codes.
- Tenant-owned encrypted credential vault.
- Raw credential values are not returned after save.
- External execution gates for publishing, CRM, messaging, voice, rendering, and M5-sensitive actions.
- Tenant lifecycle status blocks login when suspended or archived.

## CSRF / Session Position

Current auth uses bearer tokens in the `Authorization` header, not cookie-based browser sessions. That lowers classic CSRF exposure because browsers do not automatically attach bearer tokens to cross-site form posts.

Production still requires:

- CSP verification in the deployed browser.
- XSS review because browser storage tokens are sensitive.
- Confirmation that no endpoint accepts state-changing requests without `Authorization`.
- Reassessment if refresh tokens or cookies are added later.

## MFA Recovery SOP

Operating policy:

1. Admin and department manager roles must enable MFA.
2. Users must store recovery codes in an approved password manager.
3. Recovery-code regeneration requires current authenticator code.
4. Admin-assisted MFA reset requires identity verification outside the application.
5. Every MFA reset must be audit logged and reviewed.

Current implementation status:

- User self-service MFA setup exists.
- User self-service recovery-code regeneration exists and requires the current authenticator code.
- Login accepts either authenticator code or unused recovery code.
- Admin-assisted MFA reset is intentionally not exposed as a casual UI action yet; it requires a controlled support SOP and audit workflow before production use.

## CSP / Header Verification

Use the deployment verification script:

```bash
PUBLIC_APP_URL=https://tanaghum.example.com \
PUBLIC_HEALTH_URL=https://tanaghum.example.com/api/health \
node scripts/verify-security-headers.mjs
```

The script checks:

- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`

## Dependency Policy

Before production go-live:

- Run `npm audit --omit=dev` for backend.
- Run `npm audit --omit=dev` for frontend.
- Review high/critical findings manually.
- Record accepted risk with owner and expiry date.
- Pin or upgrade vulnerable packages where possible.

## Penetration Review Scope

Minimum external review scope:

- Authentication and MFA flows.
- Tenant isolation and membership enforcement.
- Credential vault endpoints.
- AI provider key handling.
- Integration credential handling.
- Postiz scheduling gates.
- GHL, WhatsApp, Telegram, and SmartLabs voice execution gates.
- CSP and frontend XSS posture.
- Rate limiting and brute-force behavior.
- Backup and restore access controls.

## Current Security Gaps

- No independent penetration test evidence yet.
- CSP verification script exists; deployed evidence must be recorded per environment.
- No formal admin-assisted MFA reset runbook sign-off yet.
- No secret-manager integration evidence beyond encrypted database vault.
- No full dependency vulnerability review evidence yet.
- No customer integration test evidence for SmartLabs/Postiz/GHL/social channels yet.
