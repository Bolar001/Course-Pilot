@echo off
echo Starting EduCoach AI Backend...
cd server
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
echo Starting server...
call npm start
pause
