@echo off
echo ===========================================
echo    KPI OTC Dashboard
echo ===========================================
echo.
echo Dang khoi dong...
cd /d "%~dp0backend"
start "" http://localhost:5173
node server.js
