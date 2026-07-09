# Hybrid Live E2E Acceptance

Purpose: keep local mocked Playwright specs separate from live Hybrid acceptance checks.

## Local PR Checks

Use local/mocked specs for normal pull request validation:

```bash
npm run test:e2e
```

These specs may intercept API routes, use local seeded data, or validate component behavior. They are not proof that the deployed Hybrid VPS works.

## Live Hybrid Acceptance

Use the dedicated live gate after deploying Hybrid:

```bash
npm run test:e2e:hybrid-live
```

Default target:

```text
https://tanaghum-hybrid.163-123-180-104.sslip.io
```

Override target when needed:

```bash
E2E_BASE_URL=https://your-hybrid-host.example.com npm run test:e2e:hybrid-live
```

Live accounts are centralized in:

```text
e2e/fixtures/hybrid-live-accounts.ts
```

Environment overrides are supported:

- `E2E_MANAGER_EMAIL`
- `E2E_MANAGER_PASSWORD`
- `E2E_SPECIALIST_EMAIL`
- `E2E_SPECIALIST_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

## What The Live Gate Covers

- Manager, specialist, and admin login.
- Main customer navigation pages.
- Specialist redirect away from admin-only connector setup.
- Manager/admin access to connector setup.
- Stitchi AI-assisted commercial plan proposal.
- No write execution before human approval.
- No failed page/API responses.
- No browser console errors.
- No customer-visible internal seed/test wording.
- No horizontal page overflow.

## Safety Rules

- Do not add destructive writes to this live gate.
- Do not trigger external publishing, CRM writes, WhatsApp, Telegram, voice, or payment actions.
- Any future live write must require a separate explicit environment flag and documented rollback path.
