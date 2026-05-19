#!/usr/bin/env bash
# ForgePilot — NAS Deploy via GHCR Pull (Mac/Linux)
# Usage: bash scripts/deploy-nas.sh
# Voraussetzung: GITHUB_TOKEN in .env.local oder als Env-Variable
set -e

NAS_HOST="${NAS_HOST:-192.168.0.136}"
NAS_USER="${NAS_USER:-admin}"
NAS_PORT="${NAS_PORT:-22}"
DOCKER="/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# GITHUB_TOKEN aus .env.local lesen falls nicht gesetzt
if [ -z "$GITHUB_TOKEN" ] && [ -f "$PROJECT_ROOT/.env.local" ]; then
  GITHUB_TOKEN=$(grep "^GITHUB_TOKEN=" "$PROJECT_ROOT/.env.local" | cut -d= -f2)
fi

echo ""
echo "==> ForgePilot NAS Deploy (GHCR Pull)"
echo "    NAS: $NAS_USER@$NAS_HOST"
echo ""

echo "[1/4] SSH prüfen..."
ssh -o ConnectTimeout=5 -o BatchMode=yes "$NAS_USER@$NAS_HOST" "echo '✅ SSH OK'"

echo "[2/4] NAS einrichten..."
ssh "$NAS_USER@$NAS_HOST" "mkdir -p /share/forgepilot"
scp -q -P "$NAS_PORT" "$PROJECT_ROOT/docker-compose.yml" "$NAS_USER@$NAS_HOST:/share/forgepilot/docker-compose.yml"
echo "      ✅ docker-compose.yml kopiert"

echo "[3/4] Image von GHCR pullen..."
if [ -n "$GITHUB_TOKEN" ]; then
  ssh "$NAS_USER@$NAS_HOST" "echo '$GITHUB_TOKEN' | $DOCKER login ghcr.io -u jokerbitt --password-stdin"
else
  echo "      ⚠  Kein GITHUB_TOKEN — anonymer Pull"
fi
ssh "$NAS_USER@$NAS_HOST" "$DOCKER pull ghcr.io/jokerbitt/forgepilot:latest"
echo "      ✅ Image gepullt"

echo "[4/4] Container starten..."
ssh "$NAS_USER@$NAS_HOST" "
  set -e
  cd /share/forgepilot
  $DOCKER compose down --remove-orphans 2>/dev/null || true
  $DOCKER compose up -d
  $DOCKER ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | grep -E 'NAMES|forgepilot|n8n'
"

echo ""
echo "✅ Deploy complete!"
echo "   ForgePilot: http://$NAS_HOST:3001"
echo "   n8n:        http://$NAS_HOST:5678  (admin / forgepilot)"
echo "   Settings:   http://$NAS_HOST:3001/settings"
