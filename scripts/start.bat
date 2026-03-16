@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║           短剧漫剧创作工坊 - 启动中...                       ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM 设置默认端口
if not defined PORT set PORT=5000

REM 检查 .env 文件
if exist ".env" (
    echo [1/3] 加载 .env 配置文件...
    for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
        set "key=%%a"
        set "val=%%b"
        if defined key if defined val (
            REM 去除前后空格
            for /f "tokens=* delims= " %%c in ("!val!") do set "val=%%c"
            set "!key!=!val!"
        )
    )
    echo       √ 配置已加载
) else (
    echo       × 未找到 .env 文件
    echo.
    echo 请先配置 .env 文件：
    echo   1. 复制 .env.example 为 .env
    echo   2. 编辑 .env 填入数据库和 API 配置
    echo.
    if exist ".env.example" (
        echo 是否复制 .env.example 为 .env? [Y/N]
        choice /c YN /n /m "请选择: "
        if !errorlevel! equ 1 (
            copy ".env.example" ".env" >nul
            echo       √ 已创建 .env 文件，请编辑后重新启动
        )
    )
    pause
    exit /b 1
)

echo.
echo [2/3] 检查环境配置...
echo       DATABASE_TYPE: !DATABASE_TYPE!
echo       DATABASE_URL: !DATABASE_URL!
if defined NEXT_PUBLIC_SUPABASE_URL (
    echo       SUPABASE_URL: !NEXT_PUBLIC_SUPABASE_URL!
)

REM 检查必要的数据库配置
if "!DATABASE_TYPE!"=="mysql" (
    if not defined DATABASE_URL (
        echo.
        echo       × 错误: 未配置 DATABASE_URL
        echo       请在 .env 中设置 DATABASE_URL=mysql://user:pass@host:port/db
        pause
        exit /b 1
    )
) else (
    if not defined NEXT_PUBLIC_SUPABASE_URL if not defined COZE_SUPABASE_URL (
        echo.
        echo       × 错误: 未配置数据库
        echo       请在 .env 中设置:
        echo         - DATABASE_TYPE=mysql 和 DATABASE_URL (本地 MySQL)
        echo         或
        echo         - NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase)
        pause
        exit /b 1
    )
)

echo       √ 数据库配置正确

echo.
echo [3/3] 启动服务器...
echo       端口: !PORT!
echo.

REM 检查 server.js 位置
if exist "app\server.js" (
    cd app
    set HOSTNAME=0.0.0.0
    ..\node\node.exe server.js
) else if exist "app\workspace\projects\server.js" (
    cd app\workspace\projects
    set HOSTNAME=0.0.0.0
    ..\..\..\node\node.exe server.js
) else (
    echo       × 错误: 未找到 server.js
    echo       请确认应用已正确安装
    pause
    exit /b 1
)

pause
