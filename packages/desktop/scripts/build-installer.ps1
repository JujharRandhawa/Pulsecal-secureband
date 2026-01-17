# Build installer script for PulseCal SecureBand Desktop App
# This script builds all dependencies and creates a Windows installer

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PulseCal SecureBand - Desktop App Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Get root directory
$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$desktopDir = Join-Path $rootDir "packages\desktop"

Write-Host "[1/6] Building shared package..." -ForegroundColor Yellow
Set-Location (Join-Path $rootDir "packages\shared")
pnpm build
if ($LASTEXITCODE -ne 0) { throw "Shared package build failed" }

Write-Host "[2/6] Building API package..." -ForegroundColor Yellow
Set-Location (Join-Path $rootDir "packages\api")
pnpm build
if ($LASTEXITCODE -ne 0) { throw "API package build failed" }

Write-Host "[3/6] Building web package (standard build)..." -ForegroundColor Yellow
Set-Location (Join-Path $rootDir "packages\web")
# Use standard build (not standalone) to avoid symlink issues
$env:ELECTRON_BUILD = "false"
pnpm build
if ($LASTEXITCODE -ne 0) { throw "Web package build failed" }

Write-Host "[4/6] Building desktop package..." -ForegroundColor Yellow
Set-Location $desktopDir
pnpm build
if ($LASTEXITCODE -ne 0) { throw "Desktop package build failed" }

Write-Host "[5/6] Generating application icons..." -ForegroundColor Yellow
pnpm generate:icons
if ($LASTEXITCODE -ne 0) { Write-Warning "Icon generation failed (icons may already exist)" }

Write-Host "[6/6] Creating Windows installer..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Gray
pnpm package:win
if ($LASTEXITCODE -ne 0) { throw "Installer creation failed" }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installer location:" -ForegroundColor Cyan
$installerPath = Get-ChildItem -Path (Join-Path $desktopDir "out") -Filter "*.exe" | Select-Object -First 1
if ($installerPath) {
    Write-Host "  $($installerPath.FullName)" -ForegroundColor White
    Write-Host ""
    Write-Host "Installer size: $([math]::Round($installerPath.Length / 1MB, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "  Installer not found in out/ directory" -ForegroundColor Red
}
Write-Host ""
