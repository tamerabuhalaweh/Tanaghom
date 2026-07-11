#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const webhookUrl = process.env.ALERT_WEBHOOK_URL || process.env.OPERATIONS_ALERT_WEBHOOK_URL || '';
const source = process.argv[2] || process.env.ALERT_SOURCE || 'tanaghum-operations';
const title = process.env.ALERT_TITLE || 'Tanaghum production operations alert';
const message = process.env.ALERT_MESSAGE || `${source} requires operator attention.`;
const evidencePath = process.env.ALERT_EVIDENCE_PATH || './ops/alert-delivery-latest.json';

function writeEvidence(status, detail = {}) {
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, JSON.stringify({
    attemptedAt: new Date().toISOString(),
    source,
    status,
    destinationConfigured: Boolean(webhookUrl),
    rawDestinationReturned: false,
    ...detail,
  }, null, 2));
}

if (!webhookUrl) {
  writeEvidence('not_configured');
  console.log('Alert destination is not configured; evidence recorded without exposing a destination.');
  process.exit(0);
}

let failureEvidenceWritten = false;
try {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      service: 'tanaghum-hybrid',
      severity: process.env.ALERT_SEVERITY || 'critical',
      source,
      title,
      message,
      occurredAt: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(Number(process.env.ALERT_TIMEOUT_MS || 15000)),
  });
  if (!response.ok) {
    writeEvidence('delivery_failed', { responseStatus: response.status });
    failureEvidenceWritten = true;
    throw new Error(`Alert endpoint returned HTTP ${response.status}`);
  }
  writeEvidence('delivered', { responseStatus: response.status });
  console.log('Operations alert delivered.');
} catch (error) {
  if (!failureEvidenceWritten) {
    writeEvidence('delivery_failed', { errorClass: error instanceof Error ? error.name : 'UnknownError' });
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
