# 短剧漫剧创作工坊 - 打包部署指南

本文档介绍如何将项目打包成可分发的安装包，支持 Windows 和 Linux (Ubuntu) 系统。

## 📦 打包方案对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **Docker** | 服务器部署、企业使用 | 跨平台一致、环境隔离、易于部署 | 需要安装 Docker |
| **便携版** | 个人使用、演示 | 无需安装、双击即用 | 需要手动配置环境 |
| **Electron** | 桌面应用 | 原生体验、自动更新 | 打包体积大 |

---

## 方案一：Docker 镜像（推荐）

### 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- 内存：至少 4GB
- 磁盘：至少 10GB 可用空间

### 快速开始

#### 1. 准备环境变量

```bash
# 复制环境变量模板
cp .env.docker.example .env

# 编辑配置
nano .env
```

填入必要的 API 密钥：
- `LLM_API_KEY` - 大语言模型 API 密钥
- `IMAGE_API_KEY` - 图像生成 API 密钥
- `VIDEO_API_KEY` - 视频生成 API 密钥

#### 2. 构建并启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f web
```

#### 3. 访问应用

- **Web 应用**: http://localhost:5000
- **MinIO 控制台**: http://localhost:9001 (用户名/密码: minioadmin/minioadmin)

#### 4. 停止服务

```bash
docker-compose down
```

### 数据持久化

Docker 会自动创建数据卷保存数据：
- `postgres-data` - 数据库数据
- `minio-data` - 对象存储数据

### 生产环境部署

```bash
# 使用生产配置启动
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 方案二：便携版（Portable）

便携版是一个独立的压缩包，解压后即可运行，无需安装。

### 构建便携版

#### Linux

```bash
# 赋予执行权限
chmod +x scripts/build-portable.sh

# 执行打包
./scripts/build-portable.sh
```

#### Windows

```batch
# 在 PowerShell 或 CMD 中运行
scripts\build-portable.bat
```

### 输出文件

打包完成后，在 `dist/portable` 目录下生成：
- `drama-studio-linux-x64.tar.gz` - Linux 便携版
- `drama-studio-win-x64.zip` - Windows 便携版

### 使用方法

#### Linux

```bash
# 解压
tar -xzf drama-studio-linux-x64.tar.gz

# 进入目录
cd drama-studio-linux-x64

# 配置环境变量
cp .env.example .env
nano .env

# 启动
./start.sh
```

#### Windows

```powershell
# 解压
Expand-Archive drama-studio-win-x64.zip

# 进入目录
cd drama-studio-win-x64

# 配置环境变量
copy .env.example .env
notepad .env

# 启动
start.bat
```

### 系统要求

- **操作系统**: Windows 10/11 x64 或 Linux x64
- **Node.js**: v20+ (需要自行安装)
- **内存**: 至少 2GB
- **磁盘**: 至少 1GB 可用空间

---

## 方案三：Electron 桌面应用

Electron 版本提供原生桌面应用体验，支持安装包和便携版。

### 构建 Electron 应用

#### 准备工作

```bash
# 安装依赖
pnpm add -D electron electron-builder tsx
```

#### 执行构建

```bash
# 赋予执行权限
chmod +x scripts/build-electron.sh

# 执行打包
./scripts/build-electron.sh
```

### 输出文件

在 `dist/electron` 目录下生成：

**Windows:**
- `短剧漫剧创作工坊 Setup 1.0.0.exe` - 安装包
- `短剧漫剧创作工坊 1.0.0.exe` - 便携版

**Linux:**
- `短剧漫剧创作工坊-1.0.0.AppImage` - AppImage 格式
- `短剧漫剧创作工坊_1.0.0_amd64.deb` - Debian/Ubuntu 安装包
- `短剧漫剧创作工坊-1.0.0-linux.tar.gz` - 便携版

### 安装使用

#### Windows

```powershell
# 安装版
双击运行 "短剧漫剧创作工坊 Setup 1.0.0.exe"

# 便携版
双击运行 "短剧漫剧创作工坊 1.0.0.exe"
```

#### Linux

```bash
# AppImage (推荐)
chmod +x 短剧漫剧创作工坊-1.0.0.AppImage
./短剧漫剧创作工坊-1.0.0.AppImage

# Debian/Ubuntu
sudo dpkg -i 短剧漫剧创作工坊_1.0.0_amd64.deb
```

---

## 🔧 高级配置

### 自定义端口

修改 `.env` 文件：
```
PORT=8080
```

### 配置外部数据库

修改 `docker-compose.yml` 或 `.env`：
```yaml
DATABASE_URL=postgresql://user:password@host:5432/database
```

### 配置外部对象存储

修改 `.env`：
```
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=your-bucket
```

---

## 🐛 故障排除

### 端口被占用

```bash
# Linux/Mac
lsof -i :5000
kill -9 <PID>

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### 数据库连接失败

1. 检查数据库服务是否启动
2. 验证连接字符串格式
3. 确认网络连接正常

### 构建失败

1. 清理缓存：`rm -rf .next node_modules`
2. 重新安装：`pnpm install`
3. 重新构建：`pnpm build`

---

## 📋 检查清单

### 部署前检查

- [ ] 已配置所有必要的 API 密钥
- [ ] 数据库连接正确
- [ ] 对象存储配置正确
- [ ] 端口未被占用
- [ ] 磁盘空间充足

### 部署后验证

- [ ] 应用可以正常访问
- [ ] 可以创建新项目
- [ ] 可以生成分镜图片
- [ ] 可以生成视频
- [ ] 文件上传下载正常

---

## 📞 技术支持

如有问题，请检查：
1. 应用日志：`/app/work/logs/bypass/app.log`
2. 控制台日志：浏览器开发者工具
3. Docker 日志：`docker-compose logs -f`

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2024-03-15 | 初始版本 |
