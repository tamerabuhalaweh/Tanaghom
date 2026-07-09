import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  E2E_HYBRID_LIVE: 'true',
  E2E_BASE_URL: process.env.E2E_BASE_URL || 'https://tanaghum-hybrid.163-123-180-104.sslip.io',
};

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  npx,
  ['playwright', 'test', 'e2e/hybrid-live-acceptance.spec.ts', '--reporter=list'],
  { stdio: 'inherit', env },
);

process.exit(result.status ?? 1);
