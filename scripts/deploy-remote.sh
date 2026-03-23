#!/bin/bash
# 远程部署启动脚本 - 生产模式，无 HMR
# 适用于通过反向代理或公网访问的场景

set -Eeuo pipefail

PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "============================================"
echo "远程部署模式 - 生产环境"
echo "============================================"
echo ""
echo "此模式禁用 HMR，适用于："
echo "  - 通过 Nginx/Apache 反向代理"
echo "  - 通过公网 IP 访问"
echo "  - 通过局域网 IP 访问"
echo ""
echo "如需开发模式（带 HMR），请使用: pnpm dev"
echo ""
echo "============================================"
echo ""

# 检查是否已构建
if [ ! -d ".next/standalone" ]; then
    echo "未检测到构建产物，正在构建..."
    pnpm build
    echo ""
fi

# 关键：standalone 模式需要手动复制 public 目录
if [ -d "public" ] && [ ! -d ".next/standalone/public" ]; then
    echo "复制 public 目录到 standalone..."
    cp -r public .next/standalone/
fi

# 确保视频目录存在
mkdir -p .next/standalone/public/videos
echo "视频存储目录: $(pwd)/.next/standalone/public/videos"

echo ""
echo "启动生产服务在端口 ${PORT}..."
echo "访问地址: http://0.0.0.0:${PORT}"
echo ""

# 启动生产服务
cd .next/standalone
PORT=${PORT} node server.js
