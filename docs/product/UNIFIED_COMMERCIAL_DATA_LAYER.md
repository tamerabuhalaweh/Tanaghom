# Unified Commercial Data Layer

Status: in progress for the Hybrid production path.

This layer is the shared truth model used by the Commercial Command Center, event workspace, connector setup, dashboards, and Stitchi. It must use customer-owned credentials, tenant-scoped storage, auditable read-sync runs, and honest missing-data states. It must not invent CRM, course, ads, form, or analytics data.

## GoHighLevel Read-Sync Acceptance

Tanaghum treats GoHighLevel as the CRM source of truth and Tanaghum as the operating/reporting layer.

Implemented foundation:

- Tenant-owned GHL API key and location ID are stored in the encrypted integration credential vault.
- GHL read sync pulls contacts, opportunities, appointments, tags, stages, purchases/value, meeting outcomes, and no-show signals into Tanaghum lead mirrors.
- GHL read sync is blocked until `GHL_READ_SYNC_ENABLED=true`.
- GHL write-back remains separately blocked by `GHL_WRITE_BACK_ENABLED`.
- `/ghl-sync/status` exposes an explicit acceptance state:
  - `requires_credentials`
  - `requires_mapping`
  - `blocked_by_environment`
  - `ready_for_read_sync`
  - `synced`

Official API references:

- HighLevel API documentation: https://help.gohighlevel.com/support/solutions/articles/48001060529-highlevel-api-documentation
- LeadConnector contacts search: https://marketplace.leadconnectorhq.com/docs/leadconnector/contacts/search/
- HighLevel opportunities search: https://marketplace.gohighlevel.com/docs/ghl/opportunities/search-opportunity/

## Kajabi Discovery And Connector Foundation

Kajabi is the course platform source for online courses, offers, purchases, orders, transactions, forms, customers, and course revenue signals.

Implemented foundation:

- Kajabi appears in tenant credential setup as a customer-owned OAuth client credential.
- Required fields: `clientId`, `clientSecret`.
- Optional fields: `baseUrl`, `siteId`.
- `/kajabi/status` returns credential/readiness state without calling Kajabi.
- `/kajabi/validate-read-access` is read-only and calls Kajabi only when credentials exist and `KAJABI_READ_SYNC_ENABLED=true`.
- Validation checks OAuth token issuance and the purchases read endpoint.
- Raw secrets and raw provider payloads are never returned.

Official API references:

- Kajabi API introduction: https://help.kajabi.com/api-reference/introduction
- Kajabi authentication: https://help.kajabi.com/api-reference/authentication
- Kajabi list purchases: https://help.kajabi.com/api-reference/purchases/list-purchases

## Still Missing

- Real customer GHL acceptance run with actual customer credentials and mappings.
- Kajabi import preview and approved import mapping into course revenue dashboards.
- Meta, YouTube, Formaloo, Postiz, WhatsApp, Telegram, and SmartLabs acceptance runs with real customer credentials.
- Scheduled sync workers and customer-approved retry/alert policy.
