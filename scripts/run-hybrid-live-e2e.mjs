import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  E2E_HYBRID_LIVE: 'true',
  E2E_BASE_URL: process.env.E2E_BASE_URL || 'https://tanaghum-hybrid.163-123-180-104.sslip.io',
};

const result = spawnSync(
  'npx playwright test e2e/hybrid-live-acceptance.spec.ts --reporter=list --workers=1',
  { stdio: 'inherit', env, shell: true },
);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
