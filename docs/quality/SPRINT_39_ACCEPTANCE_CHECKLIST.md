# Sprint 39 Acceptance Checklist

Sprint 39 validates the Commercial/Social live POC acceptance path.

## Required Commands

Local quality gate:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
cd frontend && npm run build
```

Deployed acceptance, current blocked-state mode:

```bash
E2E_ACCEPTANCE=true \
E2E_BASE_URL=http://163.123.180.104:3000 \
E2E_API_BASE_URL=http://163.123.180.104:4000 \
npm run test:e2e:acceptance
```

Deployed acceptance, full real-provider mode after credentials are configured:

```bash
E2E_ACCEPTANCE=true \
E2E_REQUIRE_REAL_LLM=true \
E2E_REQUIRE_POSTIZ_CHANNEL=true \
E2E_BASE_URL=http://163.123.180.104:3000 \
E2E_API_BASE_URL=http://163.123.180.104:4000 \
npm run test:e2e:acceptance
```

## Definition Of Done

- Command Center loads after login.
- Command Center shows nonzero real records for campaigns, approvals, packages, and qualified leads.
- Browser console has no errors.
- Failed API responses are absent during Command Center load.
- AI Provider status never returns raw keys.
- Postiz channel status never returns raw tokens.
- If no real LLM key is configured, draft generation is blocked with `LLM_PROVIDER_REQUIRED`.
- If real LLM acceptance is required, OpenAI or Claude must be configured, active, and testable through `/ai-provider/test`.
- If Postiz scheduling acceptance is required, at least one Postiz channel must be visible and selected.
- External writes remain blocked unless sandbox flags and approvals are explicitly enabled.

## Manual GitHub Workflow

Use GitHub Actions workflow `Sprint 39 Acceptance` after deployment.

Inputs:

- `base_url`: frontend URL.
- `api_base_url`: backend API URL.
- `require_real_llm`: set true only after OpenAI or Claude is saved and tested.
- `require_postiz_channel`: set true only after Postiz returns at least one connected channel and one is selected.
