#!/usr/bin/env bash
set -euo pipefail

TASK_NAME="${1:?Usage: ./run.sh <task-name> <repo>}"
REPO="${2:?Usage: ./run.sh <task-name> <repo>}"
IMAGE="${IMAGE:-dev-container}"

TOKENS_FILE="$(dirname "$0")/tokens.json"
GH_TOKEN="$(jq -r --arg repo "$REPO" '.[$repo] // empty' "$TOKENS_FILE")"

if [[ -z "$GH_TOKEN" ]]; then
  echo "ERROR: No token for repo '$REPO' in tokens.json" >&2
  exit 1
fi

docker run -d --init \
  --label "dev-container.managed=true" \
  --name "$TASK_NAME" \
  -e "GH_TOKEN=$GH_TOKEN" \
  "$IMAGE"

echo "Container '$TASK_NAME' is running."
echo "Run commands with: docker exec $TASK_NAME <command>"
echo "Stop with:         docker stop $TASK_NAME && docker rm $TASK_NAME"
