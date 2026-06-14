# postiz-integration Module

## Responsibility

Adapter layer for Postiz API/CLI. Handles authentication, integration discovery, draft creation, scheduling, and analytics retrieval.

## Allowed Actions

- Authenticate with Postiz (scoped credentials)
- List connected platform integrations
- Create drafts in Postiz
- Schedule posts in Postiz
- Pull post-level and platform-level analytics
- Map Postiz IDs to internal records

## Forbidden Actions

- Owning campaign business logic
- Approving content
- Direct database access to operational tables

## Postiz CLI Commands Used

| Command | Purpose |
|---|---|
| `postiz integrations list` | Discover connected platforms |
| `postiz posts create` | Create draft |
| `postiz posts schedule` | Schedule post |
| `postiz analytics post <id>` | Get post analytics |
| `postiz analytics platform <name>` | Get platform analytics |

## Provider Interface

All calls go through `PostizProvider` interface. This module is the concrete implementation.

```typescript
class PostizIntegrationProvider implements PostizProvider {
  createDraft(content) { ... }
  schedulePost(postId, scheduledAt, timezone) { ... }
  getPostAnalytics(postId) { ... }
  getPlatformAnalytics(platform, period) { ... }
  listIntegrations() { ... }
}
```

## Dependencies

- Postiz CLI or Public API
- `shared/logging` — audit all API calls

## Testing Focus

- CLI/API response parsing
- Error handling (API down, auth failure, rate limit)
- Integration discovery
- ID mapping (Postiz ID ↔ internal ID)
