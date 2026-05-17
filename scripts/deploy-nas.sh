#!/usr/bin/env bash
# ForgePilot — NAS Deploy Script (Mac/Linux)
# Usage: bash scripts/deploy-nas.sh [image-tag]
# Requires: Docker Desktop, SSH access to NAS (192.168.0.136)
set -e

NAS_HOST="${NAS_HOST:-192.168.0.136}"
NAS_USER="${NAS_USER:-admin}"
NAS_PORT="${NAS_PORT:-22}"
IMAGE_TAG="${1:-latest}"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> ForgePilot NAS Deploy"
echo "    NAS: $NAS_USER@$NAS_HOST"
echo "    Image: forgepilot:$IMAGE_TAG"

echo ""
echo "[1/4] Building Docker image..."
cd "$PROJECT_ROOT"
docker build -t "forgepilot:$IMAGE_TAG" .

echo ""
echo "[2/4] Exporting image..."
TAR_PATH="/tmp/forgepilot-$IMAGE_TAG.tar"
docker save "forgepilot:$IMAGE_TAG" -o "$TAR_PATH"
echo "    Saved to: $TAR_PATH"

echo ""
echo "[3/4] Uploading to NAS..."
scp -P "$NAS_PORT" "$TAR_PATH" "$NAS_USER@$NAS_HOST:/tmp/forgepilot-$IMAGE_TAG.tar"
scp -P "$NAS_PORT" "$PROJECT_ROOT/docker-compose.yml" \
    "$NAS_USER@$NAS_HOST:/share/forgepilot/docker-compose.yml"

echo ""
echo "[4/4] Deploying on NAS..."
ssh -p "$NAS_PORT" "$NAS_USER@$NAS_HOST" "
  set -e
  echo '>> Loading Docker image...'
  docker load -i /tmp/forgepilot-$IMAGE_TAG.tar
  echo '>> Restarting container...'
  mkdir -p /share/forgepilot
  cd /share/forgepilot
  docker compose down --remove-orphans
  docker compose up -d
  echo '>> Cleaning up...'
  rm -f /tmp/forgepilot-$IMAGE_TAG.tar
  echo '>> Done! ForgePilot running at http://$NAS_HOST:3001'
"

rm -f "$TAR_PATH"

echo ""
echo "✅ Deploy complete!"
echo "   ForgePilot: http://$NAS_HOST:3001"
echo "   Next: Set API keys at http://$NAS_HOST:3001/settings"
