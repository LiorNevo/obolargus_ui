#!/usr/bin/env bash
set -uo pipefail

fail() {
  echo "pnpm not found. PATH=$PATH HOME=${HOME:-<unset>} NVM_DIR=${NVM_DIR:-<unset>}" >&2
  echo "pnpm not found on PATH; install via corepack or add it" >&2
  exit 1
}

resolve() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi
  if [ -n "${NVM_DIR:-}" ] && [ -s "${NVM_DIR}/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR}/nvm.sh"
    if command -v pnpm >/dev/null 2>&1; then
      return 0
    fi
  fi
  local d
  for d in \
    "${NVM_DIR:-$HOME/.nvm}/versions/node"/*/bin \
    "$HOME/.nvm/versions/node"/*/bin \
    /home/*/.nvm/versions/node/*/bin \
    "$HOME/.local/share/pnpm" \
    /usr/local/share/pnpm /usr/local/bin; do
    if [ -x "$d/pnpm" ]; then
      export PATH="$d:$PATH"
      return 0
    fi
  done
  local pnpm_path
  pnpm_path="$(bash -lc 'command -v pnpm' 2>/dev/null || true)"
  if [ -n "$pnpm_path" ] && [ -x "$pnpm_path" ]; then
    export PATH="$(dirname "$pnpm_path"):$PATH"
    return 0
  fi
  return 1
}

resolve || fail
exec pnpm lint
