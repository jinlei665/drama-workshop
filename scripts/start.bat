@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ========================================
echo   Drama Studio - Starting...
echo ========================================
echo.

if not defined PORT set PORT=5000

if exist ".env" (
    echo [1/3] Loading .env file...
    for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
        set "key=%%a"
        set "val=%%b"
        if defined key if defined val (
            for /f "tokens=* delims= " %%c in ("!val!") do set "val=%%c"
            set "!key!=!val!"
        )
    )
    echo       OK - Config loaded
) else (
    echo       ERROR - .env file not found
    echo.
    echo Please create .env file:
    echo   1. Copy .env.example to .env
    echo   2. Edit .env with your database and API settings
    echo.
    if exist ".env.example" (
        echo Copy .env.example to .env? [Y/N]
        choice /c YN /n /m "Select: "
        if !errorlevel! equ 1 (
            copy ".env.example" ".env" >nul
            echo       OK - .env created, please edit and restart
        )
    )
    pause
    exit /b 1
)

echo.
echo [2/3] Checking configuration...
echo       DATABASE_TYPE: !DATABASE_TYPE!
if defined DATABASE_URL echo       DATABASE_URL: !DATABASE_URL!
if defined NEXT_PUBLIC_SUPABASE_URL echo       SUPABASE_URL: !NEXT_PUBLIC_SUPABASE_URL!

if "!DATABASE_TYPE!"=="mysql" (
    if not defined DATABASE_URL (
        echo.
        echo       ERROR - DATABASE_URL not set
        echo       Set DATABASE_URL=mysql://user:pass@host:port/db in .env
        pause
        exit /b 1
    )
) else (
    if not defined NEXT_PUBLIC_SUPABASE_URL if not defined COZE_SUPABASE_URL (
        echo.
        echo       ERROR - Database not configured
        echo       Set in .env:
        echo         DATABASE_TYPE=mysql + DATABASE_URL (for MySQL)
        echo         OR
        echo         NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (for Supabase)
        pause
        exit /b 1
    )
)

echo       OK - Database configured

echo.
echo [3/3] Starting server...
echo       Port: !PORT!
echo.

if exist "app\server.js" (
    cd app
    set HOSTNAME=0.0.0.0
    ..\node\node.exe server.js
) else if exist "app\workspace\projects\server.js" (
    cd app\workspace\projects
    set HOSTNAME=0.0.0.0
    ..\..\..\node\node.exe server.js
) else (
    echo       ERROR - server.js not found
    echo       Please reinstall the application
    pause
    exit /b 1
)

pause
