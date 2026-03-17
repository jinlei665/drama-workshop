@echo off
chcp 65001 >nul
echo ========================================
echo   短剧漫剧创作工坊 - Windows 安装脚本
echo ========================================
echo.

cd /d "%~dp0"

:: 检查 Node.js
echo [1/5] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装 Node.js
    echo 请从 https://nodejs.org 下载安装 LTS 版本
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% 已安装

:: 检查 pnpm
echo.
echo [2/5] 检查 pnpm...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [安装] 正在安装 pnpm...
    call corepack enable
    call corepack prepare pnpm@latest --activate
)
for /f "tokens=*" %%i in ('pnpm -v 2^>nul') do set PNPM_VER=%%i
echo [OK] pnpm 已就绪

:: 安装依赖
echo.
echo [3/5] 安装项目依赖...
call pnpm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)
echo [OK] 依赖安装完成

:: 检查 FFmpeg
echo.
echo [4/5] 检查 FFmpeg...
where ffmpeg >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 未检测到 FFmpeg
    echo 视频合并功能将不可用
    echo 请从 https://www.gyan.dev/ffmpeg/builds/ 下载安装
    echo 安装后记得添加到系统环境变量 Path
) else (
    for /f "tokens=*" %%i in ('ffmpeg -version 2^>^&1 ^| findstr "ffmpeg version"') do echo [OK] %%i
)

:: 创建环境变量文件
echo.
echo [5/5] 配置环境变量...
if not exist ".env.local" (
    if exist ".env.example" (
        copy .env.example .env.local >nul
        echo [OK] 已创建 .env.local 文件
        echo.
        echo [重要] 请编辑 .env.local 配置以下内容:
        echo   - 数据库连接信息 (如使用 MySQL/Supabase)
        echo   - 对象存储配置
        echo   - FFmpeg 路径 (如未自动检测到)
    ) else (
        echo [警告] 未找到 .env.example 模板文件
    )
) else (
    echo [OK] .env.local 已存在
)

echo.
echo ========================================
echo   安装完成！
echo ========================================
echo.
echo 后续步骤:
echo   1. 编辑 .env.local 配置环境变量
echo   2. 运行 pnpm run build 构建项目
echo   3. 运行 start-prod.bat 启动生产服务
echo.
echo 或运行 start-dev.bat 直接启动开发环境
echo.
pause
