#!/bin/bash

# LegalTrace - Stop Backend Services Script

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

echo -e "${YELLOW}Stopping LegalTrace Backend Services...${NC}"

# Stop all services or specific service
if [ -n "$1" ]; then
    docker compose stop "$1"
    echo -e "${GREEN}Stopped $1${NC}"
else
    docker compose stop
    echo -e "${GREEN}All services stopped!${NC}"
fi

echo ""
echo -e "${GREEN}Services Status:${NC}"
docker compose ps

