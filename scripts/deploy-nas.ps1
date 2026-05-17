# ForgePilot — NAS Deploy Script
# Usage: .\scripts\deploy-nas.ps1
# Requires: Docker Desktop, SSH access to NAS (192.168.0.136)

param(
  [string]$NasHost = "192.168.0.136",
  [string]$NasUser = "admin",
  [string]$NasPort = "22",
  [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "==> ForgePilot NAS Deploy" -ForegroundColor Cyan
Write-Host "    NAS: $NasUser@$NasHost"
Write-Host "    Image: forgepilot:$ImageTag"

# 1. Build Docker image locally
Write-Host "`n[1/4] Building Docker image..." -ForegroundColor Yellow
Set-Location $ProjectRoot
docker build -t "forgepilot:$ImageTag" .
if ($LASTEXITCODE -ne 0) { Write-Error "Docker build failed"; exit 1 }

# 2. Export image as tarball
Write-Host "`n[2/4] Exporting image..." -ForegroundColor Yellow
$TarPath = "$env:TEMP\forgepilot-$ImageTag.tar"
docker save "forgepilot:$ImageTag" -o $TarPath
Write-Host "    Saved to: $TarPath"

# 3. Copy to NAS via SCP
Write-Host "`n[3/4] Uploading to NAS..." -ForegroundColor Yellow
scp -P $NasPort $TarPath "${NasUser}@${NasHost}:/tmp/forgepilot-$ImageTag.tar"
if ($LASTEXITCODE -ne 0) { Write-Error "SCP upload failed"; exit 1 }

# Copy docker-compose.yml
scp -P $NasPort "$ProjectRoot\docker-compose.yml" "${NasUser}@${NasHost}:/share/forgepilot/docker-compose.yml"

# 4. SSH: load image + restart container
Write-Host "`n[4/4] Deploying on NAS..." -ForegroundColor Yellow
$RemoteCommands = @"
set -e
echo '>> Loading Docker image...'
docker load -i /tmp/forgepilot-$ImageTag.tar
echo '>> Restarting container...'
mkdir -p /share/forgepilot
cd /share/forgepilot
docker compose down --remove-orphans
docker compose up -d
echo '>> Cleaning up...'
rm -f /tmp/forgepilot-$ImageTag.tar
echo '>> Done! ForgePilot running at http://$NasHost:3001'
"@

ssh -p $NasPort "${NasUser}@${NasHost}" $RemoteCommands
if ($LASTEXITCODE -ne 0) { Write-Error "Remote deploy failed"; exit 1 }

# Cleanup local tar
Remove-Item $TarPath -ErrorAction SilentlyContinue

Write-Host "`n✅ Deploy complete!" -ForegroundColor Green
Write-Host "   ForgePilot: http://$NasHost:3001" -ForegroundColor Cyan
Write-Host "   Next: Set API keys at http://$NasHost:3001/settings"
