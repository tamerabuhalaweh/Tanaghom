# RELEASE_CHECKLIST.md — Production Readiness

> **Version**: 1.0
> **Date**: 2026-06-14

## Pre-Release Checklist

### Code Quality
- [ ] All tests passing (`npm run test`)
- [ ] Lint passing (`npm run lint`)
- [ ] Type check passing (`npm run typecheck`)
- [ ] Build succeeding (`npm run build`)
- [ ] No console.log or debug statements in production code
- [ ] No TODO comments blocking functionality

### Database
- [ ] All migrations tested and reversible
- [ ] Seed data verified
- [ ] Database backup taken before deployment
- [ ] Migration rollback plan documented

### Security
- [ ] No secrets in committed files
- [ ] `.env` not in repository
- [ ] All API endpoints have authentication
- [ ] Permission tests passing
- [ ] Prompt injection tests passing
- [ ] Audit logging verified for all external actions
- [ ] Kill switch tested

### Infrastructure
- [ ] Docker Compose services all healthy
- [ ] Environment variables documented in `.env.example`
- [ ] Backup and restore procedure tested
- [ ] Monitoring and alerting configured

### Documentation
- [ ] API contract (openapi.yaml) matches implementation
- [ ] Sprint file updated with actual deliverables
- [ ] CONTEXT.md updated for next sprint
- [ ] ADRs written for any architecture decisions made
- [ ] Module READMEs updated if boundaries changed

### Business Validation
- [ ] Workflow tested end-to-end by business owner
- [ ] Approval routing verified for all risk categories
- [ ] Platform rules reviewed and current
- [ ] Brand voice compliance verified
