# 🎮 RetroBat & Game Library Manager Pro

Gestor y escáner avanzado de bibliotecas de videojuegos retro y modernas para **Windows, Linux, macOS y Web**. Diseñado específicamente para colecciones de EmulationStation, RetroBat, Batocera y Recalbox, con soporte para títulos multidisco (.m3u), contenido descargable y actualizaciones (Switch DLC / Updates), enlaces a carpetas de PC (.game), detección de duplicados 1G1R (1 Game 1 ROM), sincronización con discos USB, exportaciones a CSV, PDF y páginas web interactivas.

---

## 📋 Requisitos Previos

- **Node.js**: Versión 18 o superior (recomendado Node.js 20 LTS o 22 LTS).
  - Descarga oficial: [nodejs.org](https://nodejs.org/)
- **npm**: Incluido con Node.js.
- **Git** (opcional, para clonar el repositorio).

---

## 🛠️ Instalación de Dependencias

Antes de construir para cualquier plataforma, clona el repositorio o sitúate en la carpeta raíz y ejecuta:

```bash
npm install
```

---

## 🚀 Guía de Construcción por Plataforma

### 1. 🌐 Web & PWA (Windows, Linux, Mac, Android, iOS)

Genera una versión web estática ultra-optimizada con soporte PWA (Progressive Web App), Service Worker para funcionamiento sin conexión y carga instantánea.

#### Compilar:
```bash
npm run build:web
```
*Los archivos se generan en la carpeta `dist/`.*

#### Probar localmente el build:
```bash
npm run preview
```

#### Despliegue en Servidores:
Puedes subir el contenido de la carpeta `dist/` directamente a:
- **Nginx / Apache**: Copia los archivos a `/var/www/html/`.
- **Vercel / Netlify / Cloudflare Pages**: Conecta el repositorio con comando de build `npm run build` y directorio de salida `dist`.
- **GitHub Pages**: Sube el contenido a la rama `gh-pages`.

---

### 2. 🪟 Windows (.exe / Instalador NSIS y Portable)

#### Opción A: Compilar Instalador Oficial de Windows (.exe)
```bash
npm run build:win
```
*Salida generada en la carpeta `dist-electron/`:*
- `RetroBat Manager Pro Setup X.X.X.exe` (Instalador guiado NSIS con accesos directos).
- `RetroBat Manager Pro-win32-x64.zip` (Versión portátil ejecutable sin instalación).

#### Opción B: Ejecución Inmediata en Windows (Sin compilar)
Haz doble clic en el archivo `run-desktop.bat` incluido en la raíz del proyecto.
El script iniciará la aplicación en modo ventana nativa de escritorio sin bordes de navegador.

---

### 3. 🐧 Linux (.AppImage y .deb para Ubuntu, Debian, Steam Deck, Arch)

#### Opción A: Compilar AppImage y Paquete Debian (.deb)
```bash
npm run build:linux
```
*Salida generada en la carpeta `dist-electron/`:*
- `RetroBat Manager Pro-X.X.X.AppImage` (Ejecutable universal para cualquier distribución Linux y Steam Deck).
- `retrobat-manager_X.X.X_amd64.deb` (Paquete nativo para Ubuntu, Debian, Linux Mint, Pop!_OS).

**Para ejecutar el AppImage:**
```bash
chmod +x dist-electron/*.AppImage
./dist-electron/*.AppImage
```

#### Opción B: Script Lanzador Interactivo en Linux
```bash
chmod +x run-desktop.sh
./run-desktop.sh
```
Te permitirá elegir entre modo ventana de escritorio, modo Electron nativo, compilación de paquetes o servidor en red LAN.

---

### 4. 🍎 macOS (.dmg y .app para Intel y Apple Silicon)

```bash
npm run build:mac
```
*Salida generada en la carpeta `dist-electron/`:*
- `RetroBat Manager Pro-X.X.X.dmg` (Imagen de disco instalable arrastrando a Aplicaciones).

---

### 5. 🐳 Docker / Servidor Doméstico (NAS, Raspberry Pi, Unraid, TrueNAS)

Permite ejecutar RetroBat Manager en un contenedor Docker y acceder desde cualquier ordenador, teléfono o televisor de la red local.

#### Iniciar con Docker Compose:
```bash
docker compose up -d --build
```
La aplicación estará disponible inmediatamente en:
`http://localhost:8080` (o la IP de tu servidor, ej: `http://192.168.1.100:8080`).

#### Detener el contenedor:
```bash
docker compose down
```

---

## 🧪 Ejecución de Pruebas Unitarias

El proyecto incluye pruebas automatizadas para toda la lógica pura (parseo de tamaños, limpiador de títulos, normalizador de regiones, algoritmo 1G1R y filtros de formato) utilizando el ejecutor nativo `node:test`:

```bash
npm test
```

---

## 📁 Estructura del Proyecto

```text
├── electron/
│   ├── main.cjs            # Proceso principal de Electron (ventanas, menús, diálogos nativos)
│   └── preload.cjs         # Script de puente de seguridad IPC
├── public/
│   └── icon.svg            # Ícono oficial de la aplicación y PWA
├── src/
│   ├── components/
│   │   ├── CopyProgressModal.tsx      # Velocímetro y sincronizador de archivos hacia USB/disco
│   │   ├── CustomListsModal.tsx       # Creador de listas y colecciones personalizadas
│   │   ├── DatabaseManagerModal.tsx   # Gestor SQLite, depurador por formato y altas manuales
│   │   ├── ExportModal.tsx            # Exportaciones a CSV, PDF, Web interactiva y USB
│   │   ├── GameDetailModal.tsx        # Inspector de carátulas, videos, dependencias y etiquetas
│   │   ├── MultiplatformModal.tsx     # Guía interactiva de compilación dentro de la app
│   │   ├── ScannerModal.tsx           # Escáner de biblioteca completa o sistema individual
│   │   └── ThemeCustomizerModal.tsx   # Personalizador de temas, fondos, títulos y bordes
│   ├── data/
│   │   └── sampleLibrary.ts           # Biblioteca de ejemplo precargada para inicio instantáneo
│   ├── types/
│   │   └── index.ts                   # Definición de tipos TypeScript
│   ├── utils/
│   │   ├── exporter.ts                # Generadores de CSV, PDF (jsPDF), HTML interactivo y JSON
│   │   ├── gameUtils.ts               # Formateo de bytes, regexes, 1G1R y utilidades
│   │   ├── gameUtils.test.ts          # Pruebas unitarias automatizadas (node:test)
│   │   ├── scannerEngine.ts           # Motor de análisis XML, m3u, cue y carpetas
│   │   └── themeManager.ts            # Gestión de paletas de color y almacenamiento local
│   ├── App.tsx                        # Componente principal con barra de herramientas y filtros
│   ├── index.css                      # Estilos globales y Tailwind CSS
│   └── main.tsx                       # Punto de entrada React
├── Dockerfile                         # Contenedor multi-stage para despliegues ligeros
├── docker-compose.yml                 # Despliegue con un solo comando en servidores
├── run-desktop.bat                    # Lanzador rápido con un clic para Windows
├── run-desktop.sh                     # Lanzador rápido ejecutable para Linux / macOS
└── README.md                          # Este archivo de instrucciones
```

---

## 🔄 Equivalencias con el Proyecto Original C# / WPF

| Componente C# Original | Implementación en este Proyecto | Mejoras Añadidas |
| :--- | :--- | :--- |
| `ScannerEngine.cs` | `src/utils/scannerEngine.ts` | Soporte para File System Access API nativo en navegador, escáner de sistema individual sin re-escanear todo, lectura de .m3u y Switch DLCs. |
| `Juego.cs` | `src/types/index.ts` & `src/utils/gameUtils.ts` | Algoritmo 1G1R optimizado, formateo dinámico de tamaños, caché de imágenes y etiquetas personalizadas. |
| `CopyProgressModal.xaml.cs` | `src/components/CopyProgressModal.tsx` | Velocímetro interactivo (MB/s), cuenta atrás de tiempo restante, logs en vivo, pausa/cancelación segura y actualización automática de `gamelist.xml`. |
| `GameDetailModal.xaml.cs` | `src/components/GameDetailModal.tsx` | Pestañas de previsualización (Carátula, Miniatura, Logo, Fondo, Video), gestor de archivos adjuntos, vinculación manual y recálculo automático de peso. |
| `CustomListsWindow.xaml.cs` | `src/components/CustomListsModal.tsx` | Selector de iconos (`⭐`, `🔥`, `🏆`, etc.), adición masiva "+ Sistema Completo", búsqueda 1 a 1 y exportación directa de cada lista a CSV/PDF/HTML. |
| `DatabaseManagerWindow.xaml.cs` | `src/components/DatabaseManagerModal.tsx` | Depuración rápida por formato (eliminación masiva de extensiones como `.xex`), registro manual y edición directa. |
| `DatabaseHelper.cs` | Almacenamiento local persistente / Exportación SQLite-JSON | Copia de seguridad en JSON completo, exportable e importable sin dependencias externas. |

---

## 📄 Licencia

Este proyecto está disponible bajo licencia libre para la comunidad retro y entusiastas de la emulación.
