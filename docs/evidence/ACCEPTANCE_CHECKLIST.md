# Demo Acceptance Checklist

> **Date**: [DATE]
> **Operator**: [NAME]
> **Demo Date**: [DATE]

## Pre-Demo

- [ ] CI 4/4 green
- [ ] Smoke test passes
- [ ] Demo data loaded
- [ ] Stakeholder walkthrough reviewed
- [ ] Demo checklist completed

## Environment

- [ ] JWT_SECRET set (32+ chars)
- [ ] DEMO_MODE=true
- [ ] All kill switches = false
- [ ] Database healthy
- [ ] Redis healthy

## Safety

- [ ] No real Postiz enabled
- [ ] No real CRM enabled
- [ ] No real WhatsApp enabled
- [ ] No real analytics enabled
- [ ] No real rendering enabled
- [ ] M5 write execution blocked
- [ ] Demo mode active

## Demo Flow

- [ ] Login works
- [ ] Campaign creation works
- [ ] AI draft works (mock)
- [ ] Approval workflow works
- [ ] Safety status page shows all gates

## Post-Demo

- [ ] Feedback collected
- [ ] Issues documented
- [ ] Next phase discussed

## Sign-Off

| Role | Name | Signature | Date |
|---|---|---|---|
| Product Owner | | | |
| CCO | | | |
| Security Lead | | | |
| Engineering Lead | | | |
