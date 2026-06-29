# Sprint 57: Campaign Workflow UX Rebuild

Status: implemented and ready for CI/VPS deployment

## Goal

Rebuild the customer-facing Campaigns page so it reads as a usable Commercial/Social product workflow instead of a scattered admin/workspace page.

## Scope

- Reworked Campaigns into a guided campaign operating flow.
- Kept existing backend contracts and runtime actions wired:
  - create campaign
  - create campaign from course-sales template
  - generate drafts
  - save edited draft
  - review quality
  - submit for approval
  - approve/request changes
  - prepare scheduling package
  - preview scheduling-service payload
  - check sandbox scheduling gate
- Updated shared product page width so customer pages no longer float awkwardly in the center on wide screens.
- Added a product-integrity test to prevent the Campaigns page from regressing to the old scattered layout.

## UX Changes

- Added a dark "Today's campaign step" command panel with one clear next action.
- Moved campaign templates into the campaign creation flow instead of showing the full template catalog at the top of the page.
- Added search and scope filters to the campaign queue.
- Reduced duplicate-looking visual clutter by making the campaign list compact and scrollable.
- Replaced permanently visible inactive sections with an active-step panel and a readable workflow guide.
- Replaced "Postiz payload" customer copy with scheduling-service language where possible.
- Added clearer locked/future-step explanations.

## Not In Scope

- No backend feature expansion.
- No live external publishing.
- No new social OAuth flow.
- No GHL/SmartLabs execution change.
- No M5 or uncontrolled external execution.

## Verification

- Frontend production build must pass.
- Frontend lint must pass.
- Product-integrity tests must pass.
- Existing CEO browser smoke must pass before deployment acceptance.

