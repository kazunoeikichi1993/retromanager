#!/usr/bin/env bash
# =========================================================
# RetroBat & Game Library Manager Pro - Linux/macOS Launcher
# =========================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================="
echo "   RetroBat & Game Library Manager Pro - Linux/macOS"
echo "========================================================="
echo ""

# 1. Comprobar Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Error: Node.js no está instalado."
    echo "Instálalo usando tu gestor de paquetes:"
    echo "  Ubuntu/Debian: sudo apt install nodejs npm"
    echo "  Arch Linux:    sudo pacman -S nodejs npm"
    echo "  Fedora:        sudo dnf install nodejs npm"
    echo "  macOS:         brew install node"
    exit 1
fi

if [ ! -d "node_modules" ] || [ ! -d "node_modules/vite" ]; then
    echo "📦 Instalando dependencias del proyecto..."
    npm install --legacy-peer-deps
fi

echo "Selecciona el modo de inicio:"
echo "  [1] Modo Aplicación de Escritorio (Ventana independiente)"
echo "  [2] Modo Electron Nativo"
echo "  [3] Compilar AppImage / Paquete Linux (.deb)"
echo "  [4] Servidor Web Local (Acceso LAN / Red)"
echo ""
read -p "Opción (1-4) [1]: " OPT
OPT=${OPT:-1}

case "$OPT" in
    1)
        echo "🚀 Iniciando servidor Vite en segundo plano..."
        npx vite --port=3000 --host=127.0.0.1 >/dev/null 2>&1 &
        VITE_PID=$!
        trap "kill $VITE_PID 2>/dev/null || true" EXIT

        sleep 2
        echo "🖥️ Abriendo ventana de aplicación..."

        # Intentar abrir en modo app con navegadores disponibles
        if command -v google-chrome >/dev/null 2>&1; then
            google-chrome --app=http://127.0.0.1:3000
        elif command -v chromium >/dev/null 2>&1; then
            chromium --app=http://127.0.0.1:3000
        elif command -v brave-browser >/dev/null 2>&1; then
            brave-browser --app=http://127.0.0.1:3000
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open http://127.0.0.1:3000
        elif command -v open >/dev/null 2>&1; then
            open http://127.0.0.1:3000
        else
            echo "Abre tu navegador en: http://127.0.0.1:3000"
            wait $VITE_PID
        fi
        ;;
    2)
        echo "🚀 Compilando y ejecutando con Electron..."
        npm run build:web
        npx electron electron/main.cjs
        ;;
    3)
        echo "🔨 Compilando paquete AppImage y .deb para Linux..."
        npm run build:linux
        echo "✅ Compilación completada. Archivos generados en dist-electron/"
        ;;
    4)
        echo "🌐 Iniciando servidor web para toda la red local..."
        npx vite --port=3000 --host=0.0.0.0
        ;;
    *)
        echo "Opción no válida."
        exit 1
        ;;
esac
