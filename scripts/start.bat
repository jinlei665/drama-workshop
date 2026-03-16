@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================
echo 短剧漫剧创作工坊 - 启动中...
echo ========================================

REM 检查 .env 文件
if exist .env (
    echo 正在加载 .env 文件...
    for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
        if "%%a" neq "" if "%%b" neq "" (
            set "%%a=%%b"
            echo 已设置: %%a
        )
    )
) else (
    echo 警告: 未找到 .env 文件，请复制 .env.example 为 .env 并配置
)

REM 设置默认端口
if not defined PORT set PORT=5000
set HOSTNAME=0.0.0.0

echo.
echo 当前环境变量:
echo   NEXT_PUBLIC_SUPABASE_URL=!NEXT_PUBLIC_SUPABASE_URL!
echo   DATABASE_TYPE=!DATABASE_TYPE!
echo   PORT=!PORT!
echo.

REM 检查必要的环境变量
if not defined NEXT_PUBLIC_SUPABASE_URL (
    echo 错误: 未配置 NEXT_PUBLIC_SUPABASE_URL
    echo 请在 .env 文件中配置 Supabase 连接信息
    echo.
    pause
    exit /b 1
)

echo ========================================
echo 启动服务器，端口: !PORT!
echo ========================================
echo.

REM 检查 server.js 位置（新版构建路径）
if exist "app\workspace\projects\server.js" (
    cd app\workspace\projects
    ..\..\..\node\node.exe server.js
) else if exist "app\server.js" (
    cd app
    ..\node\node.exe server.js
) else (
    echo 错误: 未找到 server.js
    echo 请确认应用已正确安装
    pause
    exit /b 1
)

pause
