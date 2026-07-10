# UX-R1A Hybrid v3 Prototype Review

Status: local prototype only. Not deployed.

Scope: Hybrid only. The A/B system and its repository were not modified.

## Purpose

This prototype tests a replacement customer workflow and shell before production implementation. It addresses the measured problems in GitHub issue #145: module-first navigation, hidden desktop navigation, long pages, clipped mobile layouts, expanded review feeds, competing design systems, and Stitchi overlays that compete with the current task.

## Local Review Routes

- Today: `http://127.0.0.1:4178/ux/hybrid-v3-preview`
- Content: `http://127.0.0.1:4178/ux/hybrid-v3-preview/content`
- Review Queue: `http://127.0.0.1:4178/ux/hybrid-v3-preview/review`

These routes use static sample content and do not call Tanaghum APIs or change customer records.

## Design Decisions

- Six customer destinations maximum: Today, Plans & Events, Content, Sales & Leads, Performance, and Stitchi.
- Setup and Admin remain separate from daily work.
- Desktop uses a persistent sidebar at 1024px and above.
- Mobile uses a compact top bar and five-item bottom navigation.
- Today begins with current priorities and meaningful commercial signals.
- Content begins with creation, then shows the connected Brief, Ideas, Draft, Review, Schedule, and Results journey.
- Review uses a bounded queue plus one selected decision context.
- Stitchi uses a bounded, context-aware sheet and never covers the current page permanently.
- Light operational surfaces carry daily work. Deep ink is limited to selection and emphasis.
- No gradients, glass panels, decorative motion, engineering jargon, or nested card stacks are used.

## Screenshots

### Today

![Today desktop](./ux-r1a-today-desktop.png)

![Today mobile](./ux-r1a-today-mobile.png)

### Content

![Content desktop](./ux-r1a-content-desktop.png)

![Content mobile](./ux-r1a-content-mobile.png)

### Review

![Review desktop](./ux-r1a-review-desktop.png)

![Review mobile list](./ux-r1a-review-mobile-list.png)

![Review mobile detail](./ux-r1a-review-mobile-detail.png)

### Stitchi

![Stitchi mobile](./ux-r1a-stitchi-mobile.png)

## Verification Evidence

- Frontend ESLint: passed.
- TypeScript and Vite production build: passed.
- Browser console: 0 errors and 0 warnings across the prototype routes.
- Horizontal overflow: 0px at 390, 768, 1024, 1366, and 1440 widths.
- Navigation policy: mobile navigation below 1024px; persistent desktop navigation at 1024px and above.
- Route scroll: navigating from a scrolled prototype page resets to the top.
- Stitchi: open and close behavior passed on desktop and mobile.
- Review: mobile queue to detail and back behavior passed.
- Form fields: visible labels or accessible labels present.
- Tested interactive targets: minimum 44px after correction.

## Not Implemented In This Prototype

- Tanaghum API wiring and real customer data.
- RBAC-driven navigation variants.
- Production loading, empty, error, and large-list data adapters.
- Plans & Events, Sales & Leads, and Performance sample pages.
- Arabic and RTL implementation.
- Deployment to the Hybrid VPS.

These remain implementation work after product-owner approval of the reference direction.
