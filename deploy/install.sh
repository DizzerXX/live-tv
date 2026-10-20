#!/usr/bin/env bash
# First-time install or update from GitHub, run as root (sudo).
#
#   sudo REPO_URL=https://github.com/<you>/nuvio-live-tv-addon.git bash deploy/install.sh
#
# Re-running it pulls the latest commit, rebuilds and restarts the service.
set -euo pipefail

REPO_URL="${REPO_URL:?Set REPO_URL to your GitHub clone URL}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/nuvio-live-tv-addon}"
APP_USER="nuvio-live-tv"
ENV_DIR="/etc/nuvio-live-tv"
UNIT="/etc/systemd/system/nuvio-live-tv.service"

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }
command -v git >/dev/null || { echo "git is not installed." >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js 22+ is not installed." >&2; exit 1; }

node_major="$(node -p 'process.versions.node.split(".")[0]')"
(( node_major >= 22 )) || { echo "Node.js 22+ required, found $(node -v)." >&2; exit 1; }

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$APP_USER"
fi

if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" checkout --quiet "$BRANCH"
  git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# Build as root, then hand ownership to the service user as read-only.
cd "$APP_DIR"
npm ci --no-audit --no-fund   # "prepare" runs the TypeScript build
npm prune --omit=dev --no-audit --no-fund
chown -R root:"$APP_USER" "$APP_DIR"
chmod -R u=rwX,g=rX,o= "$APP_DIR"

install -d -m 0750 -o root -g "$APP_USER" "$ENV_DIR"
if [[ ! -f "$ENV_DIR/env" ]]; then
  install -m 0640 -o root -g "$APP_USER" .env.example "$ENV_DIR/env"
fi

install -m 0644 deploy/nuvio-live-tv.service "$UNIT"
sed -i "s#^WorkingDirectory=.*#WorkingDirectory=$APP_DIR#" "$UNIT"
systemctl daemon-reload
systemctl enable --quiet nuvio-live-tv
systemctl restart nuvio-live-tv

echo "Installed $(git rev-parse --short HEAD). Check: systemctl status nuvio-live-tv"
echo "Manifest: http://127.0.0.1:$(grep -E '^PORT=' "$ENV_DIR/env" | cut -d= -f2 || echo 7000)/manifest.json"
