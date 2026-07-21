# Annual Commercial Planning UAT

## Purpose

Validate that a Brand Head can turn approved historical learning into an annual AED strategy and monthly portfolio without bypassing approval or archive controls.

## Preconditions

- Sign in as the customer Brand Head account.
- Open **Plans**, then **Annual Plan**.
- Confirm the intended planning year.
- Confirm the selected scenario status is **Draft** or **Changes requested** before editing.
- Approved learning is optional, but it must come from **Assessment**.

## Create The Annual Plan

1. Enter the plan title, currency, annual budget, annual revenue target, and strategy.
2. Select approved historical learning when available.
3. Select **Create annual plan**.
4. Confirm the scenario selector shows **Version 1 - Draft**.
5. Confirm Annual budget, Allocated, Unallocated, and Revenue target show the submitted values.

## Add August Work

1. Select **Aug** in the month row.
2. Confirm **Add to August** is visible and enabled.
3. Select **Add to August**.
4. Confirm the editor title is **Add initiative to August**.
5. Choose a revenue line and enter the initiative, allocation, target, dates, and optional event link.
6. Select **Save initiative**.
7. Confirm August shows the saved initiative and updated allocations.

## Lifecycle Rules

- Add and edit all monthly initiatives while the scenario is **Draft**.
- **Submit for approval** only after the annual direction and monthly portfolio are ready for review.
- **Archive** is not a normal UAT step. It permanently preserves that scenario as read-only evidence.
- Archive requires a confirmation dialog and a reason.
- An archived scenario cannot be edited or receive monthly initiatives.

## Recover An Archived Scenario

1. Select the archived scenario in **Scenario version**.
2. Confirm the page explains that the scenario is archived and read-only.
3. Confirm **Add to August** remains visible but disabled.
4. Select **Create new draft scenario**.
5. Enter the reason for continuing planning.
6. Select **Create draft scenario**.
7. Confirm the next version is selected with status **Draft**.
8. Confirm the annual direction and approved learning were copied.
9. Confirm monthly execution links were not copied.
10. Select August and confirm **Add to August** is enabled.

## Acceptance Evidence

- No browser console errors or failed API responses.
- No horizontal overflow at desktop, tablet, or mobile widths.
- Archive and scenario creation appear in the activity log.
- The archived scenario remains available and unchanged.
- The recovered scenario has a new version number, status **Draft**, and an empty monthly execution portfolio.
