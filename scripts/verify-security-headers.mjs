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

async function check(url) {
  const response = await fetch(url, { method: 'GET' });
  const missing = REQUIRED.filter(header => !response.headers.get(header));
  return {
    url,
    status: response.status,
    ok: response.ok && missing.length === 0,
    missing,
    headers: Object.fromEntries(REQUIRED.map(header => [header, response.headers.get(header) ? 'present' : 'missing'])),
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
