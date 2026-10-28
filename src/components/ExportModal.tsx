import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  FolderCheck,
  FolderOpen,
  FolderSync,
  HardDrive,
  Info,
  Layers,
  Link2,
  Usb,
  X,
} from 'lucide-react';
import { ColeccionPersonalizada, Juego } from '../types';
import {
  exportToCsv,
  exportToInteractiveWebHtml,
  exportToInteractiveWebLinkedHtml,
  exportToInteractiveWebZip,
  exportToJsonDatabase,
  exportToPdf,
} from '../utils/exporter';
import { formatBytes } from '../utils/gameUtils';
import { sourceFileRegistry } from '../utils/sourceFileRegistry';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  juegosSeleccionados: Juego[];
  todosLosJuegos: Juego[];
  colecciones: ColeccionPersonalizada[];
  onStartUsbSync: (juegos: Juego[], destinationName: string, destinationHandle?: any) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  juegosSeleccionados,
  todosLosJuegos,
  colecciones,
  onStartUsbSync,
}) => {
  const [targetScope, setTargetScope] = useState<'selected' | 'all'>('selected');
  const [selectedSystemFilter, setSelectedSystemFilter] = useState<string>('ALL');
  const [usbDestinationName, setUsbDestinationName] = useState('E:\\RetroBat_USB');
  const [destHandle, setDestHandle] = useState<any>(null);
  const [sourceDirName, setSourceDirName] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('Mi Selección de Juegos');
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number; message: string; percent: number } | null>(null);

  // Sync options
  const [syncGamelist, setSyncGamelist] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [includeVideos, setIncludeVideos] = useState(true);
  const [includeManuals, setIncludeManuals] = useState(true);

  const [pickerNotice, setPickerNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const handle = sourceFileRegistry.getSourceDirectoryHandle();
      if (handle) {
        setSourceDirName(handle.name);
      }
    }
  }, [isOpen]);

  const baseGames =
    targetScope === 'selected' && juegosSeleccionados.length > 0
      ? juegosSeleccionados
      : todosLosJuegos;

  // Available systems in current scope
  const availableSystems = useMemo(() => {
    return Array.from(new Set(baseGames.map((j) => (j.sistema || 'custom').toUpperCase()))).sort();
  }, [baseGames]);

  // Active games filtered by system if chosen
  const activeGames = useMemo(() => {
    if (selectedSystemFilter === 'ALL') return baseGames;
    return baseGames.filter((j) => (j.sistema || 'custom').toUpperCase() === selectedSystemFilter);
  }, [baseGames, selectedSystemFilter]);

  const totalBytes = activeGames.reduce((acc, j) => acc + (j.tamanoBytes || 0), 0);

  const selectedCountBySystem = useMemo(() => {
    const map = new Map<string, number>();
    activeGames.forEach((j) => {
      const s = (j.sistema || 'custom').toUpperCase();
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeGames]);

  if (!isOpen) return null;

  const handlePickSourceFolder = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({ mode: 'read' });
        if (handle) {
          sourceFileRegistry.setSourceDirectoryHandle(handle);
          setSourceDirName(handle.name);
        }
      }
    } catch {}
  };

  const handlePickDestinationFolder = async () => {
    try {
      setPickerNotice(null);
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });
        if (handle) {
          setDestHandle(handle);
          setUsbDestinationName(handle.name || 'Unidad Externa / USB');
        }
      } else {
        setPickerNotice('Tu navegador no soporta el selector nativo directo de carpetas. Puedes escribir la ruta deseada en el campo.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Directory pick cancelled or failed:', err);
      }
    }
  };

  const handleLaunchUsbTransfer = () => {
    onStartUsbSync(activeGames, usbDestinationName.trim() || 'USB_Drive', destHandle);
    onClose();
  };

  const handleExportZip = async () => {
    setIsZipping(true);
    setZipProgress({ current: 0, total: activeGames.length, message: 'Iniciando empaquetado...', percent: 0 });
    try {
      await exportToInteractiveWebZip(activeGames, customTitle, (p) => {
        setZipProgress(p);
      });
    } catch (e: any) {
      console.error('Error generating zip:', e);
      setPickerNotice(`Error al crear archivo ZIP: ${e.message || 'Memoria insuficiente. Prueba exportar por consola individual.'}`);
    } finally {
      setIsZipping(false);
      setZipProgress(null);
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
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Centro de Exportación y Transferencia</h2>
              <p className="text-xs text-slate-400">
                Sincroniza con unidades USB, exporta catálogos en PDF/CSV o crea páginas web con imágenes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Scope Selector */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Ámbito de Exportación</span>
                <span className="text-xs text-slate-400">
                  {activeGames.length} títulos seleccionados ({formatBytes(totalBytes)})
                </span>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setTargetScope('selected')}
                  disabled={juegosSeleccionados.length === 0}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    targetScope === 'selected'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white disabled:opacity-40'
                  }`}
                >
                  Marcados ({juegosSeleccionados.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetScope('all')}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    targetScope === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({todosLosJuegos.length})
                </button>
              </div>
            </div>

            {/* System Filter for Export */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Consola a Exportar:
              </span>
              <select
                value={selectedSystemFilter}
                onChange={(e) => setSelectedSystemFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">Todas las Consolas ({baseGames.length} títulos)</option>
                {availableSystems.map((sys) => {
                  const cnt = baseGames.filter((j) => (j.sistema || 'custom').toUpperCase() === sys).length;
                  return (
                    <option key={sys} value={sys}>
                      {sys} ({cnt} títulos)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* System Breakdown Badges (requested: psx 10, cps1 5...) */}
            {selectedCountBySystem.length > 0 && (
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1 font-medium">Desglose por consola:</span>
                {selectedCountBySystem.map(([sys, count]) => (
                  <span
                    key={sys}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25 font-semibold"
                  >
                    {sys}: {count}
                  </span>
                ))}
              </div>
            )}

            {/* Large library memory warning */}
            {activeGames.length > 1500 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <strong className="text-amber-200">Biblioteca grande ({activeGames.length} juegos):</strong>
                  <p className="text-[11px] text-amber-200/90 mt-0.5">
                    Para evitar agotar la memoria RAM del navegador al generar el archivo .ZIP, te recomendamos exportar consola por consola o utilizar la opción <strong>"Galería Web Enlazada a Carpetas Locales"</strong> (consume 0 MB adicionales de memoria).
                  </p>
                </div>
              </div>
            )}

            {/* Zipping progress banner */}
            {isZipping && zipProgress && (
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-300 font-medium truncate">{zipProgress.message}</span>
                  <span className="font-mono text-blue-400 font-bold">{zipProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 transition-all duration-200"
                    style={{ width: `${zipProgress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Option A: USB Drive / Disk Export */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Usb className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Transferir a Unidad USB / Disco Extraíble
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Sincronización Rápida
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1">
                  Carpeta de Destino (USB / Disco)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={usbDestinationName}
                    onChange={(e) => setUsbDestinationName(e.target.value)}
                    placeholder="ej: E:\RetroBat_USB o /media/usb"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handlePickDestinationFolder}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 font-medium whitespace-nowrap transition-colors flex items-center gap-1 border border-slate-600"
                    title="Seleccionar carpeta de disco o USB directamente"
                  >
                    <FolderSync className="w-3.5 h-3.5 text-emerald-400" />
                    Examinar...
                  </button>
                </div>
                {destHandle && (
                  <span className="text-[10px] text-emerald-400 mt-1 block">
                    ✓ Carpeta física vinculada: <strong>{destHandle.name}</strong> (acceso de escritura listo)
                  </span>
                )}
                {pickerNotice && (
                  <span className="text-[10px] text-amber-300 mt-1 block">
                    ℹ {pickerNotice}
                  </span>
                )}

                {/* Source ROMs Folder Status */}
                <div className="mt-3 p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <FolderCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <span className="text-[11px] font-semibold text-slate-300 block">
                        Carpeta Origen de ROMs:
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono truncate">
                        {sourceDirName ? `Conectada (${sourceDirName})` : 'Memoria activa'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePickSourceFolder}
                    className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px] text-slate-200 font-medium transition-colors border border-slate-600 flex items-center gap-1 shrink-0 ml-2"
                  >
                    <FolderOpen className="w-3 h-3 text-blue-400" />
                    {sourceDirName ? 'Reconectar Origen' : 'Vincular Origen'}
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-1 text-xs">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncGamelist}
                    onChange={(e) => setSyncGamelist(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                  />
                  <span>Actualizar gamelist.xml en destino</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeImages && includeVideos}
                    onChange={(e) => {
                      setIncludeImages(e.target.checked);
                      setIncludeVideos(e.target.checked);
                    }}
                    className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                  />
                  <span>Copiar imágenes y videos exclusivos</span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLaunchUsbTransfer}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-950/40"
            >
              <FolderSync className="w-4 h-4" /> Iniciar Transferencia de Archivos ({formatBytes(totalBytes)})
            </button>
          </div>

          {/* Option B: Document and Web Exports */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Descargas y Documentos de Colección
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Web Gallery with Images Bundle (.ZIP) */}
              <div
                onClick={isZipping ? undefined : handleExportZip}
                className={`p-4 rounded-xl bg-slate-900/60 border border-blue-500/40 hover:border-blue-400 cursor-pointer transition-colors flex flex-col justify-between group ${
                  isZipping ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <div>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 w-fit mb-3">
                    <FolderArchive className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
                    Galería Web + Carpeta de Imágenes (.ZIP)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Empaqueta el HTML y crea la carpeta <code className="text-blue-300">images/</code> con todas las carátulas para visualización 100% offline.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-blue-400 mt-4 flex items-center gap-1">
                  {isZipping ? 'Empaquetando imágenes...' : 'Descargar Paquete ZIP →'}
                </span>
              </div>

              {/* Linked Web Gallery (0 MB RAM, directly links to RetroBat folders) */}
              <div
                onClick={() => exportToInteractiveWebLinkedHtml(activeGames, customTitle)}
                className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/40 hover:border-emerald-400 cursor-pointer transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit mb-3">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                    Galería Web Enlazada a RetroBat (.HTML)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    <strong>0 MB de RAM.</strong> Genera un HTML instantáneo que enlaza a <code className="text-emerald-300">./roms/&lt;sistema&gt;/images/</code> sin empaquetar ZIPs pesados.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 mt-4 flex items-center gap-1">
                  Generar HTML Enlazado →
                </span>
              </div>

              {/* Standalone Interactive Web Page Export */}
              <div
                onClick={() => exportToInteractiveWebHtml(activeGames, customTitle)}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-sky-500/60 cursor-pointer transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 w-fit mb-3">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1 group-hover:text-sky-400 transition-colors">
                    Galería Web (.HTML individual)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Archivo único HTML ligero con buscador, filtros y arte vectorial de cartuchos incorporado.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-sky-400 mt-4 flex items-center gap-1">
                  Generar HTML →
                </span>
              </div>

              {/* CSV Export */}
              <div
                onClick={() => exportToCsv(activeGames, `${customTitle.replace(/\s+/g, '_')}.csv`)}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/60 cursor-pointer transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit mb-3">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                    Exportar a CSV
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Formato estructurado compatible con Excel, LibreOffice y Google Sheets (UTF-8 con BOM).
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 mt-4 flex items-center gap-1">
                  Descargar CSV →
                </span>
              </div>

              {/* PDF Export */}
              <div
                onClick={() => exportToPdf(activeGames, customTitle)}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/60 cursor-pointer transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 w-fit mb-3">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1 group-hover:text-rose-400 transition-colors">
                    Exportar a PDF
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Documento de catálogo formal en tamaño horizontal A4 listo para imprimir o archivar.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-rose-400 mt-4 flex items-center gap-1">
                  Descargar PDF →
                </span>
              </div>
            </div>
          </div>

          {/* Database JSON Backup */}
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-xs font-semibold text-white block">
                  Copia de Seguridad de la Base de Datos
                </span>
                <span className="text-[11px] text-slate-400">
                  Respaldo completo con metadatos, listas personalizadas y dependencias en JSON.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => exportToJsonDatabase(todosLosJuegos, colecciones)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              Exportar JSON
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-slate-900/60" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <span className="text-xs text-slate-500">
            Los archivos exportados se generan localmente en tu navegador.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
