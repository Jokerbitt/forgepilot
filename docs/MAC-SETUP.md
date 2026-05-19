# ForgePilot — Mac Setup (M5 Pro)

## Überblick: Was läuft wo

```
NAS (192.168.0.136 / Tailscale 100.94.55.15)
  ├── ForgePilot   :3002  ← App (Next.js)
  └── n8n          :5678  ← Workflow-Automation

Mac (M5 Pro)
  ├── Ollama       :11434 ← Lokales LLM (gratis, schnell)
  ├── Claude Code  ← Entwicklung
  └── Browser      → http://100.94.55.15:3002 (ForgePilot via Tailscale)
```

Du brauchst die App **nicht lokal auf dem Mac laufen lassen** — sie läuft auf dem NAS.
Der Mac ist für: lokale KI (Ollama) + Entwicklung (Claude Code).

---

## Schritt 1: Tailscale auf Mac installieren

1. https://tailscale.com/download/mac → installieren
2. Mit deinem Account anmelden (gleicher wie NAS/HA)
3. Mac erscheint jetzt im Tailscale-Netzwerk
4. ForgePilot im Browser öffnen: **http://100.94.55.15:3002**

---

## Schritt 2: Ollama installieren (lokales LLM, kostenlos)

```bash
# Homebrew (falls noch nicht installiert)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Ollama installieren
brew install ollama

# Starten (läuft als Service im Hintergrund)
brew services start ollama

# Modelle laden (einmalig, ~4-8 GB Download)
ollama pull llama3.2        # 3B Params — schnell, für quick Tasks
ollama pull llama3.1:8b     # 8B Params — gut für standard Tasks
ollama pull qwen2.5-coder   # speziell für Code-Generierung

# Testen
curl http://localhost:11434/api/generate \
  -d '{"model":"llama3.2","prompt":"Hallo!","stream":false}'
```

### Ollama mit ForgePilot verbinden

Damit ForgePilot (auf dem NAS) Ollama (auf dem Mac) nutzen kann:

1. Mac-Tailscale-IP ermitteln: `tailscale ip -4` → z.B. `100.x.x.x`
2. Ollama für externen Zugriff freigeben:
   ```bash
   # In ~/.zshrc oder ~/.bash_profile hinzufügen:
   export OLLAMA_HOST=0.0.0.0
   # Dann: brew services restart ollama
   ```
3. In ForgePilot Settings: **http://[mac-tailscale-ip]:11434** eintragen

---

## Schritt 3: Entwicklung auf Mac (optional)

```bash
# Voraussetzungen
brew install node@20 git gh

# Repo klonen
gh auth login
gh repo clone Jokerbitt/forgepilot
cd forgepilot

# Dependencies
npm install

# Dev-Server starten (läuft auf localhost:3000)
npm run dev
```

Dann im Browser: **http://localhost:3000**

### Claude Code auf Mac

```bash
npm install -g @anthropic-ai/claude-code
# oder mit brew:
brew install anthropic-ai/claude/claude-code

# Im Projektverzeichnis starten
cd forgepilot
claude
```

---

## Deployment ohne GitHub Actions (falls Billing gesperrt)

### Option A: Repo public machen (empfohlen)
→ GitHub → forgepilot → Settings → Change visibility → Public
→ GitHub Actions für public Repos kostenlos + unbegrenzt

### Option B: Lokal auf Mac bauen + auf NAS laden

```bash
cd forgepilot

# Docker Desktop für Mac installieren: https://www.docker.com/products/docker-desktop/

# Image bauen
docker build -t forgepilot:local .

# Auf NAS laden (via SSH)
docker save forgepilot:local | ssh admin@192.168.0.136 \
  "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker load"

# Auf NAS: docker-compose.yml anpassen (image: forgepilot:local statt ghcr.io/...)
ssh admin@192.168.0.136 "cd /share/forgepilot && \
  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker compose up -d forgepilot"
```

### Option C: Sync-Skript (Dateien direkt auf NAS, kein Docker-Build)

```bash
# Nur geänderte Src-Dateien synken + App neustarten
rsync -avz --exclude node_modules --exclude .next \
  /Users/$USER/dev/forgepilot/ \
  admin@192.168.0.136:/share/forgepilot/src/

ssh admin@192.168.0.136 "cd /share/forgepilot && \
  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart forgepilot"
```

---

## n8n API Keys eintragen

```bash
# SSH auf NAS
ssh admin@192.168.0.136

# .env Datei anlegen (einmalig)
cat > /share/forgepilot/.env << 'EOF'
LINEAR_API_KEY=lin_api_xxxxx
TELEGRAM_BOT_TOKEN=123456:ABC-xxxxx
TELEGRAM_CHAT_ID=123456789
EOF

# n8n neu starten damit .env geladen wird
cd /share/forgepilot
/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker compose up -d n8n
```

---

## Telegram Bot einrichten (Stufe 3 Alerts)

1. Telegram öffnen → **@BotFather** suchen
2. `/newbot` tippen → Name eingeben → Token kopieren (sieht aus wie `123456:ABC-...`)
3. **@userinfobot** schreiben → deine Chat-ID erscheint (Zahl, z.B. `87654321`)
4. Bot starten: deinen neuen Bot in Telegram suchen → `/start` tippen
5. Token + Chat-ID in `/share/forgepilot/.env` eintragen (siehe oben)
6. n8n: "Telegram Delegation Alerts" Workflow aktivieren

---

## GitHub Secret für PR→Linear (Stufe 4)

1. https://github.com/Jokerbitt/forgepilot/settings/secrets/actions
2. "New repository secret" → Name: `LINEAR_API_KEY` → Wert: dein Key
3. Ab jetzt: jeder gemergter PR mit `JOK-XXX` im Branch/Titel → Linear-Ticket auf Done

---

## URLs auf einen Blick

| Was | URL |
|---|---|
| ForgePilot (NAS) | http://100.94.55.15:3002 |
| n8n (NAS) | http://100.94.55.15:5678 |
| ForgePilot lokal (Mac) | http://localhost:3000 |
| Ollama API | http://localhost:11434 |
