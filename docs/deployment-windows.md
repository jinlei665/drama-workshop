# Windows 部署攻略

## 系统要求

- **操作系统**: Windows 10/11 (64位)
- **内存**: 最低 4GB，推荐 8GB+
- **存储**: 20GB+ 可用空间

---

## 一、环境准备

### 1.1 安装 Node.js

#### 方法一：官方安装包（推荐新手）

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 **LTS 版本** (v20.x 或更高)
3. 运行安装程序，一路 Next
4. 验证安装：

```powershell
# 打开 PowerShell 或 CMD
node -v    # 应显示 v20.x.x
npm -v     # 应显示 npm 版本
```

#### 方法二：使用 winget（Windows 包管理器）

```powershell
# 安装 Node.js LTS
winget install OpenJS.NodeJS.LTS

# 刷新环境变量（或重启终端）
refreshenv
```

#### 方法三：使用 Chocolatey

```powershell
# 先安装 Chocolatey（如果没有）
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 安装 Node.js
choco install nodejs-lts -y
```

### 1.2 安装 pnpm

```powershell
# 使用 corepack（Node.js 内置）
corepack enable
corepack prepare pnpm@latest --activate

# 或使用 npm 安装
npm install -g pnpm

# 验证
pnpm -v
```

### 1.3 安装 FFmpeg

#### 方法一：使用 winget（最简单）

```powershell
winget install Gyan.FFmpeg
```

#### 方法二：使用 Chocolatey

```powershell
choco install ffmpeg -y
```

#### 方法三：手动安装

