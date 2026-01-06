#!/bin/bash

# LegalTrace - Start Database and Backend Script
# This script starts PostgreSQL, Redis, and optionally the backend container

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

echo -e "${GREEN}Starting LegalTrace Backend Services...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Start database and Redis services
echo -e "${YELLOW}Starting PostgreSQL and Redis containers...${NC}"
docker compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker compose exec -T postgres pg_isready -U legaltrace_user -d legaltrace_db > /dev/null 2>&1; then
        echo -e "${GREEN}PostgreSQL is ready!${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "\n${RED}Error: PostgreSQL failed to start within $max_attempts seconds${NC}"
    exit 1
fi

# Wait for Redis to be ready
echo -e "${YELLOW}Waiting for Redis to be ready...${NC}"
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}Redis is ready!${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "\n${RED}Error: Redis failed to start within $max_attempts seconds${NC}"
    exit 1
fi

# Check if backend should run in container or locally
if [ "$1" == "--container" ] || [ "$1" == "-c" ]; then
    echo -e "${YELLOW}Building and starting backend container...${NC}"
    docker compose build backend
    docker compose up -d backend
    
    # Wait for backend to be ready
    echo -e "${YELLOW}Waiting for backend to be ready...${NC}"
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}Backend is ready!${NC}"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    if [ $attempt -lt $max_attempts ]; then
        echo -e "\n${GREEN}Backend container started!${NC}"
        echo -e "${GREEN}Backend API available at: http://localhost:8000${NC}"
        echo -e "${GREEN}API docs available at: http://localhost:8000/docs${NC}"
    else
        echo -e "\n${YELLOW}Backend container started but health check timed out.${NC}"
        echo -e "${YELLOW}Check logs with: docker compose logs backend${NC}"
    fi
else
    echo -e "${GREEN}Database and Redis are ready!${NC}"
    echo -e "${YELLOW}To start the backend locally, run:${NC}"
    echo -e "  cd backend && uvicorn backend.api.main:app --reload"
    echo ""
    echo -e "${YELLOW}Or start the backend container with:${NC}"
    echo -e "  ./scripts/start-backend.sh --container"
fi

echo ""
echo -e "${GREEN}Services Status:${NC}"
docker compose ps

