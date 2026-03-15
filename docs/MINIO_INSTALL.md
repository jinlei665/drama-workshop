# MinIO 本地安装指南（无需 Docker）

本文档介绍如何在**没有 Docker** 的情况下安装和使用 MinIO 对象存储。

---

## 目录
- [什么是 MinIO](#什么是-minio)
- [快速开始](#快速开始)
- [各系统安装方法](#各系统安装方法)
- [创建存储桶](#创建存储桶)
- [配置项目连接](#配置项目连接)
- [常见问题](#常见问题)

---

## 什么是 MinIO

MinIO 是一个高性能、兼容 S3 协议的对象存储服务：
- ✅ 完全免费开源
- ✅ 兼容 AWS S3 API
- ✅ 支持大文件存储
- ✅ 提供 Web 管理界面
- ✅ 支持所有主流操作系统

---

## 快速开始

### 登录信息

| 项目 | 值 |
|------|-----|
| API 地址 | http://localhost:9000 |
| 控制台地址 | http://localhost:9001 |
| 用户名 | `minioadmin` |
| 密码 | `minioadmin123` |

---

## 各系统安装方法

### Ubuntu / Debian / Linux

#### 1. 下载 MinIO

```bash
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
```

#### 2. 创建数据目录

```bash
sudo mkdir -p /data/minio
sudo chown $USER:$USER /data/minio
```

#### 3. 启动 MinIO

**前台启动（测试）：**
```bash
MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin123 \
  minio server /data/minio --console-address ":9001"
```

**后台启动：**
```bash
nohup minio server /data/minio --console-address ":9001" > /var/log/minio.log 2>&1 &
```

#### 4. 设置开机自启（systemd）

```bash
sudo tee /etc/systemd/system/minio.service << 'EOF'
[Unit]
Description=MinIO Object Storage
After=network.target

[Service]
User=your_username
Group=your_username
Environment="MINIO_ROOT_USER=minioadmin"
Environment="MINIO_ROOT_PASSWORD=minioadmin123"
ExecStart=/usr/local/bin/minio server /data/minio --console-address ":9001"
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 替换 your_username 为你的用户名
sudo sed -i "s/your_username/$USER/g" /etc/systemd/system/minio.service

# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable --now minio

# 检查状态
sudo systemctl status minio
```

#### 5. 停止/重启服务

```bash
sudo systemctl stop minio      # 停止
sudo systemctl restart minio   # 重启
sudo systemctl status minio    # 查看状态
```

---

### Windows

#### 1. 下载 MinIO

- **直接下载**：https://dl.min.io/server/minio/release/windows-amd64/minio.exe
- 或使用 PowerShell：
  ```powershell
  mkdir C:\minio
  Invoke-WebRequest -Uri "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile "C:\minio\minio.exe"
  ```

#### 2. 创建数据目录

```cmd
mkdir C:\minio-data
```

#### 3. 启动 MinIO

**CMD 方式：**
```cmd
set MINIO_ROOT_USER=minioadmin
set MINIO_ROOT_PASSWORD=minioadmin123
C:\minio\minio.exe server C:\minio-data --console-address ":9001"
```

**PowerShell 方式：**
```powershell
$env:MINIO_ROOT_USER="minioadmin"
$env:MINIO_ROOT_PASSWORD="minioadmin123"
C:\minio\minio.exe server C:\minio-data --console-address ":9001"
```

**创建启动脚本（推荐）：**

创建文件 `C:\minio\start-minio.bat`：
```cmd
@echo off
title MinIO Server
set MINIO_ROOT_USER=minioadmin
set MINIO_ROOT_PASSWORD=minioadmin123
echo Starting MinIO Server...
echo Console: http://localhost:9001
echo User: minioadmin
echo Password: minioadmin123
echo.
C:\minio\minio.exe server C:\minio-data --console-address ":9001"
pause
```

双击 `start-minio.bat` 即可启动。

#### 4. 设置开机自启（使用 NSSM）

1. **下载 NSSM**：https://nssm.cc/download
2. 解压到 `C:\nssm\`
3. 以管理员身份运行 CMD：

```cmd
# 安装服务
C:\nssm\nssm.exe install MinIO "C:\minio\minio.exe" "server C:\minio-data --console-address :9001"

# 设置环境变量
C:\nssm\nssm.exe set MinIO AppEnvironmentExtra "MINIO_ROOT_USER=minioadmin" "MINIO_ROOT_PASSWORD=minioadmin123"

# 启动服务
C:\nssm\nssm.exe start MinIO

# 设置开机自启
C:\nssm\nssm.exe set MinIO Start SERVICE_AUTO_START
```

#### 5. 管理服务

```cmd
# 查看状态
C:\nssm\nssm.exe status MinIO

# 停止服务
C:\nssm\nssm.exe stop MinIO

# 重启服务
C:\nssm\nssm.exe restart MinIO

# 卸载服务
C:\nssm\nssm.exe remove MinIO confirm
```

---

### macOS

#### 1. 使用 Homebrew 安装

```bash
brew install minio/stable/minio
```

#### 2. 手动安装

```bash
wget https://dl.min.io/server/minio/release/darwin-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
```

#### 3. 启动 MinIO

```bash
mkdir -p ~/minio-data

MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin123 \
  minio server ~/minio-data --console-address ":9001"
```

#### 4. 设置开机自启（launchd）

创建 `~/Library/LaunchAgents/com.minio.minio.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.minio.minio</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/minio</string>
        <string>server</string>
        <string>/Users/your_username/minio-data</string>
        <string>--console-address</string>
        <string>:9001</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>MINIO_ROOT_USER</key>
        <string>minioadmin</string>
        <key>MINIO_ROOT_PASSWORD</key>
        <string>minioadmin123</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

加载服务：
```bash
launchctl load ~/Library/LaunchAgents/com.minio.minio.plist
```

---

## 创建存储桶

### 方式一：Web 控制台（推荐）

1. 打开浏览器访问：http://localhost:9001
2. 登录：
   - 用户名：`minioadmin`
   - 密码：`minioadmin123`
3. 点击左侧 "Buckets"
4. 点击 "Create Bucket"
5. 输入名称：`drama-studio`
6. 点击 "Create Bucket"

### 方式二：命令行（mc 客户端）

**安装 mc 客户端：**

```bash
# Linux
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Windows PowerShell
Invoke-WebRequest -Uri "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile "C:\minio\mc.exe"

# macOS
brew install minio/stable/mc
```

**创建存储桶：**

```bash
# 配置别名
mc alias set local http://localhost:9000 minioadmin minioadmin123

# 创建存储桶
mc mb local/drama-studio

# 设置公开访问（可选，允许直接访问文件）
mc anonymous set download local/drama-studio

# 验证
mc ls local
```

---

## 配置项目连接

编辑项目 `.env` 文件：

```env
# MinIO 本地配置
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-studio
S3_REGION=us-east-1
```

**⚠️ 生产环境请修改默认密码：**

```env
S3_ACCESS_KEY=your-secure-username
S3_SECRET_KEY=your-secure-password-at-least-8-chars
```

同时更新 MinIO 启动时的环境变量：
```bash
MINIO_ROOT_USER=your-secure-username
MINIO_ROOT_PASSWORD=your-secure-password-at-least-8-chars
```

---

## 常见问题

### Q: 登录无效，提示用户名或密码错误？

1. 确认访问的是 **9001** 端口（控制台），不是 9000（API）
2. 清除浏览器缓存或使用无痕模式
3. 检查启动时设置的环境变量是否正确
4. 重启 MinIO 服务

### Q: 如何查看 MinIO 日志？

**Linux（systemd）：**
```bash
sudo journalctl -u minio -f
```

**Windows（NSSM）：**
```cmd
# 日志在 Windows 事件查看器中
# 或查看服务状态
C:\nssm\nssm.exe status MinIO
```

**前台启动：**
直接在终端查看输出

### Q: 如何修改默认存储路径？

修改启动命令中的路径：
```bash
minio server /your/custom/path --console-address ":9001"
```

### Q: 如何修改端口？

```bash
minio server /data --address ":9002" --console-address ":9003"
```

### Q: 如何检查 MinIO 是否正常运行？

```bash
# 检查健康状态
curl http://localhost:9000/minio/health/live

# 应返回 200 OK
```

### Q: 如何完全卸载 MinIO？

**Linux：**
```bash
sudo systemctl stop minio
sudo systemctl disable minio
sudo rm /etc/systemd/system/minio.service
sudo rm /usr/local/bin/minio
sudo rm -rf /data/minio
```

**Windows：**
```cmd
# 停止并卸载服务
C:\nssm\nssm.exe stop MinIO
C:\nssm\nssm.exe remove MinIO confirm

# 删除文件
rmdir /s /q C:\minio
rmdir /s /q C:\minio-data
```

---

## 相关文档

- [MinIO 官方文档](https://min.io/docs/minio/linux/index.html)
- [数据库与存储配置指南](./DATABASE_STORAGE_CONFIG.md)
- [MinIO 问题排查](./MINIO_TROUBLESHOOTING.md)
