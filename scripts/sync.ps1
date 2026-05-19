# ForgePilot — Sync local src to NAS (dev workflow)
# Usage: .\scripts\sync.ps1
# Syncs source files to NAS share for inspection/backup — does NOT restart the container.
# For a full redeploy, use .\scripts\deploy-nas.ps1

param(
  [string]$NasHost = "192.168.0.136",
  [string]$NasUser = "admin",
  [string]$NasPort = "22",
  [string]$NasDest = "/share/forgepilot/src-backup"
)

$ProjectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "==> Syncing src/ to NAS..." -ForegroundColor Cyan

# Use robocopy to mirror src to NAS (via SMB if mapped, else SCP)
$NasMapped = "Z:\NAS\Projects\forgepilot\src-backup"

if (Test-Path "Z:\NAS") {
  # NAS is mapped as Z: — use robocopy (fast)
  New-Item -ItemType Directory -Force -Path $NasMapped | Out-Null
  robocopy "$ProjectRoot\src" $NasMapped /MIR /NFL /NDL /NJH /NJS /nc /ns /np
  Write-Host "✅ Synced via Z: drive ($NasMapped)" -ForegroundColor Green
} else {
  # Fallback: SCP
  scp -P $NasPort -r "$ProjectRoot\src" "${NasUser}@${NasHost}:$NasDest"
  Write-Host "✅ Synced via SCP" -ForegroundColor Green
}
