# Ubuntu 24.04 部署攻略

## 系统环境

本项目当前沙箱环境：
- **操作系统**: Ubuntu 24.04.4 LTS (Noble Numbat)
- **Node.js**: v24.13.1
- **FFmpeg**: 6.1.1-3ubuntu5
- **包管理器**: pnpm

---

## 一、环境准备

### 1.1 安装 Node.js (v20+)

```bash
# 方法一：使用 NodeSource 仓库（推荐）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 方法二：使用 nvm 安装（支持多版本管理）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 验证安装
node -v  # 应显示 v20.x.x 或更高
npm -v
```

### 1.2 安装 pnpm

```bash
# 使用 corepack（Node.js 内置）
corepack enable
corepack prepare pnpm@latest --activate

# 或使用 npm 全局安装
npm install -g pnpm

# 验证安装
pnpm -v
```

### 1.3 安装 FFmpeg

```bash
# Ubuntu 24.04 默认仓库已包含 FFmpeg 6.x
sudo apt update
sudo apt install -y ffmpeg

# 验证安装
ffmpeg -version
ffprobe -version

# 查看安装路径
which ffmpeg   # 通常是 /usr/bin/ffmpeg
which ffprobe  # 通常是 /usr/bin/ffprobe
```

### 1.4 安装 Git

```bash
sudo apt install -y git

# 配置 Git（可选）
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

---

## 二、数据库配置（可选）

### 2.1 方案一：MySQL 本地安装

```bash
# 安装 MySQL Server
sudo apt install -y mysql-server

# 启动服务
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置
sudo mysql_secure_installation

# 创建数据库和用户
sudo mysql -u root -p
```

```sql
CREATE DATABASE short_drama_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'drama_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON short_drama_db.* TO 'drama_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2.2 方案二：使用 Supabase 云服务

