# Social Growth Intelligence

## Purpose

Tanaghum now frames the customer-facing Commercial/Social product around a course-sales growth workflow:

**Create stronger social content -> approve safely -> prepare scheduling -> capture interest -> qualify leads -> prepare CRM/voice handoff -> measure results.**

This is designed for personal-brand businesses that sell courses, coaching, events, books, apps, or learning programs through social media.

## Customer-Facing Capabilities

The Growth Engine provides:

- Course-sales KPI dashboard.
- Course launch, lead magnet, event, testimonial, and book/app-to-course campaign templates.
- Social Algorithm Knowledge Pack.
- Course-sales funnel from campaigns to qualified leads.
- GoHighLevel and SmartLabs readiness status.
- Next best actions for the marketing team.

## Social Algorithm Knowledge Pack

Tanaghum does **not** import private platform algorithms.

The platform uses a governed knowledge pack built from:

- official/public platform guidance,
- official social analytics APIs when the customer connects accounts,
- customer-owned historical performance data,
- approved operator rules,
- internal learning signals from published campaign outcomes.

The knowledge pack can influence:

- opening hook strength,
- format recommendation,
- CTA clarity,
- hashtag hygiene,
- platform fit,
- risk/compliance notes,
- timing recommendation,
- lead-conversion readiness.

## MCP Role

The Social Algorithm MCP path is a read-only/import-and-normalize layer.

Correct flow:

```text
Official docs / official analytics APIs / customer performance data
-> Social Algorithm MCP
-> Tanaghum Algorithm Knowledge Pack
-> Human/operator review
-> Active scoring and recommendation rules
-> AI draft generation and quality review
```

The MCP server does not become the source of truth. Tanaghum's governed knowledge pack, approval controls, audit records, and tenant-owned credentials remain authoritative.

## Course-Sales Templates

The product includes starter motions for:

- Course Launch Waitlist.
- Lead Magnet / Comment Keyword.
- Live Event Conversion.
- Transformation Story.
- Book/App to Course Bridge.

Each template produces a real campaign record and can move through the existing workflow:

```text
Template -> Campaign -> AI drafts -> Quality review -> Human approval -> Scheduling package -> Leads -> CRM/voice handoff
```

## Honest Current Boundaries

The following still require customer/operator input:

- AI model key.
- Postiz connected business/professional social channels.
- Official social analytics credentials.
- GoHighLevel tenant API credentials.
- SmartLabs tenant API key.
- WhatsApp/Telegram credentials where required.

The platform must not fake engagement, scrape social platforms, create fake metrics, or claim private algorithm access.
