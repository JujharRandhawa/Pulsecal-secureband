# PulseCal SecureBand - Restore Script (PowerShell)
# Restores database and Redis from backups

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("database", "redis")]
    [string]$Type = "database"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Load environment variables
$envFile = Join-Path $ProjectRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

function Confirm-Restore {
    Write-Host "[WARN] WARNING: This will overwrite existing data!" -ForegroundColor Yellow
    $confirm = Read-Host "Are you sure you want to continue? (yes/no)"
    
    if ($confirm -ne "yes") {
        Write-Host "[INFO] Restore cancelled" -ForegroundColor Green
        exit 0
    }
}

function Restore-Database {
    param([string]$BackupFile)
    
    if (-not (Test-Path $BackupFile)) {
        Write-Host "[ERROR] Backup file not found: $BackupFile" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[INFO] Restoring PostgreSQL database from $BackupFile..." -ForegroundColor Green
    Write-Host "[WARN] This will drop and recreate the database!" -ForegroundColor Yellow
    
    Confirm-Restore
    
    # Stop API to prevent connections
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" stop api
    
    $dbUser = if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "postgres" }
    $dbName = if ($env:DB_DATABASE) { $env:DB_DATABASE } else { "pulsecal" }
    
    # Drop and recreate database
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" exec -T postgres `
        psql -U $dbUser -c "DROP DATABASE IF EXISTS $dbName;"
    
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" exec -T postgres `
        psql -U $dbUser -c "CREATE DATABASE $dbName;"
    
    # Restore from backup
    if ($BackupFile -match '\.gz$') {
        # Compressed backup
        $tempFile = [System.IO.Path]::GetTempFileName()
        try {
            $content = Get-Content $BackupFile -Raw -Encoding Byte
            [System.IO.File]::WriteAllBytes($tempFile, $content)
            
            # Decompress and restore
            $decompressed = [System.IO.Path]::ChangeExtension($tempFile, ".sql")
            # Note: Requires 7zip or similar for gzip decompression in PowerShell
            # For now, use gunzip if available, or manual decompression
            Write-Host "[INFO] Decompressing backup..." -ForegroundColor Green
            # This would require additional tools - recommend using Linux restore script
            Write-Host "[ERROR] Gzip decompression not available in PowerShell. Use Linux restore script or decompress manually." -ForegroundColor Red
            exit 1
        }
        finally {
            if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
        }
    }
    else {
        # Uncompressed backup
        Get-Content $BackupFile | docker-compose -f "$ProjectRoot\docker-compose.prod.yml" exec -T postgres `
            psql -U $dbUser $dbName
    }
    
    Write-Host "[INFO] Database restored successfully" -ForegroundColor Green
    
    # Restart API
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" start api
}

function Restore-Redis {
    param([string]$BackupFile)
    
    if (-not (Test-Path $BackupFile)) {
        Write-Host "[ERROR] Backup file not found: $BackupFile" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[INFO] Restoring Redis data from $BackupFile..." -ForegroundColor Green
    
    Confirm-Restore
    
    # Stop Redis
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" stop redis
    
    # Copy backup file
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" cp `
        $BackupFile redis:/data/dump.rdb
    
    # Start Redis
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" start redis
    
    Write-Host "[INFO] Redis restored successfully" -ForegroundColor Green
}

# Main restore function
function Main {
    if ($Type -eq "redis") {
        Restore-Redis $BackupFile
    }
    else {
        Restore-Database $BackupFile
    }
    
    Write-Host "[INFO] Restore completed successfully!" -ForegroundColor Green
}

Main
