@echo off
set "PATH=C:\temp\node20\node-v20.19.0-win-x64;%PATH%"
echo Starting all Glanz servers...

start "Glanz Backend" cmd /k "cd /d %~dp0Glanz-WebApp && dotnet run --project Glanz.API/Glanz.API.csproj"

timeout /t 2 /nobreak >nul

start "Glanz Frontend" cmd /k "cd /d %~dp0Glanz-WebApp\glanz-frontend && npm run dev"

timeout /t 3 /nobreak >nul

start "Glanz Mobile" cmd /k "set PATH=C:\temp\node20\node-v20.19.0-win-x64;%PATH% && cd /d %~dp0Glanz-Mobile && npx expo start --port 8083"

echo DONE! Backend (5289), Frontend (5173), Mobile (8083) all running.