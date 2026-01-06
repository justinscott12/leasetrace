# LegalTrace Scripts

Utility scripts for managing LegalTrace services.

## Scripts

### `start-backend.sh`

Starts PostgreSQL and Redis containers, and optionally the backend container.

**Usage:**
```bash
# Start only database and Redis (for local backend development)
./scripts/start-backend.sh

# Start database, Redis, and backend container
./scripts/start-backend.sh --container
# or
./scripts/start-backend.sh -c
```

**What it does:**
1. Checks if Docker is running
2. Starts PostgreSQL and Redis containers
3. Waits for both services to be healthy
4. Optionally starts the backend container (with `--container` flag)
5. Displays service status

### `stop-backend.sh`

Stops LegalTrace services.

**Usage:**
```bash
# Stop all services
./scripts/stop-backend.sh

# Stop a specific service
./scripts/stop-backend.sh postgres
./scripts/stop-backend.sh redis
./scripts/stop-backend.sh backend
```

## Quick Start

1. **Start services:**
   ```bash
   ./scripts/start-backend.sh
   ```

2. **Start backend locally:**
   ```bash
   cd backend
   source venv/bin/activate  # or your virtual environment
   uvicorn backend.api.main:app --reload
   ```

3. **Or start backend in container:**
   ```bash
   ./scripts/start-backend.sh --container
   ```

4. **Stop services:**
   ```bash
   ./scripts/stop-backend.sh
   ```

## Notes

- The scripts use `docker compose` (Docker Compose V2) syntax
- Services are configured with health checks
- Database data persists in Docker volumes
- Backend container requires `.env` file in `backend/` directory

