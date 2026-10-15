@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo   BEAUTY TECH - PROTOTIPO DE RETAIL INTELIGENTE
echo ==============================================
echo.
where php >nul 2>&1
if %errorlevel%==0 (
  echo Iniciando servidor con PHP...
  start "Beauty Tech - servidor local" /D "%~dp0" cmd /k "php -S 127.0.0.1:8000"
  goto OPEN
)
where py >nul 2>&1
if %errorlevel%==0 (
  echo PHP no encontrado. Iniciando servidor con Python...
  start "Beauty Tech - servidor local" /D "%~dp0" cmd /k "py -m http.server 8000 --bind 127.0.0.1"
  goto OPEN
)
where python >nul 2>&1
if %errorlevel%==0 (
  echo PHP no encontrado. Iniciando servidor con Python...
  start "Beauty Tech - servidor local" /D "%~dp0" cmd /k "python -m http.server 8000 --bind 127.0.0.1"
  goto OPEN
)
echo No se ha encontrado PHP ni Python.
echo Instala PHP o Python, o ejecuta el proyecto desde XAMPP.
echo Consulta README.md para ver las instrucciones.
pause
exit /b 1

:OPEN
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8000/
echo.
echo La demo se ha abierto en el navegador.
echo No cierres la ventana del servidor mientras la uses.
echo Para detenerlo, cierra la ventana del servidor.
endlocal
