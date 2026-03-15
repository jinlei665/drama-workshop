# Drama Studio - 数据库与存储配置指南

## 目录
- [数据库配置](#数据库配置)
  - [方案一：使用 MySQL](#方案一使用-mysql)
  - [方案二：使用 PostgreSQL](#方案二使用-postgresql)
  - [方案三：使用 Supabase 云服务](#方案三使用-supabase-云服务)
- [对象存储配置](#对象存储配置)
  - [方案一：本地 MinIO（推荐）](#方案一本地-minio推荐)
  - [方案二：云存储服务](#方案二云存储服务)
- [完整配置示例](#完整配置示例)

---

## 数据库配置

### 方案一：使用 MySQL

#### 1. Docker 方式启动 MySQL

```bash
# 使用提供的 docker-compose.local.yml
docker compose -f docker-compose.local.yml up -d mysql

# 查看状态
docker compose -f docker-compose.local.yml ps
```

#### 2. 本地安装 MySQL

**Ubuntu:**
```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation

# 创建数据库
sudo mysql -u root -p
```

```sql
CREATE DATABASE drama_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'drama_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON drama_studio.* TO 'drama_user'@'localhost';
FLUSH PRIVILEGES;
```

**Windows:**
1. 下载 MySQL Community Server：https://dev.mysql.com/downloads/mysql/
2. 安装并配置 root 密码
3. 使用 MySQL Workbench 或命令行创建数据库

#### 3. 修改项目配置

**安装 MySQL 驱动：**
```bash
pnpm add mysql2
```

**修改 .env 文件：**
```env
# MySQL 连接字符串
DATABASE_URL=mysql://drama_user:your_password@localhost:3306/drama_studio
```

**修改代码使用 MySQL 客户端：**

在需要使用数据库的文件中：

```typescript
// 方式1: 使用 Supabase 客户端（推荐，已集成）
import { getSupabaseClient } from '@/storage/database/supabase-client';
const client = getSupabaseClient();

// 方式2: 使用原生 MySQL（需要修改 API 路由）
import { getMysqlClient, executeSql } from '@/storage/database/mysql-client';

// 执行原生 SQL
const results = await executeSql('SELECT * FROM projects');
```

#### 4. 初始化数据库表

```bash
# 使用初始化脚本
mysql -u drama_user -p drama_studio < docker/init-mysql.sql

# 或通过 Docker
docker exec -i drama-studio-mysql mysql -u drama_user -pdrama123456 drama_studio < docker/init-mysql.sql
```

---

### 方案二：使用 PostgreSQL

#### 1. Docker 方式

```bash
# 使用主 docker-compose.yml
docker compose up -d db

# 初始化
docker exec -i drama-studio-db psql -U postgres -d drama_studio < docker/init-db.sql
```

#### 2. 本地安装

**Ubuntu:**
```bash
sudo apt install -y postgresql postgresql-contrib

sudo -u postgres psql
```

```sql
CREATE DATABASE drama_studio;
CREATE USER drama_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE drama_studio TO drama_user;
\c drama_studio
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Windows:**
1. 下载 PostgreSQL：https://www.postgresql.org/download/windows/
2. 安装时记住设置的密码
3. 使用 pgAdmin 创建数据库

#### 3. 配置连接

```env
DATABASE_URL=postgresql://drama_user:your_password@localhost:5432/drama_studio
```

---

### 方案三：使用 Supabase 云服务

**最简单的方式，推荐用于生产环境！**

1. 访问 https://supabase.com/ 注册账号
2. 创建新项目
3. 在项目设置中获取：
   - Project URL
   - Anon Key
   - Service Role Key

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
```

**优点：**
- 免费套餐足够开发使用
- 自动备份
- 内置身份验证
- 实时订阅
- 无需维护数据库

---

## 对象存储配置

### 方案一：本地 MinIO（推荐）

MinIO 是兼容 S3 协议的本地对象存储，完全免费！

#### 1. Docker 方式（推荐）

```bash
# 启动 MinIO
docker compose -f docker-compose.local.yml up -d minio

# 查看状态
docker compose -f docker-compose.local.yml ps
```

#### 2. 访问 MinIO 控制台

- **API 地址**：http://localhost:9000
- **控制台地址**：http://localhost:9001
- **默认用户名**：minioadmin
- **默认密码**：minioadmin123

#### 3. 创建存储桶

1. 打开 http://localhost:9001
2. 登录后点击 "Buckets" → "Create Bucket"
3. 输入桶名称：`drama-studio`
4. 设置为公开访问（可选）

#### 4. 配置项目

```env
# MinIO 本地配置
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio
S3_REGION=us-east-1
```

#### 5. 本地安装 MinIO（Windows）

1. 下载：https://dl.min.io/server/minio/release/windows-amd64/minio.exe
2. 创建数据目录：`C:\minio-data`
3. 启动服务：

```cmd
minio.exe server C:\minio-data --console-address ":9001"
```

4. 配置为 Windows 服务（可选）：

```cmd
# 创建服务
sc create MinIO binPath= "C:\path\to\minio.exe server C:\minio-data --console-address :9001" start= auto
```

#### 6. 本地安装 MinIO（Ubuntu）

```bash
# 下载
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# 创建数据目录
sudo mkdir -p /data/minio
sudo chown $USER:$USER /data/minio

# 启动
minio server /data/minio --console-address ":9001"
```

**创建 systemd 服务：**

```bash
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

sudo systemctl daemon-reload
sudo systemctl enable --now minio
```

---

### 方案二：云存储服务

#### 阿里云 OSS

```env
S3_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
S3_ACCESS_KEY=your-access-key-id
S3_SECRET_KEY=your-access-key-secret
S3_BUCKET=your-bucket-name
S3_REGION=oss-cn-hangzhou
```

#### 腾讯云 COS

```env
S3_ENDPOINT=https://cos.ap-guangzhou.myqcloud.com
S3_ACCESS_KEY=your-secret-id
S3_SECRET_KEY=your-secret-key
S3_BUCKET=your-bucket-name
S3_REGION=ap-guangzhou
```

#### AWS S3

```env
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
```

---

## 完整配置示例

### 开发环境（本地全部服务）

```env
# ==================== 数据库配置 ====================
# MySQL 本地
DATABASE_URL=mysql://drama_user:drama123456@localhost:3306/drama_studio

# ==================== 对象存储配置 ====================
# MinIO 本地
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio
S3_REGION=us-east-1

# ==================== API 密钥 ====================
LLM_API_KEY=your-llm-api-key
IMAGE_API_KEY=your-image-api-key
VIDEO_API_KEY=your-video-api-key
VOICE_API_KEY=your-voice-api-key

# ==================== 其他配置 ====================
NODE_ENV=development
PORT=5000
```

### 生产环境（云服务）

```env
# ==================== 数据库配置 ====================
# Supabase 云服务
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...

# ==================== 对象存储配置 ====================
# 阿里云 OSS
S3_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
S3_ACCESS_KEY=your-access-key-id
S3_SECRET_KEY=your-access-key-secret
S3_BUCKET=drama-studio-prod
S3_REGION=oss-cn-hangzhou

# ==================== API 密钥 ====================
LLM_API_KEY=your-production-api-key
IMAGE_API_KEY=your-production-api-key
VIDEO_API_KEY=your-production-api-key
VOICE_API_KEY=your-production-api-key

# ==================== 其他配置 ====================
NODE_ENV=production
PORT=5000
```

---

## 快速启动（全本地环境）

```bash
# 1. 启动本地服务（MySQL + MinIO）
docker compose -f docker-compose.local.yml up -d

# 2. 等待服务启动
sleep 10

# 3. 初始化数据库
docker exec -i drama-studio-mysql mysql -u drama_user -pdrama123456 drama_studio < docker/init-mysql.sql

# 4. 配置环境变量
cp .env.docker.example .env
# 编辑 .env，使用上面的"开发环境"配置

# 5. 安装依赖并启动
pnpm install
pnpm dev
```

---

## 数据库管理工具

### Web 界面

启动 Adminer（数据库管理界面）：

```bash
docker compose -f docker-compose.local.yml up -d adminer
```

访问：http://localhost:8080

**登录信息：**
- 系统：MySQL
- 服务器：mysql
- 用户名：drama_user
- 密码：drama123456
- 数据库：drama_studio

### 桌面工具

- **MySQL**: MySQL Workbench、DBeaver、Navicat
- **PostgreSQL**: pgAdmin、DBeaver、Navicat
- **MinIO**: 控制台 http://localhost:9001

---

## 数据迁移

### PostgreSQL → MySQL

如果已有 PostgreSQL 数据，需要迁移到 MySQL：

1. 导出 PostgreSQL 数据：
```bash
pg_dump -h localhost -U postgres drama_studio > pg_backup.sql
```

2. 转换 SQL 语法（需要注意语法差异）
3. 导入 MySQL：
```bash
mysql -u drama_user -p drama_studio < mysql_import.sql
```

### 建议使用 Drizzle Kit 迁移

```bash
# 生成迁移文件
pnpm drizzle-kit generate

# 执行迁移
pnpm drizzle-kit migrate
```
