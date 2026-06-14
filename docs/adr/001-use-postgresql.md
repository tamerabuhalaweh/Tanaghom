# ADR-001: Use PostgreSQL as Primary Database

> **Status**: Accepted
> **Date**: 2026-06-14

## Context

The platform needs a relational database to store operational data: content items, approvals, analytics, audit logs, users, departments, and platform rules. Data integrity, transactional consistency, and structured queries are critical for workflow state management.

## Decision

Use PostgreSQL as the primary operational database, with Prisma as the ORM for schema management and migrations.

## Consequences

- Strong data integrity with ACID transactions
- Well-supported by Prisma for TypeScript projects
- pgvector extension available for vector search if needed
- Team familiarity with PostgreSQL
- Requires database hosting and backup management

## Alternatives Considered

- **MongoDB**: Flexible schema but weaker consistency guarantees for workflow state. Not ideal for relational data (users → departments, approvals → content items).
- **SQLite**: Too limited for production use, no concurrent access support.
- **MySQL**: Viable but PostgreSQL has better JSON support and pgvector extension.

## References

- Prisma documentation: https://www.prisma.io/docs
- PostgreSQL + pgvector: https://github.com/pgvector/pgvector
