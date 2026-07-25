#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repositoryRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const temporaryAdvisory = 'GHSA-qwww-vcr4-c8h2';
const temporaryAdvisoryUrl = `https://github.com/advisories/${temporaryAdvisory}`;
const exceptionExpiresAt = Date.parse('2026-08-08T00:00:00Z');

function runAudit(cwd) {
  try {
    const output = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    return JSON.parse(output);
  } catch (error) {
    const stdout = error?.stdout?.toString();
    if (!stdout) throw error;
    return JSON.parse(stdout);
  }
}

function advisoryUrls(report) {
  const urls = new Set();
  for (const vulnerability of Object.values(report.vulnerabilities || {})) {
    for (const via of vulnerability.via || []) {
      if (via && typeof via === 'object' && typeof via.url === 'string') {
        urls.add(via.url);
      }
    }
  }
  return urls;
}

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) files.push(...collectSourceFiles(fullPath));
    else if (/\.(?:js|jsx|ts|tsx)$/.test(entry)) files.push(fullPath);
  }
  return files;
}

function assertNoRscUsage(frontendRoot) {
  const forbiddenPatterns = [
    /react-server-dom/i,
    /unstable_RSC/,
    /RSCStaticRouter/,
    /createCallServer/,
  ];
  const matches = [];
  for (const file of collectSourceFiles(join(frontendRoot, 'src'))) {
    const content = readFileSync(file, 'utf8');
    if (forbiddenPatterns.some(pattern => pattern.test(content))) {
      matches.push(relative(frontendRoot, file));
    }
  }
  if (matches.length) {
    throw new Error(`Temporary React Router RSC exception is invalid; RSC usage found in: ${matches.join(', ')}`);
  }
}

function patchedReleaseIsAvailable() {
  try {
    execFileSync('npm', ['view', 'react-router-dom@8.3.0', 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    });
    return true;
  } catch {
    return false;
  }
}

const rootReport = runAudit(repositoryRoot);
const rootHigh = Number(rootReport.metadata?.vulnerabilities?.high || 0);
const rootCritical = Number(rootReport.metadata?.vulnerabilities?.critical || 0);
if (rootHigh || rootCritical) {
  throw new Error(`Backend production audit failed: high=${rootHigh} critical=${rootCritical}`);
}

const frontendRoot = join(repositoryRoot, 'frontend');
const frontendReport = runAudit(frontendRoot);
const frontendHigh = Number(frontendReport.metadata?.vulnerabilities?.high || 0);
const frontendCritical = Number(frontendReport.metadata?.vulnerabilities?.critical || 0);

if (!frontendHigh && !frontendCritical) {
  console.log('Production dependency audit passed with no high or critical findings.');
  process.exit(0);
}

const urls = advisoryUrls(frontendReport);
const vulnerablePackages = Object.keys(frontendReport.vulnerabilities || {});
const onlyTemporaryRscAdvisory = (
  frontendCritical === 0
  && urls.size === 1
  && urls.has(temporaryAdvisoryUrl)
  && vulnerablePackages.every(name => ['react-router', 'react-router-dom'].includes(name))
);

if (!onlyTemporaryRscAdvisory) {
  throw new Error(`Frontend production audit has unapproved findings: ${[...urls].join(', ') || 'unknown advisory'}`);
}
if (Date.now() >= exceptionExpiresAt) {
  throw new Error(`Temporary ${temporaryAdvisory} exception expired; upgrade React Router before release.`);
}

assertNoRscUsage(frontendRoot);
if (patchedReleaseIsAvailable()) {
  throw new Error('react-router-dom 8.3.0 is available; remove the temporary RSC exception and upgrade.');
}

console.warn(
  `Temporary risk acceptance: ${temporaryAdvisory} affects unstable RSC APIs, `
  + 'which are not used by this Vite SPA. The exception expires 2026-08-08 and fails as soon as 8.3.0 is published.',
);
