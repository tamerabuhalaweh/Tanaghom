# Demo Deployment Guide

> **Version**: v0.1-stitch-foundation-demo
> **Date**: 2026-06-17

## Overview

This guide explains how to deploy the Tanaghum platform for a controlled stakeholder demo. The platform runs in demo-safe mode with all live integrations disabled and M5 execution blocked.

## Prerequisites

- Docker and Docker Compose installed
- Git installed
- 4GB+ RAM available for Docker
- Ports 3000, 4000, 5432, 6379 available

## Quick Start

```bash
# Clone the repository
git clone https://github.com/tamerabuhalaweh/Tanaghom.git
cd Tanaghum

# Set a strong JWT_SECRET (required)
export JWT_SECRET="your-strong-secret-at-least-32-characters-long"

# Start the demo stack
docker compose -f docker-compose.demo.yml up -d

# Wait for services to start (approximately 30 seconds)
sleep 30

# Verify backend health
curl http://localhost:4000/health

# Access frontend
open http://localhost:3000
```

## Required Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Strong secret (32+ chars). Must not use default/weak values. |
| `DATABASE_URL` | Auto | PostgreSQL connection (set in compose) |
| `REDIS_URL` | Auto | Redis connection (set in compose) |
| `DEMO_MODE` | Auto | Set to `true` (blocks all live integrations) |
| `NODE_ENV` | Auto | Set to `demo` |

## Demo-Safe Kill Switches

All live integrations are disabled by default:

| Switch | Default | Effect |
|---|---|---|
| `EXTERNAL_EXECUTION_ENABLED` | `false` | Blocks all external calls |
| `M5_WRITE_EXECUTION_ENABLED` | `false` | Blocks M5 write operations |
| `POSTIZ_LIVE_ENABLED` | `false` | Blocks real Postiz publishing |
| `CRM_LIVE_ENABLED` | `false` | Blocks real CRM operations |
| `WHATSAPP_LIVE_ENABLED` | `false` | Blocks real WhatsApp messages |
| `RENDERING_LIVE_ENABLED` | `false` | Blocks real rendering |
| `RESOURCESPACE_LIVE_ENABLED` | `false` | Blocks real ResourceSpace |
| `PAPERCLIP_SYNC_ENABLED` | `false` | Blocks real Paperclip sync |
| `ANALYTICS_LIVE_ENABLED` | `false` | Blocks real analytics pulls |

**Enabling any of these in demo mode will cause startup failure.**

## Stopping the Demo

```bash
# Stop all services
docker compose -f docker-compose.demo.yml down

# Stop and remove volumes (reset data)
docker compose -f docker-compose.demo.yml down -v
```

## Troubleshooting

| Issue | Solution |
|---|---|
| JWT_SECRET error | Set a strong 32+ character secret |
| Port already in use | Stop other services or change ports |
| Database connection failed | Wait for PostgreSQL health check |
| Frontend not loading | Check if port 3000 is available |
