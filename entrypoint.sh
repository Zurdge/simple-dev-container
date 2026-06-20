#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "ERROR: GH_TOKEN is not set. Pass it with -e GH_TOKEN=<token>" >&2
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "ERROR: GH_TOKEN is set but authentication failed. Check the token." >&2
  exit 1
fi

echo "Container ready. Use 'docker exec ${HOSTNAME} <command>' to run commands."
exec sleep infinity
