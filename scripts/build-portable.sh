#!/bin/bash

# 短剧漫剧创作工坊 - 便携版打包脚本
# 支持 Windows 和 Linux

set -e

VERSION="1.0.0"
PROJECT_NAME="drama-studio"
BUILD_DIR="dist/portable"
NODE_VERSION="20.11.0"

echo "========================================"
echo "短剧漫剧创作工坊 - 便携版打包工具"
echo "版本: $VERSION"
echo "========================================"

# 清理旧的构建文件
echo ""
echo "[1/6] 清理旧的构建文件..."
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR

# 构建项目
echo ""
echo "[2/6] 构建项目..."
pnpm run build

# 创建 standalone 输出目录结构
echo ""
echo "[3/6] 准备应用文件..."

# Linux 版本
LINUX_DIR="$BUILD_DIR/$PROJECT_NAME-linux-x64"
mkdir -p $LINUX_DIR/app

# 复制构建产物
cp -r .next/standalone/* $LINUX_DIR/app/
cp -r .next/static $LINUX_DIR/app/.next/
cp -r public $LINUX_DIR/app/

# Windows 版本
WIN_DIR="$BUILD_DIR/$PROJECT_NAME-win-x64"
mkdir -p $WIN_DIR/app

# 复制构建产物
cp -r .next/standalone/* $WIN_DIR/app/
cp -r .next/static $WIN_DIR/app/.next/
cp -r public $WIN_DIR/app/

# 下载 Node.js 便携版
echo ""
echo "[4/6] 下载 Node.js 运行时..."

# Linux Node.js
if [ ! -f "cache/node-v$NODE_VERSION-linux-x64.tar.xz" ]; then
    mkdir -p cache
    echo "下载 Node.js for Linux..."
    wget -q "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
        -O "cache/node-v$NODE_VERSION-linux-x64.tar.xz"
fi

# Windows Node.js
if [ ! -f "cache/node-v$NODE_VERSION-win-x64.zip" ]; then
    echo "下载 Node.js for Windows..."
    wget -q "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-win-x64.zip" \
        -O "cache/node-v$NODE_VERSION-win-x64.zip"
fi

# 解压 Node.js
echo ""
echo "[5/6] 解压 Node.js 运行时..."

# Linux
tar -xf "cache/node-v$NODE_VERSION-linux-x64.tar.xz" -C $LINUX_DIR
mv $LINUX_DIR/node-v$NODE_VERSION-linux-x64 $LINUX_DIR/node

# Windows
unzip -q "cache/node-v$NODE_VERSION-win-x64.zip" -d $WIN_DIR
mv $WIN_DIR/node-v$NODE_VERSION-win-x64 $WIN_DIR/node

# 创建启动脚本
echo ""
echo "[6/6] 创建启动脚本..."

# Linux 启动脚本
cat > $LINUX_DIR/start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/app"
export PORT=5000
export HOSTNAME="0.0.0.0"
../node/bin/node server.js
EOF
chmod +x $LINUX_DIR/start.sh

# Windows 启动脚本
cat > $WIN_DIR/start.bat << 'EOF'
@echo off
cd /d "%~dp0app"
set PORT=5000
set HOSTNAME=0.0.0.0
..\node\node.exe server.js
pause
EOF

# 创建环境变量配置文件
cat > $LINUX_DIR/.env.example << 'EOF'
# 数据库配置
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/drama_studio

# API 密钥
LLM_API_KEY=your-llm-api-key
IMAGE_API_KEY=your-image-api-key
VIDEO_API_KEY=your-video-api-key
EOF

cp $LINUX_DIR/.env.example $WIN_DIR/.env.example

# 创建说明文件
cat > $LINUX_DIR/README.md << EOF
# 短剧漫剧创作工坊 v$VERSION

## 快速开始

1. 复制 \`.env.example\` 为 \`.env\` 并配置环境变量
2. 运行启动脚本：
   \`\`\`bash
   ./start.sh
   \`\`\`
3. 打开浏览器访问 http://localhost:5000

## 系统要求

- Linux x64
- 内存：至少 2GB
- 磁盘：至少 1GB 可用空间

## 文件说明

- \`app/\` - 应用程序文件
- \`node/\` - Node.js 运行时
- \`start.sh\` - 启动脚本
- \`.env.example\` - 环境变量示例

## 注意事项

- 首次运行前请确保已配置数据库连接
- 默认端口为 5000，可在 .env 中修改
EOF

cp $LINUX_DIR/README.md $WIN_DIR/README.md

# 打包
echo ""
echo "========================================"
echo "打包压缩文件..."

cd $BUILD_DIR

# Linux 压缩包
tar -czf $PROJECT_NAME-linux-x64.tar.gz $PROJECT_NAME-linux-x64
echo "✓ Linux 版本: $PROJECT_NAME-linux-x64.tar.gz"

# Windows 压缩包
zip -rq $PROJECT_NAME-win-x64.zip $PROJECT_NAME-win-x64
echo "✓ Windows 版本: $PROJECT_NAME-win-x64.zip"

# 清理解压目录
rm -rf $PROJECT_NAME-linux-x64 $PROJECT_NAME-win-x64

cd ../..

echo ""
echo "========================================"
echo "打包完成！"
echo ""
echo "输出文件："
echo "  - dist/portable/$PROJECT_NAME-linux-x64.tar.gz"
echo "  - dist/portable/$PROJECT_NAME-win-x64.zip"
echo "========================================"
