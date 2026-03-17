@echo off
chcp 65001 >nul
echo ========================================
echo   短剧漫剧创作工坊 - 构建脚本
echo ========================================
echo.

cd /d "%~dp0"

:: 检查环境
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

:: 类型检查
echo [1/2] 类型检查...
call pnpm run typecheck
if %errorlevel% neq 0 (
    echo [错误] 类型检查失败
    pause
    exit /b 1
)

:: 构建
echo.
echo [2/2] 构建生产版本...
call pnpm run build
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   构建完成！
echo ========================================
echo.
echo 运行 start-prod.bat 启动生产服务
echo.
pause
