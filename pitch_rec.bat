@echo off
cd /d %~dp0

rem Activate the virtual environment
call app_env\Scripts\activate.bat

rem Run the app
python app.py

pause