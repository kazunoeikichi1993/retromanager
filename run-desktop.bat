@echo off
setlocal
cd /d "%~dp0"

:: 1. Verificar si Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo =========================================================
    echo [ERROR] Node.js no esta instalado en este equipo.
    echo Por favor descarga e instala Node.js LTS desde:
    echo    https://nodejs.org/
    echo =========================================================
    echo.
    pause
    exit /b 1
)

:: 2. Ejecutar launcher nativo a prueba de caracteres especiales (&, espacios, parentesis)
node "scripts\launcher.cjs" %*
if %errorlevel% neq 0 (
    echo.
    pause
)
