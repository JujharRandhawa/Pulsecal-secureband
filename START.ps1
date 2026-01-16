# ============================================================================
# PulseCal SecureBand - One-Click Launcher (PowerShell)
# ============================================================================
# This script starts all services for the PulseCal SecureBand application
# ============================================================================

$ErrorActionPreference = "Stop"

# Set window title
$Host.UI.RawUI.WindowTitle = "PulseCal SecureBand - Starting Services..."

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Write-Header {
    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "  PulseCal SecureBand - Production-Ready Monitoring Platform" -ForegroundColor Cyan
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Command {
    param([string]$Command)
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
    return $connection
}

Write-Header

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
if (-not (Test-Command "node")) {
    Write-Host "[ERROR] Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
$nodeVersion = node --version
Write-Host "[OK] Node.js found: $nodeVersion" -ForegroundColor Green

# Check pnpm
if (-not (Test-Command "pnpm")) {
    Write-Host "[INFO] pnpm not found. Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm@8.15.0
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install pnpm" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}
$pnpmVersion = pnpm --version
Write-Host "[OK] pnpm found: v$pnpmVersion" -ForegroundColor Green

# Check Python (optional for AI services)
if (-not (Test-Command "python")) {
    Write-Host "[WARNING] Python not found. AI services may not work." -ForegroundColor Yellow
    Write-Host "Please install Python 3.11+ from https://www.python.org/" -ForegroundColor Yellow
} else {
    $pythonVersion = python --version
    Write-Host "[OK] Python found: $pythonVersion" -ForegroundColor Green
}

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing dependencies..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Check if shared package is built
if (-not (Test-Path "packages\shared\dist")) {
    Write-Host "[INFO] Building shared package..." -ForegroundColor Yellow
    pnpm --filter shared build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to build shared package" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Check for port conflicts
Write-Host ""
Write-Host "Checking for port conflicts..." -ForegroundColor Yellow
$ports = @(3000, 3001, 8000, 5432, 6379)
$portNames = @{
    3000 = "Web Dashboard"
    3001 = "API Server"
    8000 = "AI Services"
    5432 = "PostgreSQL"
    6379 = "Redis"
}

$conflicts = @()
foreach ($port in $ports) {
    if (Test-Port -Port $port) {
        $conflicts += "$($portNames[$port]) (Port $port)"
    }
}

if ($conflicts.Count -gt 0) {
    Write-Host "[WARNING] Port conflicts detected:" -ForegroundColor Yellow
    foreach ($conflict in $conflicts) {
        Write-Host "  - $conflict" -ForegroundColor Yellow
    }
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 0
    }
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  Service Ports:" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  Web Dashboard    : http://localhost:3000" -ForegroundColor White
Write-Host "  API Server       : http://localhost:3001" -ForegroundColor White
Write-Host "  AI Services      : http://localhost:8000" -ForegroundColor White
Write-Host "  PostgreSQL       : localhost:5432" -ForegroundColor White
Write-Host "  Redis            : localhost:6379" -ForegroundColor White
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Start services
Write-Host "Starting services..." -ForegroundColor Yellow
Write-Host ""

# Start Web (Next.js)
Write-Host "[1/3] Starting Web Dashboard (Port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir'; pnpm --filter web dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# Start API (NestJS)
Write-Host "[2/3] Starting API Server (Port 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir'; pnpm --filter api start:dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# Start AI Services (FastAPI)
Write-Host "[3/3] Starting AI Services (Port 8000)..." -ForegroundColor Cyan
if (Test-Command "python") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\packages\ai-services'; python run.py" -WindowStyle Normal
} else {
    Write-Host "[WARNING] Python not found. Skipping AI Services." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "  Services Starting..." -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Three windows have been opened:" -ForegroundColor White
Write-Host "  1. Web Dashboard (Next.js) - Port 3000" -ForegroundColor White
Write-Host "  2. API Server (NestJS) - Port 3001" -ForegroundColor White
Write-Host "  3. AI Services (FastAPI) - Port 8000" -ForegroundColor White
Write-Host ""
Write-Host "Please wait for services to start (30-60 seconds)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Once ready, open your browser to:" -ForegroundColor White
Write-Host "  http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

# Wait and open browser
$openBrowser = Read-Host "Open dashboard in browser now? (Y/n)"
if ($openBrowser -ne "n" -and $openBrowser -ne "N") {
    Write-Host ""
    Write-Host "Waiting 10 seconds for services to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Start-Process "http://localhost:3000"
    Write-Host ""
    Write-Host "Dashboard opened in your browser!" -ForegroundColor Green
}

Write-Host ""
Write-Host "To stop all services, close the service windows." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
