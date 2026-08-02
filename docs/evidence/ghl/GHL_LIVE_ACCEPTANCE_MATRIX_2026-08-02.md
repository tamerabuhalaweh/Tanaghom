# GoHighLevel Live Acceptance Matrix

Date: 2026-08-02

Environment: Hybrid temporary production

Tracking issue: GitHub #238

System of record: GoHighLevel for CRM records; Tanaghum for governed work, approval, audit, and reporting.

## Decision

The customer-owned GoHighLevel account is live-accepted for governed contact, tag, opportunity/payment, and appointment operations. Each accepted operation was executed by the server worker after human approval and confirmed by provider read-back. Browser code did not call GHL directly.

The GHL scope is **conditionally accepted**, not fully closed:

- WhatsApp remains unavailable because the customer has not connected and approved a GHL WhatsApp channel, consented test contact, and messaging policy.
- Signed webhook delivery remains unavailable because a Private Integration Token does not register Marketplace/OAuth webhooks. Accepted non-message operations currently use bounded provider read-back.
- Contact, tag, sale/payment, and meeting operations now each have a fresh Stitchi-originated live acceptance record.

## Operation Matrix

| Customer workflow | Adapter and governance | Live GHL write | Provider read-back | Tanaghum mirror and audit | Stitchi live acceptance | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Customer | Preview, approval, idempotent worker command, tenant checks, sanitized result | Provider contact `iLVURdJaWPl0fRBygAdF` accepted | Confirmed | Command `90f0b3e2-de4a-40bd-8ed5-40444511b361` reconciled; local mirror and seven ordered audit records written | Action `2df55c76-89b8-4976-a077-4d70b355b603` | **Live accepted through Stitchi** |
| Tags | Mapped-tag validation, selected-customer binding, approval, idempotent worker command | HTTP 201; added `tanaghum-moaaskar-uat` | HTTP 200 confirmed exact tag present | Command `117d8860-9146-404f-9dce-3219889b8c55` reconciled; local mirror and audit updated | Action `def2e518-eb23-4801-b41e-1dfb55428aea` | **Live accepted through Stitchi** |
| Sale and payment | Approved pipeline/stage validation, payment rules, immutable preview, approval, idempotent worker command | HTTP 200; provider opportunity `tAl8XDryikbogYgIS9Am` | Confirmed pipeline, stage, Won status, value, and mapped payment fields | Command `0c4adbd5-faed-4e0f-ace5-abc07dea9e2f` reconciled; purchased/buyer mirror updated | Action `50ac5dce-a301-4232-b192-f96a9d8fe7f8` | **Live accepted through Stitchi** |
| Meeting | Approved calendar validation, time/status validation, approval, idempotent create/update | HTTP 200; provider appointment `IH32pT2lA3LI1KUrQ74f` | Confirmed | Command `a4bc5e9e-8ffd-43cc-9b06-8582eefa554e` reconciled; mirror and audit updated | Action `b7b8a07c-e59e-48ef-badd-e2c066d4e572` | **Live accepted through Stitchi** |
| WhatsApp | Consent/DND validation, approval, idempotency, and webhook-only delivery confirmation implemented | Not attempted | Not available | No delivery success claimed | Preparation only | **Blocked by customer GHL WhatsApp setup** |

## Confirmed Tag Acceptance Chain

The most recent controlled acceptance proves the complete path:

1. A user selected `Tanaghum UAT Customer` in Sales & Leads.
2. Stitchi prepared an exact mapped tag operation using the selected internal lead ID.
3. No provider write occurred before approval.
4. The authorized manager approved the Stitchi action.
5. Tanaghum created an immutable GHL command preview.
6. The authorized manager approved the CRM command.
7. The governed server worker executed the command once.
8. GHL returned HTTP 201.
9. Tanaghum read the contact back from GHL over HTTP 200.
10. Reconciliation verified that `tanaghum-moaaskar-uat` was present.
11. Tanaghum updated the local mirror and wrote the complete audit trail.

Audit actions recorded:

- `ghl_operation_previewed`
- `ghl_operation_submitted`
- `ghl_operation_approved`
- `ghl_operation_execution_started`
- `ghl_operation_provider_accepted`
- `ghl_operation_reconciled`
- `ghl_operation_local_mirror_updated`

## Confirmed Customer Acceptance Chain

The final parity run proves Customer Upsert through Stitchi, not only through
the form-based Sales & Leads workflow:

1. The selected Tanaghum lead was passed to Stitchi as governed page context.
2. Stitchi prepared `contact_upsert` and created an approval-gated action run.
3. An MFA-enrolled CCO QA identity approved and executed the internal Stitchi action.
4. Tanaghum created an immutable GHL command preview; no provider write occurred during preparation.
5. The CCO submitted and approved the exact CRM command.
6. The server worker sent the contact upsert to GHL.
7. Provider read-back confirmed contact `iLVURdJaWPl0fRBygAdF`.
8. Tanaghum reconciled the operation, updated the local mirror, and wrote the
   ordered audit chain.
9. The temporary QA identity was disabled immediately after acceptance.

Evidence identifiers:

- Conversation: `1da6dac2-ab1b-472b-a293-9c6582b867a8`
- Stitchi action: `2df55c76-89b8-4976-a077-4d70b355b603`
- GHL command: `90f0b3e2-de4a-40bd-8ed5-40444511b361`
- Provider contact: `iLVURdJaWPl0fRBygAdF`
- Final command state: `reconciled`
- Final reconciliation state: `confirmed`
- Raw secrets returned: `false`

The first attempt in this acceptance window reached
`reconciliation_failed` because of a transient provider transport failure.
The terminal failure was preserved as evidence, no provider object was
claimed, and a new idempotent command was prepared and approved after
connectivity was rechecked. The retry then reconciled successfully. This
confirms both honest failure handling and the recovery path.

## UI Status Behavior

After an operation is approved, the Hybrid UI now checks the Tanaghum command endpoint automatically. It displays:

- approved and sending;
- provider accepted and checking the saved record;
- provider-confirmed success;
- provider failure with the sanitized reason; or
- a bounded-wait recovery message with a working Refresh action.

Polling stops after reconciliation or failure and is cleaned up when the component unmounts. The browser never receives provider credentials and never executes or reconciles GHL commands directly.

## Automated Verification

Focused browser contract:

```text
npx playwright test e2e/ghl-two-way-commercial-operations.spec.ts --reporter=list --workers=1
10 passed
```

The suite covers:

- selected-customer handoff to Stitchi;
- sales-manager preparation without self-approval;
- CCO approval;
- automatic transition from approved to provider-confirmed reconciliation;
- automatic transition to a visible provider failure;
- polling shutdown after terminal state;
- WhatsApp shown honestly as approval-only;
- payment validation;
- viewer read-only behavior without hidden 403 responses;
- no browser-side Execute or Reconcile control;
- no unexpected API failures or browser console errors.

## Remaining Customer Dependency

WhatsApp can only enter live acceptance after the customer:

1. connects a WhatsApp sender/channel to the GHL location;
2. confirms message templates or direct-send policy;
3. provides a consented test contact and DND rules;
4. grants the required GHL message scopes;
5. approves one controlled message operation.

Until then, `GHL_WHATSAPP_SEND_ENABLED` and the corresponding live provider controls must remain disabled, and Tanaghum must not claim that a message was sent.
