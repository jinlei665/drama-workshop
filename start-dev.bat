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
    echo 下载地址: https://nodejs.org
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
    echo 下载地址: https://www.gyan.dev/ffmpeg/builds/
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
