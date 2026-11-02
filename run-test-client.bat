@echo off
title Rintarou Closet - Ban Test Desktop
echo ========================================================
echo   KHOI DONG RINTAROU CLOSET - BAN TEST DONG BO VA TRANG PHUC
echo   Gia lap: Faker #T1 - Chay song song 100%% voi client chinh
echo ========================================================
echo.

set HEXTECH_TEST_MODE=1

if exist "Rintarou Closet.exe" (
    echo Dang khoi chay Rintarou Closet - Ban Test Desktop...
    start "" "Rintarou Closet.exe" --test
    exit /b 0
)

if exist "target\release\hextech-skin-client.exe" (
    echo Dang khoi chay Rintarou Closet - Ban Test Desktop...
    start "" "target\release\hextech-skin-client.exe" --test
    exit /b 0
)

if exist "hextech-skin-client.exe" (
    echo Dang khoi chay Rintarou Closet - Ban Test Desktop...
    start "" "hextech-skin-client.exe" --test
    exit /b 0
)

if exist "target\debug\hextech-skin-client.exe" (
    echo Dang khoi chay Rintarou Closet - Ban Test Desktop...
    start "" "target\debug\hextech-skin-client.exe" --test
    exit /b 0
)

echo Dang khoi chay thong qua npm run tauri:dev...
npm run tauri:dev -- -- --test
