@echo off
echo Starting all Flowly servers...

start "Flowly Backend" cmd /k "cd /d %~dp0Flowly-WebApp && dotnet run --project Flowly.API/Flowly.API.csproj"

timeout /t 3 /nobreak >nul

start "Flowly Frontend" cmd /k "cd /d %~dp0Flowly-WebApp\flowly-frontend && npm run dev"

timeout /t 3 /nobreak >nul

start "Flowly Mobile" cmd /k "cd /d %~dp0Flowly-Mobile && npx expo start --port 8083"

echo Done! Backend :5289  Frontend :5173  Mobile :8083