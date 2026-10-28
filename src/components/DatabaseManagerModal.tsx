import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Edit3,
  Eraser,
  Filter,
  Folder,
  FolderCheck,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Juego } from '../types';
import { filterGamesByFormat, formatBytes, parseSize } from '../utils/gameUtils';
import {
  DEFAULT_PDB_FILENAME,
  downloadPdbDatabaseFile,
  parsePdbBinary,
  readPdbFromDirectoryHandle,
  savePdbToDirectoryHandle,
} from '../utils/pdbDatabase';
import { sourceFileRegistry } from '../utils/sourceFileRegistry';

interface DatabaseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  juegos: Juego[];
  onSaveDatabase: (updatedJuegos: Juego[]) => void;
}

export const DatabaseManagerModal: React.FC<DatabaseManagerModalProps> = ({
  isOpen,
  onClose,
  juegos,
  onSaveDatabase,
}) => {
  const [listaJuegos, setListaJuegos] = useState<Juego[]>(juegos);
  const [selectedSystem, setSelectedSystem] = useState<string>('Todos los Sistemas');
  const [searchQuery, setSearchQuery] = useState('');
  const [soloM3U, setSoloM3U] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    setListaJuegos(juegos);
  }, [juegos, isOpen]);

  // Local PDB & Disk Cache state
  const [appDirHandle, setAppDirHandle] = useState<any>(null);
  const [appDirName, setAppDirName] = useState<string>('');
  const [isSavingPdb, setIsSavingPdb] = useState(false);
  const [isLoadingPdb, setIsLoadingPdb] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'pdbConfig'>('table');

  useEffect(() => {
    sourceFileRegistry.getAppDirectoryHandle().then((handle) => {
      if (handle) {
        setAppDirHandle(handle);
        setAppDirName(handle.name);
      }
    });
  }, [isOpen]);

  // Edit Scanned Game State
  const [editingGame, setEditingGame] = useState<Juego | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSystem, setEditSystem] = useState('');
  const [editExtension, setEditExtension] = useState('');
  const [editSizeText, setEditSizeText] = useState('');
  const [editRuta, setEditRuta] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editRegion, setEditRegion] = useState('');

  // Manual Add Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSystem, setNewSystem] = useState('psx');
  const [newExtension, setNewExtension] = useState('.iso');
  const [newSizeText, setNewSizeText] = useState('650 MB');
  const [newGenre, setNewGenre] = useState('Varios');
  const [newRegion, setNewRegion] = useState('Spain');

  // Systems list
  const sistemas = useMemo(() => {
    const list = Array.from(new Set(listaJuegos.map((j) => j.sistema))).sort();
    return ['Todos los Sistemas', ...list];
  }, [listaJuegos]);

  // Status Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Format Depuration state (no prompt/confirm)
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [selectedFormatToClean, setSelectedFormatToClean] = useState('');

  // Bulk delete confirmation state (no confirm)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Available extensions for format debugger
  const formatosDisponibles = useMemo(() => {
    const pool =
      selectedSystem === 'Todos los Sistemas'
        ? listaJuegos
        : listaJuegos.filter((j) => j.sistema === selectedSystem);
    return Array.from(
      new Set(pool.map((j) => (j.extension || '').toLowerCase()).filter(Boolean))
    ).sort();
  }, [listaJuegos, selectedSystem]);

  // Filtered dataset
  const filteredJuegos = useMemo(() => {
    return listaJuegos.filter((j) => {
      const matchSys =
        selectedSystem === 'Todos los Sistemas' || j.sistema === selectedSystem;
      const matchSearch =
        !searchQuery ||
        j.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.cleanTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.ruta.toLowerCase().includes(searchQuery.toLowerCase());
      const matchM3U =
        !soloM3U || (j.extension && j.extension.toLowerCase() === '.m3u') || (j.dependencias && j.dependencias.length > 0);

      return matchSys && matchSearch && matchM3U;
    });
  }, [listaJuegos, selectedSystem, searchQuery, soloM3U]);

  // Calculate games matching current selected format to clean
  const countMatchesToClean = useMemo(() => {
    if (!selectedFormatToClean) return 0;
    return listaJuegos.filter((j) => {
      const matchSys = selectedSystem === 'Todos los Sistemas' || j.sistema === selectedSystem;
      return matchSys && (j.extension || '').toLowerCase() === selectedFormatToClean.toLowerCase();
    }).length;
  }, [listaJuegos, selectedFormatToClean, selectedSystem]);

  if (!isOpen) return null;

  // Depuración rápida por formato
  const handleOpenFormatCleaner = () => {
    if (formatosDisponibles.length === 0) {
      setFeedback({ type: 'error', message: 'No hay formatos para depurar en la vista actual.' });
      return;
    }
    setSelectedFormatToClean(formatosDisponibles[0] || '');
    setShowFormatModal(true);
  };

  const handleConfirmCleanFormat = () => {
    if (!selectedFormatToClean) return;

    const res = filterGamesByFormat(
      listaJuegos,
      selectedFormatToClean,
      selectedSystem === 'Todos los Sistemas' ? undefined : selectedSystem
    );

    setListaJuegos(res.remaining);
    setSelectedIds(new Set());
    setShowFormatModal(false);
    setFeedback({
      type: 'success',
      message: `Se eliminaron ${res.countRemoved} registros con formato "${selectedFormatToClean}".`,
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredJuegos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredJuegos.map((j) => j.id)));
    }
  };

  const handleToggleSelectOne = (id: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleRequestDeleteSelected = () => {
    if (selectedIds.size === 0) {
      setFeedback({ type: 'error', message: 'Por favor selecciona uno o varios juegos para eliminar.' });
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteSelected = () => {
    const count = selectedIds.size;
    setListaJuegos((prev) => prev.filter((j) => !selectedIds.has(j.id)));
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    setFeedback({ type: 'success', message: `Se eliminaron ${count} juegos seleccionados de la base de datos.` });
  };

  const handleAddManualGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFeedback({ type: 'error', message: 'Por favor ingresa el título del juego.' });
      return;
    }

    let ext = newExtension.trim().toLowerCase();
    if (!ext.startsWith('.')) ext = '.' + ext;

    const bytes = parseSize(newSizeText) || 500 * 1024 * 1024;
    const nuevo: Juego = {
      id: `manual_${Date.now()}`,
      nombre: newTitle.trim(),
      cleanTitle: newTitle.trim(),
      ruta: `./${newTitle.trim()}${ext}`,
      rutaCompleta: `/RetroBat/roms/${newSystem}/${newTitle.trim()}${ext}`,
      sistema: newSystem,
      extension: ext,
      tamanoBytes: bytes,
      region: newRegion,
      genero: newGenre,
      desarrollador: 'Manual',
      anio: new Date().getFullYear().toString(),
      descripcion: 'Juego registrado manualmente en la base de datos.',
      dependencias: [],
    };

    setListaJuegos([nuevo, ...listaJuegos]);
    setShowAddForm(false);
    setNewTitle('');
    setFeedback({ type: 'success', message: `Juego "${nuevo.nombre}" añadido a la base de datos.` });
  };

  const handleOpenEditGame = (j: Juego) => {
    setEditingGame(j);
    setEditTitle(j.nombre);
    setEditSystem(j.sistema);
    setEditExtension(j.extension || '');
    setEditSizeText(formatBytes(j.tamanoBytes));
    setEditRuta(j.ruta);
    setEditGenre(j.genero || 'Varios');
    setEditRegion(j.region || 'Global');
  };

  const handleSaveEditGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;

    let ext = editExtension.trim().toLowerCase();
    if (ext && !ext.startsWith('.')) ext = '.' + ext;

    const parsedBytes = parseSize(editSizeText);
    const newBytes = parsedBytes > 0 ? parsedBytes : editingGame.tamanoBytes;

    const updated = listaJuegos.map((g) => {
      if (g.id === editingGame.id) {
        return {
          ...g,
          nombre: editTitle.trim(),
          cleanTitle: editTitle.trim(),
          sistema: editSystem.trim().toLowerCase(),
          extension: ext,
          tamanoBytes: newBytes,
          ruta: editRuta.trim(),
          genero: editGenre.trim(),
          region: editRegion.trim(),
        };
      }
      return g;
    });

    setListaJuegos(updated);
    setFeedback({
      type: 'success',
      message: `Título "${editTitle.trim()}" (${ext.toUpperCase()} · ${formatBytes(newBytes)}) actualizado con éxito en la base de datos.`,
    });
    setEditingGame(null);
  };

  const handleSelectAppDirectory = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (handle) {
          await sourceFileRegistry.setAppDirectoryHandle(handle);
          setAppDirHandle(handle);
          setAppDirName(handle.name);
          setFeedback({
            type: 'success',
            message: `Carpeta local del programa vinculada: "${handle.name}". La base de datos (.pdb) y la caché se generarán directamente allí.`,
          });
        }
      } else {
        setFeedback({
          type: 'error',
          message: 'Tu navegador no soporta el selector nativo de carpetas. Puedes descargar y cargar archivos .pdb manualmente.',
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Directory selection error:', err);
      }
    }
  };

  const handleSavePdb = async () => {
    setIsSavingPdb(true);
    try {
      if (appDirHandle) {
        const res = await savePdbToDirectoryHandle(appDirHandle, listaJuegos, []);
        setFeedback({
          type: 'success',
          message: `Base de datos guardada con éxito en "${appDirName}/${DEFAULT_PDB_FILENAME}" (${formatBytes(res.bytesWritten)}).`,
        });
      } else {
        downloadPdbDatabaseFile(listaJuegos, [], DEFAULT_PDB_FILENAME);
        setFeedback({
          type: 'success',
          message: `Archivo "${DEFAULT_PDB_FILENAME}" generado y descargado para tu carpeta local.`,
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: `Error al guardar base de datos: ${e.message}`,
      });
    } finally {
      setIsSavingPdb(false);
    }
  };

  const handleLoadPdbFromDisk = async () => {
    setIsLoadingPdb(true);
    try {
      if (appDirHandle) {
        const result = await readPdbFromDirectoryHandle(appDirHandle, DEFAULT_PDB_FILENAME);
        if (result && result.juegos.length > 0) {
          setListaJuegos(result.juegos);
          setFeedback({
            type: 'success',
            message: `Base de datos cargada desde "${appDirName}/${DEFAULT_PDB_FILENAME}" con ${result.juegos.length} juegos.`,
          });
          setIsLoadingPdb(false);
          return;
        }
      }

      // Fallback: trigger file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdb,.json';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) {
          setIsLoadingPdb(false);
          return;
        }
        try {
          const result = await parsePdbBinary(file);
          if (result && result.juegos.length > 0) {
            setListaJuegos(result.juegos);
            setFeedback({
              type: 'success',
              message: `Cargados ${result.juegos.length} juegos desde "${file.name}".`,
            });
          } else {
            setFeedback({ type: 'error', message: 'El archivo no contiene juegos válidos.' });
          }
        } catch (err: any) {
          setFeedback({ type: 'error', message: `Error leyendo archivo .pdb: ${err.message}` });
        } finally {
          setIsLoadingPdb(false);
        }
      };
      input.click();
    } catch (e: any) {
      setFeedback({ type: 'error', message: `Error: ${e.message}` });
      setIsLoadingPdb(false);
    }
  };

  const handleSaveAndClose = () => {
    onSaveDatabase(listaJuegos);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-6xl h-[88vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--card-app, #111827)',
          borderColor: 'var(--border-app, #1F2937)',
          color: 'var(--text-app, #F3F4F6)',
        }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Administrador de Base de Datos SQLite & .PDB Local
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {listaJuegos.length} registros totales
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Archivo retrobat_library.pdb, caché local en disco y depuración por formato
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`px-3 py-1.5 rounded font-medium transition-colors ${
                  activeTab === 'table' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                📋 Registros y Formatos
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pdbConfig')}
                className={`px-3 py-1.5 rounded font-medium transition-colors ${
                  activeTab === 'pdbConfig' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🗄️ Base de Datos .PDB & Caché
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Feedback Banner */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              feedback.type === 'error'
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white ml-2 text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 1: Table & Format Cleaner */}
        {activeTab === 'table' && (
          <>
            {/* Toolbar & Filters */}
            <div className="px-6 py-3 border-b bg-slate-900/40 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          {/* Left search & filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o ruta..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
            >
              {sistemas.map((sys) => (
                <option key={sys} value={sys}>
                  {sys.toUpperCase()}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none pl-2">
              <input
                type="checkbox"
                checked={soloM3U}
                onChange={(e) => setSoloM3U(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-0"
              />
              <span>Solo M3U / Multidisco</span>
            </label>
          </div>

          {/* Right action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenFormatCleaner}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Eliminar masivamente extensiones obsoletas como .xex o .bin"
            >
              <Eraser className="w-3.5 h-3.5" /> Depurar Formato ({formatosDisponibles.length})
            </button>

            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar Manual
            </button>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleRequestDeleteSelected}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Delete Confirmation Banner */}
        {showDeleteConfirm && (
          <div className="p-4 bg-rose-950/40 border-b border-rose-800/60 flex items-center justify-between text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>
                ¿Confirmas la eliminación permanente de <strong>{selectedIds.size}</strong> títulos seleccionados de la base de datos?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Sí, Eliminar Títulos
              </button>
            </div>
          </div>
        )}

        {/* Format Depuration Dialog Panel */}
        {showFormatModal && (
          <div className="p-4 bg-amber-950/30 border-b border-amber-800/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-amber-300">
                Depurar Formatos en {selectedSystem}:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-300">Extensión a remover:</span>
                <select
                  value={selectedFormatToClean}
                  onChange={(e) => setSelectedFormatToClean(e.target.value)}
                  className="px-2.5 py-1 rounded bg-slate-900 border border-amber-600/50 text-white font-mono text-xs"
                >
                  {formatosDisponibles.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-slate-300">
                Registros afectados: <strong className="text-amber-400 font-mono">{countMatchesToClean}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFormatModal(false)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={countMatchesToClean === 0}
                onClick={handleConfirmCleanFormat}
                className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs"
              >
                Eliminar {countMatchesToClean} registros ({selectedFormatToClean})
              </button>
            </div>
          </div>
        )}

        {/* Manual Add Collapsible Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddManualGame}
            className="p-4 bg-slate-900 border-b border-slate-800 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs"
          >
            <div>
              <label className="block text-slate-400 mb-1">Título</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Nombre del juego..."
                className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Sistema</label>
              <input
                type="text"
                value={newSystem}
                onChange={(e) => setNewSystem(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-white uppercase"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Extensión</label>
              <input
                type="text"
                value={newExtension}
                onChange={(e) => setNewExtension(e.target.value)}
                placeholder=".iso, .m3u, .chd"
                className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Tamaño</label>
              <input
                type="text"
                value={newSizeText}
                onChange={(e) => setNewSizeText(e.target.value)}
                placeholder="650 MB, 1.2 GB"
                className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Género</label>
              <input
                type="text"
                value={newGenre}
                onChange={(e) => setNewGenre(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-white"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-2.5 py-1.5 rounded bg-slate-800 text-slate-300"
              >
                ✕
              </button>
            </div>
          </form>
        )}

        {/* DataGrid Table */}
        <div className="flex-1 overflow-auto bg-slate-900/20">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800 z-10 backdrop-blur-sm">
              <tr>
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      filteredJuegos.length > 0 &&
                      selectedIds.size === filteredJuegos.length
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-700 text-blue-600"
                  />
                </th>
                <th className="py-2.5 px-3 font-semibold">Sistema</th>
                <th className="py-2.5 px-3 font-semibold">Título</th>
                <th className="py-2.5 px-3 font-semibold">Ruta / Archivo</th>
                <th className="py-2.5 px-3 font-semibold">Extensión</th>
                <th className="py-2.5 px-3 font-semibold text-right">Peso</th>
                <th className="py-2.5 px-3 font-semibold">Región</th>
                <th className="py-2.5 px-3 font-semibold">Género</th>
                <th className="py-2.5 px-3 font-semibold text-center">Deps</th>
                <th className="py-2.5 px-3 font-semibold text-center w-16">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredJuegos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No hay registros que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredJuegos.map((j) => {
                  const isChecked = selectedIds.has(j.id);
                  return (
                    <tr
                      key={j.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isChecked ? 'bg-blue-900/15' : ''
                      }`}
                    >
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectOne(j.id)}
                          className="rounded border-slate-700 text-blue-600"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono uppercase text-blue-400 font-semibold text-[11px]">
                        {j.sistema}
                      </td>
                      <td className="py-2 px-3 font-medium text-white truncate max-w-xs" title={j.nombre}>
                        {j.nombre}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400 truncate max-w-xs" title={j.ruta}>
                        {j.ruta}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-300">
                        {j.extension?.toUpperCase() || '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-300">
                        {formatBytes(j.tamanoBytes)}
                      </td>
                      <td className="py-2 px-3 text-slate-400">{j.region || 'Global'}</td>
                      <td className="py-2 px-3 text-slate-400 truncate max-w-[120px]">
                        {j.genero || 'Varios'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="font-mono text-[11px] text-slate-400">
                          {j.dependencias?.length || 0}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenEditGame(j)}
                          className="px-2 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                          title="Editar título, formato o peso de este juego"
                        >
                          <Edit3 className="w-3 h-3" /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </>
        )}

        {/* Tab 2: .PDB Local Database & Disk Cache Configuration */}
        {activeTab === 'pdbConfig' && (
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Top Grid: Paths & Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Local App Folder */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Carpeta del Programa
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        appDirName
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {appDirName ? 'Conectada' : 'No vinculada'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mb-1">
                    Directorio local donde se guardan el archivo .pdb y la caché:
                  </span>
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 font-mono text-xs text-white truncate" title={appDirName || 'Sin carpeta física vinculada'}>
                    {appDirName ? appDirName : 'Modo memoria (Selecciona tu carpeta local)'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAppDirectory}
                  className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  {appDirName ? 'Cambiar Carpeta del Programa' : 'Vincular Carpeta del Programa'}
                </button>
              </div>

              {/* Card 2: .PDB Database File */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Base de Datos (.PDB)
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold">
                      {DEFAULT_PDB_FILENAME}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mb-1">Ruta exacta del archivo .pdb:</span>
                  <div
                    className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 font-mono text-xs text-blue-300 truncate"
                    title={appDirName ? `${appDirName}/${DEFAULT_PDB_FILENAME}` : `./${DEFAULT_PDB_FILENAME}`}
                  >
                    {appDirName ? `${appDirName}/${DEFAULT_PDB_FILENAME}` : `./${DEFAULT_PDB_FILENAME}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isSavingPdb}
                    onClick={handleSavePdb}
                    className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingPdb ? 'Guardando...' : 'Guardar .pdb'}
                  </button>
                  <button
                    type="button"
                    disabled={isLoadingPdb}
                    onClick={handleLoadPdbFromDisk}
                    className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isLoadingPdb ? 'Cargando...' : 'Cargar .pdb'}
                  </button>
                </div>
              </div>

              {/* Card 3: Disk Cache */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Rutas de Caché Multimedia
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                      cache/
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Ruta Caché Imágenes:</span>
                      <div className="p-1.5 rounded bg-slate-800/80 font-mono text-[11px] text-emerald-300 truncate">
                        {appDirName ? `${appDirName}/cache/images/` : './cache/images/'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Ruta Caché Videos:</span>
                      <div className="p-1.5 rounded bg-slate-800/80 font-mono text-[11px] text-emerald-300 truncate">
                        {appDirName ? `${appDirName}/cache/videos/` : './cache/videos/'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 italic">
                  Las imágenes se leen de la caché local para evitar accesos repetitivos a la red.
                </div>
              </div>
            </div>

            {/* Explanation & Technical Details */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Arquitectura de Rendimiento: .PDB Local y Eliminación de Latencia de Red
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
                <div className="space-y-2 p-3 rounded-lg bg-slate-800/40 border border-slate-800">
                  <span className="font-semibold text-white block">1. Base de Datos .pdb Binaria Compacta:</span>
                  <p className="text-slate-400 text-[11px]">
                    Almacena la estructura completa de tus {listaJuegos.length} juegos en un archivo <code>retrobat_library.pdb</code>.
                    Al reiniciar el programa, la biblioteca se carga en milisegundos sin re-escanear 211,000 archivos por la red.
                  </p>
                </div>
                <div className="space-y-2 p-3 rounded-lg bg-slate-800/40 border border-slate-800">
                  <span className="font-semibold text-white block">2. Caché Local en la Carpeta del Programa:</span>
                  <p className="text-slate-400 text-[11px]">
                    Todas las carátulas, capturas y miniaturas se consultan primero en <code>cache/images/</code> y <code>cache/videos/</code> dentro de la carpeta donde se ejecuta la app, eliminando el cuello de botella de unidades compartidas en red.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Scanned Game Dialog */}
        {editingGame && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Editar Registro en Base de Datos</h3>
                    <p className="text-xs text-slate-400">Modifica el nombre, formato/extensión y peso del juego</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingGame(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditGame} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Nombre / Título del Juego</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Formato / Extensión</label>
                    <input
                      type="text"
                      required
                      value={editExtension}
                      onChange={(e) => setEditExtension(e.target.value)}
                      placeholder=".chd, .iso, .zip, .m3u..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Peso / Tamaño (MB o GB)</label>
                    <input
                      type="text"
                      required
                      value={editSizeText}
                      onChange={(e) => setEditSizeText(e.target.value)}
                      placeholder="ej: 650 MB o 1.4 GB"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Sistema / Consola</label>
                    <input
                      type="text"
                      required
                      value={editSystem}
                      onChange={(e) => setEditSystem(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white uppercase focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Región</label>
                    <input
                      type="text"
                      value={editRegion}
                      onChange={(e) => setEditRegion(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Ruta en Disco</label>
                  <input
                    type="text"
                    value={editRuta}
                    onChange={(e) => setEditRuta(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingGame(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow"
                  >
                    <Save className="w-3.5 h-3.5" /> Guardar Registro
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-slate-900/60" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <span className="text-xs text-slate-400 font-mono">
            Mostrando {filteredJuegos.length} de {listaJuegos.length} juegos en base de datos
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 transition-colors"
            >
              Guardar Cambios en Base de Datos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
