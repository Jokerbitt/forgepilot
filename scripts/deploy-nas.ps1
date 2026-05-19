# ForgePilot — NAS Deploy via GHCR Pull
# Kein lokales Docker nötig — GitHub Actions baut, NAS pullt.
# Usage: .\scripts\deploy-nas.ps1
# Voraussetzung: GITHUB_TOKEN in .env.local oder als Parameter

param(
  [string]$NasHost = "192.168.0.136",
  [string]$NasUser = "admin",
  [string]$NasPort = "22",
  [string]$GhcrToken = $env:GITHUB_TOKEN
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$Docker = "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker"

Write-Host ""
Write-Host "==> ForgePilot NAS Deploy (GHCR Pull)" -ForegroundColor Cyan
Write-Host "    NAS: $NasUser@$NasHost"
Write-Host "    Image: ghcr.io/jokerbitt/forgepilot:latest"
Write-Host ""

# 1. SSH prüfen
Write-Host "[1/4] SSH prüfen..." -ForegroundColor Yellow
$test = ssh -o ConnectTimeout=5 -o BatchMode=yes "${NasUser}@${NasHost}" "echo OK" 2>&1
if ($test -notmatch "OK") { Write-Error "SSH fehlgeschlagen"; exit 1 }
Write-Host "      ✅ SSH OK" -ForegroundColor Green

# 2. NAS-Verzeichnis + docker-compose kopieren
Write-Host "[2/4] NAS einrichten..." -ForegroundColor Yellow
ssh "${NasUser}@${NasHost}" "mkdir -p /share/forgepilot"
scp -q -P $NasPort "$ProjectRoot\docker-compose.yml" "${NasUser}@${NasHost}:/share/forgepilot/docker-compose.yml"
Write-Host "      ✅ docker-compose.yml kopiert" -ForegroundColor Green

# 3. GHCR Login + Image pullen
Write-Host "[3/4] Image von GHCR pullen..." -ForegroundColor Yellow
if (-not $GhcrToken) {
  # Aus .env.local lesen falls vorhanden
  $envFile = Join-Path $ProjectRoot ".env.local"
  if (Test-Path $envFile) {
    $GhcrToken = (Select-String "GITHUB_TOKEN=(.+)" $envFile).Matches.Groups[1].Value
  }
}

if ($GhcrToken) {
  ssh "${NasUser}@${NasHost}" "echo '$GhcrToken' | $Docker login ghcr.io -u jokerbitt --password-stdin 2>&1"
} else {
  Write-Host "      ⚠  Kein GITHUB_TOKEN — versuche anonymen Pull (nur für public images)" -ForegroundColor Yellow
}

ssh "${NasUser}@${NasHost}" "$Docker pull ghcr.io/jokerbitt/forgepilot:latest"
Write-Host "      ✅ Image gepullt" -ForegroundColor Green

# 4. Container neu starten
Write-Host "[4/4] Container starten..." -ForegroundColor Yellow
$startScript = @"
set -e
cd /share/forgepilot
$Docker compose down --remove-orphans 2>/dev/null || true
$Docker compose up -d
echo STARTED
"@
$result = ssh "${NasUser}@${NasHost}" $startScript
if ($result -notmatch "STARTED") {
  Write-Error "Container-Start fehlgeschlagen"
  exit 1
}
Write-Host "      ✅ Container laufen" -ForegroundColor Green

# Status
Write-Host ""
ssh "${NasUser}@${NasHost}" "$Docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | grep -E 'NAMES|forgepilot|n8n'"

Write-Host ""
Write-Host "✅ Deploy complete!" -ForegroundColor Green
Write-Host "   ForgePilot: http://$NasHost:3001" -ForegroundColor Cyan
Write-Host "   n8n:        http://$NasHost:5678  (admin / forgepilot)" -ForegroundColor Cyan
Write-Host "   Settings:   http://$NasHost:3001/settings"
