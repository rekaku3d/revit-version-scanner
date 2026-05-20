@echo off
title Revit Version Scanner Server
echo ===================================================
echo   Starting Revit Version Scanner Local Server...
echo   Url: http://127.0.0.1:8000
echo ===================================================
cd /d "C:\Users\Admin\Documents\github\revit-version-scanner"
start "" "http://127.0.0.1:8000"
python -m http.server 8000 --bind 127.0.0.1
pause
