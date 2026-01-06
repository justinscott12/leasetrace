#!/bin/bash

# Automated test runner for LegalTrace
# Runs the test suite and reports results

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "LegalTrace Automated Test Suite"
echo "================================"
echo ""

# Check if backend is running
echo "Checking backend status..."
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "❌ Backend is not running!"
    echo "   Start it with: docker compose up -d backend"
    echo "   Or: cd backend && uvicorn backend.api.main:app --reload"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Run tests
cd "$PROJECT_ROOT"
python3 -m backend.tests.automated_test_suite "$@"

