@echo off
rem Starts a local web server for this folder and opens the site in your browser.
rem 3D models only load through a server, not by double-clicking index.html.
cd /d "%~dp0"
set PORT=8080
echo.
echo   Site running at  http://localhost:%PORT%
echo   Keep this window open while presenting. Press Ctrl+C to stop.
echo.
start "" "http://localhost:%PORT%"
where python >nul 2>nul && (python -m http.server %PORT% & goto :eof)
where py >nul 2>nul && (py -m http.server %PORT% & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p %PORT% -c-1 & goto :eof)
echo Could not find Python or Node.js.
echo Install Python from python.org, or open this folder in VS Code and use the "Live Server" extension.
pause
