#!/bin/bash

# 短剧漫剧创作工坊 - 一键打包脚本
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
echo "[1/5] 创建 setup 目录..."
cd $WORK_DIR
rm -rf $SETUP_DIR
mkdir -p $SETUP_DIR

# 确保构建完成
echo ""
echo "[2/5] 检查构建产物..."
if [ ! -d ".next/standalone" ]; then
    echo "构建产物不存在，开始构建..."
    npx next build
fi

# 准备打包文件
echo ""
echo "[3/5] 准备打包文件..."

# 创建临时目录
TEMP_DIR="dist/package-temp"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR/app

# 复制文件
cp -r .next/standalone/workspace/projects/* $TEMP_DIR/app/ 2>/dev/null || true
if [ ! -f "$TEMP_DIR/app/server.js" ]; then
    # 直接复制 standalone 内容
    cp -r .next/standalone/* $TEMP_DIR/app/
fi

cp -r .next/static $TEMP_DIR/app/.next/ 2>/dev/null || true
cp -r public $TEMP_DIR/app/ 2>/dev/null || true

# 创建环境变量模板
cat > $TEMP_DIR/app/.env.example << 'EOF'
# 数据库配置
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/drama_studio

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
- 磁盘：至少 500MB 可用空间

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
1. 首次运行前请确保已安装 Node.js
2. 请配置正确的数据库连接和 API 密钥
3. 默认端口为 5000，可在 .env 中修改

## 功能介绍
- 📝 文本解析：支持小说、脚本内容输入
- 🎭 角色管理：创建和管理故事人物
- 🎬 分镜生成：AI 自动生成分镜脚本
- 🖼️ 图像生成：为每个分镜生成高质量图片
- 🎥 视频合成：将分镜图片转换为动态视频
- 🔊 语音配音：为角色配置独特的语音风格

## 技术支持
如有问题，请查看日志文件或联系技术支持。
EOF

# 打包 Linux 版本
echo ""
echo "[4/5] 打包 Linux 版本..."
cd $TEMP_DIR
tar -czf $WORK_DIR/$SETUP_DIR/$PROJECT_NAME-linux-x64.tar.gz *
cd $WORK_DIR
echo "✓ Linux 版本打包完成"

# 打包 Windows 版本
echo ""
echo "[5/5] 打包 Windows 版本..."
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
echo "  4. 配置 .env 文件"
echo "  5. 运行启动脚本"
echo "========================================"
