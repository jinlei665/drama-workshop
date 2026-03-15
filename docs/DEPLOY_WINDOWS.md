# Drama Studio - Windows 源码部署文档

## 目录
- [系统要求](#系统要求)
- [方式一：使用安装包（推荐）](#方式一使用安装包推荐)
- [方式二：源码部署](#方式二源码部署)
- [方式三：Docker Desktop 部署](#方式三docker-desktop-部署)
- [数据库配置](#数据库配置)
- [对象存储配置](#对象存储配置)
- [常见问题](#常见问题)

---

## 系统要求

| 组件 | 最低要求 | 推荐配置 |
|------|---------|---------|
| 操作系统 | Windows 10 | Windows 10/11 |
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘 | 10 GB | 20 GB+ |
| Node.js | v18.x | v20.x LTS |

---

## 方式一：使用安装包（推荐）

### 1. 准备工作

1. **安装 Node.js**
   - 下载地址：https://nodejs.org/
   - 选择 **LTS 版本**（推荐 v20.x）
   - 安装时勾选 "Add to PATH"

2. **验证安装**

打开命令提示符（CMD）或 PowerShell：

```cmd
node --version
npm --version
```

### 2. 下载并解压

1. 下载 `drama-studio-win-x64.zip`
2. 解压到目标目录（建议路径不含中文和空格）
   - ✅ 推荐：`D:\drama-studio\`
   - ❌ 避免：`D:\ai短剧\drama-studio\`

### 3. 配置环境变量

1. 进入 `app` 目录
2. 复制 `.env.example` 为 `.env`
3. 用记事本或 VS Code 编辑 `.env`

**必须配置的项目：**

```env
# Supabase 数据库配置（推荐使用云服务）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 或使用本地数据库
DATABASE_URL=mysql://root:password@localhost:3306/drama_studio

# 对象存储（本地 MinIO 或云存储）
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio

# API 密钥
LLM_API_KEY=your-llm-api-key
IMAGE_API_KEY=your-image-api-key
VIDEO_API_KEY=your-video-api-key
VOICE_API_KEY=your-voice-api-key
```

### 4. 启动应用

双击运行 `start.bat`

首次运行会自动安装依赖，请耐心等待。

### 5. 访问应用

打开浏览器访问：`http://localhost:5000`

---

## 方式二：源码部署

### 1. 安装 Node.js

1. 访问 https://nodejs.org/
2. 下载 **LTS 版本**（v20.x 推荐）
3. 运行安装程序
4. 安装完成后重启电脑

**验证安装：**

```cmd
node --version
npm --version
```

### 2. 安装 pnpm

```cmd
npm install -g pnpm
pnpm --version
```

### 3. 安装 Git

1. 访问 https://git-scm.com/download/win
2. 下载并安装 Git
3. 安装时选择默认选项即可

**验证安装：**

```cmd
git --version
```

### 4. 克隆项目

打开 PowerShell 或 CMD：

```cmd
# 切换到目标目录
cd D:\

# 克隆项目
git clone https://github.com/your-repo/drama-studio.git
cd drama-studio
```

### 5. 安装依赖

```cmd
pnpm install
```

如果遇到网络问题，可以使用国内镜像：

```cmd
pnpm config set registry https://registry.npmmirror.com
pnpm install
```

### 6. 配置环境变量

1. 复制 `.env.docker.example` 为 `.env`

```cmd
copy .env.docker.example .env
```

2. 编辑 `.env` 文件

```cmd
notepad .env
```

**必须配置的项目：**

```env
# Supabase 配置（推荐使用云服务）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 对象存储
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio

# API 密钥
LLM_API_KEY=your-llm-api-key
IMAGE_API_KEY=your-image-api-key
VIDEO_API_KEY=your-video-api-key
```

### 7. 构建项目

```cmd
pnpm build
```

### 8. 启动应用

```cmd
pnpm start
```

### 9. 访问应用

打开浏览器访问：`http://localhost:5000`

---

## 方式三：Docker Desktop 部署

### 1. 安装 Docker Desktop

1. 访问 https://www.docker.com/products/docker-desktop/
2. 下载 Windows 版本
3. 安装并启动 Docker Desktop
4. 等待 Docker 引擎启动完成

### 2. 克隆项目

```cmd
git clone https://github.com/your-repo/drama-studio.git
cd drama-studio
```

### 3. 启动本地服务

**方案 A：PostgreSQL + MinIO**

```cmd
docker compose up -d
```

**方案 B：MySQL + MinIO**

```cmd
docker compose -f docker-compose.local.yml up -d
```

### 4. 初始化数据库

**PostgreSQL：**
```cmd
docker exec -i drama-studio-db psql -U postgres -d drama_studio < docker/init-db.sql
```

**MySQL：**
```cmd
docker exec -i drama-studio-mysql mysql -u drama_user -pdrama123456 drama_studio < docker/init-mysql.sql
```

### 5. 配置环境变量

```cmd
copy .env.docker.example .env
notepad .env
```

**Docker 内部网络配置：**

```env
# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@db:5432/drama_studio

# 或 MySQL
DATABASE_URL=mysql://drama_user:drama123456@mysql:3306/drama_studio

# MinIO
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio
```

### 6. 启动应用

```cmd
# 安装依赖
pnpm install

# 如使用 MySQL
pnpm add mysql2

# 构建
pnpm build

# 启动
pnpm start
```

---

## 数据库配置

### 方案对比

| 数据库 | 难度 | 成本 | 推荐场景 |
|--------|------|------|---------|
| **Supabase 云** | ⭐ | 免费 | 生产环境（推荐） |
| **本地 PostgreSQL** | ⭐⭐⭐ | 免费 | 内网部署 |
| **本地 MySQL** | ⭐⭐ | 免费 | 熟悉 MySQL 的用户 |

### 方案一：Supabase 云服务（推荐）

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
- 无需维护数据库

### 方案二：本地 MySQL

#### 安装 MySQL

1. **下载 MySQL**
   - 访问 https://dev.mysql.com/downloads/mysql/
   - 选择 Windows 版本下载
   - 运行安装程序

2. **配置 MySQL**
   - 设置 root 密码
   - 选择 "Developer Default" 或 "Server Only"

3. **创建数据库**

打开 MySQL Command Line Client 或 MySQL Workbench：

```sql
CREATE DATABASE drama_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'drama_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON drama_studio.* TO 'drama_user'@'localhost';
FLUSH PRIVILEGES;
```

4. **初始化表结构**

```cmd
mysql -u drama_user -p drama_studio < docker\init-mysql.sql
```

5. **配置连接**

```env
DATABASE_URL=mysql://drama_user:your_password@localhost:3306/drama_studio
```

6. **安装 MySQL 驱动**

```cmd
pnpm add mysql2
```

### 方案三：本地 PostgreSQL

1. **下载 PostgreSQL**
   - 访问 https://www.postgresql.org/download/windows/
   - 下载并安装

2. **创建数据库**

使用 pgAdmin 或命令行：

```sql
CREATE DATABASE drama_studio;
CREATE USER drama_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE drama_studio TO drama_user;
```

3. **配置连接**

```env
DATABASE_URL=postgresql://drama_user:your_password@localhost:5432/drama_studio
```

---

## 对象存储配置

### 方案对比

| 存储 | 难度 | 成本 | 推荐场景 |
|------|------|------|---------|
| **MinIO 本地** | ⭐⭐ | 免费 | 开发/内网（推荐） |
| **阿里云 OSS** | ⭐ | 按量付费 | 生产环境 |
| **腾讯云 COS** | ⭐ | 按量付费 | 生产环境 |

### 方案一：本地 MinIO（推荐）

#### 安装 MinIO

1. **下载 MinIO**
   - 访问 https://dl.min.io/server/minio/release/windows-amd64/minio.exe
   - 保存到 `C:\minio\minio.exe`

2. **创建数据目录**

```cmd
mkdir C:\minio-data
```

3. **启动 MinIO**

```cmd
C:\minio\minio.exe server C:\minio-data --console-address ":9001"
```

4. **配置为 Windows 服务（可选）**

使用 NSSM（Non-Sucking Service Manager）：

```cmd
# 下载 NSSM: https://nssm.cc/download
# 解压后运行：
nssm install MinIO "C:\minio\minio.exe" "server C:\minio-data --console-address :9001"
nssm set MinIO AppEnvironmentExtra "MINIO_ROOT_USER=minioadmin" "MINIO_ROOT_PASSWORD=minioadmin123"
nssm start MinIO
```

5. **创建存储桶**

   - 打开浏览器访问 http://localhost:9001
   - 用户名：`minioadmin`
   - 密码：`minioadmin123`
   - 点击 "Buckets" → "Create Bucket"
   - 输入名称：`drama-studio`

6. **配置项目**

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio
S3_REGION=us-east-1
```

#### 使用 Docker 启动 MinIO

如果已安装 Docker Desktop：

```cmd
docker compose -f docker-compose.local.yml up -d minio
```

### 方案二：阿里云 OSS

```env
S3_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
S3_ACCESS_KEY=your-access-key-id
S3_SECRET_KEY=your-access-key-secret
S3_BUCKET=your-bucket-name
S3_REGION=oss-cn-hangzhou
```

### 方案三：腾讯云 COS

```env
S3_ENDPOINT=https://cos.ap-guangzhou.myqcloud.com
S3_ACCESS_KEY=your-secret-id
S3_SECRET_KEY=your-secret-key
S3_BUCKET=your-bucket-name
S3_REGION=ap-guangzhou
```

---

## 配置为 Windows 服务（开机自启）

### 使用 NSSM

1. **下载 NSSM**
   - 访问 https://nssm.cc/download
   - 解压到任意目录

2. **安装服务**

```cmd
# 以管理员身份运行 CMD
cd C:\nssm-2.24\win64

# 安装服务
nssm install DramaStudio

# 在弹出的窗口中配置：
# Path: C:\Program Files\nodejs\node.exe
# Startup directory: D:\drama-studio
# Arguments: node_modules\next\dist\bin\next start --port 5000
```

3. **启动服务**

```cmd
nssm start DramaStudio
```

### 使用 PM2

1. **安装 PM2**

```cmd
npm install -g pm2
npm install -g pm2-windows-startup

pm2-startup install
```

2. **创建启动脚本**

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'drama-studio',
    script: 'pnpm',
    args: 'start',
    cwd: 'D:\\drama-studio',
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
```

3. **启动服务**

```cmd
pm2 start ecosystem.config.js
pm2 save
```

---

## 防火墙配置

如果需要从其他电脑访问，需要开放端口：

1. 打开 **Windows Defender 防火墙**
2. 点击 **高级设置**
3. 创建 **入站规则**：
   - 端口：5000
   - 协议：TCP
   - 操作：允许连接

或使用命令：

```cmd
# 以管理员身份运行
netsh advfirewall firewall add rule name="Drama Studio" dir=in action=allow protocol=tcp localport=5000
```

---

## 常见问题

### 1. 'pnpm' 不是内部或外部命令

**解决方案：**
```cmd
npm install -g pnpm
```

### 2. 依赖安装失败

**解决方案：**
```cmd
# 清除缓存
pnpm store prune

# 使用国内镜像
pnpm config set registry https://registry.npmmirror.com

# 重新安装
pnpm install
```

### 3. 端口被占用

```cmd
# 查看端口占用
netstat -ano | findstr :5000

# 杀死进程（替换 PID）
taskkill /PID <PID> /F
```

### 4. Node.js 版本问题

建议使用 Node.js v20.x LTS。如果已安装其他版本：

**使用 nvm-windows 管理 Node.js 版本：**

1. 下载 https://github.com/coreybutler/nvm-windows/releases
2. 安装后执行：

```cmd
nvm install 20
nvm use 20
```

### 5. 启动报错找不到模块

```cmd
# 删除 node_modules 重新安装
rmdir /s /q node_modules
pnpm install
```

### 6. PowerShell 执行策略问题

```cmd
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 7. 中文路径问题

如果项目路径包含中文，可能会导致各种问题：

**解决方案：**
- 将项目移动到纯英文路径，如 `D:\drama-studio\`

---

## 更新项目

```cmd
cd D:\drama-studio

# 拉取最新代码
git pull

# 安装新依赖
pnpm install

# 重新构建
pnpm build

# 重启服务（如果使用 PM2）
pm2 restart drama-studio
```

---

## 备份数据

### 备份配置

```cmd
# 复制 .env 文件
copy .env .env.backup
```

### 备份数据库（如果使用本地 PostgreSQL）

```cmd
pg_dump -h localhost -U drama_user drama_studio > backup_%date:~0,10%.sql
```

---

## 性能优化建议

1. **使用 SSD 硬盘**：提升读写速度
2. **增加内存**：视频生成需要较多内存
3. **关闭不必要的后台程序**
4. **定期清理 node_modules 和重新安装**：

```cmd
rmdir /s /q node_modules
rmdir /s /q .next
pnpm install
pnpm build
```

---

## 开发模式

如果需要开发调试：

```cmd
# 启动开发服务器（支持热更新）
pnpm dev
```

访问：`http://localhost:5000`
