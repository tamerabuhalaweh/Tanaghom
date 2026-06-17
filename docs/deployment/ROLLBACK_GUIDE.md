# Rollback Guide

> **Version**: v0.1-stitch-foundation-demo

## Quick Rollback

```bash
# Stop demo stack
docker compose -f docker-compose.demo.yml down

# Remove volumes (reset data)
docker compose -f docker-compose.demo.yml down -v

# Checkout previous version
git checkout <previous-tag>

# Rebuild and restart
docker compose -f docker-compose.demo.yml up -d --build
```

## Database Rollback

```bash
# Connect to PostgreSQL
docker exec -it <postgres-container> psql -U tanaghum -d tanaghum

# Or reset database
docker compose -f docker-compose.demo.yml down -v
docker compose -f docker-compose.demo.yml up -d
```

## Full Reset

```bash
# Stop everything
docker compose -f docker-compose.demo.yml down -v

# Clean Docker
docker system prune -f

# Restart fresh
docker compose -f docker-compose.demo.yml up -d --build
```
