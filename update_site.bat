@echo off
chcp 65001 >nul
cls
echo ============================================================
echo    OLX SCRAPER - DIGITAL PC SITE UPDATER
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Python is not installed!
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

echo ✅ Python found
echo.

REM Check if pip is available
python -m pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: pip is not available!
    pause
    exit /b 1
)

echo ✅ pip found
echo.

REM Install/Update dependencies
echo 📦 Installing required packages...
echo    (This may take a few minutes on first run)
echo.
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt

if errorlevel 1 (
    echo.
    echo ❌ ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ✅ All dependencies installed
echo.
echo ============================================================
echo    STARTING OLX SCRAPER
echo ============================================================
echo.

REM Run the scraper
python scrape_olx.py

if errorlevel 1 (
    echo.
    echo ❌ Scraper encountered an error
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo    ✅ SCRAPING COMPLETED SUCCESSFULLY!
echo ============================================================
echo.
echo Next steps:
echo 1. Check data/products.json for updated product data
echo 2. Check images/products/ for downloaded images
echo 3. Open index.html in browser to verify changes
echo 4. If everything looks good, commit and push to GitHub:
echo    - git add .
echo    - git commit -m "Update products from OLX"
echo    - git push
echo.
pause
