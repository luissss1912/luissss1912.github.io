@echo off
chcp 65001 >nul
REM Programa la publicacion desde tu PC cada 2 horas (solo si usas la opcion 2).
cd /d "%~dp0"
schtasks /Create /F /SC HOURLY /MO 2 /TN "Publicar web gasolineras" /TR "\"%~dp02-PUBLICAR-DESDE-MI-PC.bat\" auto"
if errorlevel 1 ( echo No se pudo programar. & pause & exit /b 1 )
echo Listo: la web se actualizara cada 2 horas mientras el PC este encendido.
echo Para quitarlo: schtasks /Delete /TN "Publicar web gasolineras" /F
pause
