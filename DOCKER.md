# Docker Development Setup

This document explains how to run Bifrost with PostgreSQL using Docker Compose.

## Quick Start

1. **Start the services:**
   ```bash
   docker-compose up -d
   ```

2. **Verify the services:**
   ```bash
   docker-compose ps
   ```

3. **Access the services:**
   - Bifrost API: http://localhost:8080
   - PostgreSQL: localhost:5432

4. **Stop the services:**
   ```bash
   docker-compose down
   ```

## Services

### PostgreSQL
- **Image**: `postgres:16-alpine`
- **Database**: `bifrost`
- **User**: `bifrost`
- **Password**: `bifrost123`
- **Port**: `5432`
- **Health Check**: Automatically verifies database readiness

### Bifrost Server
- **Image**: Built locally from `Dockerfile`
- **Database Driver**: PostgreSQL
- **Port**: `8080`
- **Depends On**: PostgreSQL health check

## Configuration

### Environment Variables

The setup uses these environment variables (defined in `docker-compose.yml`):

```yaml
environment:
  BIFROST_DB_DRIVER: postgres
  BIFROST_DB_PATH: postgres://bifrost:bifrost123@postgres:5432/bifrost?sslmode=disable
  BIFROST_PORT: 8080
```

### Custom Configuration

Create a `.env` file to override defaults:

```bash
cp .env.example .env
# Edit .env with your custom values
```

Available configuration options:
- `POSTGRES_DB`: Database name (default: `bifrost`)
- `POSTGRES_USER`: Database user (default: `bifrost`)
- `POSTGRES_PASSWORD`: Database password (default: `bifrost123`)
- `BIFROST_DB_DRIVER`: Database driver (`postgres` or `sqlite`)
- `BIFROST_DB_PATH`: Database connection string
- `BIFROST_PORT`: Server port (default: `8080`)

## Development Workflow

### Building Images

```bash
# Build the Bifrost image
docker-compose build

# Or build without cache
docker-compose build --no-cache
```

### Viewing Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs bifrost
docker-compose logs postgres

# Follow logs in real-time
docker-compose logs -f bifrost
```

### Executing Commands

```bash
# Access the Bifrost CLI
docker exec bifrost-server bf list

# Access PostgreSQL
docker exec bifrost-postgres psql -U bifrost -d bifrost

# Access shell in containers
docker exec -it bifrost-server sh
docker exec -it bifrost-postgres sh
```

### Database Management

```bash
# Connect to PostgreSQL
docker exec bifrost-postgres psql -U bifrost -d bifrost

# View tables
docker exec bifrost-postgres psql -U bifrost -d bifrost -c "\dt"

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in `docker-compose.yml` if 8080 or 5432 are in use
2. **Connection refused**: Wait for PostgreSQL to fully start (health check handles this)
3. **Permission issues**: Ensure Docker has proper permissions

### Health Checks

The setup includes health checks:
- PostgreSQL: Uses `pg_isready` command
- Bifrost: Depends on PostgreSQL being healthy

Check health status:
```bash
docker-compose ps
```

### Reset Everything

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove images (optional)
docker-compose down --rmi all
```

## Production Considerations

For production deployments:

1. **Security**: Change default passwords
2. **Persistence: Ensure volumes are properly backed up
3. **Networking**: Consider using custom networks
4. **Resources**: Set memory and CPU limits
5. **Monitoring**: Add health checks and monitoring

Example production environment variables:
```bash
POSTGRES_PASSWORD=your-secure-password
ADMIN_JWT_SIGNING_KEY=your-jwt-signing-key
BIFROST_CATCHUP_INTERVAL=1s
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Bifrost       │    │   PostgreSQL    │
│   (Port 8080)   │◄──►│   (Port 5432)   │
└─────────────────┘    └─────────────────┘
```

- Bifrost container connects to PostgreSQL via Docker network
- Data persists in Docker volumes
- Health checks ensure proper startup sequence