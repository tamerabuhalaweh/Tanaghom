# Demo Evidence Pack

> **Version**: v0.1-stitch-foundation-demo
> **Date**: 2026-06-18

## Contents

| Artifact | File | Purpose |
|---|---|---|
| CI Snapshot | [CI_SNAPSHOT.md](CI_SNAPSHOT.md) | Current CI status |
| Smoke Test Template | [SMOKE_TEST_OUTPUT.md](SMOKE_TEST_OUTPUT.md) | Fill during demo |
| Acceptance Checklist | [ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md) | Pre-demo verification |
| Customer Onboarding Guide | [../product/CUSTOMER_ONBOARDING_AND_OPERATOR_GUIDE.md](../product/CUSTOMER_ONBOARDING_AND_OPERATOR_GUIDE.md) | Customer/operator handoff workflow |
| Customer-Owned Credential Checklist | [../integrations/CUSTOMER_OWNED_CREDENTIAL_CHECKLIST.md](../integrations/CUSTOMER_OWNED_CREDENTIAL_CHECKLIST.md) | Required customer accounts, credentials, scopes, and gated actions |
| Sprint 65 Customer Acceptance Workflow | [sprint-65/CUSTOMER_ACCEPTANCE_WORKFLOW.md](sprint-65/CUSTOMER_ACCEPTANCE_WORKFLOW.md) | Final 15-minute customer acceptance path |
| Sprint 65 Deployed Release Gate | [sprint-65/DEPLOYED_RELEASE_GATE.md](sprint-65/DEPLOYED_RELEASE_GATE.md) | VPS smoke, operations, and release decision evidence |

## Usage

1. Run CI snapshot before demo
2. Run smoke test and capture output
3. Complete acceptance checklist
4. Attach evidence to demo package

## Evidence Requirements

- CI must be 4/4 green
- Smoke test must pass all checks
- Acceptance checklist must be complete
- All live flags must be false
- M5 must be blocked
