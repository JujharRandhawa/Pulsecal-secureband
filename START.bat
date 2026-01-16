@echo off
REM ============================================================================
REM PulseCal SecureBand - One-Click Launcher
REM ============================================================================
REM This script starts all services for the PulseCal SecureBand application
REM ============================================================================

title PulseCal SecureBand - Starting Services...

echo.
echo ============================================================================
echo   PulseCal SecureBand - Production-Ready Monitoring Platform
echo ============================================================================
echo.
echo Starting all services...
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if pnpm is installed
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] pnpm not found. Installing pnpm...
    call npm install -g pnpm@8.15.0
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install pnpm
        pause
        exit /b 1
    )
)

REM Check if Python is installed (for AI services)
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Python not found. AI services may not work.
    echo Please install Python 3.11+ from https://www.python.org/
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call pnpm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if shared package is built
if not exist "packages\shared\dist" (
    echo [INFO] Building shared package...
    call pnpm --filter shared build
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to build shared package
        pause
        exit /b 1
    )
)

echo.
echo ============================================================================
echo   Service Ports:
echo ============================================================================
echo   Web Dashboard    : http://localhost:3000
echo   API Server       : http://localhost:3001
echo   AI Services      : http://localhost:8000
echo   PostgreSQL       : localhost:5432
echo   Redis            : localhost:6379
echo ============================================================================
echo.
echo Starting services in new windows...
echo.

REM Start Web (Next.js) in new window
start "PulseCal Web (Port 3000)" cmd /k "cd /d %~dp0 && pnpm --filter web dev"

REM Wait a bit before starting next service
timeout /t 3 /nobreak >nul

REM Start API (NestJS) in new window
start "PulseCal API (Port 3001)" cmd /k "cd /d %~dp0 && pnpm --filter api start:dev"

REM Wait a bit before starting next service
timeout /t 3 /nobreak >nul

REM Start AI Services (FastAPI) in new window
start "PulseCal AI Services (Port 8000)" cmd /k "cd /d %~dp0\packages\ai-services && python run.py"

echo.
echo ============================================================================
echo   Services Starting...
echo ============================================================================
echo.
echo Three windows have been opened:
echo   1. Web Dashboard (Next.js) - Port 3000
echo   2. API Server (NestJS) - Port 3001
echo   3. AI Services (FastAPI) - Port 8000
echo.
echo Please wait for services to start (30-60 seconds)
echo.
echo Once ready, open your browser to:
echo   http://localhost:3000
echo.
echo Press any key to open the dashboard in your browser...
pause >nul

REM Open browser after a delay
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo Dashboard opened in your browser!
echo.
echo To stop all services, close the three service windows.
echo.
pause
