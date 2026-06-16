# Sprint 5 — AgentRep Identity & Session Context Lock

> **Sprint**: 5
> **Status**: Complete
> **Date**: 2026-06-16
> **Goal**: Implement the STITCH identity-delegation foundation so every important action can be traced from HumanUser → AgentRep → functional/governance action.

## Scope

Identity model implementation with AgentRep, FunctionalAgent, GovernanceAgent, and Session Context Lock. No business workflow changes.

## Deliverables

### Prisma Schema Updates

| Model | Purpose |
|---|---|
| `AgentRep` | Canonical delegated identity for each HumanUser |
| `FunctionalAgent` | Specialized agents for specific capabilities |
| `GovernanceAgent` | Policy enforcement agents with veto authority |

### New Enums

| Enum | Values |
|---|---|
| `AgentType` | functional, governance |
| `AgentStatus` | active, inactive, suspended |

### Module Updates

| Module | Changes |
|---|---|
| `users-departments` | Added AgentRep types, repository, service with Session Context Lock |
| `auth` | Updated JWT payload with agentRepId, session context resolution |
| `shared/auth` | Added SessionContext type, resolveSessionContext function |

### Key Functions

| Function | Purpose |
|---|---|
| `getAgentRepByUserId()` | Retrieve AgentRep for a HumanUser |
| `createAgentRep()` | Create new AgentRep |
| `resolveSessionContext()` | Resolve full session context from JWT |
| `validateSessionContextLock()` | Enforce Session Context Lock rules |
| `validateAgentRepOwnership()` | Verify AgentRep belongs to authenticated user |

### Session Context Lock Rules

1. **HumanUser can only invoke their assigned AgentRep** — enforced by validateSessionContextLock
2. **User cannot command another user's AgentRep** — enforced by cross-user validation
3. **User Rep Agents cannot command another human's Rep Agent** — enforced by AgentRep ownership check
4. **FunctionalAgent cannot act as HumanUser** — enforced by agent type validation
5. **GovernanceAgent cannot bypass HumanUser authority** — enforced by human approval check

### Seed Updates

- AgentRep records created for all sample users
- FunctionalAgents assigned to non-CCO users (Content_Strategy_Agent, Algorithm_Intelligence_Agent, Analytics_KPI_Agent, Graphic_Design_Agent)
- GovernanceAgents assigned to CCO user (CCO_Governance_Agent, Compliance_Governance_Agent, Approval_Governance_Agent)

### Tests Added

| Test File | Tests |
|---|---|
| `agentrep-session-lock.test.ts` | 29 tests covering Session Context Lock, AgentRep permissions, identity lineage |

## Test Results

```
Test Files: 23 passed (23)
Tests:      304 passed (304)
Duration:   2.32s
```

- Existing tests: 275 pass
- New tests: 29 pass
- All existing modules unaffected

## Verification

- [x] Lint: clean
- [x] Typecheck: clean
- [x] Tests: 304/304 pass
- [x] Build: clean
- [ ] CI: pending

## Not Included (Explicitly Out of Scope)

- Approval workflow
- SAIF decision execution
- Publishing
- Analytics pulls
- Learning engine
- CRM/WhatsApp
- Paperclip integration
- ResourceSpace integration
- Real MCP servers
- Real external APIs
- Any M5 write-enabled runtime

## STITCH Identity Model Summary

```
HumanUser (User table)
    ↓ (1:1)
AgentRep (agent_reps table)
    ├── FunctionalAgent (functional_agents table)
    │   ├── Content_Strategy_Agent
    │   ├── Algorithm_Intelligence_Agent
    │   ├── Analytics_KPI_Agent
    │   └── Graphic_Design_Agent
    └── GovernanceAgent (governance_agents table)
        ├── CCO_Governance_Agent
        ├── Compliance_Governance_Agent
        └── Approval_Governance_Agent
```

## Session Context Lock

```
JWT Payload
    ↓
resolveSessionContext()
    ↓
SessionContext {
    humanUserId: string
    agentRepId: string
    agentType: AgentType
    actingAgentId: string | null
    role: Role
    departmentId: string | null
}
    ↓
validateSessionContextLock()
    ↓
Enforces:
- HumanUser can only invoke their assigned AgentRep
- Cannot act on behalf of another user
- AgentRep ownership validation
```

## Revision History

| Date | Change | Author |
|---|---|---|
| 2026-06-16 | Sprint complete | Sprint 5 |
