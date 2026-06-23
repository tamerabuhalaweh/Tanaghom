# MCP Server Configuration for Development

> **Version**: 1.0
> **Date**: 2026-06-23

## Purpose

Document MCP server recommendations for AI-assisted development on the Tanaghum platform.

**Important**: These are development tooling MCP servers for the AI agent — NOT the same as Tanaghum MCP Engine connectors (which are for runtime integration).

## Recommended MCP Servers

### Must-Have (Immediate)

| Server | Purpose | Status |
|---|---|---|
| **shadcn/ui MCP** | Premium dashboard UI components | ✅ Integrated (local components) |
| **Playwright MCP** | Browser automation, E2E testing | ⏳ Configure at platform level |
| **Context7 MCP** | Context management for large codebases | ⏳ Configure at platform level |

### Very Useful (Next)

| Server | Purpose | Status |
|---|---|---|
| **Storybook MCP** | Component development & documentation | ⏳ Future |
| **Figma MCP** | Design-to-code integration | ⏳ Future |
| **Chrome DevTools MCP** | Runtime debugging & performance | ⏳ Future |

## shadcn/ui Integration

shadcn/ui components are now available locally:

```
frontend/src/components/ui/
├── button.tsx      — Button with variants
├── card.tsx        — Card, CardHeader, CardTitle, CardContent
├── badge.tsx       — Badge with variants
├── index.ts        — Re-exports
└── utils.ts        — cn() utility
```

### Usage

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <Button variant="default">Action</Button>
    <Badge variant="success">Status</Badge>
  </CardContent>
</Card>
```

### Available Variants

**Button**: default, destructive, outline, secondary, ghost, link
**Badge**: default, secondary, destructive, outline, success, warning, info, mock

## Platform-Level MCP Configuration

MCP servers like Playwright, Context7, Storybook, Figma, and Chrome DevTools must be configured at the MiMo Code platform level, not in the project repo.

Contact your platform administrator to add these MCP servers to your development environment.

## Tanaghum MCP Engine (Runtime)

For runtime MCP connectors (Postiz, GoHighLevel, etc.), see:
- `docs/demo/POSTIZ_SANDBOX_READINESS.md`
- `docs/demo/OPENCLAW_READINESS.md`
- `frontend/src/modules/mcp-engine/registry-data.ts`
