# Independent Security Review Brief

## Purpose

This brief is the handoff contract for an independent tester. Internal automated tests and CodeQL are necessary controls, but they are not an independent penetration test.

## In-Scope Environment

- Hybrid production URL only: `https://tanaghum-hybrid.163-123-180-104.sslip.io`
- Backend API through `/api`
- Customer-owned connectors must remain non-executing unless the test owner explicitly authorizes a sandbox account.
- The A/B environment is out of scope and must not be scanned or changed.

## Required Test Areas

1. Authentication, MFA, recovery codes, password reset, token revocation, and brute-force controls.
2. Tenant isolation across every customer-owned object and export path.
3. Role and approval bypass attempts for plans, content, leads, reporting, credentials, and Stitchi actions.
4. Credential vault encryption, secret redaction, logging, and API response handling.
5. Stored/reflected DOM XSS, CSP bypass attempts, unsafe URL handling, and browser token exposure.
6. Injection testing for SQL/Prisma inputs, CSV imports, webhooks, LLM prompts, and file metadata.
7. SSRF and egress behavior for AI, GHL, Postiz, SmartLabs, OAuth, and runtime bridge endpoints.
8. External execution kill switches and approval gates.
9. Rate limiting, request size limits, denial-of-service controls, and error information leakage.
10. Backup, operations, metrics, and administrative endpoint access control.

## Evidence Required From Tester

- Tester/company identity and test dates.
- Exact environment and commit SHA.
- Methodology and tool versions.
- Findings with severity, reproducible steps, affected endpoint, impact, and remediation guidance.
- Explicit statement covering tenant-isolation testing.
- Retest evidence for every critical/high finding.
- Final signed summary showing no open critical or high findings, or an approved risk acceptance with owner and expiry.

## Exit Rule

Issue #171 must remain open while no independent report exists or any unaccepted critical/high finding remains open.
