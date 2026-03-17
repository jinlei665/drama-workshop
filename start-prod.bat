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

echo [检查环境]
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装 Node.js
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装 pnpm
    pause
    exit /b 1
)

echo.
echo [启动生产服务器]
echo 访问地址: http://localhost:5000
echo 按 Ctrl+C 停止服务
echo.

set PORT=5000
pnpm run start
pause
