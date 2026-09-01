#!/usr/bin/env bash
set -Eeuo pipefail

# One-time host bootstrap for the shdwmnrchbks Steam Deck/CachyOS runner.
# Dayloop provisions JDK 17 and Android SDK 35 inside its workflow; the host
# only needs common archive/network tools. Docker is installed so ShadowGarden
# can execute its pinned Playwright container on the self-hosted runner.

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[[ "$EUID" -ne 0 ]] || die "Run this as your normal runner user, not root."
command -v pacman >/dev/null 2>&1 || die "This script expects CachyOS/Arch Linux."
command -v sudo >/dev/null 2>&1 || die "sudo is required."

log "Authenticating sudo"
sudo -v

log "Installing CI host dependencies"
sudo pacman -S --needed --noconfirm \
  ca-certificates \
  curl \
  git \
  github-cli \
  gzip \
  jq \
  tar \
  unzip \
  zip \
  docker

log "Enabling Docker"
sudo systemctl enable --now docker

GROUP_CHANGED=0
if ! id -nG "$USER" | tr ' ' '\n' | grep -Fxq docker; then
  sudo usermod -aG docker "$USER"
  GROUP_CHANGED=1
  ok "Added $USER to the docker group"
fi

# A systemd service resolves supplementary groups when it starts, so restarting
# the Actions service is enough for it to pick up docker-group membership even
# before the interactive desktop session is restarted.
RUNNER_SERVICE="$(systemctl list-unit-files --type=service --no-legend 'actions.runner.*.service' 2>/dev/null | awk 'NR==1 {print $1}')"
if [[ -n "$RUNNER_SERVICE" ]]; then
  log "Restarting GitHub Actions runner service"
  sudo systemctl restart "$RUNNER_SERVICE"
  sudo systemctl --no-pager --full status "$RUNNER_SERVICE" || true
  ok "Restarted $RUNNER_SERVICE"
else
  printf '\033[1;33m!\033[0m No actions.runner.* service was found; restart your runner after this script.\n' >&2
fi

log "Verifying Docker daemon"
sudo docker version >/dev/null
ok "Docker is running"

cat <<EOF

CachyOS runner host dependencies are ready.

Dayloop CI will provision:
  - JDK 17
  - Android SDK platform 35
  - Android Build Tools 35.0.0
  - Gradle dependencies/caches

ShadowGarden CI will provision:
  - Node.js 22
  - npm dependencies
  - Playwright 1.62.1 browsers and Linux libraries through its pinned container

The GitHub runner itself must have these labels:
  self-hosted, Linux, X64, steamdeck
EOF

if (( GROUP_CHANGED )); then
  echo
  echo "Your interactive shell will see docker-group membership after logout/login."
  echo "The restarted GitHub Actions systemd service already receives the new group."
fi
