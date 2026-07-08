# SRD v4.3 Acceptance Matrix

This file is the working traceability document for customer SRD v4.3 alignment. It separates the Commercial department command center from the Event operational workspace.

## Sprint 1 Scope

Sprint 1 establishes the Commercial Command Center foundation:

- Commercial department data model.
- SRD revenue lines.
- Three-stage operating UX shell.
- Event section preserved as the live-event operational workspace.
- Stitchi linked to the new commercial objects through approved internal actions.

## Revenue Lines

| SRD Revenue Line | Sprint 1 Status | Notes |
|---|---:|---|
| Live Events | Foundation added | Event operations remain in `/events`; commercial plans can link to events. |
| Online Courses | Foundation added | Revenue line can be configured and planned. |
| B2B | Foundation added | Revenue line can be configured and planned. |
| Platinum Elite | Foundation added | Revenue line can be configured and planned. |
| Certified Trainer Network | Foundation added | Revenue line can be configured and planned. |
| Loyalty & Community | Foundation added | Revenue line can be configured and planned. |

## Three-Stage Operating Model

| Stage | Sprint 1 Status | Product Meaning |
|---|---:|---|
| Assess | Foundation added | Capture commercial assessment signals, risks, findings, and readiness. |
| Strategy & Planning | Foundation added | Create commercial planning records by revenue line and horizon. |
| Implementation & Engagement | Foundation added | Tracks execution-stage plans and links to event operations where relevant. |

## Stitchi Alignment

| Capability | Sprint 1 Status | Notes |
|---|---:|---|
| Read commercial center context | Added | Stitchi read-only context includes revenue lines, active plans, signals, and recent plans. |
| Configure revenue line through approval | Added | `create_commercial_revenue_line` action. |
| Create commercial plan through approval | Added | `create_commercial_plan` action; requires a configured revenue line ID. |
| Create assessment signal through approval | Added | `create_commercial_assessment_signal` action. |
| External execution | Still blocked | No publishing, CRM writes, WhatsApp, Telegram, or voice execution from chat. |

## Current Gaps After Sprint 1

- The Commercial Center does not yet include full per-revenue-line KPI dashboards.
- GoHighLevel, Formaloo, Meta, YouTube, WhatsApp, Telegram, Postiz, and SmartLabs still require customer-owned credentials and validated mappings for live data.
- Stitchi can propose and execute approved internal Commercial Center actions, but it is not yet a complete autonomous business operator.
- Revenue-line planning UI is foundation-level; deeper forms for budgets, email/WhatsApp plans, offers, and detailed tasks remain in later sprints.
- Event operations are preserved and linked, but commercial plans do not yet auto-create event workflows.

## GitHub Tracking

- #111 Epic: SRD Alignment Sprint 1.
- #112 Commercial Department Data Model And Revenue Lines.
- #113 Three-Stage Commercial Command Center UX Shell.
- #114 Preserve Event Strength And Define Cross-Department Boundary.
- #115 Commercial Manager Daily Workflow And Role-Based Navigation.
- #116 SRD v4.3 Acceptance Matrix And Gap Traceability.
