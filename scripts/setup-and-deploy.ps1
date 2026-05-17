# ForgePilot — Vollautomatisches Ersteinrichtung & Deploy
# GitHub Actions baut das Image, dieses Script richtet den NAS ein und startet alles.
# Usage: .\scripts\setup-and-deploy.ps1
# Optional: .\scripts\setup-and-deploy.ps1 -AnthropicKey "sk-ant-..." -LinearKey "lin_api_..." -GithubToken "ghp_..."

param(
  [string]$NasHost = "192.168.0.136",
  [string]$NasUser = "admin",
  [string]$AnthropicKey = "",
  [string]$LinearKey = "",
  [string]$LinearTeamId = "",
  [string]$GithubToken = $env:GITHUB_TOKEN
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$Docker = "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker"

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ForgePilot — Ersteinrichtung & Deploy   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "  NAS: $NasUser@$NasHost"
Write-Host ""

# Aus .env.local lesen falls Keys nicht übergeben
$envFile = Join-Path $ProjectRoot ".env.local"
if (Test-Path $envFile) {
  $envLines = Get-Content $envFile
  if (-not $AnthropicKey)  { $AnthropicKey  = ($envLines | Select-String "^ANTHROPIC_API_KEY=(.+)").Matches.Groups[1].Value }
  if (-not $LinearKey)     { $LinearKey     = ($envLines | Select-String "^LINEAR_API_KEY=(.+)").Matches.Groups[1].Value }
  if (-not $LinearTeamId)  { $LinearTeamId  = ($envLines | Select-String "^LINEAR_TEAM_ID=(.+)").Matches.Groups[1].Value }
  if (-not $GithubToken)   { $GithubToken   = ($envLines | Select-String "^GITHUB_TOKEN=(.+)").Matches.Groups[1].Value }
}

# 1. SSH prüfen
Write-Host "[1/5] SSH-Verbindung..." -ForegroundColor Yellow
$test = ssh -o ConnectTimeout=5 -o BatchMode=yes "${NasUser}@${NasHost}" "echo OK" 2>&1
if ($test -notmatch "OK") { Write-Error "SSH fehlgeschlagen. Tipp: ssh-copy-id admin@$NasHost"; exit 1 }
Write-Host "      ✅ SSH OK" -ForegroundColor Green

# 2. NAS einrichten
Write-Host "[2/5] NAS-Verzeichnisse anlegen..." -ForegroundColor Yellow
ssh "${NasUser}@${NasHost}" "mkdir -p /share/forgepilot /share/forgepilot/config"
scp -q "$ProjectRoot\docker-compose.yml" "${NasUser}@${NasHost}:/share/forgepilot/docker-compose.yml"
Write-Host "      ✅ /share/forgepilot bereit" -ForegroundColor Green

# 3. .env auf NAS schreiben (API Keys für den Container)
Write-Host "[3/5] API Keys auf NAS schreiben..." -ForegroundColor Yellow
$envContent = ""
if ($AnthropicKey)  { $envContent += "ANTHROPIC_API_KEY=$AnthropicKey`n" }
if ($LinearKey)     { $envContent += "LINEAR_API_KEY=$LinearKey`n" }
if ($LinearTeamId)  { $envContent += "LINEAR_TEAM_ID=$LinearTeamId`n" }
if ($GithubToken)   { $envContent += "GITHUB_TOKEN=$GithubToken`n" }
$envContent += "GITHUB_OWNER=Jokerbitt`nGITHUB_REPOSITORIES=forgepilot`n"

$tmpEnv = "$env:TEMP\forgepilot.env"
$envContent | Out-File -FilePath $tmpEnv -Encoding utf8 -NoNewline
scp -q $tmpEnv "${NasUser}@${NasHost}:/share/forgepilot/.env"
Remove-Item $tmpEnv
Write-Host "      ✅ .env gesetzt" -ForegroundColor Green

# 4. GHCR Login + Image pullen
Write-Host "[4/5] Image von GHCR pullen..." -ForegroundColor Yellow
if ($GithubToken) {
  ssh "${NasUser}@${NasHost}" "echo '$GithubToken' | $Docker login ghcr.io -u jokerbitt --password-stdin 2>&1" | Out-Null
}
ssh "${NasUser}@${NasHost}" "$Docker pull ghcr.io/jokerbitt/forgepilot:latest"
ssh "${NasUser}@${NasHost}" "$Docker pull n8nio/n8n:latest"
Write-Host "      ✅ Images gepullt" -ForegroundColor Green

# 5. Container starten
Write-Host "[5/5] Container starten..." -ForegroundColor Yellow
$startScript = @"
set -e
cd /share/forgepilot
$Docker compose down --remove-orphans 2>/dev/null || true
$Docker compose up -d
echo DONE
"@
ssh "${NasUser}@${NasHost}" $startScript | Out-Null

Start-Sleep 3
$status = ssh "${NasUser}@${NasHost}" "$Docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | grep -E 'NAMES|forgepilot|n8n'"
Write-Host $status -ForegroundColor Green

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ ForgePilot läuft auf dem NAS!        ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host "  App:      http://$NasHost:3001"
Write-Host "  n8n:      http://$NasHost:5678   (admin / forgepilot)"
Write-Host "  Settings: http://$NasHost:3001/settings"
Write-Host ""
if (-not $AnthropicKey) {
  Write-Host "  ⚠  ANTHROPIC_API_KEY fehlt → Research Run nicht möglich" -ForegroundColor Yellow
  Write-Host "     Eintragen unter: http://$NasHost:3001/settings"
}
