# ADR-002: Use Postiz for Social Media Publishing

> **Status**: Accepted
> **Date**: 2026-06-14

## Context

The platform needs a publishing layer to schedule and publish content to social media platforms (LinkedIn, Instagram, X). Building custom integrations for each platform API is complex, error-prone, and requires ongoing maintenance as APIs change.

## Decision

Use Postiz as the publishing and analytics layer. Integrate via Postiz CLI (wraps Public API, returns structured JSON) and/or Postiz Public API directly.

## Consequences

- Postiz handles multi-platform publishing, scheduling, and API changes
- Postiz provides post-level and platform-level analytics
- Self-hosted deployment via Docker Compose gives full control
- CLI is agent-ready (structured JSON output)
- Dependency on Postiz project health and maintenance
- Temporal workflow orchestration in Postiz Docker Compose adds complexity

## Alternatives Considered

- **Custom integrations**: Full control but high maintenance burden for multiple platform APIs.
- **Buffer/Hootsuite API**: SaaS dependency, less control, cost.
- **n8n/Make.com**: Workflow automation but not purpose-built for social publishing.

## References

- Postiz docs: https://docs.postiz.com
- Postiz Docker Compose: https://docs.postiz.com/installation/docker-compose
- Postiz CLI: https://docs.postiz.com/cli/introduction
- Postiz Public API: https://docs.postiz.com/public-api/introduction
