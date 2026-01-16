# PulseCal SecureBand - System Health Check Script (PowerShell)
# Checks the health of all services and components

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Health check results
$script:Healthy = 0
$script:Unhealthy = 0

function Test-Service {
    param(
        [string]$ServiceName,
        [string]$HealthEndpoint = ""
    )
    
    $status = docker-compose -f "$ProjectRoot\docker-compose.prod.yml" ps $ServiceName 2>&1
    if ($status -match "healthy|Up") {
        Write-Host "✓ $ServiceName`: Healthy" -ForegroundColor Green
        $script:Healthy++
        return $true
    }
    else {
        Write-Host "✗ $ServiceName`: Unhealthy" -ForegroundColor Red
        $script:Unhealthy++
        return $false
    }
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ $Name endpoint: Accessible" -ForegroundColor Green
            $script:Healthy++
            return $true
        }
    }
    catch {
        Write-Host "✗ $Name endpoint: Not accessible" -ForegroundColor Red
        $script:Unhealthy++
        return $false
    }
}

function Test-Database {
    $result = docker-compose -f "$ProjectRoot\docker-compose.prod.yml" exec -T postgres pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PostgreSQL: Ready" -ForegroundColor Green
        $script:Healthy++
        return $true
    }
    else {
        Write-Host "✗ PostgreSQL: Not ready" -ForegroundColor Red
        $script:Unhealthy++
        return $false
    }
}

function Test-Redis {
    $result = docker-compose -f "$ProjectRoot\docker-compose.prod.yml" exec -T redis redis-cli ping 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Redis: Ready" -ForegroundColor Green
        $script:Healthy++
        return $true
    }
    else {
        Write-Host "✗ Redis: Not ready" -ForegroundColor Red
        $script:Unhealthy++
        return $false
    }
}

function Test-DiskSpace {
    $drive = (Get-PSDrive C)
    $usage = [math]::Round((($drive.Used / $drive.Free) * 100), 2)
    
    if ($usage -lt 80) {
        Write-Host "✓ Disk space: $usage% used" -ForegroundColor Green
        $script:Healthy++
    }
    elseif ($usage -lt 90) {
        Write-Host "⚠ Disk space: $usage% used (warning)" -ForegroundColor Yellow
        $script:Healthy++
    }
    else {
        Write-Host "✗ Disk space: $usage% used (critical)" -ForegroundColor Red
        $script:Unhealthy++
    }
}

function Test-Backups {
    $backupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $ProjectRoot "backups" }
    $recentBackup = Get-ChildItem $backupDir -Filter "*.sql.gz" -ErrorAction SilentlyContinue | 
        Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-1) } | 
        Select-Object -First 1
    
    if ($recentBackup) {
        Write-Host "✓ Recent backup found: $($recentBackup.Name)" -ForegroundColor Green
        $script:Healthy++
    }
    else {
        Write-Host "⚠ No recent backup found (last 24 hours)" -ForegroundColor Yellow
        $script:Healthy++
    }
}

# Main health check
function Main {
    Write-Host "PulseCal SecureBand - System Health Check" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check Docker services
    Write-Host "Docker Services:" -ForegroundColor Yellow
    Test-Service "postgres"
    Test-Service "redis"
    Test-Service "api"
    Test-Service "web"
    Test-Service "ai-services"
    Write-Host ""
    
    # Check database connectivity
    Write-Host "Database Connectivity:" -ForegroundColor Yellow
    Test-Database
    Test-Redis
    Write-Host ""
    
    # Check HTTP endpoints
    Write-Host "HTTP Endpoints:" -ForegroundColor Yellow
    Test-Endpoint "API Health" "http://localhost:3001/health"
    Test-Endpoint "Web Dashboard" "http://localhost:3000"
    Test-Endpoint "AI Services" "http://localhost:8000/api/v1/health"
    Write-Host ""
    
    # Check system resources
    Write-Host "System Resources:" -ForegroundColor Yellow
    Test-DiskSpace
    Test-Backups
    Write-Host ""
    
    # Summary
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Health Check Summary:" -ForegroundColor Cyan
    Write-Host "  Healthy: $script:Healthy" -ForegroundColor Green
    Write-Host "  Unhealthy: $script:Unhealthy" -ForegroundColor $(if ($script:Unhealthy -gt 0) { "Red" } else { "Green" })
    Write-Host ""
    
    if ($script:Unhealthy -eq 0) {
        Write-Host "All systems operational" -ForegroundColor Green
        exit 0
    }
    else {
        Write-Host "Some systems are unhealthy" -ForegroundColor Red
        exit 1
    }
}

Main