1. 访问 [FFmpeg 官方下载页](https://www.gyan.dev/ffmpeg/builds/)
2. 下载 **ffmpeg-release-essentials.zip**
3. 解压到 `C:\ffmpeg`
4. 添加环境变量：

```powershell
# 方法一：通过 PowerShell（需要管理员权限）
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\ffmpeg\bin", "User")

# 方法二：手动添加
# 1. 右键「此电脑」->「属性」->「高级系统设置」
# 2. 点击「环境变量」
# 3. 在「用户变量」中找到「Path」，点击「编辑」
# 4. 添加：C:\ffmpeg\bin
```

5. **重启终端**后验证：

```powershell
ffmpeg -version
ffprobe -version

# 查看安装路径
where ffmpeg
where ffprobe
```

### 1.4 安装 Git

```powershell
# 使用 winget
winget install Git.Git

# 或下载安装包：https://git-scm.com/download/win
```

---

## 二、数据库配置（可选）

### 2.1 方案一：MySQL 本地安装

#### 安装 MySQL

1. 下载 [MySQL Community Server](https://dev.mysql.com/downloads/mysql/)
2. 选择「Windows (x86, 64-bit), ZIP Archive」或 MSI 安装包
3. 运行安装程序，设置 root 密码
4. 创建数据库：

```sql
-- 使用 MySQL Workbench 或命令行
CREATE DATABASE short_drama_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'drama_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON short_drama_db.* TO 'drama_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2.2 方案二：使用 Supabase 云服务

同 Ubuntu 文档，参考 [Supabase](https://supabase.com)

### 2.3 方案三：内存模式（无需安装数据库）

项目支持无数据库运行。

---

## 三、项目部署

### 3.1 克隆项目

```powershell
# 克隆代码
git clone <your-repo-url> short-drama-workshop
cd short-drama-workshop
```

### 3.2 安装依赖

```powershell
pnpm install
```

### 3.3 配置环境变量

```powershell
# 复制环境变量模板
copy .env.example .env.local

# 使用记事本编辑
notepad .env.local

# 或使用 VS Code
code .env.local
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

# 方案二：Supabase
DATABASE_TYPE=supabase
COZE_SUPABASE_URL=https://xxxxx.supabase.co
COZE_SUPABASE_ANON_KEY=your-anon-key

# 方案三：内存模式
DATABASE_TYPE=memory

# 对象存储
COZE_BUCKET_ENDPOINT_URL=your-endpoint-url
COZE_BUCKET_NAME=your-bucket-name

# FFmpeg 路径（Windows 格式）
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
FFPROBE_PATH=C:\ffmpeg\bin\ffprobe.exe
```

### 3.4 构建项目

```powershell
# 类型检查
pnpm run typecheck

# 构建生产版本
pnpm run build
```

### 3.5 启动服务

```powershell
# 开发模式（带热更新）
pnpm run dev

# 生产模式
pnpm run start

# 指定端口启动
$env:PORT=3000; pnpm run start
```

访问：http://localhost:5000

---

## 四、使用 PM2 管理进程（生产环境）

### 4.1 安装 PM2

```powershell
npm install -g pm2
npm install -g pm2-windows-startup

# 安装 Windows 服务
pm2-startup install
```

### 4.2 创建启动脚本

在项目根目录创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'short-drama-workshop',
    script: 'pnpm',
    args: 'start',
    cwd: 'C:/path/to/short-drama-workshop',
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

### 4.3 启动和管理

```powershell
# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs short-drama-workshop

# 重启服务
pm2 restart short-drama-workshop

# 保存进程列表（开机自启）
pm2 save
```

---

## 五、Windows 服务方式运行（可选）

### 5.1 使用 NSSM（推荐）

1. 下载 [NSSM](https://nssm.cc/download)
2. 解压后，在管理员 PowerShell 中运行：

```powershell
# 安装服务
nssm install ShortDramaWorkshop

# 在弹出的窗口中配置：
# Application Path: C:\Program Files\nodejs\node.exe
# Startup directory: C:\path\to\short-drama-workshop
# Arguments: server.js 或 node_modules\next\dist\bin\next start

# 或者命令行直接配置：
nssm install ShortDramaWorkshop "C:\Program Files\nodejs\node.exe"
nssm set ShortDramaWorkshop AppDirectory "C:\path\to\short-drama-workshop"
nssm set ShortDramaWorkshop AppParameters "node_modules\next\dist\bin\next start"
nssm set ShortDramaWorkshop AppEnvironmentExtra "PORT=5000"

# 启动服务
nssm start ShortDramaWorkshop

# 其他命令
nssm stop ShortDramaWorkshop
nssm restart ShortDramaWorkshop
nssm remove ShortDramaWorkshop
```

---

## 六、创建便捷启动脚本

### 6.1 开发环境启动脚本

创建 `start-dev.bat`：

```batch
@echo off
chcp 65001 >nul
echo ================================
echo   短剧漫剧创作工坊 - 开发环境
echo ================================
echo.

cd /d "%~dp0"

echo [检查环境]
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装 Node.js，请先安装
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装 pnpm，请先运行: npm install -g pnpm
    pause
    exit /b 1
)

where ffmpeg >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 未检测到 FFmpeg，视频合并功能将不可用
) else (
    echo [OK] FFmpeg 已就绪
)

echo.
echo [启动开发服务器]
echo 访问地址: http://localhost:5000
echo 按 Ctrl+C 停止服务
echo.

pnpm run dev
pause
```

### 6.2 生产环境启动脚本

创建 `start-prod.bat`：

```batch
@echo off
chcp 65001 >nul
echo ================================
echo   短剧漫剧创作工坊 - 生产环境
echo ================================
echo.

cd /d "%~dp0"

:: 检查是否已构建
if not exist ".next" (
    echo [错误] 项目未构建，请先运行: pnpm run build
    pause
    exit /b 1
)

echo [启动生产服务器]
echo 访问地址: http://localhost:5000
echo 按 Ctrl+C 停止服务
echo.

set PORT=5000
pnpm run start
pause
```

### 6.3 一键安装脚本

创建 `install.bat`：

```batch
@echo off
chcp 65001 >nul
echo ========================================
echo   短剧漫剧创作工坊 - Windows 安装脚本
echo ========================================
echo.

cd /d "%~dp0"

:: 检查 Node.js
echo [1/4] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装 Node.js
    echo 请从 https://nodejs.org 下载安装
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% 已安装

