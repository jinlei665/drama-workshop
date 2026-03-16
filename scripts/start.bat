@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ========================================
echo   Drama Studio - Starting...
echo ========================================
echo.

REM Set default port
if not defined PORT set PORT=5000

REM Check and load .env file
if exist ".env" (
    echo [1/3] Loading .env file...
    for /f "usebackq eol= tokens=1,* delims==" %%a in (".env") do (
        set "line=%%a"
        REM Skip empty lines and comments
        if defined line (
            echo !line! | findstr /r /c:"^[^#]" >nul 2>&1
            if !errorlevel! equ 0 (
                if "%%b" neq "" (
                    set "%%a=%%b"
                )
            )
        )
    )
    echo       OK - Config loaded
) else (
    echo       ERROR - .env file not found
    echo.
    echo Please create .env file first.
    if exist ".env.example" (
        echo.
        copy ".env.example" ".env" >nul 2>&1
        echo Created .env from .env.example
        echo Please edit .env and restart.
    )
    pause
    exit /b 1
)

echo.
echo [2/3] Checking configuration...

REM Display config
if defined DATABASE_TYPE (
    echo       DATABASE_TYPE: !DATABASE_TYPE!
) else (
    echo       DATABASE_TYPE: (not set, will auto-detect)
)

if defined DATABASE_URL (
    echo       DATABASE_URL: !DATABASE_URL!
)

if defined NEXT_PUBLIC_SUPABASE_URL (
    echo       SUPABASE_URL: !NEXT_PUBLIC_SUPABASE_URL!
)

REM Check database configuration
REM If DATABASE_URL starts with mysql://, use MySQL
if defined DATABASE_URL (
    echo !DATABASE_URL! | findstr /c:"mysql://" >nul 2>&1
    if !errorlevel! equ 0 (
        echo       OK - MySQL database configured
        goto :start_server
    )
)

REM Check for Supabase
if defined NEXT_PUBLIC_SUPABASE_URL (
    echo       OK - Supabase configured
    goto :start_server
)

REM No valid database configuration
echo.
echo       ERROR - Database not configured
echo.
echo       Please set ONE of these in .env:
echo.
echo       Option 1 - Local MySQL:
echo         DATABASE_URL=mysql://root:password@localhost:3306/drama_studio
echo.
echo       Option 2 - Supabase Cloud:
echo         NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
echo         NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
echo.
pause
exit /b 1

:start_server
echo.
echo [3/3] Starting server...
echo       Port: !PORT!
echo.

REM Set hostname
set HOSTNAME=0.0.0.0

REM Find and run server.js
if exist "app\server.js" (
    cd app
    ..\node\node.exe server.js
) else if exist "app\workspace\projects\server.js" (
    cd app\workspace\projects
    ..\..\..\node\node.exe server.js
) else (
    echo       ERROR - server.js not found
    echo       Application may be corrupted. Please reinstall.
    pause
    exit /b 1
)

pause
