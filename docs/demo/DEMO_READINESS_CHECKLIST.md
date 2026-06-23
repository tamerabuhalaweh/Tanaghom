# Demo Readiness Checklist

> **Version**: 1.0
> **Date**: 2026-06-23
> **Sprint**: 27

## Infrastructure

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Database is healthy
- [ ] Redis is healthy
- [ ] Health endpoint returns 200
- [ ] Demo mode headers present
- [ ] M5 blocked header present

## Demo User

- [ ] Demo user can login
- [ ] AgentRep is created for demo user
- [ ] Session Context Lock enforced
- [ ] Demo user has correct permissions

## Demo Data

- [ ] Demo departments seeded
- [ ] Demo users seeded
- [ ] Demo AgentReps seeded
- [ ] Demo capabilities seeded
- [ ] Demo campaigns available
- [ ] Demo approval items available
- [ ] Demo analytics data available

## Golden Path

- [ ] Dashboard loads with demo data
- [ ] Campaign list shows demo campaigns
- [ ] Campaign detail view works
- [ ] AI draft generation works (mock provider)
- [ ] Platform adaptation shows multiple platforms
- [ ] Reach/readiness scoring works
- [ ] Approval submission works
- [ ] Approval queue shows pending items
- [ ] Approve/reject/request edit works
- [ ] Publishing preparation package generated
- [ ] Publishing status shows "preparation only"
- [ ] Analytics demo view loads
- [ ] CRM/WhatsApp handoff preparation shows
- [ ] Production request preparation shows
- [ ] Audit trail / SPINE timeline visible

## Safety

- [ ] No real publishing occurs
- [ ] No real messages sent
- [ ] No real CRM writes
- [ ] No real analytics pulls
- [ ] No real rendering
- [ ] M5 execution blocked
- [ ] External APIs blocked
- [ ] Kill switches active
- [ ] Demo labels visible on all mock features

## Quality

- [ ] All tests pass (871)
- [ ] Backend lint clean
- [ ] Backend typecheck clean
- [ ] Backend build passes
- [ ] Frontend lint clean
- [ ] Frontend build passes
- [ ] CI 4/4 green
- [ ] No console errors in browser
- [ ] No API errors in network tab

## Documentation

- [ ] Golden path documented
- [ ] Customer demo script exists
- [ ] Demo readiness checklist complete
- [ ] Demo labels on all mock features
- [ ] README updated with demo instructions
