#!/bin/bash

# 短剧漫剧创作工坊 - 完整打包脚本 (修复版 v2)
# 不复制 node_modules，在启动时安装

set -e

VERSION="1.0.0"
PROJECT_NAME="drama-studio"
SETUP_DIR="setup"
WORK_DIR="/workspace/projects"

echo "========================================"
echo "短剧漫剧创作工坊 - 完整打包工具"
echo "版本: $VERSION"
echo "========================================"

# 创建 setup 目录
echo ""
echo "[1/5] 创建 setup 目录..."
cd $WORK_DIR
rm -rf $SETUP_DIR
mkdir -p $SETUP_DIR

# 创建临时目录
TEMP_DIR="dist/package-final"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR/app

# 复制项目文件
echo ""
echo "[2/5] 复制项目文件..."
cp package.json $TEMP_DIR/app/
cp pnpm-lock.yaml $TEMP_DIR/app/
cp next.config.mjs $TEMP_DIR/app/
rm -f $TEMP_DIR/app/next.config.ts 2>/dev/null || true
cp tsconfig.json $TEMP_DIR/app/
cp .babelrc $TEMP_DIR/app/ 2>/dev/null || true
cp tailwind.config.ts $TEMP_DIR/app/ 2>/dev/null || true
cp postcss.config.mjs $TEMP_DIR/app/ 2>/dev/null || true

# 复制源代码
echo ""
echo "[3/5] 复制源代码..."
cp -r src $TEMP_DIR/app/
cp -r public $TEMP_DIR/app/
cp -r .cozeproj $TEMP_DIR/app/ 2>/dev/null || true
cp .coze $TEMP_DIR/app/ 2>/dev/null || true

# 复制构建产物 (standalone + static)
echo ""
echo "[4/5] 复制构建产物..."
mkdir -p $TEMP_DIR/app/.next
cp -r .next/static $TEMP_DIR/app/.next/
cp -r .next/server $TEMP_DIR/app/.next/
cp -r .next/standalone $TEMP_DIR/app/.next/
cp .next/BUILD_ID $TEMP_DIR/app/.next/
cp .next/package.json $TEMP_DIR/app/.next/
cp .next/required-server-files.json $TEMP_DIR/app/.next/

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

# 创建简化的 package.json (使用 npm)
cat > $TEMP_DIR/app/package.json << 'PKGEOF'
{
  "name": "drama-studio",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "next start --port 5000"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-aspect-ratio": "^1.1.8",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-context-menu": "^2.2.16",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-hover-card": "^1.1.15",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-menubar": "^1.1.16",
    "@radix-ui/react-navigation-menu": "^1.2.14",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@supabase/supabase-js": "2.95.3",
    "archiver": "^7.0.1",
    "axios": "^1.13.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "coze-coding-dev-sdk": "^0.7.17",
    "date-fns": "^4.1.0",
    "dotenv": "^17.2.3",
    "drizzle-orm": "^0.45.1",
    "embla-carousel-react": "^8.6.0",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.468.0",
    "next": "16.1.1",
    "next-themes": "^0.4.6",
    "pg": "^8.16.3",
    "react": "19.2.3",
    "react-day-picker": "^9.13.0",
    "react-dom": "19.2.3",
    "react-hook-form": "^7.70.0",
    "react-resizable-panels": "^4.2.0",
    "recharts": "2.15.4",
    "sonner": "^2.0.7",
    "tailwind-merge": "^2.6.0",
    "tw-animate-css": "^1.4.0",
    "vaul": "^1.1.2",
    "zod": "^4.3.5"
  }
}
PKGEOF

# Linux 启动脚本
cat > $TEMP_DIR/start.sh << 'EOF'
#!/bin/bash

echo "========================================"
echo "短剧漫剧创作工坊 v1.0.0"
echo "========================================"
echo

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js v20+"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "[信息] Node.js 版本:"
node --version
echo

cd "$(dirname "$0")/app"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "========================================"
    echo "[信息] 首次运行，正在安装依赖..."
    echo "这可能需要几分钟，请耐心等待..."
    echo "========================================"
    echo
    
    # 使用国内镜像加速
    npm config set registry https://registry.npmmirror.com
    
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo
        echo "[错误] 依赖安装失败！"
        echo "请检查网络连接后重试"
        exit 1
    fi
    
    echo
    echo "[信息] 依赖安装完成！"
    echo
fi

echo "========================================"
echo "[信息] 正在启动服务..."
echo "启动后请访问: http://localhost:5000"
echo "按 Ctrl+C 可停止服务"
echo "========================================"
echo

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "[警告] 未找到 .env 配置文件！"
    echo "请复制 .env.example 为 .env 并配置必要参数"
    echo
fi

export PORT=5000
export HOSTNAME="0.0.0.0"

npm start
EOF
chmod +x $TEMP_DIR/start.sh

# Windows 启动脚本 (纯英文避免编码问题)
cat > $TEMP_DIR/start.bat << 'EOF'
@echo off
title Drama Studio

echo ========================================
echo Drama Studio v1.0.0
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js v20+
    echo Download: https://nodejs.org/
    goto :end
)

echo [INFO] Node.js version:
node --version
echo.

cd /d "%~dp0app"

REM Check node_modules
if not exist "node_modules" (
    echo ========================================
    echo [INFO] Installing dependencies...
    echo Please wait a few minutes...
    echo ========================================
    echo.
    
    npm config set registry https://registry.npmmirror.com
    
    npm install --legacy-peer-deps
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to install dependencies!
        echo Please check your network and try again.
        goto :end
    )
    
    echo.
    echo [INFO] Dependencies installed!
    echo.
)

