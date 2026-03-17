#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

start_service() {
    cd "${COZE_WORKSPACE_PATH}"
    
    # 检查是否存在 standalone 构建产物
    if [ -f ".next/standalone/server.js" ]; then
        echo "Starting standalone server on port ${DEPLOY_RUN_PORT}..."
        cd .next/standalone
        NODE_ENV=production PORT=${DEPLOY_RUN_PORT} node server.js
    else
        echo "Standalone build not found, starting with next start..."
        npx next start --port ${DEPLOY_RUN_PORT}
    fi
}

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT}..."
start_service
