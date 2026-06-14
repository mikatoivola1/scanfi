@echo off
echo Starting ScanFi...
echo.
echo Step 1: Starting backend server in new window...
start "ScanFi Backend" cmd /k "cd /d C:\scanfi\backend && python -m uvicorn app:app --port 8000"

echo Waiting for server to start...
timeout /t 3 /nobreak >nul

echo.
echo Step 2: Starting ngrok tunnel...
echo Look for the URL like: https://xxxx.ngrok-free.app
echo.
"C:\Users\mikat\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" http 8000