echo ========================================
echo [INFO] Starting server...
echo Visit: http://localhost:5000
echo Press Ctrl+C to stop
echo ========================================
echo.

REM Check .env file
if not exist ".env" (
    echo [WARNING] .env file not found!
    echo Please copy .env.example to .env and configure it.
    echo.
)

set PORT=5000
set HOSTNAME=0.0.0.0

npm start

:end
echo.
echo ========================================
echo Press any key to exit...
echo ========================================
pause >nul
EOF

# 环境检查脚本 (Windows, 纯英文)
cat > $TEMP_DIR/check.bat << 'EOF'
@echo off
title Environment Check

echo ========================================
echo Drama Studio - Environment Check
echo ========================================
echo.

echo [1] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo     [X] Node.js not installed
    echo     Download from https://nodejs.org/
) else (
    echo     [OK] Node.js installed
    node --version
)
echo.

echo [2] Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo     [X] npm not installed
) else (
    echo     [OK] npm installed
    npm --version
)
echo.

echo [3] Checking project files...
if exist "app\package.json" (
    echo     [OK] package.json exists
) else (
    echo     [X] package.json NOT found
)

if exist "app\.next" (
    echo     [OK] .next directory exists
) else (
    echo     [X] .next directory NOT found
)

if exist "app\node_modules" (
    echo     [OK] node_modules installed
) else (
    echo     [!] node_modules not installed (will auto-install on first run)
)
echo.

echo [4] Checking config file...
if exist "app\.env" (
    echo     [OK] .env config file exists
) else (
    echo     [!] .env config file NOT found
    echo     Please copy app\.env.example to app\.env
)
echo.

echo ========================================
echo Check completed
echo ========================================
echo.
pause
EOF

# 说明文件
cat > $TEMP_DIR/README.md << 'EOF'
# 短剧漫剧创作工坊 v1.0.0

## 🚀 快速开始

### 系统要求
- **Node.js v20+** (必须，推荐 v22+)
- 内存：至少 4GB
- 磁盘：至少 2GB 可用空间

### 使用方法

#### Windows:
```
1. 解压安装包
2. 配置 app/.env 文件（复制 app/.env.example 并修改）
3. 双击运行 start.bat
4. 首次运行会自动安装依赖（需要几分钟）
5. 安装完成后访问 http://localhost:5000
```

#### Linux:
```bash
1. 解压安装包
2. 配置 app/.env 文件
3. 运行 ./start.sh
4. 首次运行会自动安装依赖
5. 访问 http://localhost:5000
```

### 配置环境变量

编辑 `app/.env` 文件，填入必要的配置：

```env
# 数据库连接（必须配置）
DATABASE_URL=postgresql://用户名:密码@主机:端口/数据库名

# API 密钥（必须配置，从对应平台获取）
LLM_API_KEY=your-llm-api-key
IMAGE_API_KEY=your-image-api-key
VIDEO_API_KEY=your-video-api-key

# 对象存储（用于存储生成的图片和视频）
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=drama-studio
```

---

## 📋 功能介绍

- 📝 **文本解析**：支持小说、脚本内容输入
- 🎭 **角色管理**：创建和管理故事人物
- 🎬 **分镜生成**：AI 自动生成分镜脚本
- 🖼️ **图像生成**：为每个分镜生成高质量图片
- 🎥 **视频合成**：将分镜图片转换为动态视频
- 🔊 **语音配音**：为角色配置独特的语音风格

---

## ❓ 常见问题

### Q: 首次启动很慢？
A: 首次运行需要安装依赖，大约需要 3-5 分钟，请耐心等待

### Q: 启动报错 "Cannot find module"
A: 
1. 确保使用 Node.js v20+ 版本
2. 删除 app/node_modules 目录后重新运行 start.bat/start.sh

### Q: 启动报错 "EADDRINUSE"
A: 端口 5000 已被占用，请关闭占用该端口的程序

### Q: 依赖安装失败
A: 
1. 检查网络连接
2. 尝试使用国内镜像：npm config set registry https://registry.npmmirror.com

### Q: 数据库连接失败
A: 确保 PostgreSQL 服务已启动，检查 DATABASE_URL 配置

### Q: API 调用失败
A: 检查 .env 中的 API 密钥配置是否正确

---

## 📞 技术支持

如有其他问题，请联系技术支持。
EOF

# 打包
echo ""
echo "[5/5] 打包安装文件..."

# Linux
echo "  打包 Linux 版本..."
cd $TEMP_DIR
tar -czf $WORK_DIR/$SETUP_DIR/$PROJECT_NAME-linux-x64.tar.gz *
cd $WORK_DIR
echo "✓ Linux 版本完成"

# Windows
echo "  打包 Windows 版本..."
cd $TEMP_DIR
zip -rq $WORK_DIR/$SETUP_DIR/$PROJECT_NAME-win-x64.zip *
cd $WORK_DIR
echo "✓ Windows 版本完成"

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
echo "  1. 解压安装包"
echo "  2. 配置 app/.env 文件"
echo "  3. 运行 start.bat (Windows) 或 ./start.sh (Linux)"
echo "  4. 首次运行会自动安装依赖"
echo "  5. 访问 http://localhost:5000"
echo "========================================"
