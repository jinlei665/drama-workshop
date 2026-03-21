#!/bin/bash
# 本地部署启动脚本 - 禁用 HMR，避免 WebSocket 连接问题
# 适用于通过公网 IP 或局域网 IP 访问的场景

set -Eeuo pipefail

PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Starting development server on port ${PORT} (HMR disabled)"
echo "This is recommended for deployment via public IP or LAN IP"
echo ""

# 禁用 HMR 的方式：
# 1. WATCHPACK_POLLING=true - 使用轮询检测文件变化
# 2. --no-turbo - 使用 webpack 而不是 turbopack（更稳定）
# 3. NODE_ENV=production 会完全禁用 HMR，但这里保持开发模式

# 方式1: 完全禁用 HMR（使用生产模式启动，但保留开发功能）
# 这是最稳定的方式，但需要手动重启来看到代码变化

WATCHPACK_POLLING=true npx next dev --webpack --port $PORT --hostname 0.0.0.0
