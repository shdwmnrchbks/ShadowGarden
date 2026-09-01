#!/usr/bin/env bash
set -Eeuo pipefail

# One-time host bootstrap for a CachyOS/Arch Linux x64 runner in shdwmnrchbks.
# Workflows target runner capabilities rather than a specific machine label.
# Docker is installed so ShadowGarden can execute its pinned Playwright image.

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

ShadowGarden verify can run on any x64 self-hosted runner. Playwright E2E and
the release gate use the Linux x64 pool because job containers and their shell
tooling are Linux-specific.

Required built-in labels for this host:
  self-hosted, Linux, X64

Custom labels such as steamdeck/cachyos remain optional; workflows no longer
bind themselves to one named machine.
EOF

if (( GROUP_CHANGED )); then
  echo
  echo "Your interactive shell will see docker-group membership after logout/login."
  echo "The restarted GitHub Actions systemd service already receives the new group."
fi
