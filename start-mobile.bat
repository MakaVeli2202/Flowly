@echo off
set "PATH=C:\temp\node20\node-v20.19.0-win-x64;%PATH%"
cd /d "%~dp0Glanz-Mobile"
node --version
npx expo start --port 8083