1. 访问 [Supabase](https://supabase.com) 注册账号
2. 创建新项目
3. 获取连接信息：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2.3 方案三：不使用数据库（内存模式）

项目支持无数据库运行，数据存储在内存中（重启后丢失）。

---

## 三、AI 服务配置（重要）

### 3.1 使用 Coze API（推荐）

项目内置豆包系列 AI 模型，自部署时需要配置 Coze API Key。

#### 获取 Coze API Key

1. 访问 [Coze 平台](https://www.coze.cn) 并登录
2. 点击右上角头像 →「个人设置」
3. 左侧菜单选择「API 访问令牌」
4. 点击「创建令牌」，选择权限后生成
5. 复制生成的 Token（以 `pat-` 开头）

#### 配置方式

**方式一：在应用设置中配置（推荐）**

启动应用后，进入「设置」→「API」标签页，填入 API Key 保存即可。

**方式二：环境变量配置**

```env
# .env.local
COZE_API_KEY=pat-xxxxxxxxxxxxx
COZE_BASE_URL=https://api.coze.com
```

### 3.2 可用的 AI 模型

配置 Coze API 后可使用：

| 功能 | 模型 | 说明 |
|------|------|------|
| LLM | Doubao Seed 2.0 Pro | 复杂推理、多模态 |
| LLM | DeepSeek V3.2 | 高级推理 |
| LLM | Kimi K2.5 | 长上下文 |
| 图像生成 | Doubao Seedream 3.0 | 2K/4K 高质量图像 |
| 视频生成 | Doubao Seedance 1.5 Pro | 图生视频、音频生成 |

---

## 四、项目部署

### 4.1 克隆项目

```bash
# 克隆代码
git clone <your-repo-url> short-drama-workshop
cd short-drama-workshop
```

### 4.2 安装依赖

```bash
pnpm install
```

### 4.3 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑配置
nano .env.local
```

**`.env.local` 配置示例：**

```env
# 数据库配置（三选一）

# 方案一：MySQL
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=drama_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=short_drama_db

# 方案二：Supabase（云服务）
DATABASE_TYPE=supabase
COZE_SUPABASE_URL=https://xxxxx.supabase.co
COZE_SUPABASE_ANON_KEY=your-anon-key

# 方案三：内存模式（无需配置）
DATABASE_TYPE=memory

# Coze API 配置（必需，用于 AI 功能）
COZE_API_KEY=pat-xxxxxxxxxxxxx
COZE_BASE_URL=https://api.coze.com

# 对象存储（必需，用于存储图片和视频）
COZE_BUCKET_ENDPOINT_URL=your-endpoint-url
COZE_BUCKET_NAME=your-bucket-name

# FFmpeg 路径（通常自动检测）
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

### 4.4 初始化数据库表

如果使用 MySQL 或 Supabase，需要创建数据表：

```bash
# 运行数据库迁移脚本
pnpm run db:migrate

# 或手动执行 SQL（见下方）
```

<details>
<summary>点击查看数据库表结构 SQL</summary>

```sql
-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
    id VARCHAR(36) PRIMARY KEY DEFAULT UUID(),
    -- Coze API 配置
    coze_api_key VARCHAR(500),
    coze_base_url VARCHAR(200) DEFAULT 'https://api.coze.com',
    -- LLM 配置
    llm_provider VARCHAR(50) DEFAULT 'doubao',
    llm_model VARCHAR(100) DEFAULT 'doubao-seed-1-8-251228',
    llm_api_key VARCHAR(500),
    llm_base_url VARCHAR(500),
    -- 图像配置
    image_provider VARCHAR(50) DEFAULT 'doubao',
    image_model VARCHAR(100) DEFAULT 'doubao-seed-3-0',
    image_api_key VARCHAR(500),
    image_base_url VARCHAR(500),
    image_size VARCHAR(20) DEFAULT '2K',
    -- 视频配置
    video_provider VARCHAR(50) DEFAULT 'doubao',
    video_model VARCHAR(100) DEFAULT 'doubao-seedance-1-5-pro-251215',
    video_api_key VARCHAR(500),
    video_base_url VARCHAR(500),
    video_resolution VARCHAR(20) DEFAULT '720p',
    video_ratio VARCHAR(10) DEFAULT '16:9',
    -- 语音配置
    voice_provider VARCHAR(50) DEFAULT 'doubao',
    voice_model VARCHAR(100) DEFAULT 'doubao-tts',
    voice_api_key VARCHAR(500),
    voice_base_url VARCHAR(500),
    voice_default_style VARCHAR(50) DEFAULT 'natural',
    -- FFmpeg 配置
    ffmpeg_path VARCHAR(500),
    ffprobe_path VARCHAR(500),
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    story_type VARCHAR(50) DEFAULT 'novel',
    raw_text TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    final_video_url VARCHAR(1000),
    final_video_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    appearance TEXT,
    image_key VARCHAR(500),
    image_url VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 分镜表
CREATE TABLE IF NOT EXISTS scenes (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    scene_number INT NOT NULL,
    title VARCHAR(200),
    description TEXT NOT NULL,
    dialogue TEXT,
    action TEXT,
    emotion VARCHAR(100),
    character_ids JSON,
    status VARCHAR(50) DEFAULT 'pending',
    image_key VARCHAR(500),
    image_url VARCHAR(1000),
    video_url VARCHAR(1000),
    video_status VARCHAR(50) DEFAULT 'pending',
    last_frame_url VARCHAR(1000),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 剧集表
CREATE TABLE IF NOT EXISTS episodes (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    episode_number INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX idx_scenes_project ON scenes(project_id);
CREATE INDEX idx_characters_project ON characters(project_id);
CREATE INDEX idx_episodes_project ON episodes(project_id);
```

</details>

### 4.5 构建项目

```bash
# 类型检查
pnpm run typecheck

# 构建生产版本
pnpm run build
```

### 4.6 启动服务

```bash
# 开发模式（带热更新）
pnpm run dev

# 生产模式
pnpm run start

# 指定端口启动
PORT=3000 pnpm run start
```

---

## 四、使用 PM2 管理进程（生产环境推荐）

### 4.1 安装 PM2

```bash
sudo npm install -g pm2
```

### 4.2 创建 PM2 配置文件

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'short-drama-workshop',
    script: 'pnpm',
    args: 'start',
    cwd: '/path/to/short-drama-workshop',
    instances: 1,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
}
```

### 4.3 启动和管理

```bash
# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs short-drama-workshop

# 重启服务
pm2 restart short-drama-workshop

# 停止服务
pm2 stop short-drama-workshop

# 开机自启
pm2 startup
pm2 save
```

---

## 五、Nginx 反向代理（可选）

### 5.1 安装 Nginx

```bash
sudo apt install -y nginx
```

### 5.2 配置站点

```bash
sudo nano /etc/nginx/sites-available/short-drama
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 如果有 SSL
    # listen 443 ssl http2;
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 视频上传/合并需要较长超时
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # 静态资源缓存
    location /_next/static/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_cache static_cache;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### 5.3 启用站点

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/short-drama /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## 六、常见问题

### Q1: FFmpeg 视频合并失败

```bash
# 检查 FFmpeg 是否正常
ffmpeg -version

# 检查编码器支持
ffmpeg -encoders | grep libx264

# 如果缺少编码器，安装完整版
sudo apt install -y ffmpeg libx264-dev
```

### Q2: 端口被占用

```bash
# 查看端口占用
sudo lsof -i :5000

# 或使用 ss
sudo ss -tlnp | grep :5000

# 杀死进程
sudo kill -9 <PID>
```

### Q3: 内存不足

```bash
# 查看内存使用
free -h

# 创建交换分区（临时解决）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Q4: 数据库连接失败

```bash
# 检查 MySQL 服务
sudo systemctl status mysql

# 检查连接
mysql -u drama_user -p -h localhost short_drama_db

# 查看日志
sudo tail -f /var/log/mysql/error.log
```

---

## 七、系统资源建议

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 存储 | 20 GB | 50 GB+ SSD |
| 带宽 | 5 Mbps | 20 Mbps+ |

---

## 八、快速部署脚本

```bash
#!/bin/bash
# quick-deploy.sh - Ubuntu 24.04 一键部署脚本

set -e

echo "=== 短剧漫剧创作工坊 - Ubuntu 24.04 部署脚本 ==="

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
  echo "请使用 sudo 运行此脚本"
  exit 1
fi

# 更新系统
echo "[1/6] 更新系统..."
apt update && apt upgrade -y

# 安装 Node.js
echo "[2/6] 安装 Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 安装 pnpm
echo "[3/6] 安装 pnpm..."
corepack enable
corepack prepare pnpm@latest --activate

# 安装 FFmpeg
echo "[4/6] 安装 FFmpeg..."
apt install -y ffmpeg

# 安装 PM2
echo "[5/6] 安装 PM2..."
npm install -g pm2

# 安装 Nginx（可选）
read -p "是否安装 Nginx？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  apt install -y nginx
  echo "Nginx 已安装，请手动配置 /etc/nginx/sites-available/short-drama"
fi

# 验证安装
echo "[6/6] 验证安装..."
echo ""
echo "Node.js: $(node -v)"
echo "pnpm: $(pnpm -v)"
echo "FFmpeg: $(ffmpeg -version 2>&1 | head -1)"
echo "PM2: $(pm2 -v)"
echo ""
echo "=== 基础环境安装完成 ==="
echo "请继续执行以下步骤："
echo "1. git clone <your-repo> && cd <your-repo>"
echo "2. pnpm install"
echo "3. cp .env.example .env.local && nano .env.local"
echo "4. pnpm run build"
echo "5. pm2 start pnpm --name 'short-drama' -- start"
