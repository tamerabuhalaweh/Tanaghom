# PR Review Prompt

Use this prompt when reviewing a pull request.

---

## Review Checklist

### Code Quality
- [ ] Code follows module pattern (controller/service/repository/types/validators/events)
- [ ] No direct imports from other modules (use shared utilities or events)
- [ ] No hardcoded values for secrets, URLs, or configuration
- [ ] Error handling is consistent with shared error types
- [ ] Logging follows structured format (actor, action, object, timestamp, result)

### Module Boundaries
- [ ] Changes are within the allowed module scope
- [ ] No cross-module business logic leaked into wrong module
- [ ] Domain events used for inter-module communication
- [ ] Provider interfaces used for external service calls

### State Machines
- [ ] Status transitions go through validation functions
- [ ] Invalid transitions are rejected with clear errors
- [ ] All transitions are logged with actor and timestamp
- [ ] State machine transition table is respected

### Security
- [ ] No secrets in code or comments
- [ ] Authentication required on all endpoints
- [ ] Permission checks match USER_ROLES.md matrix
- [ ] Approval workflow cannot be bypassed
- [ ] Audit logging covers new external actions
- [ ] Parameterized database queries (no SQL injection)

### Testing
- [ ] Unit tests for service logic
- [ ] API tests for endpoints
- [ ] Permission tests for role boundaries
- [ ] State machine tests for valid + invalid transitions
- [ ] Mock providers used (no real external calls in tests)

### Documentation
- [ ] openapi.yaml updated if API changed
- [ ] Module README.md updated if responsibilities changed
- [ ] Sprint file updated with progress
- [ ] ADR written if architecture decision was made

### Database
- [ ] Migration is reversible (down migration exists)
- [ ] Schema changes match DATA_MODEL.md
- [ ] Indexes added for query patterns
- [ ] No data loss in migration

## Review Output Format

```
## Summary
[Approve / Request Changes / Comment]

## Findings
- [List issues found]

## Positive Notes
- [Good patterns observed]

## Required Changes
- [Must fix before merge]

## Suggestions
- [Nice to have improvements]
```
