@echo off
chcp 65001 >nul
title Ver la web en mi ordenador
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Falta Node.js. Instalalo desde https://nodejs.org ^(boton LTS^) y vuelve a abrir este archivo.
  echo.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando lo necesario ^(solo la primera vez^)...
  call npm install
  if errorlevel 1 ( echo Algo ha fallado instalando. & pause & exit /b 1 )
)
echo.
echo Descargando los precios de hoy y generando la web...
call npm run construir
if errorlevel 1 ( pause & exit /b 1 )
echo.
echo Abriendo la web en tu navegador. Cierra esta ventana para pararla.
call npm run servir
pause
