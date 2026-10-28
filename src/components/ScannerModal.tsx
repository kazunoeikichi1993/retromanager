import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  FolderOpen,
  FolderSearch,
  HardDrive,
  RefreshCw,
  X,
  Zap,
} from 'lucide-react';
import { Juego } from '../types';
import { escanearDirectorioCompleto, parseGamelistXml } from '../utils/scannerEngine';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportGames: (scannedGames: Juego[], modo: 'merge' | 'replace', sistemaEspecifico?: string) => void;
  sistemasExistentes: string[];
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onImportGames,
  sistemasExistentes,
}) => {
  const [scanMode, setScanMode] = useState<'all' | 'single' | 'xml'>('all');
  const [selectedSingleSystem, setSelectedSingleSystem] = useState<string>(sistemasExistentes[0] || 'psx');
  const [customSystemInput, setCustomSystemInput] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // Scanner runtime state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [progressState, setProgressState] = useState({
    fase: '',
    sistemaActual: '',
    juegosEncontrados: 0,
    archivosProcesados: 0,
    mensaje: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const targetSystemName =
    selectedSingleSystem === '__custom' ? customSystemInput.trim() || 'custom' : selectedSingleSystem;

  const handleDirectoryPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);
    setScanError(null);
    try {
      // If single system mode, auto-detect system name from the parent folder of files if not custom
      let targetSys = targetSystemName;
      const firstRel = (files[0] as any).webkitRelativePath || '';
      const parts = firstRel.replace(/\\/g, '/').split('/').filter(Boolean);
      if (scanMode === 'single' && selectedSingleSystem === '__custom' && parts.length > 1) {
        targetSys = parts[parts.length - 2].toLowerCase();
      }

      const scanned = await escanearDirectorioCompleto(files, (p) => {
        setProgressState(p);
      });

      const finalGames =
        scanMode === 'single'
          ? scanned.map((g) => ({ ...g, sistema: targetSys }))
          : scanned;

      onImportGames(finalGames, importMode, scanMode === 'single' ? targetSys : undefined);
      setIsScanning(false);
      onClose();
    } catch (err: any) {
      setScanError('Error durante el escaneo: ' + (err.message || err));
      setIsScanning(false);
    }
  };

  const handleXmlPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);
    setScanError(null);
    const file = files[0];
    try {
      const text = await file.text();
      const parsed = parseGamelistXml(text, targetSystemName);
      onImportGames(parsed, importMode, scanMode === 'single' ? targetSystemName : undefined);
      setIsScanning(false);
      onClose();
    } catch (err: any) {
      setScanError('Error al procesar el archivo gamelist.xml: ' + (err.message || err));
      setIsScanning(false);
    }
  };

  const [validarFisicos, setValidarFisicos] = useState(true);

  const triggerDirectoryPicker = async () => {
    // Check if modern File System Access API is supported
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        setIsScanning(true);
        const folderName = dirHandle.name.toLowerCase();
        let targetSys = scanMode === 'single' ? folderName : 'Multisistema';

        setProgressState({
          fase: 'Indexando estructura de RetroBat',
          sistemaActual: targetSys.toUpperCase(),
          juegosEncontrados: 0,
          archivosProcesados: 0,
          mensaje: `Analizando estructura en ${dirHandle.name}...`,
        });

        const files: File[] = [];
        let count = 0;
        const mediaFolderNames = new Set(['images', 'media', 'videos', 'manuals', 'fanart', 'wheel', 'marquees', 'boxart', 'screenshots']);

        // Función optimizada que NO se congela en carpetas de juegos con miles de archivos (ej: PS3, Windows)
        // Lee gamelist.xml, archivos directos de roms, multimedia, y carpetas de juegos a nivel de raíz
        async function inspectSystemDir(sysHandle: any, sysPath: string) {
          for await (const entry of sysHandle.values()) {
            if (entry.kind === 'file') {
              try {
                const f = await entry.getFile();
                Object.defineProperty(f, 'webkitRelativePath', {
                  value: `${sysPath}/${f.name}`,
                });
                files.push(f);
                count++;
              } catch {}
            } else if (entry.kind === 'directory') {
              const dirLower = entry.name.toLowerCase();
              if (mediaFolderNames.has(dirLower)) {
                // Es carpeta de multimedia: leer imágenes/videos (1 nivel poco profundo)
                for await (const mediaEntry of entry.values()) {
                  if (mediaEntry.kind === 'file') {
                    try {
                      const mf = await mediaEntry.getFile();
                      Object.defineProperty(mf, 'webkitRelativePath', {
                        value: `${sysPath}/${entry.name}/${mf.name}`,
                      });
                      files.push(mf);
                      count++;
                    } catch {}
                  }
                }
              } else {
                // Es una carpeta de juego (ej: PS3_GAME, carpeta de juego de PC, etc.)
                // NO entramos recursivamente a sus 50.000 archivos internos de texturas/audio
                // Registramos la carpeta y buscamos si tiene boot file en la raíz (ej: EBOOT.BIN, .game, etc.)
                try {
                  let foundMain = false;
                  for await (const subEntry of entry.values()) {
                    if (subEntry.kind === 'file') {
                      const subLower = subEntry.name.toLowerCase();
                      if (subLower === 'eboot.bin' || subLower.endsWith('.game') || subLower.endsWith('.m3u') || subLower.endsWith('.cue') || subLower.endsWith('.iso')) {
                        const subFile = await subEntry.getFile();
                        Object.defineProperty(subFile, 'webkitRelativePath', {
                          value: `${sysPath}/${entry.name}/${subEntry.name}`,
                        });
                        files.push(subFile);
                        foundMain = true;
                        count++;
                      }
                    }
                  }
                  // Si no tuvo boot file directo en la raíz de la carpeta, registrar un marcador de carpeta física
                  const dummyFolderFile = new File([''], entry.name, { type: 'application/octet-stream' });
                  Object.defineProperty(dummyFolderFile, 'webkitRelativePath', {
                    value: `${sysPath}/${entry.name}`,
                  });
                  files.push(dummyFolderFile);
                  count++;
                } catch {}
              }
            }

            if (count % 40 === 0) {
              setProgressState((prev) => ({
                ...prev,
                archivosProcesados: count,
                mensaje: `Indexando ${entry.name}...`,
              }));
              await new Promise((r) => setTimeout(r, 0));
            }
          }
        }

        // Determinar si el directorio raíz seleccionado es "roms", un sistema individual o raíz general
        if (scanMode === 'single') {
          await inspectSystemDir(dirHandle, dirHandle.name);
        } else {
          // Biblioteca completa: verificar si hay subcarpeta "roms" o si los sistemas están directamente
          let foundRomsSubdir = false;
          for await (const entry of dirHandle.values()) {
            if (entry.kind === 'directory' && entry.name.toLowerCase() === 'roms') {
              foundRomsSubdir = true;
              for await (const sysEntry of entry.values()) {
                if (sysEntry.kind === 'directory') {
                  await inspectSystemDir(sysEntry, `roms/${sysEntry.name}`);
                }
              }
              break;
            }
          }

          if (!foundRomsSubdir) {
            // Verificar si contiene gamelist.xml directo (sistema individual o plano)
            let hasDirectGamelist = false;
            for await (const entry of dirHandle.values()) {
              if (entry.kind === 'file' && entry.name.toLowerCase() === 'gamelist.xml') {
                hasDirectGamelist = true;
                break;
              }
            }

            if (hasDirectGamelist) {
              await inspectSystemDir(dirHandle, dirHandle.name);
            } else {
              // Asumir que cada subdirectorio es un sistema
              for await (const entry of dirHandle.values()) {
                if (entry.kind === 'directory') {
                  await inspectSystemDir(entry, entry.name);
                }
              }
            }
          }
        }

        const scanned = await escanearDirectorioCompleto(files, (p) => setProgressState(p));
        const finalGames =
          scanMode === 'single'
            ? scanned.map((g) => ({ ...g, sistema: targetSys }))
            : scanned;

        onImportGames(finalGames, importMode, scanMode === 'single' ? targetSys : undefined);
        setIsScanning(false);
        onClose();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setIsScanning(false);
          return;
        }
        console.warn('showDirectoryPicker failed, falling back to input', err);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--card-app, #111827)',
          borderColor: 'var(--border-app, #1F2937)',
          color: 'var(--text-app, #F3F4F6)',
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FolderSearch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Escáner de Bibliotecas y Sistemas</h2>
              <p className="text-xs text-slate-400">
                Escanea carpetas locales, sistemas individuales o importa archivos gamelist.xml
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isScanning}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Error Alert Banner */}
        {scanError && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between">
            <span>{scanError}</span>
            <button
              onClick={() => setScanError(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Hidden inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleDirectoryPicked}
            /* @ts-ignore */
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
          />
          <input
            type="file"
            ref={xmlInputRef}
            onChange={handleXmlPicked}
            accept=".xml"
            className="hidden"
          />

          {/* Mode Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Modo de Escaneo
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900/60 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setScanMode('all')}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  scanMode === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Biblioteca Completa
              </button>
              <button
                type="button"
                onClick={() => setScanMode('single')}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  scanMode === 'single'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sistema Individual
              </button>
              <button
                type="button"
                onClick={() => setScanMode('xml')}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  scanMode === 'xml'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Archivo gamelist.xml
              </button>
            </div>
          </div>

          {/* Single System Option Selector */}
          {scanMode === 'single' && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-white">
                  Escaneo protegido de sistema único (No sobreescribe los demás)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Te permite actualizar únicamente los juegos de una consola específica sin arruinar ni re-escanear el resto de la base de datos.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1">
                    Seleccionar Sistema
                  </label>
                  <select
                    value={selectedSingleSystem}
                    onChange={(e) => setSelectedSingleSystem(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none"
                  >
                    {sistemasExistentes.map((s) => (
                      <option key={s} value={s}>
                        {s.toUpperCase()}
                      </option>
                    ))}
                    <option value="__custom">+ Otro Sistema (Personalizado)...</option>
                  </select>
                </div>
                {selectedSingleSystem === '__custom' && (
                  <div>
                    <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1">
                      Nombre del Sistema
                    </label>
                    <input
                      type="text"
                      value={customSystemInput}
                      onChange={(e) => setCustomSystemInput(e.target.value)}
                      placeholder="ej: saturn, dreamcast..."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import Mode: Merge vs Replace */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800">
            <div>
              <span className="text-xs font-semibold text-white block">Modo de Integración</span>
              <span className="text-[11px] text-slate-400">
                {importMode === 'merge'
                  ? 'Fusiona con los juegos existentes y actualiza duplicados'
                  : 'Reemplaza completamente la base de datos actual'}
              </span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`px-3 py-1 rounded font-medium ${
                  importMode === 'merge' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Fusionar
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`px-3 py-1 rounded font-medium ${
                  importMode === 'replace' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Reemplazar
              </button>
            </div>
          </div>

          {/* Validar Existencia Física */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
            <div className="pr-4">
              <span className="text-xs font-semibold text-white block">Validar Existencia Física</span>
              <span className="text-[11px] text-slate-400">
                Omite registros antiguos o eliminados del gamelist.xml cuyos archivos reales no existan en el disco.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={validarFisicos}
                onChange={(e) => setValidarFisicos(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Scanning Progress Banner */}
          {isScanning && (
            <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {progressState.fase}
                </span>
                <span className="text-xs font-mono text-blue-400 font-semibold">
                  {progressState.juegosEncontrados} juegos detectados
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 truncate">
                {progressState.mensaje}
              </p>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 animate-pulse w-full" />
              </div>
            </div>
          )}

          {/* Action Trigger Card */}
          <div
            onClick={
              isScanning
                ? undefined
                : scanMode === 'xml'
                ? () => xmlInputRef.current?.click()
                : triggerDirectoryPicker
            }
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
              isScanning
                ? 'opacity-50 pointer-events-none border-slate-800'
                : 'border-slate-700 hover:border-blue-500 hover:bg-slate-900/40'
            }`}
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-3">
              {scanMode === 'xml' ? <FileCode className="w-6 h-6" /> : <FolderOpen className="w-6 h-6" />}
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              {scanMode === 'xml'
                ? 'Seleccionar archivo gamelist.xml'
                : scanMode === 'single'
                ? `Seleccionar carpeta para [${targetSystemName.toUpperCase()}]`
                : 'Seleccionar carpeta raíz de RetroBat / ROMs'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Haz clic para abrir el explorador de carpetas o arrastra y suelta directamente aquí.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-slate-900/60" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <span className="text-xs text-slate-500">
            Compatible con Windows, Linux y Mac mediante Web File System Access
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isScanning}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
