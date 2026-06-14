# production-requests Module

## Responsibility

Generates AI creative briefs from campaign requests and creates design/video/carousel asset requests for the production team.

## Allowed Actions

- Generate creative briefs from campaign context
- Create design/video/carousel asset requests
- Track asset request status (requested, in_progress, delivered, approved)
- Notify production team via messaging

## Forbidden Actions

- Approving commercial strategy
- Publishing content directly
- Managing brand voice

## Asset Request Types

| Type | Description |
|---|---|
| Image | Static graphics, infographics, product photos |
| Carousel | Multi-slide designs for LinkedIn/Instagram |
| Reel/Video | Short-form video content |
| Story | Story-format content |
| Document | PDF guides, whitepapers |

## Creative Brief Output

```
Campaign: [Campaign name]
Platform: [Target platform]
Format: [Asset type]
Objective: [What the asset should communicate]
Audience: [Target audience]
Brand Guidelines: [Key brand elements to include]
Dimensions: [Platform-specific dimensions]
Deadline: [When asset is needed]
Reference: [Examples or mood board links]
```

## Events Emitted

- `production.brief_created` — when brief generated
- `production.request_created` — when asset request sent
- `production.asset_delivered` — when asset received

## Events Handled

- `campaign.created` — triggers brief generation (for campaigns needing assets)

## Dependencies

- `MessagingProvider` — notify production team

## Testing Focus

- Brief generation from campaign context
- Asset request lifecycle
- Notification delivery
