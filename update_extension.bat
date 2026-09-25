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

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"

if not defined BRANCH (
    echo ERROR: Git is in detached HEAD state.
    echo Switch to a branch before running this updater.
    echo.
    pause
    exit /b 1
)

echo Current branch: %BRANCH%
echo.
echo Fetching latest code...
git fetch origin
if errorlevel 1 goto :error

git ls-remote --exit-code --heads origin "%BRANCH%" >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: The branch "%BRANCH%" does not exist on origin.
    echo Push the branch first, or switch to a tracked remote branch.
    echo.
    pause
    exit /b 1
)

echo Pulling latest changes for %BRANCH%...
git pull --ff-only origin "%BRANCH%"
if errorlevel 1 goto :error

echo.
echo Update complete on branch: %BRANCH%
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
