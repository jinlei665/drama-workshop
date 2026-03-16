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

# 复制构建产物（standalone 输出在 workspace/projects 子目录下）
if [ -d ".next/standalone/workspace/projects" ]; then
    cp -r .next/standalone/workspace/projects/* $LINUX_DIR/app/
else
    cp -r .next/standalone/* $LINUX_DIR/app/
fi
cp -r .next/static $LINUX_DIR/app/.next/
cp -r public $LINUX_DIR/app/

# Windows 版本
WIN_DIR="$BUILD_DIR/$PROJECT_NAME-win-x64"
mkdir -p $WIN_DIR/app

# 复制构建产物（standalone 输出在 workspace/projects 子目录下）
if [ -d ".next/standalone/workspace/projects" ]; then
    cp -r .next/standalone/workspace/projects/* $WIN_DIR/app/
else
    cp -r .next/standalone/* $WIN_DIR/app/
fi
cp -r .next/static $WIN_DIR/app/.next/
cp -r public $WIN_DIR/app/

# 下载 Node.js 便携版
echo ""
echo "[4/6] 下载 Node.js 运行时..."

mkdir -p cache

# Linux Node.js
if [ ! -f "cache/node-v$NODE_VERSION-linux-x64.tar.xz" ]; then
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
cd "$(dirname "$0")"

echo "========================================"
echo "短剧漫剧创作工坊 - 启动中..."
echo "========================================"

# 加载 .env 文件
if [ -f ".env" ]; then
    echo "正在加载 .env 文件..."
    while IFS='=' read -r key value; do
        # 跳过注释和空行
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        
        # 设置环境变量
        export "$key=$value"
        echo "已设置: $key"
    done < <(grep -v '^#' .env | grep -v '^$')
else
    echo "警告: 未找到 .env 文件，请复制 .env.example 为 .env 并配置"
fi

# 设置默认值
export PORT=${PORT:-5000}
export HOSTNAME="0.0.0.0"

echo ""
echo "当前环境变量:"
echo "  DATABASE_TYPE=${DATABASE_TYPE:-未设置}"
if [ "$DATABASE_TYPE" = "mysql" ]; then
    echo "  DATABASE_URL=${DATABASE_URL:-未设置}"
else
    echo "  NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-未设置}"
fi
echo "  PORT=$PORT"
echo ""

# 检查数据库配置
if [ "$DATABASE_TYPE" = "mysql" ]; then
    if [ -z "$DATABASE_URL" ]; then
        echo "错误: 未配置 DATABASE_URL"
        echo "请在 .env 文件中设置 DATABASE_URL=mysql://user:password@host:port/database"
        exit 1
    fi
else
    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -z "$COZE_SUPABASE_URL" ]; then
        echo "错误: 未配置数据库"
        echo "请在 .env 文件中设置:"
        echo "  - DATABASE_TYPE=mysql 和 DATABASE_URL (本地 MySQL)"
        echo "  或"
        echo "  - NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase)"
        exit 1
    fi
fi

echo "========================================"
echo "启动服务器，端口: $PORT"
echo "========================================"
echo ""

cd app
../node/bin/node server.js
EOF
chmod +x $LINUX_DIR/start.sh

# Windows 启动脚本
cp scripts/start.bat $WIN_DIR/start.bat

# 创建环境变量配置文件
cat > $LINUX_DIR/.env.example << 'EOF'
# ==================== 数据库配置 ====================
# 选择一种数据库方式：

# 方式1: 本地 MySQL（推荐用于本地开发）
DATABASE_TYPE=mysql
DATABASE_URL=mysql://root:password@localhost:3306/drama_studio

# 方式2: Supabase 云服务（推荐用于生产环境）
# DATABASE_TYPE=supabase
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...

# ==================== 对象存储配置 ====================
# 本地 MinIO 存储
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio
S3_REGION=us-east-1

# ==================== LLM API 配置 ====================
# 豆包/字节跳动大模型 API
# 获取地址: https://console.volcengine.com/ark
LLM_API_KEY=your-llm-api-key
LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# ==================== 图像生成 API 配置 ====================
IMAGE_API_KEY=your-image-api-key
IMAGE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# ==================== 视频生成 API 配置 ====================
VIDEO_API_KEY=your-video-api-key
VIDEO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# ==================== 其他配置 ====================
PORT=5000
EOF

cp $LINUX_DIR/.env.example $WIN_DIR/.env.example

# 创建说明文件
cat > $LINUX_DIR/README.md << 'EOF'
# 短剧漫剧创作工坊

将文字故事转化为精美短剧视频的 AI 创作工具。

## 快速开始

### 1. 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，填入以下配置：
# - Supabase 数据库 URL 和密钥（推荐）
# - LLM API 密钥（豆包/字节跳动）
# - 图像生成 API 密钥
# - 视频生成 API 密钥
```

### 2. 启动应用

```bash
./start.sh
```

### 3. 访问应用

打开浏览器访问 http://localhost:5000

## 获取 API 密钥

### Supabase（数据库）

1. 访问 https://supabase.com 注册账号
2. 创建新项目
3. 在项目设置中获取 URL 和 anon key

### 豆包/字节跳动（AI 服务）

1. 访问 https://console.volcengine.com/ark
2. 创建推理接入点
3. 获取 API Key

## 系统要求

- Linux x64
- 内存：至少 4GB
- 磁盘：至少 2GB 可用空间

## 故障排除

### 端口被占用

修改 .env 文件中的 PORT 值。

### 数据库连接失败

1. 确认 Supabase 项目已启动
2. 检查 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 是否正确

### 页面无法访问

1. 等待几秒钟让服务完全启动
2. 检查控制台是否有错误信息

## 技术支持

- GitHub: https://github.com/jinlei665/drama-workshop
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
echo ""
echo "使用说明："
echo "  1. 解压对应的压缩包"
echo "  2. 复制 .env.example 为 .env 并配置"
echo "  3. 运行 start.sh (Linux) 或 start.bat (Windows)"
echo "========================================"
