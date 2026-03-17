#!/bin/bash

# 短剧漫剧创作工坊 - 一键打包脚本 (修复版)
# 生成 Windows 和 Linux 安装包

set -e

VERSION="1.0.0"
PROJECT_NAME="drama-studio"
SETUP_DIR="setup"
WORK_DIR="/workspace/projects"

echo "========================================"
echo "短剧漫剧创作工坊 - 安装包打包工具"
echo "版本: $VERSION"
echo "========================================"

# 创建 setup 目录
echo ""
echo "[1/6] 创建 setup 目录..."
cd $WORK_DIR
rm -rf $SETUP_DIR
mkdir -p $SETUP_DIR

# 确保构建完成
echo ""
echo "[2/6] 检查构建产物..."
if [ ! -d ".next/standalone" ]; then
    echo "构建产物不存在，开始构建..."
    npx next build
fi

# 准备打包文件
echo ""
echo "[3/6] 准备打包文件..."

# 创建临时目录
TEMP_DIR="dist/package-temp"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR/app

# 复制 server.js 和必要文件
cp .next/standalone/workspace/projects/server.js $TEMP_DIR/app/
cp .next/standalone/workspace/projects/package.json $TEMP_DIR/app/

# 复制 .next 目录
mkdir -p $TEMP_DIR/app/.next
cp -r .next/standalone/workspace/projects/.next/standalone $TEMP_DIR/app/.next/
cp -r .next/static $TEMP_DIR/app/.next/

# 复制 public 目录
cp -r public $TEMP_DIR/app/

# 创建完整的 node_modules (解析符号链接)
echo ""
echo "[4/6] 复制 node_modules (解析符号链接)..."
mkdir -p $TEMP_DIR/app/node_modules

# 复制 pnpm 结构并解析符号链接
cd .next/standalone/workspace/projects/node_modules
for item in */; do
    if [[ -L "$item" ]]; then
        # 符号链接，复制实际内容
        target=$(readlink -f "$item")
        cp -r "$target" "$WORK_DIR/$TEMP_DIR/app/node_modules/$item"
    else
        # 普通目录，直接复制
        cp -r "$item" "$WORK_DIR/$TEMP_DIR/app/node_modules/"
    fi
done

# 复制 .pnpm 目录中的实际依赖
if [ -d ".pnpm" ]; then
    mkdir -p $WORK_DIR/$TEMP_DIR/app/node_modules/.pnpm
    cp -r .pnpm/* $WORK_DIR/$TEMP_DIR/app/node_modules/.pnpm/
fi

cd $WORK_DIR

# 创建环境变量模板
cat > $TEMP_DIR/app/.env.example << 'EOF'
# 数据库配置
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/drama_studio

# Supabase 配置（如果使用）
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API 密钥
LLM_API_KEY=your-llm-api-key
IMAGE_API_KEY=your-image-api-key
VIDEO_API_KEY=your-video-api-key

# 对象存储配置
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=drama-studio
EOF

# Linux 启动脚本
cat > $TEMP_DIR/start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/app"
export PORT=5000
export HOSTNAME="0.0.0.0"
node server.js
EOF
chmod +x $TEMP_DIR/start.sh

# Windows 启动脚本
cat > $TEMP_DIR/start.bat << 'EOF'
@echo off
cd /d "%~dp0app"
set PORT=5000
set HOSTNAME=0.0.0.0
node server.js
pause
EOF

# 说明文件
cat > $TEMP_DIR/README.md << EOF
# 短剧漫剧创作工坊 v$VERSION

## 快速开始

### 系统要求
- Node.js v20+ (需要自行安装)
- 内存：至少 2GB
- 磁盘：至少 1GB 可用空间

### 使用方法

#### Linux
\`\`\`bash
# 配置环境变量
cp app/.env.example app/.env
nano app/.env

# 启动应用
./start.sh
\`\`\`

#### Windows
\`\`\`powershell
# 配置环境变量
copy app\\.env.example app\\.env
notepad app\\.env

# 启动应用
start.bat
\`\`\`

### 访问应用
启动后打开浏览器访问: http://localhost:5000

### 注意事项
1. 首次运行前请确保已安装 Node.js v20+
2. 请配置正确的数据库连接和 API 密钥
3. 默认端口为 5000，可在 .env 中修改
4. 如果遇到数据库连接问题，请确保 PostgreSQL 已启动

## 功能介绍
- 📝 文本解析：支持小说、脚本内容输入
- 🎭 角色管理：创建和管理故事人物
- 🎬 分镜生成：AI 自动生成分镜脚本
- 🖼️ 图像生成：为每个分镜生成高质量图片
- 🎥 视频合成：将分镜图片转换为动态视频
- 🔊 语音配音：为角色配置独特的语音风格

## 常见问题

### Q: 启动报错 "Cannot find module"
A: 请确保使用 Node.js v20+ 版本，并检查 node_modules 目录是否完整

### Q: 数据库连接失败
A: 请检查 .env 中的 DATABASE_URL 配置，确保 PostgreSQL 服务已启动

### Q: API 调用失败
A: 请检查 .env 中的 API 密钥配置是否正确

## 技术支持
如有问题，请查看日志或联系技术支持。
EOF

# 打包 Linux 版本
echo ""
echo "[5/6] 打包 Linux 版本..."
cd $TEMP_DIR
tar -czf $WORK_DIR/$SETUP_DIR/$PROJECT_NAME-linux-x64.tar.gz *
cd $WORK_DIR
echo "✓ Linux 版本打包完成"

# 打包 Windows 版本
echo ""
echo "[6/6] 打包 Windows 版本..."
cd $TEMP_DIR
zip -rq $WORK_DIR/$SETUP_DIR/$PROJECT_NAME-win-x64.zip *
cd $WORK_DIR
echo "✓ Windows 版本打包完成"

# 清理
rm -rf $TEMP_DIR

# 显示结果
echo ""
echo "========================================"
echo "打包完成！"
echo ""
echo "安装包位置："
ls -lh $SETUP_DIR/
echo ""
echo "使用说明："
echo "  1. Linux: 解压 $PROJECT_NAME-linux-x64.tar.gz"
echo "  2. Windows: 解压 $PROJECT_NAME-win-x64.zip"
echo "  3. 安装 Node.js v20+"
echo "  4. 配置 app/.env 文件"
echo "  5. 运行启动脚本"
echo "========================================"
