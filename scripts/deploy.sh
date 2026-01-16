#!/bin/bash

# PulseCal SecureBand - Production Deployment Script
# This script sets up and deploys the system for on-premise jail deployment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing=0
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        missing=1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        missing=1
    fi
    
    if [ $missing -eq 1 ]; then
        log_error "Please install missing prerequisites"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Validate environment file
validate_env() {
    log_info "Validating environment configuration..."
    
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_error ".env file not found"
        log_info "Copying .env.example to .env..."
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        log_warn "Please edit .env file with your configuration before continuing"
        exit 1
    fi
    
    # Check for required variables
    source "$PROJECT_ROOT/.env"
    
    if [ -z "${DB_PASSWORD:-}" ] || [ "$DB_PASSWORD" = "CHANGE_ME_SECURE_PASSWORD" ]; then
        log_error "DB_PASSWORD must be set in .env file"
        exit 1
    fi
    
    if [ -z "${SESSION_SECRET:-}" ] || [ "$SESSION_SECRET" = "CHANGE_ME_GENERATE_SECURE_SECRET" ]; then
        log_error "SESSION_SECRET must be set in .env file"
        log_info "Generate one with: openssl rand -base64 32"
        exit 1
    fi
    
    log_info "Environment configuration validated"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p "$PROJECT_ROOT/backups"
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/database/init"
    
    log_info "Directories created"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    log_info "Docker images built successfully"
}

# Start services
start_services() {
    log_info "Starting services..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.prod.yml up -d
    
    log_info "Waiting for services to be healthy..."
    sleep 10
    
    # Wait for health checks
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
            log_info "Services are healthy"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warn "Some services may not be healthy. Check logs with: docker-compose -f docker-compose.prod.yml logs"
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres &> /dev/null; then
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Database is not ready"
        exit 1
    fi
    
    # Run initialization scripts if they exist
    if [ -d "$PROJECT_ROOT/database/init" ] && [ "$(ls -A $PROJECT_ROOT/database/init)" ]; then
        log_info "Running database initialization scripts..."
        docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d pulsecal -f /docker-entrypoint-initdb.d/init.sql || true
    fi
    
    log_info "Database migrations completed"
}

# Display deployment information
show_info() {
    log_info "Deployment completed successfully!"
    echo ""
    echo "Services are running:"
    docker-compose -f docker-compose.prod.yml ps
    echo ""
    echo "Access the dashboard at: http://localhost:${WEB_PORT:-3000}"
    echo ""
    echo "Useful commands:"
    echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  Stop services: docker-compose -f docker-compose.prod.yml down"
    echo "  Restart services: docker-compose -f docker-compose.prod.yml restart"
    echo "  Backup database: $PROJECT_ROOT/scripts/backup.sh"
}

# Main deployment flow
main() {
    log_info "Starting PulseCal SecureBand deployment..."
    
    check_prerequisites
    validate_env
    create_directories
    build_images
    start_services
    run_migrations
    show_info
    
    log_info "Deployment complete!"
}

# Run main function
main "$@"
