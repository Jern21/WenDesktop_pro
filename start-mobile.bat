@echo off
chcp 936 >nul 2>&1
setlocal enabledelayedexpansion

:: Wen workbench - Mobile PWA dev (port 3460). Requires backend on 3456.

set "ROOT=%~dp0"
set "MOBILE_DIR=%ROOT%mobile-pwa"
set "API_PORT=3460"
set "BACKEND_PORT=3456"

echo.
echo ========================================
echo   Mobile PWA dev server
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo Node.js: %NODE_VER%

netstat -ano | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARN] Backend port %BACKEND_PORT% is not listening.
    echo        Run start.bat first, or: cd backend ^& npm start
    echo.
)

if not exist "%MOBILE_DIR%\package.json" (
    echo [ERROR] Missing folder: %MOBILE_DIR%
    pause
    exit /b 1
)

cd /d "%MOBILE_DIR%"
if %errorlevel% neq 0 (
    echo [ERROR] Cannot cd to mobile-pwa
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] npm install...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)

echo [2/2] Starting Vite http://localhost:%API_PORT%
echo       API proxy -^> http://localhost:%BACKEND_PORT%
echo.
call npm run dev

endlocal
