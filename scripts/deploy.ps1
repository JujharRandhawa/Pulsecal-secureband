# PulseCal SecureBand - Production Deployment Script (PowerShell)
# This script sets up and deploys the system for on-premise jail deployment on Windows

param(
    [switch]$SkipBuild,
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Logging functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    $missing = @()
    
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $missing += "Docker"
    }
    
    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        $missing += "Docker Compose"
    }
    
    if ($missing.Count -gt 0) {
        Write-Error "Missing prerequisites: $($missing -join ', ')"
        Write-Error "Please install missing prerequisites"
        exit 1
    }
    
    Write-Info "Prerequisites check passed"
}

# Validate environment file
function Test-Environment {
    Write-Info "Validating environment configuration..."
    
    $envFile = Join-Path $ProjectRoot ".env"
    
    if (-not (Test-Path $envFile)) {
        Write-Error ".env file not found"
        $exampleFile = Join-Path $ProjectRoot ".env.example"
        if (Test-Path $exampleFile) {
            Copy-Item $exampleFile $envFile
            Write-Warn "Copied .env.example to .env"
        }
        Write-Warn "Please edit .env file with your configuration before continuing"
        exit 1
    }
    
    # Load environment variables
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
    
    # Check required variables
    if (-not $env:DB_PASSWORD -or $env:DB_PASSWORD -eq "CHANGE_ME_SECURE_PASSWORD") {
        Write-Error "DB_PASSWORD must be set in .env file"
        exit 1
    }
    
    if (-not $env:SESSION_SECRET -or $env:SESSION_SECRET -eq "CHANGE_ME_GENERATE_SECURE_SECRET") {
        Write-Error "SESSION_SECRET must be set in .env file"
        Write-Info "Generate one with: openssl rand -base64 32"
        exit 1
    }
    
    Write-Info "Environment configuration validated"
}

# Create necessary directories
function New-Directories {
    Write-Info "Creating necessary directories..."
    
    $directories = @(
        "backups",
        "logs",
        "database\init"
    )
    
    foreach ($dir in $directories) {
        $fullPath = Join-Path $ProjectRoot $dir
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        }
    }
    
    Write-Info "Directories created"
}

# Build Docker images
function Build-Images {
    if ($SkipBuild) {
        Write-Info "Skipping image build"
        return
    }
    
    Write-Info "Building Docker images..."
    
    Push-Location $ProjectRoot
    try {
        docker-compose -f docker-compose.prod.yml build --no-cache
        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed"
        }
    }
    finally {
        Pop-Location
    }
    
    Write-Info "Docker images built successfully"
}

# Start services
function Start-Services {
    Write-Info "Starting services..."
    
    Push-Location $ProjectRoot
    try {
        docker-compose -f docker-compose.prod.yml up -d
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to start services"
        }
        
        Write-Info "Waiting for services to be healthy..."
        Start-Sleep -Seconds 10
        
        # Wait for health checks
        $maxAttempts = 30
        $attempt = 0
        
        while ($attempt -lt $maxAttempts) {
            $status = docker-compose -f docker-compose.prod.yml ps
            if ($status -match "healthy") {
                Write-Info "Services are healthy"
                break
            }
            $attempt++
            Start-Sleep -Seconds 2
        }
        
        if ($attempt -eq $maxAttempts) {
            Write-Warn "Some services may not be healthy. Check logs with: docker-compose -f docker-compose.prod.yml logs"
        }
    }
    finally {
        Pop-Location
    }
}

# Run database migrations
function Invoke-Migrations {
    Write-Info "Running database migrations..."
    
    # Wait for database to be ready
    $maxAttempts = 30
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        $result = docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) {
            break
        }
        $attempt++
        Start-Sleep -Seconds 2
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Error "Database is not ready"
        exit 1
    }
    
    # Run initialization scripts if they exist
    $initDir = Join-Path $ProjectRoot "database\init"
    if (Test-Path $initDir) {
        $initFiles = Get-ChildItem $initDir -Filter "*.sql"
        if ($initFiles.Count -gt 0) {
            Write-Info "Running database initialization scripts..."
            foreach ($file in $initFiles) {
                Get-Content $file.FullName | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d pulsecal
            }
        }
    }
    
    Write-Info "Database migrations completed"
}

# Display deployment information
function Show-Info {
    Write-Info "Deployment completed successfully!"
    Write-Host ""
    Write-Host "Services are running:"
    docker-compose -f docker-compose.prod.yml ps
    Write-Host ""
    $webPort = if ($env:WEB_PORT) { $env:WEB_PORT } else { "3000" }
    Write-Host "Access the dashboard at: http://localhost:$webPort"
    Write-Host ""
    Write-Host "Useful commands:"
    Write-Host "  View logs: docker-compose -f docker-compose.prod.yml logs -f"
    Write-Host "  Stop services: docker-compose -f docker-compose.prod.yml down"
    Write-Host "  Restart services: docker-compose -f docker-compose.prod.yml restart"
    Write-Host "  Backup database: .\scripts\backup.ps1"
}

# Main deployment flow
function Main {
    Write-Info "Starting PulseCal SecureBand deployment..."
    
    Test-Prerequisites
    
    if (-not $SkipValidation) {
        Test-Environment
    }
    
    New-Directories
    Build-Images
    Start-Services
    Invoke-Migrations
    Show-Info
    
    Write-Info "Deployment complete!"
}

# Run main function
Main
