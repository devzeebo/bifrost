# Docker Development Setup

This document provides a quick reference for Docker commands with Bifrost.

## Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View status
docker-compose ps

# View logs
docker-compose logs -f

# Rebuild
docker-compose build

# Access CLI
docker exec bifrost-server bf list

# Access database
docker exec bifrost-postgres psql -U bifrost -d bifrost

# Reset everything
docker-compose down -v
```

## Services

- **Bifrost API**: http://localhost:8080
- **PostgreSQL**: localhost:5432 (user: bifrost, pass: bifrost123)

## Environment

Copy `.env.example` to `.env` and customize as needed.