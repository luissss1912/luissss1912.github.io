@echo off
chcp 65001 >nul
title Publicar la web desde mi PC (Cloudflare Pages)
cd /d "%~dp0"
REM Solo hace falta si GitHub no puede descargar los precios del Ministerio.
REM La primera vez se abrira el navegador para entrar en tu cuenta de Cloudflare.
if not exist node_modules call npm install
call npm run construir
if errorlevel 1 ( pause & exit /b 1 )
call npx --yes wrangler@4 pages deploy dist --project-name gasolineras --branch main --commit-dirty=true
if "%1"=="" pause
