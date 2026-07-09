# UAE PDPL / Privacy Review Guide

## Purpose

This document supports GitHub issue #143 / SRD-R13. It explains, in business language, why Tanaghum needs a privacy, retention, export, and deletion review before live customer data, social messages, CRM records, voice calls, and AI-agent conversations are treated as production-ready.

This document is not legal advice. Final acceptance must come from the customer and their legal/privacy counsel.

## Why This Matters

The UAE Personal Data Protection Law is Federal Decree-Law No. 45 of 2021. Public UAE government guidance describes it as the law governing protection of personal data. The law creates obligations around how personal data is collected, processed, protected, retained, and handled when a person asks to access, correct, delete, restrict, or transfer their data.

For Tanaghum, this matters because the platform may store:

- Stitchi and AI-agent conversation logs.
- CRM leads, purchases, meetings, no-shows, and follow-up history.
- WhatsApp, social DM, or comment records.
- SmartLabs voice call summaries or transcripts.
- Content approval and publishing audit evidence.

## What The Customer Must Decide

The customer answered that retention should be "forever". That is recorded as a preference, but it is not enough for production compliance by itself. The customer/legal team still needs to confirm:

- Which privacy laws apply to their customer base and operating countries.
- Whether "forever" retention is legally acceptable for each data category.
- Who inside the customer organization owns privacy approvals and data subject requests.
- Who can export tenant data or request deletion review.
- Whether voice, WhatsApp, social DM, and AI-agent logs can be stored for audit and improvement.
- Whether data should be deleted, anonymized, archived, or retained for legal/business reasons.

## Current Tanaghum Controls

Tanaghum now provides:

- A tenant privacy and retention policy in Tenant Admin.
- Configurable retention mode instead of hardcoded forever.
- Stored-data category toggles for conversation logs, CRM lead data, voice transcripts, and social DM records.
- Export/delete authority limited to executive admin/CCO system roles until a dedicated GM role exists.
- Tenant export with password hashes, API keys, OAuth tokens, and encrypted secrets redacted.
- Deletion review flow that does not hard-delete data from the browser.
- Audit log entries for tenant export, deletion review, lifecycle changes, and privacy policy updates.
- Live automation gate: social, CRM, voice, and AI-agent workflows remain blocked until privacy/legal readiness is documented.

## What Is Still Pending

- Customer legal/privacy owner must be named.
- Final retention period must be approved.
- Final UAE PDPL/data-protection review must be accepted by customer counsel.
- Dedicated GM role can be added later if the customer wants GM access separate from admin/CCO.
- Real connector processing remains dependent on customer-provided credentials and privacy approval.
