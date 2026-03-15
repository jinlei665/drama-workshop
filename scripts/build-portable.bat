@echo off
REM 短剧漫剧创作工坊 - Windows 便携版打包脚本
REM 需要在 Git Bash 或 WSL 中运行

setlocal enabledelayedexpansion

set VERSION=1.0.0
set PROJECT_NAME=drama-studio
set BUILD_DIR=dist/portable
set NODE_VERSION=20.11.0

echo ========================================
echo 短剧漫剧创作工坊 - Windows 便携版打包工具
echo 版本: %VERSION%
echo ========================================

REM 检查必要工具
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js，请先安装
    exit /b 1
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 pnpm，请先安装
    exit /b 1
)

REM 清理旧的构建文件
echo.
echo [1/5] 清理旧的构建文件...
if exist %BUILD_DIR% rmdir /s /q %BUILD_DIR%
mkdir %BUILD_DIR%

REM 构建项目
echo.
echo [2/5] 构建项目...
call pnpm run build
if %errorlevel% neq 0 (
    echo 错误: 构建失败
    exit /b 1
)

REM 创建输出目录
echo.
echo [3/5] 准备应用文件...
set OUTPUT_DIR=%BUILD_DIR%\%PROJECT_NAME%-win-x64
mkdir %OUTPUT_DIR%\app

REM 复制构建产物
xcopy /s /e /q .next\standalone\* %OUTPUT_DIR%\app\
xcopy /s /e /q .next\static %OUTPUT_DIR%\app\.next\static\
xcopy /s /e /q public %OUTPUT_DIR%\app\public\

REM 创建启动脚本
echo.
echo [4/5] 创建启动脚本...

(
echo @echo off
echo cd /d "%%~dp0app"
echo set PORT=5000
echo set HOSTNAME=0.0.0.0
echo node server.js
echo pause
) > %OUTPUT_DIR%\start.bat

REM 创建环境变量配置文件
(
echo # 数据库配置
echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/drama_studio
echo.
echo # API 密钥
echo LLM_API_KEY=your-llm-api-key
echo IMAGE_API_KEY=your-image-api-key
echo VIDEO_API_KEY=your-video-api-key
) > %OUTPUT_DIR%\.env.example

REM 创建说明文件
(
echo # 短剧漫剧创作工坊 v%VERSION%
echo.
echo ## 快速开始
echo.
echo 1. 确保 Node.js 已安装（推荐 v20+）
echo 2. 复制 `.env.example` 为 `.env` 并配置环境变量
echo 3. 双击运行 `start.bat`
echo 4. 打开浏览器访问 http://localhost:5000
echo.
echo ## 系统要求
echo.
echo - Windows 10/11 x64
echo - Node.js v20+ （需要自行安装）
echo - 内存：至少 2GB
echo - 磁盘：至少 1GB 可用空间
) > %OUTPUT_DIR%\README.md

REM 打包
echo.
echo [5/5] 打包压缩文件...
powershell -command "Compress-Archive -Path '%OUTPUT_DIR%' -DestinationPath '%BUILD_DIR%\%PROJECT_NAME%-win-x64.zip' -Force"

REM 清理临时目录
rmdir /s /q %OUTPUT_DIR%

echo.
echo ========================================
echo 打包完成！
echo.
echo 输出文件：dist\portable\%PROJECT_NAME%-win-x64.zip
echo ========================================

pause
