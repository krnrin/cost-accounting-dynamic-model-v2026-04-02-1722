@echo off
title 高压线束成本核算 - Dev Server
cd /d "C:\Users\lyvee\.accio\accounts\7083816540\agents\DID-F456DA-2B0D4C\project\cost-accounting-dynamic-model-v2026-04-02-1722\app"
echo ========================================
echo   高压线束成本核算动态模型 - Dev Server
echo ========================================
echo.
echo  启动中... 请等待出现 Local: http://localhost:5173
echo  启动后在浏览器打开 http://localhost:5173
echo  按 Ctrl+C 停止服务
echo.
npx vite --host
pause
