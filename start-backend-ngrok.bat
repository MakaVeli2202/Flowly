@echo off
setlocal

echo Starting Flowly API locally and exposing it with ngrok...

start "Flowly Backend API" cmd /k "cd /d %~dp0Flowly-WebApp && dotnet run --project Flowly.API/Flowly.API.csproj --urls http://localhost:5289"

timeout /t 4 /nobreak >nul

where ngrok >nul 2>&1
if errorlevel 1 (
  echo ngrok is not installed or not in PATH.
  echo Install it with: winget install ngrok.ngrok
  pause
  exit /b 1
)

start "Flowly ngrok Tunnel" cmd /k "ngrok http http://localhost:5289"

echo.
echo DONE!
echo 1) API running at http://localhost:5289
echo 2) ngrok UI at http://127.0.0.1:4040
echo 3) Copy the HTTPS Forwarding URL from ngrok and set it in Vercel as:
echo    VITE_API_BASE_URL=https://your-ngrok-url.ngrok-free.app
echo.

start "" http://127.0.0.1:4040

endlocal
