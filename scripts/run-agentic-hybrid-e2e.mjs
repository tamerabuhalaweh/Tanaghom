import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  E2E_AGENTIC_HYBRID_LIVE: 'true',
  E2E_BASE_URL: process.env.E2E_BASE_URL || 'https://tanaghum-hybrid.163-123-180-104.sslip.io',
};

const result = spawnSync(
  'npx playwright test e2e/agentic-hybrid-live.spec.ts --reporter=list,html --workers=1 --trace=retain-on-failure',
  { stdio: 'inherit', env, shell: true },
);

if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
