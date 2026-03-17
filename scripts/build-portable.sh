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

# 函数: 解析 pnpm 符号链接，复制实际文件
function resolve_pnpm_symlinks() {
    local TARGET_DIR="$1"
    local NM_DIR="$TARGET_DIR/node_modules"
    local PNPM_DIR="$NM_DIR/.pnpm"
    
    if [ ! -d "$PNPM_DIR" ]; then
        echo "  No .pnpm directory found, skipping..."
        return
    fi
    
    echo "  Resolving pnpm symlinks..."
    
    # 1. 处理顶层符号链接
    pushd "$NM_DIR" > /dev/null
    for item in *; do
        [ "$item" = ".pnpm" ] && continue
        [ -L "$item" ] || continue
        
        local link_target=$(readlink "$item")
        
        if [[ "$link_target" == .pnpm/* ]]; then
            local real_path=".pnpm/${link_target#.pnpm/}"
            if [ -d "$real_path" ]; then
                echo "    Replacing symlink: $item"
                rm -f "$item"
                cp -r "$real_path" "$item"
            fi
        fi
    done
    popd > /dev/null
    
    # 2. 处理 @scope 目录中的符号链接
    pushd "$NM_DIR" > /dev/null
    for scope_dir in @*; do
        [ -d "$scope_dir" ] || continue
        [ "$scope_dir" = ".pnpm" ] && continue
        
        pushd "$scope_dir" > /dev/null
        for sub_item in *; do
            [ -L "$sub_item" ] || continue
            
            local sub_link_target=$(readlink "$sub_item")
            local real_path=""
            
            if [[ "$sub_link_target" == ../../.pnpm/* ]]; then
                real_path="../.pnpm/${sub_link_target#../../.pnpm/}"
            elif [[ "$sub_link_target" == ../.pnpm/* ]]; then
                real_path="../.pnpm/${sub_link_target#../.pnpm/}"
            fi
            
            if [ -n "$real_path" ] && [ -d "$real_path" ]; then
                echo "    Replacing symlink: $scope_dir/$sub_item"
                rm -f "$sub_item"
                cp -r "$real_path" "$sub_item"
            fi
        done
        popd > /dev/null
    done
    popd > /dev/null
    
    # 3. 扫描 .pnpm 目录，复制所有缺失的包
    echo "  Scanning for missing packages..."
    
    for pnpm_pkg in "$PNPM_DIR"/*; do
        [ -d "$pnpm_pkg" ] || continue
        
        local pkg_basename=$(basename "$pnpm_pkg")
        
        # 处理 @scope/name 格式的包
        if [[ "$pkg_basename" == @* ]]; then
            # 解析包名: @next+env@16.1.1 -> @next/env
            local scope_name="${pkg_basename%%+*}"  # @next
            local pkg_tail="${pkg_basename#*+}"      # env@16.1.1
            local pkg_name="${pkg_tail%@*}"          # env
            
            local target_dir="$NM_DIR/$scope_name/$pkg_name"
            local src_dir="$pnpm_pkg/node_modules/$scope_name/$pkg_name"
            
            if [ -d "$src_dir" ] && [ ! -d "$target_dir" ]; then
                echo "    Creating: $scope_name/$pkg_name"
                mkdir -p "$NM_DIR/$scope_name"
                cp -r "$src_dir" "$target_dir"
            fi
        else
            # 处理普通包: styled-jsx@5.1.6 -> styled-jsx
            local pkg_name="${pkg_basename%%@*}"
            
            local target_dir="$NM_DIR/$pkg_name"
            local src_dir="$pnpm_pkg/node_modules/$pkg_name"
            
            # 跳过已存在的目录（包括符号链接已解析的）
            if [ -d "$src_dir" ] && [ ! -d "$target_dir" ] && [ ! -L "$target_dir" ]; then
                echo "    Creating: $pkg_name"
                cp -r "$src_dir" "$target_dir"
            fi
        fi
    done
    
    echo "  Done resolving symlinks"
}

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

if [ -d ".next/standalone/workspace/projects" ]; then
    cp -r .next/standalone/workspace/projects/. $LINUX_DIR/app/
else
    cp -r .next/standalone/. $LINUX_DIR/app/
fi
# 复制静态文件到 .next 目录（合并，不是覆盖）
mkdir -p $LINUX_DIR/app/.next/static
cp -r .next/static/. $LINUX_DIR/app/.next/static/
cp -r public $LINUX_DIR/app/

echo "  Processing Linux package..."
resolve_pnpm_symlinks "$LINUX_DIR/app"

# Windows 版本
WIN_DIR="$BUILD_DIR/$PROJECT_NAME-win-x64"
mkdir -p $WIN_DIR/app

if [ -d ".next/standalone/workspace/projects" ]; then
    cp -r .next/standalone/workspace/projects/. $WIN_DIR/app/
else
    cp -r .next/standalone/. $WIN_DIR/app/
fi
# 复制静态文件到 .next 目录（合并，不是覆盖）
mkdir -p $WIN_DIR/app/.next/static
cp -r .next/static/. $WIN_DIR/app/.next/static/
cp -r public $WIN_DIR/app/

echo "  Processing Windows package..."
resolve_pnpm_symlinks "$WIN_DIR/app"

# 下载 Node.js 便携版
echo ""
echo "[4/6] 下载 Node.js 运行时..."

mkdir -p cache

if [ ! -f "cache/node-v$NODE_VERSION-linux-x64.tar.xz" ]; then
    echo "下载 Node.js for Linux..."
    wget -q "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
        -O "cache/node-v$NODE_VERSION-linux-x64.tar.xz"
fi

if [ ! -f "cache/node-v$NODE_VERSION-win-x64.zip" ]; then
    echo "下载 Node.js for Windows..."
    wget -q "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-win-x64.zip" \
        -O "cache/node-v$NODE_VERSION-win-x64.zip"
fi

# 解压 Node.js
echo ""
echo "[5/6] 解压 Node.js 运行时..."

tar -xf "cache/node-v$NODE_VERSION-linux-x64.tar.xz" -C $LINUX_DIR
mv $LINUX_DIR/node-v$NODE_VERSION-linux-x64 $LINUX_DIR/node

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

if [ -f ".env" ]; then
    echo "正在加载 .env 文件..."
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        export "$key=$value"
        echo "已设置: $key"
    done < <(grep -v '^#' .env | grep -v '^$')
else
    echo "警告: 未找到 .env 文件，请复制 .env.example 为 .env 并配置"
fi

export PORT=${PORT:-5000}
export HOSTNAME="0.0.0.0"

echo ""
echo "当前环境变量:"
echo "  DATABASE_TYPE=${DATABASE_TYPE:-未设置}"
[ "$DATABASE_TYPE" = "mysql" ] && echo "  DATABASE_URL=${DATABASE_URL:-未设置}"
echo "  PORT=$PORT"
echo ""

if [ "$DATABASE_TYPE" = "mysql" ] && [ -z "$DATABASE_URL" ]; then
    echo "错误: 未配置 DATABASE_URL"
    exit 1
fi

echo "========================================"
echo "启动服务器，端口: $PORT"
echo "========================================"
echo ""

cd app
../node/bin/node server.js
EOF
chmod +x $LINUX_DIR/start.sh

cp scripts/start.bat $WIN_DIR/start.bat

cat > $LINUX_DIR/.env.example << 'EOF'
# 短剧漫剧创作工坊 - 桌面应用环境变量配置
# 复制此文件为 .env 并填入实际值

# ==================== 数据库配置 ====================
# 数据库类型：mysql 或 postgresql
DATABASE_TYPE=mysql

# ===== 本地 MySQL 配置（推荐用于本地开发）=====
DATABASE_URL=mysql://root:password@localhost:3306/drama_studio

# ===== Supabase 云服务配置 =====
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...

# ==================== 对象存储配置 ====================
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=drama-studio
S3_REGION=us-east-1

# ==================== LLM API 配置 ====================
# MiniMax 2.5 API（Anthropic 兼容格式）
# 获取地址: https://www.minimaxi.com
LLM_API_KEY=your-minimax-api-key
LLM_BASE_URL=https://api.minimaxi.com/anthropic
LLM_MODEL=MiniMax-Text-01

# ==================== 图像生成 API 配置 ====================
IMAGE_API_KEY=your-image-api-key
IMAGE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# ==================== 视频生成 API 配置 ====================
VIDEO_API_KEY=your-video-api-key
VIDEO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VIDEO_MODEL=doubao-seedance-1-5-pro-251215
EOF

cp $LINUX_DIR/.env.example $WIN_DIR/.env.example

# 创建预配置的 .env 文件（包含用户的 MiniMax API Key）
cat > $WIN_DIR/.env << 'ENVEOF'
# 短剧漫剧创作工坊 - 已配置 MiniMax 2.5 API
# 数据库配置
DATABASE_TYPE=mysql
DATABASE_URL=mysql://root:password@localhost:3306/drama_studio

# 对象存储配置
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=drama-studio
S3_REGION=us-east-1

# LLM API 配置 - MiniMax 2.5
LLM_API_KEY=sk-cp-mHX1Q4XAXPS_IBiK_0WwAWTx8a1HwJS7eeOU0fm96zs-Y3IDSvnBx__NIZxgwy3xK7WMdjxj4_2natt_XTyN-pAguwxoy4B5dhU9x4tzWPqqsRCsAGK8gcQ
LLM_BASE_URL=https://api.minimaxi.com/anthropic
LLM_MODEL=MiniMax-Text-01

# 图像生成 API 配置（需要配置）
IMAGE_API_KEY=your-image-api-key
IMAGE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 视频生成 API 配置（需要配置）
VIDEO_API_KEY=your-video-api-key
VIDEO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VIDEO_MODEL=doubao-seedance-1-5-pro-251215
ENVEOF

# 压缩
echo ""
echo "正在压缩..."
cd $BUILD_DIR
tar -czf $PROJECT_NAME-linux-x64.tar.gz $PROJECT_NAME-linux-x64
zip -rq $PROJECT_NAME-win-x64.zip $PROJECT_NAME-win-x64
cd -

echo ""
echo "========================================"
echo "打包完成！"
echo "========================================"
echo ""
ls -lh $BUILD_DIR/*.tar.gz $BUILD_DIR/*.zip