:: 检查 pnpm
echo.
echo [2/4] 检查 pnpm...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [安装] 正在安装 pnpm...
    npm install -g pnpm
)
for /f "tokens=*" %%i in ('pnpm -v') do set PNPM_VER=%%i
echo [OK] pnpm %PNPM_VER% 已就绪

:: 安装依赖
echo.
echo [3/4] 安装项目依赖...
pnpm install
echo [OK] 依赖安装完成

:: 检查 FFmpeg
echo.
echo [4/4] 检查 FFmpeg...
where ffmpeg >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 未检测到 FFmpeg
    echo 视频合并功能将不可用
    echo 请从 https://www.gyan.dev/ffmpeg/builds/ 下载安装
) else (
    echo [OK] FFmpeg 已安装
)

:: 创建环境变量文件
if not exist ".env.local" (
    if exist ".env.example" (
        echo.
        echo [配置] 创建 .env.local 文件...
        copy .env.example .env.local >nul
        echo [OK] 已创建 .env.local，请根据需要修改配置
    )
)

echo.
echo ========================================
echo   安装完成！
echo ========================================
echo.
echo 后续步骤:
echo   1. 编辑 .env.local 配置环境变量
echo   2. 运行 pnpm run build 构建项目
echo   3. 运行 pnpm run start 启动服务
echo.
echo 或直接运行 start-dev.bat 启动开发环境
echo.
pause
```

---

## 七、常见问题

### Q1: FFmpeg 在应用中无法识别

**解决方案**：在设置中手动配置 FFmpeg 路径

1. 打开应用设置页面
2. 找到「FFmpeg 配置」选项卡
3. 设置路径：
   - FFmpeg: `C:\ffmpeg\bin\ffmpeg.exe`
   - FFprobe: `C:\ffmpeg\bin\ffprobe.exe`

### Q2: 端口被占用

```powershell
# 查看端口占用
netstat -ano | findstr :5000

# 结束进程（替换 PID）
taskkill /PID <进程ID> /F
```

### Q3: 脚本执行权限错误

```powershell
# 以管理员身份运行 PowerShell，执行：
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q4: Node Sass / Native 模块编译失败

```powershell
# 安装 Windows 构建工具
npm install -g windows-build-tools

# 或使用 Visual Studio Build Tools
# 下载地址：https://visualstudio.microsoft.com/downloads/
# 安装时选择「Desktop development with C++」
```

### Q5: 中文路径或文件名乱码

```powershell
# 设置终端编码为 UTF-8
chcp 65001

# 确保 .env.local 文件保存为 UTF-8 编码
```

---

## 八、系统资源建议

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 双核 2.0GHz | 四核 3.0GHz+ |
| 内存 | 4 GB | 8 GB+ |
| 存储 | 20 GB | 50 GB+ SSD |

---

## 九、目录结构

```
short-drama-workshop/
├── .env.local          # 环境变量配置
├── .env.example        # 环境变量模板
├── package.json        # 项目依赖
├── pnpm-lock.yaml      # 依赖锁定文件
├── next.config.ts      # Next.js 配置
├── tsconfig.json       # TypeScript 配置
├── start-dev.bat       # 开发环境启动脚本
├── start-prod.bat      # 生产环境启动脚本
├── install.bat         # 一键安装脚本
├── src/                # 源代码目录
│   ├── app/            # Next.js App Router
│   ├── components/     # React 组件
│   ├── lib/            # 工具库
│   └── storage/        # 数据库存储
└── public/             # 静态资源
```

---

## 十、快速启动清单

```powershell
# 1. 克隆项目
git clone <repo-url> && cd short-drama-workshop

# 2. 运行安装脚本
.\install.bat

# 3. 配置环境变量
notepad .env.local

# 4. 构建项目
pnpm run build

# 5. 启动服务
.\start-prod.bat

# 或开发模式
.\start-dev.bat
```

访问 http://localhost:5000 开始使用！
