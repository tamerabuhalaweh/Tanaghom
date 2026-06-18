# Demo Checklist

> **Version**: v0.1-stitch-foundation-demo

## Pre-Demo Verification

- [ ] CI pipeline green (4/4 jobs)
- [ ] Docker images build successfully
- [ ] Demo compose starts without errors
- [ ] Backend `/health` returns 200
- [ ] Frontend loads in browser
- [ ] No live integrations enabled
- [ ] M5 execution blocked (X-M5-Blocked header present)
- [ ] Mock providers active (Postiz, CRM, WhatsApp, Analytics, Rendering)
- [ ] Demo data loaded (users, campaigns, approvals)
- [ ] Stakeholder demo path verified

## Environment

- [ ] JWT_SECRET set (32+ chars, no defaults)
- [ ] DEMO_MODE=true
- [ ] All kill switches = false
- [ ] Database healthy
- [ ] Redis healthy

## Demo Flow Verification

- [ ] HumanUser authentication works
- [ ] AgentRep resolution works
- [ ] Campaign creation works
- [ ] AI draft generation (mock) works
- [ ] Reach score evaluation (mock) works
- [ ] SAIF decision creation works
- [ ] Approval workflow works
- [ ] Capability resolution works
- [ ] MCP mediation blocks direct access
- [ ] SPINE timeline shows runs
- [ ] Observability events recorded
- [ ] Publishing package created
- [ ] Manifest generated
- [ ] Mock Postiz preparation works
- [ ] M5 publishing blocked
- [ ] Analytics snapshot (mock) works
- [ ] Learning signal created
- [ ] DKS update proposal works
- [ ] CRM handoff (mock) works
- [ ] WhatsApp handoff (mock) blocked
- [ ] Production request created
- [ ] Rendering package prepared
- [ ] M5 rendering blocked
- [ ] Safety status page shows all gates
