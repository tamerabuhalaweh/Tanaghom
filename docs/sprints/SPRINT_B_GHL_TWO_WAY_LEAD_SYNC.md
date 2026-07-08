# Sprint B - GHL Two-Way Lead Sync

## Goal

Make GoHighLevel the customer CRM source of truth for leads while Tanaghum operates as the campaign, workflow, and reporting layer.

## Delivered

- Added GHL lead mirror fields to `LeadCaptureRecord`:
  - `source_of_truth`
  - `external_source_provider`
  - `external_source_id`
  - `external_opportunity_id`
  - `external_pipeline_id`
  - `external_stage_id`
  - `external_tags`
  - `external_last_synced_at`
  - `external_sync_fingerprint`
- Added `GhlLeadSyncRun` audit ledger for pull previews, pull syncs, write-back previews, and gated write-back execution.
- Added `/ghl-sync` API:
  - `GET /ghl-sync/status`
  - `POST /ghl-sync/pull-preview`
  - `POST /ghl-sync/pull-sync`
  - `POST /ghl-sync/write-back-preview`
  - `POST /ghl-sync/write-back`
- Added read-only LeadConnector adapter for:
  - Contacts
  - Opportunities
  - Contact tags
  - Pipeline/stage IDs
  - Opportunity status/value
- Added deterministic mapping:
  - GHL tags -> Tanaghum lead status or temperature
  - GHL pipeline stages -> Tanaghum lead status
  - Won opportunities -> purchased / buyer
  - Lost opportunities -> lost
- Updated Event Dashboard:
  - Shows `GoHighLevel Lead Source`
  - Shows GHL readiness, last sync, mirrored lead count, and blocked setup actions
  - Adds `CRM Source` column to event leads
- Added gated write-back execution:
  - Only authorized roles can call it.
  - Tenant-owned GHL credentials are required.
  - `GHL_WRITE_BACK_ENABLED=true` is required.
  - Raw GHL responses are not returned to the frontend.

## Safety Rules

- Customer-owned tenant vault credentials are required.
- `GHL_READ_SYNC_ENABLED=true` is required before live read sync calls are made.
- Raw GHL API payloads are not returned to the frontend.
- Tanaghum write-back is gated by default.
- `GHL_WRITE_BACK_ENABLED=true` is required before write execution.
- GoHighLevel remains the CRM source of truth.
- Tanaghum remains the operating/reporting layer.

## Still Required

- Customer must provide valid GHL API key and location ID.
- Customer must configure tag and pipeline/stage mappings.
- Customer must explicitly enable GHL read sync in deployment.
- Real customer GHL test must be executed before claiming production CRM sync verified.
- Real write-back execution must be tested with the customer GHL account before claiming production CRM write-back verified.
