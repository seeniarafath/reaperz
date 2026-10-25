@echo off
title REAPERZ Community Portal Server
color 0B
echo ===================================================
echo     REAPERZ TAMIL GTA 5 & FIVEM COMMUNITY PORTAL
echo ===================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Starting server with Node.js on http://localhost:5000 ...
    echo.
    start "" http://localhost:5000
    node server.js
    goto end
)

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Starting server with Python on http://localhost:5000 ...
    echo.
    start "" http://localhost:5000
    python app.py
    goto end
)

echo [ERROR] Neither Node.js nor Python was found on your system.
echo Please ensure Node.js is installed to run the backend server.
echo.

:end
pause
