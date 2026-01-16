# PulseCal SecureBand - Backup Script (PowerShell)
# Creates backups of database and Redis data

param(
    [string]$BackupDir = "",
    [int]$RetentionDays = 30
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

$BackupDir = if ($BackupDir) { $BackupDir } else { if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $ProjectRoot "backups" } }
$RetentionDays = if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { $RetentionDays }
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Create backup directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# Backup PostgreSQL database
function Backup-Database {
    Write-Host "[INFO] Backing up PostgreSQL database..." -ForegroundColor Green
    
    $backupFile = Join-Path $BackupDir "pulsecal_db_$Timestamp.sql.gz"
    $dbUser = if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "postgres" }
    $dbName = if ($env:DB_DATABASE) { $env:DB_DATABASE } else { "pulsecal" }
    
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" exec -T postgres `
        pg_dump -U $dbUser $dbName | gzip | Out-File -FilePath $backupFile -Encoding Byte
    
    if (Test-Path $backupFile) {
        $size = (Get-Item $backupFile).Length / 1MB
        Write-Host "[INFO] Database backup created: $backupFile ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        return $backupFile
    }
    else {
        Write-Host "[ERROR] Database backup failed" -ForegroundColor Red
        exit 1
    }
}

# Backup Redis data
function Backup-Redis {
    Write-Host "[INFO] Backing up Redis data..." -ForegroundColor Green
    
    $backupFile = Join-Path $BackupDir "redis_$Timestamp.rdb"
    
    # Trigger Redis save
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" exec -T redis redis-cli BGSAVE
    
    # Wait for save to complete
    Start-Sleep -Seconds 5
    
    # Copy RDB file
    docker-compose -f "$ProjectRoot\docker-compose.prod.yml" cp `
        redis:/data/dump.rdb $backupFile
    
    if (Test-Path $backupFile) {
        $size = (Get-Item $backupFile).Length / 1MB
        Write-Host "[INFO] Redis backup created: $backupFile ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        return $backupFile
    }
    else {
        Write-Host "[WARN] Redis backup skipped (no data or AOF enabled)" -ForegroundColor Yellow
    }
}

# Create backup manifest
function New-Manifest {
    $manifestFile = Join-Path $BackupDir "backup_$Timestamp.manifest"
    
    $version = try { git describe --tags --always 2>$null } catch { "unknown" }
    
    $manifest = @"
Backup Manifest
===============
Timestamp: $Timestamp
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC")
System: PulseCal SecureBand
Version: $version

Backup Files:
$(Get-ChildItem "$BackupDir\*$Timestamp*" | ForEach-Object { "$($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" })

Database:
- Host: $(if ($env:DB_HOST) { $env:DB_HOST } else { "postgres" })
- Database: $(if ($env:DB_DATABASE) { $env:DB_DATABASE } else { "pulsecal" })
- User: $(if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "postgres" })

Restore Instructions:
1. Stop services: docker-compose -f docker-compose.prod.yml down
2. Restore database: .\scripts\restore.ps1 $BackupDir\pulsecal_db_$Timestamp.sql.gz
3. Restore Redis: .\scripts\restore.ps1 $BackupDir\redis_$Timestamp.rdb redis
4. Start services: docker-compose -f docker-compose.prod.yml up -d
"@
    
    $manifest | Out-File -FilePath $manifestFile -Encoding UTF8
    Write-Host "[INFO] Backup manifest created: $manifestFile" -ForegroundColor Green
}

# Clean old backups
function Remove-OldBackups {
    Write-Host "[INFO] Cleaning up backups older than $RetentionDays days..." -ForegroundColor Green
    
    $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
    
    Get-ChildItem $BackupDir -Include "*.sql.gz", "*.rdb", "*.manifest" -Recurse | 
        Where-Object { $_.LastWriteTime -lt $cutoffDate } | 
        Remove-Item -Force
    
    Write-Host "[INFO] Old backups cleaned" -ForegroundColor Green
}

# Main backup function
function Main {
    Write-Host "[INFO] Starting backup process..." -ForegroundColor Green
    
    Backup-Database
    Backup-Redis
    New-Manifest
    Remove-OldBackups
    
    Write-Host "[INFO] Backup completed successfully!" -ForegroundColor Green
    Write-Host "[INFO] Backup location: $BackupDir" -ForegroundColor Green
}

Main
