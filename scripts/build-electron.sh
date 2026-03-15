#!/bin/bash

# 短剧漫剧创作工坊 - Electron 桌面应用打包脚本

set -e

VERSION="1.0.0"
PROJECT_NAME="drama-studio"

echo "========================================"
echo "短剧漫剧创作工坊 - Electron 桌面应用打包"
echo "版本: $VERSION"
echo "========================================"

# 检查必要工具
echo ""
echo "[1/7] 检查依赖..."

if ! command -v pnpm &> /dev/null; then
    echo "错误: 未找到 pnpm"
    exit 1
fi

# 安装 Electron 相关依赖
echo ""
echo "[2/7] 安装 Electron 依赖..."
pnpm add -D electron electron-builder tsx

# 构建 Next.js 应用
echo ""
echo "[3/7] 构建 Next.js 应用..."
pnpm run build

# 编译 Electron 主进程
echo ""
echo "[4/7] 编译 Electron 主进程..."
npx tsc -p electron/tsconfig.json

# 创建 Electron 资源目录
echo ""
echo "[5/7] 准备 Electron 资源..."
mkdir -p electron/resources

# 创建默认图标（如果没有）
if [ ! -f "electron/resources/icon.png" ]; then
    echo "创建默认图标..."
    # 创建一个简单的 SVG 并转换为 PNG（需要 ImageMagick）
    convert -size 256x256 xc:none -fill "#F59E0B" -draw "roundrectangle 0,0,256,256,32,32" \
        -fill white -font Arial -pointsize 120 -gravity center -annotate +0+0 "剧" \
        electron/resources/icon.png 2>/dev/null || \
    echo "警告: 未找到 ImageMagick，请手动添加图标"
fi

# 构建 Electron 应用
echo ""
echo "[6/7] 构建 Electron 应用..."

# Windows
echo "  构建 Windows 版本..."
npx electron-builder --win --x64

# Linux
echo "  构建 Linux 版本..."
npx electron-builder --linux --x64

# 清理
echo ""
echo "[7/7] 清理临时文件..."
rm -rf dist/.icon

echo ""
echo "========================================"
echo "构建完成！"
echo ""
echo "输出文件："
ls -la dist/electron/
echo "========================================"
