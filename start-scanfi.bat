@echo off
title ScanFi Server
echo ========================================
echo   ScanFi - Product Scanner PWA
echo ========================================
echo.
echo Starting server at http://localhost:8000
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"
start http://localhost:8000
python -m uvicorn backend.app:app --reload --port 8000
