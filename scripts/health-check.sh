#!/bin/bash

# PulseCal SecureBand - System Health Check Script
# Checks the health of all services and components

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Health check results
HEALTHY=0
UNHEALTHY=0

check_service() {
    local service_name="$1"
    local health_endpoint="${2:-}"
    
    if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" ps "$service_name" | grep -q "healthy\|Up"; then
        echo -e "${GREEN}✓${NC} $service_name: Healthy"
        HEALTHY=$((HEALTHY + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $service_name: Unhealthy"
        UNHEALTHY=$((UNHEALTHY + 1))
        return 1
    fi
}

check_endpoint() {
    local name="$1"
    local url="$2"
    
    if curl -sf "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name endpoint: Accessible"
        HEALTHY=$((HEALTHY + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $name endpoint: Not accessible"
        UNHEALTHY=$((UNHEALTHY + 1))
        return 1
    fi
}

check_database() {
    if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
        pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} PostgreSQL: Ready"
        HEALTHY=$((HEALTHY + 1))
        return 0
    else
        echo -e "${RED}✗${NC} PostgreSQL: Not ready"
        UNHEALTHY=$((UNHEALTHY + 1))
        return 1
    fi
}

check_redis() {
    if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T redis \
        redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis: Ready"
        HEALTHY=$((HEALTHY + 1))
        return 0
    else
        echo -e "${RED}✗${NC} Redis: Not ready"
        UNHEALTHY=$((UNHEALTHY + 1))
        return 1
    fi
}

check_disk_space() {
    local usage=$(df -h "$PROJECT_ROOT" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -lt 80 ]; then
        echo -e "${GREEN}✓${NC} Disk space: ${usage}% used"
        HEALTHY=$((HEALTHY + 1))
    elif [ "$usage" -lt 90 ]; then
        echo -e "${YELLOW}⚠${NC} Disk space: ${usage}% used (warning)"
        HEALTHY=$((HEALTHY + 1))
    else
        echo -e "${RED}✗${NC} Disk space: ${usage}% used (critical)"
        UNHEALTHY=$((UNHEALTHY + 1))
    fi
}

check_backups() {
    local backup_dir="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
    local recent_backup=$(find "$backup_dir" -name "*.sql.gz" -type f -mtime -1 2>/dev/null | head -1)
    
    if [ -n "$recent_backup" ]; then
        echo -e "${GREEN}✓${NC} Recent backup found: $(basename "$recent_backup")"
        HEALTHY=$((HEALTHY + 1))
    else
        echo -e "${YELLOW}⚠${NC} No recent backup found (last 24 hours)"
        HEALTHY=$((HEALTHY + 1))
    fi
}

# Main health check
main() {
    echo "PulseCal SecureBand - System Health Check"
    echo "=========================================="
    echo ""
    
    # Check Docker services
    echo "Docker Services:"
    check_service "postgres"
    check_service "redis"
    check_service "api"
    check_service "web"
    check_service "ai-services"
    echo ""
    
    # Check database connectivity
    echo "Database Connectivity:"
    check_database
    check_redis
    echo ""
    
    # Check HTTP endpoints
    echo "HTTP Endpoints:"
    check_endpoint "API Health" "http://localhost:3001/health"
    check_endpoint "Web Dashboard" "http://localhost:3000"
    check_endpoint "AI Services" "http://localhost:8000/api/v1/health"
    echo ""
    
    # Check system resources
    echo "System Resources:"
    check_disk_space
    check_backups
    echo ""
    
    # Summary
    echo "=========================================="
    echo "Health Check Summary:"
    echo "  Healthy: $HEALTHY"
    echo "  Unhealthy: $UNHEALTHY"
    echo ""
    
    if [ $UNHEALTHY -eq 0 ]; then
        echo -e "${GREEN}All systems operational${NC}"
        exit 0
    else
        echo -e "${RED}Some systems are unhealthy${NC}"
        exit 1
    fi
}

main "$@"
