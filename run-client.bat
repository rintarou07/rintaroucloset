@echo off
title Rintarou Closet - Client Chinh
echo ========================================================
echo   KHOI DONG RINTAROU CLOSET - CLIENT CHINH
echo ========================================================
echo.

if exist "Rintarou Closet.exe" (
    echo Dang khoi chay Rintarou Closet...
    start "" "Rintarou Closet.exe"
    exit /b 0
)

if exist "target\release\hextech-skin-client.exe" (
    echo Dang khoi chay Rintarou Closet...
    start "" "target\release\hextech-skin-client.exe"
    exit /b 0
)

if exist "hextech-skin-client.exe" (
    echo Dang khoi chay Rintarou Closet...
    start "" "hextech-skin-client.exe"
    exit /b 0
)

echo Dang khoi chay thong qua npm run tauri:dev...
npm run tauri:dev
