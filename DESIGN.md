# Tanaghum Product Design System

## Direction

Tanaghum uses a restrained operational SaaS language. Light neutral work surfaces carry most daily tasks; deep ink is reserved for navigation emphasis, selected records, and occasional executive focus. The interface should feel organized and decisive at first glance, then progressively reveal detail.

## Color

- Canvas: `#F5F6F4`
- Primary surface: `#FFFFFF`
- Secondary surface: `#F0F2EF`
- Primary text: `#171A18`
- Secondary text: `#5E665F`
- Border: `#DDE1DC`
- Ink action: `#161A17`
- Brand accent: `#1B7F61`
- Accent soft: `#E7F4EF`
- Information: `#2563EB`
- Warning: `#B45309`
- Danger: `#B42318`

Use accent color for the primary action, current selection, progress, and meaningful state only. Do not use gradients, decorative color fields, or color as the only status signal.

## Typography

- Family: Inter with the system sans stack as fallback.
- Page title: 28px/34px, 650 weight.
- Section title: 18px/24px, 650 weight.
- Card/list title: 15px/21px, 600 weight.
- Body: 14px/21px, 400 weight.
- Label: 12px/16px, 600 weight.
- Data: tabular numerals where values are compared.

Use one family and a compact scale. Do not use display fonts, fluid viewport typography, negative letter spacing, or hero-scale headings in operational pages.

## Spacing And Shape

- Base spacing unit: 4px.
- Common gaps: 8, 12, 16, 24, and 32px.
- Page gutter: 16px mobile, 24px tablet, 32px desktop.
- Content width: fluid inside the shell, with readable prose constrained to 72ch.
- Control radius: 8px.
- Panel radius: 12px.
- Avoid nested cards. Use section bands, dividers, list rows, and whitespace before adding another container.
- Shadows are subtle and reserved for overlays, sticky action bars, and the active navigation surface.

## Shell And Navigation

- Desktop at 1024px and above: persistent 248px sidebar with six customer destinations maximum.
- Mobile: compact top bar and five-item bottom navigation; secondary destinations live under More.
- Customer destinations: Today, Plans & Events, Content, Sales & Leads, Performance, Stitchi.
- Setup and Admin are separate, permission-controlled groups.
- Page headers show location, short purpose, and one primary action. They do not contain feature descriptions.
- Route changes reset to the top unless returning to a deliberately preserved list state.

## Workflow Patterns

- Today: role-specific KPI strip, priority queue, performance signal, and the next required decision.
- Content: Brief, Ideas, Draft, Review, Schedule, and Results are one connected state model. The creation action appears above the library.
- Review: bounded queue plus one selected decision context. Desktop uses list/detail; mobile uses list then detail.
- Stitchi: contextual assistant with a bounded conversation history, clear proposal cards, and explicit approval before internal writes.

## Components

- Buttons: one solid primary action per task region; secondary outline and tertiary text actions.
- Inputs: persistent labels, helper/error text, 44px minimum height, visible focus, and clear required status.
- Status: plain label plus semantic icon or dot; avoid badge overload.
- Lists: stable row height, clear selected state, compact metadata, truncation with accessible full detail, and pagination or virtualization for large data.
- Empty states: state what is missing and provide the next valid action.
- Loading: preserve layout with skeletons.
- Errors: explain what failed and how to recover.

## Responsive Rules

- Build mobile-first with grid tracks using `minmax(0, 1fr)` and children using `min-width: 0`.
- No fixed-width operational table may determine a phone viewport.
- Convert dense tables to priority cards or list/detail views on mobile.
- Keep primary actions visible without covering content or bottom navigation.
- Test at 390, 768, 1024, 1366, and 1440px.

## Motion

Use 150-220ms transitions for opacity, color, and transform when they communicate state. Respect `prefers-reduced-motion`. Do not animate page entry, use hover scale, or add decorative choreography.
