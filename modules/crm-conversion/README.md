# crm-conversion Module

## Responsibility

Routes leads from campaigns to WhatsApp/CRM, manages contact tags, and tracks CTA source attribution.

## Allowed Actions

- Create leads from campaign interactions
- Route leads to WhatsApp for handoff
- Apply CRM tags based on campaign source
- Track CTA click-through and conversion

## Forbidden Actions

- Managing brand voice
- Approving content
- Publishing to social platforms

## Lead Routing Flow

```
Campaign CTA clicked
    ↓
Lead created in CRM
    ↓
Tags applied (campaign, platform, content_type)
    ↓
Route to WhatsApp if conversion-type campaign
    ↓
Track conversion outcome
```

## Events Emitted

- `lead.created` — when new lead identified
- `lead.routed` — when lead sent to WhatsApp/CRM
- `lead.tagged` — when tags applied

## Events Handled

- `publishing.published` — enables CTA tracking
- `campaign.created` — sets up lead routing rules

## Dependencies

- `CRMProvider` — lead creation, tagging, WhatsApp routing (mock during development)
- `MessagingProvider` — WhatsApp handoff

## Testing Focus

- Lead creation from CTA clicks
- Tag application logic
- WhatsApp routing
- Source attribution tracking
