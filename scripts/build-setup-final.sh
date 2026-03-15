#!/bin/bash

# 短剧漫剧创作工坊 - 完整打包脚本 (最终版)
# 解析所有符号链接，确保 Windows 兼容

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
echo "[1/7] 创建 setup 目录..."
cd $WORK_DIR
rm -rf $SETUP_DIR
mkdir -p $SETUP_DIR

# 创建临时目录
TEMP_DIR="dist/package-full"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR/app

# 复制项目文件
echo ""
echo "[2/7] 复制项目文件..."
cp package.json $TEMP_DIR/app/
cp pnpm-lock.yaml $TEMP_DIR/app/
cp next.config.ts $TEMP_DIR/app/
cp tsconfig.json $TEMP_DIR/app/
cp .babelrc $TEMP_DIR/app/ 2>/dev/null || true
cp tailwind.config.ts $TEMP_DIR/app/ 2>/dev/null || true
cp postcss.config.mjs $TEMP_DIR/app/ 2>/dev/null || true

# 复制源代码
echo ""
echo "[3/7] 复制源代码..."
cp -r src $TEMP_DIR/app/
cp -r public $TEMP_DIR/app/
cp -r .cozeproj $TEMP_DIR/app/ 2>/dev/null || true
cp .coze $TEMP_DIR/app/ 2>/dev/null || true

# 复制构建产物
echo ""
echo "[4/7] 复制构建产物..."
cp -r .next $TEMP_DIR/app/

# 创建 node_modules 并解析符号链接
echo ""
echo "[5/7] 复制依赖并解析符号链接..."
mkdir -p $TEMP_DIR/app/node_modules

# 使用 tar 来解析符号链接并复制
echo "  正在复制 node_modules (这可能需要几分钟)..."
(cd node_modules && tar cf - .) | (cd $TEMP_DIR/app/node_modules && tar xf - --dereference)

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
node node_modules/next/dist/bin/next start
EOF
chmod +x $TEMP_DIR/start.sh

# Windows 启动脚本
cat > $TEMP_DIR/start.bat << 'EOF'
@echo off
cd /d "%~dp0app"
set PORT=5000
set HOSTNAME=0.0.0.0
node node_modules\next\dist\bin\next start
pause
EOF

# 安装依赖脚本 (Windows)
cat > $TEMP_DIR/install.bat << 'EOF'
@echo off
cd /d "%~dp0app"
echo 正在安装依赖...
npm install --legacy-peer-deps
echo 安装完成！
pause
EOF

# 安装依赖脚本 (Linux)
cat > $TEMP_DIR/install.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/app"
echo "正在安装依赖..."
npm install --legacy-peer-deps
echo "安装完成！"
EOF
chmod +x $TEMP_DIR/install.sh

# 说明文件
cat > $TEMP_DIR/README.md << 'EOF'
# 短剧漫剧创作工坊 v1.0.0

## 🚀 快速开始

### 系统要求
- Node.js v20+ (必须)
- 内存：至少 4GB
- 磁盘：至少 2GB 可用空间

### 使用方法

#### Windows:
```
1. 解压安装包
2. 配置 app/.env 文件（复制 app/.env.example 并修改）
3. 双击运行 start.bat
```

#### Linux:
```bash
1. 解压安装包
2. 配置 app/.env 文件
3. 运行 ./start.sh
```

### 配置环境变量

编辑 `app/.env` 文件，填入必要的配置：

```env
# 数据库连接
DATABASE_URL=postgresql://用户名:密码@主机:端口/数据库名

# API 密钥（从对应平台获取）
LLM_API_KEY=your-llm-api-key
IMAGE_API_KEY=your-image-api-key
VIDEO_API_KEY=your-video-api-key

# 对象存储（用于存储生成的图片和视频）
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=drama-studio
```

### 访问应用
启动后打开浏览器访问: **http://localhost:5000**

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

### Q: 启动报错 "Cannot find module"
A: 
1. 确保使用 Node.js v20+ 版本
2. 尝试运行 `install.bat`（Windows）或 `./install.sh`（Linux）重新安装依赖

### Q: 启动报错 "EADDRINUSE"
A: 端口被占用，修改 start.bat/start.sh 中的 PORT 变量

### Q: 数据库连接失败
A: 确保 PostgreSQL 服务已启动，检查 DATABASE_URL 配置

### Q: API 调用失败
A: 检查 .env 中的 API 密钥配置是否正确

---

## 📞 技术支持

如有其他问题，请联系技术支持。
EOF

# 打包 Linux 版本
echo ""
echo "[6/7] 打包 Linux 版本..."
cd $TEMP_DIR
tar -czf $WORK_DIR/$SETUP_DIR/$PROJECT_NAME-linux-x64.tar.gz *
cd $WORK_DIR
echo "✓ Linux 版本打包完成"

# 打包 Windows 版本
echo ""
echo "[7/7] 打包 Windows 版本..."
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
echo "  1. 解压安装包"
echo "  2. 配置 app/.env 文件"
echo "  3. Windows: 运行 start.bat"
echo "     Linux:   运行 ./start.sh"
echo "========================================"
