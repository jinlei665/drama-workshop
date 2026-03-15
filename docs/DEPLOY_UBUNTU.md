# Drama Studio - Ubuntu 部署文档

## 目录
- [系统要求](#系统要求)
- [方式一：Docker 部署（推荐）](#方式一docker-部署推荐)
- [方式二：源码部署](#方式二源码部署)
- [数据库配置](#数据库配置)
- [对象存储配置](#对象存储配置)
- [Nginx 反向代理配置](#nginx-反向代理配置)
- [常见问题](#常见问题)

---

## 系统要求

| 组件 | 最低要求 | 推荐配置 |
|------|---------|---------|
| 操作系统 | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘 | 20 GB | 50 GB+ |
| Node.js | v18.x | v20.x LTS |
| pnpm | v9.x | v9.x |

---

## 方式一：Docker 部署（推荐）

### 1. 安装 Docker 和 Docker Compose

```bash
# 更新软件包索引
sudo apt update

# 安装依赖
sudo apt install -y ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 添加 Docker 软件源
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 启动 Docker 并设置开机自启
sudo systemctl enable --now docker

# 添加当前用户到 docker 组（免 sudo）
sudo usermod -aG docker $USER
newgrp docker
```

### 2. 克隆项目

```bash
# 安装 git
sudo apt install -y git

# 克隆项目
git clone https://github.com/your-repo/drama-studio.git
cd drama-studio
```

### 3. 选择部署方案

#### 方案 A：使用 PostgreSQL + MinIO（默认）

```bash
# 复制环境变量模板
cp .env.docker.example .env

# 编辑配置文件
nano .env
```

配置 Supabase 或本地 PostgreSQL：

```env
# 使用 Supabase 云服务（推荐）
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...

# 或使用本地 PostgreSQL（Docker 内部）
DATABASE_URL=postgresql://postgres:postgres@db:5432/drama_studio
```

启动服务：

```bash
docker compose up -d
```

#### 方案 B：使用 MySQL + MinIO（本地全套服务）

```bash
# 启动 MySQL + MinIO 本地服务
docker compose -f docker-compose.local.yml up -d

# 等待 MySQL 启动
sleep 15

# 初始化 MySQL 数据库
docker exec -i drama-studio-mysql mysql -u drama_user -pdrama123456 drama_studio < docker/init-mysql.sql
```

配置 `.env` 文件：

```env
# MySQL 本地连接
DATABASE_URL=mysql://drama_user:drama123456@localhost:3306/drama_studio

# MinIO 本地对象存储
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio
S3_REGION=us-east-1

# API 密钥
LLM_API_KEY=your-llm-api-key
IMAGE_API_KEY=your-image-api-key
VIDEO_API_KEY=your-video-api-key
VOICE_API_KEY=your-voice-api-key

# 其他配置
NODE_ENV=production
PORT=5000
```

安装 MySQL 驱动并启动应用：

```bash
# 安装 MySQL 驱动
pnpm add mysql2

# 安装依赖
pnpm install

# 构建
pnpm build

# 启动
pnpm start
```

### 4. 访问应用

打开浏览器访问：`http://your-server-ip:5000`

### 5. 管理界面

| 服务 | 地址 | 说明 |
|------|------|------|
| MinIO 控制台 | http://your-ip:9001 | 对象存储管理 |
| Adminer | http://your-ip:8080 | 数据库管理 |

---

## 方式二：源码部署

### 1. 安装 Node.js

```bash
# 安装 Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version  # 应显示 v20.x.x
npm --version
```

### 2. 安装 pnpm

```bash
# 全局安装 pnpm
npm install -g pnpm

# 验证安装
pnpm --version
```

### 3. 安装数据库

#### 选项 A：PostgreSQL

```bash
# 安装 PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 启动服务
sudo systemctl enable --now postgresql

# 创建数据库和用户
sudo -u postgres psql << 'EOF'
CREATE DATABASE drama_studio;
CREATE USER drama_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE drama_studio TO drama_user;
\c drama_studio
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF
```

#### 选项 B：MySQL

```bash
# 安装 MySQL
sudo apt install -y mysql-server

# 安全配置
sudo mysql_secure_installation

# 创建数据库和用户
sudo mysql -u root -p << 'EOF'
CREATE DATABASE drama_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'drama_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON drama_studio.* TO 'drama_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# 初始化表结构（使用项目提供的 SQL 文件）
mysql -u drama_user -p drama_studio < sql/init-mysql.sql
```

### 4. 安装对象存储（MinIO）

```bash
# 下载 MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# 创建数据目录
sudo mkdir -p /data/minio
sudo chown $USER:$USER /data/minio

# 创建 systemd 服务
sudo tee /etc/systemd/system/minio.service << 'EOF'
[Unit]
Description=MinIO Object Storage
After=network.target

[Service]
User=your_username
Group=your_username
ExecStart=/usr/local/bin/minio server /data/minio --console-address ":9001"
Environment="MINIO_ROOT_USER=minioadmin"
Environment="MINIO_ROOT_PASSWORD=minioadmin123"
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 启动 MinIO
sudo systemctl daemon-reload
sudo systemctl enable --now minio

# 创建存储桶（首次使用）
# 访问 http://localhost:9001 创建 bucket: drama-studio
```

### 5. 克隆并配置项目

```bash
# 克隆项目
git clone https://github.com/your-repo/drama-studio.git
cd drama-studio

# 安装依赖
pnpm install

# 如果使用 MySQL，安装驱动
pnpm add mysql2

# 复制并配置环境变量
cp .env.docker.example .env
nano .env
```

**PostgreSQL 配置：**

```env
DATABASE_URL=postgresql://drama_user:your_password@localhost:5432/drama_studio

# 如果使用 Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
```

**MySQL 配置：**

```env
DATABASE_URL=mysql://drama_user:your_password@localhost:3306/drama_studio
```

**MinIO 配置：**

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio
S3_REGION=us-east-1
```

### 6. 构建项目

```bash
# 构建生产版本
pnpm build
```

### 7. 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'drama-studio',
    script: 'pnpm',
    args: 'start',
    cwd: '/path/to/drama-studio',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
}
EOF

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 设置开机自启
pm2 startup
pm2 save
```

### 8. 访问应用

打开浏览器访问：`http://localhost:5000`

---

## 数据库配置

### 方案对比

| 数据库 | 优点 | 缺点 | 推荐场景 |
|--------|------|------|---------|
| **Supabase 云** | 免费、免维护、自动备份 | 需要网络 | 生产环境（推荐） |
| **PostgreSQL** | 功能强大、开源 | 需要维护 | 内网部署 |
| **MySQL** | 广泛使用、熟悉度高 | 功能略少 | MySQL 用户 |

### Supabase 云服务（推荐）

1. 访问 https://supabase.com/ 注册账号
2. 创建新项目
3. 获取连接信息填入 `.env`

### 本地数据库初始化

**PostgreSQL：**
```bash
# 方式1: 直接执行 SQL 文件（源码部署推荐）
psql -U postgres -f sql/init-postgresql.sql

# 方式2: Docker 容器内执行
docker exec -i drama-studio-db psql -U postgres -d drama_studio < docker/init-db.sql
```

**MySQL：**
```bash
# 方式1: 直接执行 SQL 文件（源码部署推荐）
mysql -u drama_user -p drama_studio < sql/init-mysql.sql

# 方式2: Docker 容器内执行
docker exec -i drama-studio-mysql mysql -u drama_user -pdrama123456 drama_studio < docker/init-mysql.sql
```

---

## 对象存储配置

### 方案对比

| 存储 | 优点 | 缺点 | 推荐场景 |
|------|------|------|---------|
| **MinIO 本地** | 免费、快速、无网络依赖 | 需要维护 | 开发/内网（推荐） |
| **阿里云 OSS** | 稳定、CDN 加速 | 按量付费 | 生产环境 |
| **腾讯云 COS** | 稳定、CDN 加速 | 按量付费 | 生产环境 |

### MinIO 本地存储

**启动：**
```bash
docker compose -f docker-compose.local.yml up -d minio
```

**访问控制台：**
- 地址：http://localhost:9001
- 用户名：minioadmin
- 密码：minioadmin123

**创建存储桶：**
1. 登录控制台
2. 点击 "Buckets" → "Create Bucket"
3. 输入名称：`drama-studio`
4. 设置 Access Policy 为 Public（可选）

---

## Nginx 反向代理配置

### 1. 安装 Nginx

```bash
sudo apt install -y nginx
```

### 2. 配置反向代理

```bash
sudo tee /etc/nginx/sites-available/drama-studio << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 反向代理
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
        
        # 增加超时时间（视频生成可能较慢）
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # 增加上传文件大小限制
    client_max_body_size 100M;
}
EOF

# 启用站点
sudo ln -s /etc/nginx/sites-available/drama-studio /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 3. 配置 HTTPS（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 设置自动续期
sudo certbot renew --dry-run
```

---

## 常见问题

### 1. 端口被占用

```bash
# 查看端口占用
sudo lsof -i :5000

# 杀死进程
sudo kill -9 <PID>
```

### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 服务状态
sudo systemctl status postgresql

# 检查连接
psql -h localhost -U drama_user -d drama_studio
```

### 3. 权限问题

```bash
# 修复项目目录权限
sudo chown -R $USER:$USER /path/to/drama-studio
```

### 4. 内存不足

```bash
# 查看内存使用
free -h

# 添加 Swap（如果没有）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久启用
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 5. Docker 服务问题

```bash
# 重启 Docker
sudo systemctl restart docker

# 查看容器日志
docker compose logs -f

# 重建容器
docker compose down
docker compose up -d --build
```

---

## 更新部署

### Docker 方式

```bash
cd drama-studio

# 拉取最新代码
git pull

# 重新构建并启动
docker compose down
docker compose up -d --build
```

### 源码方式

```bash
cd drama-studio

# 拉取最新代码
git pull

# 安装依赖
pnpm install

# 重新构建
pnpm build

# 重启 PM2
pm2 restart drama-studio
```

---

## 备份与恢复

### 数据库备份

```bash
# 备份
pg_dump -h localhost -U drama_user drama_studio > backup_$(date +%Y%m%d).sql

# 恢复
psql -h localhost -U drama_user drama_studio < backup_20240101.sql
```

### Docker 数据备份

```bash
# 备份 PostgreSQL 数据卷
docker run --rm -v drama-studio_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# 备份 MinIO 数据卷
docker run --rm -v drama-studio_minio-data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz -C /data .
```
