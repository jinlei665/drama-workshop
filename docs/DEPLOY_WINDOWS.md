# Drama Studio - Windows 源码部署文档

## 目录
- [系统要求](#系统要求)
- [方式一：使用安装包（推荐）](#方式一使用安装包推荐)
- [方式二：源码部署](#方式二源码部署)
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

# 或使用本地 PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/drama_studio

# 对象存储（推荐使用云存储）
S3_ENDPOINT=https://your-s3-endpoint.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
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
S3_ENDPOINT=https://your-s3-endpoint.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
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

## 可选：安装本地数据库

### 方式一：安装 PostgreSQL

1. **下载 PostgreSQL**
   - 访问 https://www.postgresql.org/download/windows/
   - 下载并安装

2. **创建数据库**

```cmd
# 打开 SQL Shell (psql)
# 输入密码后执行：
CREATE DATABASE drama_studio;
CREATE USER drama_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE drama_studio TO drama_user;
```

3. **修改 .env 配置**

```env
DATABASE_URL=postgresql://drama_user:your_password@localhost:5432/drama_studio
```

### 方式二：使用 Supabase 云服务（推荐）

1. 访问 https://supabase.com/
2. 注册并创建新项目
3. 获取连接信息：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. 在 `.env` 中配置这些值

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
