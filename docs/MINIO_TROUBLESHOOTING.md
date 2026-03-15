# MinIO 登录问题排查指南

## 问题描述

本地 MinIO 控制台登录无效，提示用户名或密码错误。

---

## 排查步骤

### 1. 检查 MinIO 是否正常运行

```bash
# 查看容器状态
docker ps | grep minio

# 查看容器日志
docker logs drama-studio-minio

# 检查端口是否监听
# Linux
ss -tlnp | grep 9000
ss -tlnp | grep 9001

# Windows PowerShell
netstat -ano | findstr :9000
netstat -ano | findstr :9001
```

### 2. 重启 MinIO 容器

```bash
# 停止并删除容器
docker compose -f docker-compose.local.yml down minio

# 重新启动
docker compose -f docker-compose.local.yml up -d minio

# 查看启动日志
docker logs -f drama-studio-minio
```

### 3. 清除浏览器缓存

1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮 → "清空缓存并硬性重新加载"
3. 或使用隐私模式（无痕模式）访问

### 4. 确认正确的登录凭据

| 地址 | 用户名 | 密码 |
|------|--------|------|
| http://localhost:9001 | minioadmin | minioadmin123 |

**注意：** 是 `9001` 端口（控制台），不是 `9000`（API）

### 5. 检查环境变量

MinIO 版本不同，环境变量名称也不同：

**新版本 (2022+)：**
```
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
```

**旧版本：**
```
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
```

`docker-compose.local.yml` 已同时配置两组变量，兼容所有版本。

### 6. 完全重置 MinIO

```bash
# 停止所有容器
docker compose -f docker-compose.local.yml down

# 删除 MinIO 数据卷（会清除所有存储的文件！）
docker volume rm drama-studio_minio-data

# 重新启动
docker compose -f docker-compose.local.yml up -d minio
```

---

## Windows 特有问题

### 问题：Docker Desktop 未启动

**解决方案：**
1. 打开 Docker Desktop
2. 等待 Docker 图标变绿（引擎已启动）
3. 重新运行 `docker compose -f docker-compose.local.yml up -d minio`

### 问题：端口被占用

```powershell
# 查看端口占用
netstat -ano | findstr :9001

# 杀死占用进程（替换 PID）
taskkill /PID <PID> /F
```

### 问题：WSL2 问题

如果使用 WSL2 后端：

```powershell
# 重启 WSL
wsl --shutdown

# 重启 Docker Desktop
```

---

## 手动创建存储桶

如果无法通过控制台创建，可以使用命令行：

### 使用 Docker 容器内的 mc 客户端

```bash
# 进入 MinIO 容器
docker exec -it drama-studio-minio sh

# 配置别名
mc alias set local http://localhost:9000 minioadmin minioadmin123

# 创建存储桶
mc mb local/drama-studio

# 设置公开访问（可选）
mc anonymous set download local/drama-studio

# 退出容器
exit
```

### 使用本地 mc 客户端

```bash
# Linux/macOS
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile "mc.exe"

# 配置并创建存储桶
mc alias set local http://localhost:9000 minioadmin minioadmin123
mc mb local/drama-studio
```

---

## 验证 MinIO 是否正常

### 检查 API 端点

```bash
# 访问健康检查端点
curl http://localhost:9000/minio/health/live

# 应返回：200 OK
```

### 测试上传文件

```bash
# 创建测试文件
echo "test" > test.txt

# 使用 curl 上传
curl -X PUT \
  -u minioadmin:minioadmin123 \
  -T test.txt \
  http://localhost:9000/drama-studio/test.txt
```

---

## 常见错误信息

### "Invalid Login"

**原因：** 用户名或密码错误，或版本不兼容

**解决：**
1. 确认使用的是 `9001` 端口
2. 检查环境变量配置
3. 重启容器并清除浏览器缓存

### "Access Denied"

**原因：** 存储桶权限问题

**解决：**
```bash
mc anonymous set download local/drama-studio
```

### "Connection Refused"

**原因：** MinIO 未启动或端口未开放

**解决：**
1. 检查容器状态：`docker ps`
2. 检查端口：`netstat -tlnp | grep 9000`
3. 检查防火墙设置

---

## 推荐配置

生产环境建议修改默认密码：

```yaml
environment:
  MINIO_ROOT_USER: your-secure-username
  MINIO_ROOT_PASSWORD: your-secure-password-at-least-8-chars
```

同时更新 `.env` 文件：

```env
S3_ACCESS_KEY=your-secure-username
S3_SECRET_KEY=your-secure-password-at-least-8-chars
```
