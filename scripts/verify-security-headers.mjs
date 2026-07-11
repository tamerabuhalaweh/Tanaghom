#!/usr/bin/env node

const appUrl = process.env.PUBLIC_APP_URL || process.argv[2];
const apiUrl = process.env.PUBLIC_HEALTH_URL || process.argv[3];

if (!appUrl || !apiUrl) {
  console.error('Usage: PUBLIC_APP_URL=<url> PUBLIC_HEALTH_URL=<url> scripts/verify-security-headers.mjs');
  process.exit(2);
}

const REQUIRED = [
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
];

const HSTS_HEADER = 'strict-transport-security';
const MIN_HSTS_MAX_AGE = Number(process.env.MIN_HSTS_MAX_AGE || 31536000);

function validateHsts(url, value) {
  if (!url.startsWith('https://')) return null;
  if (!value) return 'missing';
  const match = value.match(/(?:^|;)\s*max-age=(\d+)/i);
  if (!match) return 'max-age_missing';
  if (Number(match[1]) < MIN_HSTS_MAX_AGE) return 'max-age_too_short';
  return null;
}

async function check(url) {
  const response = await fetch(url, { method: 'GET', redirect: 'error' });
  const missing = REQUIRED.filter(header => !response.headers.get(header));
  const hsts = response.headers.get(HSTS_HEADER);
  const hstsError = validateHsts(url, hsts);
  return {
    url,
    status: response.status,
    ok: response.ok && missing.length === 0 && !hstsError,
    missing,
    hstsError,
    headers: Object.fromEntries(
      [...REQUIRED, HSTS_HEADER].map(header => [header, response.headers.get(header) ? 'present' : 'missing']),
    ),
  };
}

const results = await Promise.all([check(appUrl), check(apiUrl)]);
for (const result of results) {
  console.log(JSON.stringify(result));
}

const failed = results.filter(result => !result.ok);
if (failed.length) {
  console.error(`Security header verification failed for ${failed.length} endpoint(s).`);
  process.exit(1);
}

console.log('Security header verification passed.');
