@echo off
echo Starting ScanFi with Cloudflare Tunnel...
echo.
echo Step 1: Start the backend server in a new window
start "ScanFi Backend" cmd /k "cd /d C:\scanfi\backend && python -m uvicorn app:app --port 8000"

echo Waiting for server to start...
timeout /t 3 /nobreak >nul

echo.
echo Step 2: Starting Cloudflare Tunnel...
echo Look for the URL like: https://xxx-xxx-xxx.trycloudflare.com
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8000
