@echo off
setlocal

cd /d "%~dp0"

echo.
echo ========================================
echo   PixGrabber Extension Updater
echo ========================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git was not found in PATH.
    echo Install Git for Windows and try again.
    echo.
    pause
    exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ERROR: This folder is not a Git repository.
    echo Run this updater from inside the Pixgrabber-Extension folder.
    echo.
    pause
    exit /b 1
)

echo Fetching latest code...
git fetch origin
if errorlevel 1 goto :error

git show-ref --verify --quiet refs/heads/chrome-mv3
if errorlevel 1 (
    echo Creating local chrome-mv3 branch...
    git switch -c chrome-mv3 --track origin/chrome-mv3
) else (
    echo Switching to chrome-mv3...
    git switch chrome-mv3
)
if errorlevel 1 goto :error

echo Pulling latest changes...
git pull --ff-only origin chrome-mv3
if errorlevel 1 goto :error

echo.
echo Update complete.
echo.
echo If Chrome is using this as an unpacked extension:
echo   1. Open chrome://extensions
echo   2. Click Reload on Pix Thumbnail Grabber
echo.
pause
exit /b 0

:error
echo.
echo Update failed.
echo Git may have reported local changes or another problem above.
echo Your files have not been force-reset.
echo.
pause
exit /b 1
