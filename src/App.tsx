import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Copy,
  Database,
  Download,
  Eye,
  Filter,
  FolderOpen,
  FolderSearch,
  Grid,
  HardDrive,
  Layers,
  List,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Star,
  Tag,
  Trash2,
  Upload,
  Usb,
  X,
  Zap,
} from 'lucide-react';
import { CopyProgressModal } from './components/CopyProgressModal';
import { CustomListsModal } from './components/CustomListsModal';
import { DatabaseManagerModal } from './components/DatabaseManagerModal';
import { ExportModal } from './components/ExportModal';
import { GameDetailModal } from './components/GameDetailModal';
import { MultiplatformModal } from './components/MultiplatformModal';
import { ScannerModal } from './components/ScannerModal';
import { ThemeCustomizerModal } from './components/ThemeCustomizerModal';
import { INITIAL_COLLECTIONS, INITIAL_GAMES } from './data/sampleLibrary';
import { ColeccionPersonalizada, FilterOptions, Juego, ThemeColors, ThemePreset, ViewMode } from './types';
import { parseImportedGameSelection } from './utils/exporter';
import {
  calculateGameTotalBytes,
  formatBytes,
  getGameBadge,
  processDuplicates1G1R,
} from './utils/gameUtils';
import { applyThemeCssVars, getStoredTheme } from './utils/themeManager';
import { exportAllMediaToDirectoryHandle, rehydrateGameMedia } from './utils/mediaCache';
import {
  DEFAULT_PDB_FILENAME,
  downloadPdbDatabaseFile,
  parsePdbBinary,
  readPdbFromDirectoryHandle,
  savePdbToDirectoryHandle,
} from './utils/pdbDatabase';
import { sourceFileRegistry } from './utils/sourceFileRegistry';

export type SortOption =
  | 'nombre-asc'
  | 'nombre-desc'
  | 'numerico'
  | 'tamano-desc'
  | 'tamano-asc'
  | 'anio-desc'
  | 'anio-asc'
  | 'sistema-asc';

export type GridAspectMode = '3/4' | '4/3' | '16/10' | '1/1';

const STORAGE_GAMES_KEY = 'retrobat_games_library_v1';
const STORAGE_COLLECTIONS_KEY = 'retrobat_collections_v1';

export default function App() {
  // Theme state
  const [themePreset, setThemePreset] = useState<ThemePreset>('dark');
  const [themeColors, setThemeColors] = useState<ThemeColors>(getStoredTheme().custom);

  // Core Data state
  const [juegos, setJuegos] = useState<Juego[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GAMES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_GAMES;
  });

  const [colecciones, setColecciones] = useState<ColeccionPersonalizada[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COLLECTIONS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_COLLECTIONS;
  });

  // Selected game IDs for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // View & Filter states
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    sistema: 'ALL',
    genero: 'ALL',
    anio: 'ALL',
    region: 'ALL',
    soloM3U: false,
    soloSeleccionados: false,
    soloDuplicados: false,
    filtroRolDuplicado: 'all',
    tag: 'ALL',
  });

  // Modals visibility state
  const [gridArtworkType, setGridArtworkType] = useState<'caratula' | 'miniatura' | 'logo' | 'fondo'>('caratula');
  const [gridAspect, setGridAspect] = useState<GridAspectMode>('3/4');
  const [sortBy, setSortBy] = useState<SortOption>('nombre-asc');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isMultiplatformOpen, setIsMultiplatformOpen] = useState(false);
  const [selectedGameForDetail, setSelectedGameForDetail] = useState<Juego | null>(null);

  // USB Sync state
  const [isUsbCopyOpen, setIsUsbCopyOpen] = useState(false);
  const [usbCopyTargetGames, setUsbCopyTargetGames] = useState<Juego[]>([]);
  const [usbDestinationName, setUsbDestinationName] = useState('E:\\RetroBat_USB');
  const [usbDestHandle, setUsbDestHandle] = useState<any>(null);

  // Local Program Folder, Database & Media Cache State
  const [appDirHandle, setAppDirHandle] = useState<any>(null);
  const [appDirName, setAppDirName] = useState<string>('');
  const [mediaCacheDirHandle, setMediaCacheDirHandle] = useState<any>(null);
  const [mediaCacheDirName, setMediaCacheDirName] = useState<string>('');
  const [isSavingPdbQuick, setIsSavingPdbQuick] = useState(false);
  const [isExportingMediaCache, setIsExportingMediaCache] = useState(false);

  // Pagination state (Crucial for preventing 6 GB RAM overflow on 9,000+ titles)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(48);

  // In-app Notification toast & Delete modal states (zero browser locker alerts/confirms)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appNotification, setAppNotification] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (appNotification) {
      const timer = setTimeout(() => {
        setAppNotification(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [appNotification]);

  // Reset pagination on filter or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortBy]);

  // Initialize theme & load persisted directory handles on mount
  useEffect(() => {
    const { preset, custom } = getStoredTheme();
    setThemePreset(preset);
    setThemeColors(custom);
    applyThemeCssVars(custom);

    sourceFileRegistry.initFromStorage().then(({ appHandle, mediaCacheHandle }) => {
      if (appHandle) {
        setAppDirHandle(appHandle);
        setAppDirName(appHandle.name);
      }
      if (mediaCacheHandle) {
        setMediaCacheDirHandle(mediaCacheHandle);
        setMediaCacheDirName(mediaCacheHandle.name);
      }
    });

    // Rehydrate media blobs from IndexedDB so images/videos persist across reloads
    try {
      const raw = localStorage.getItem(STORAGE_GAMES_KEY);
      if (raw) {
        const parsed: Juego[] = JSON.parse(raw);
        if (parsed && parsed.length > 0) {
          rehydrateGameMedia(parsed).then((rehydrated) => {
            setJuegos(rehydrated);
          });
        }
      }
    } catch (e) {
      console.warn('Could not rehydrate games from localStorage', e);
    }
  }, []);

  // Persist games whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_GAMES_KEY, JSON.stringify(juegos));
    } catch (e) {
      console.warn('Could not persist games to localStorage', e);
    }
  }, [juegos]);

  // Persist collections
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COLLECTIONS_KEY, JSON.stringify(colecciones));
    } catch (e) {
      console.warn('Could not persist collections to localStorage', e);
    }
  }, [colecciones]);

  // Systems and metadata options
  const sistemasDisponibles = useMemo(() => {
    return Array.from(new Set(juegos.map((j) => j.sistema))).sort();
  }, [juegos]);

  // Per-system detailed statistics (count, storage bytes, m3u, duplicates)
  const systemStats = useMemo(() => {
    const map = new Map<string, { count: number; bytes: number; m3u: number; dups: number }>();
    juegos.forEach((j) => {
      const s = j.sistema || 'otros';
      const entry = map.get(s) || { count: 0, bytes: 0, m3u: 0, dups: 0 };
      entry.count++;
      entry.bytes += j.tamanoBytes || 0;
      if (j.extension?.toLowerCase() === '.m3u') entry.m3u++;
      if (j.esDuplicado) entry.dups++;
      map.set(s, entry);
    });
    return map;
  }, [juegos]);

  const generosDisponibles = useMemo(() => {
    return Array.from(new Set(juegos.map((j) => j.genero).filter(Boolean))).sort();
  }, [juegos]);

  const tagsDisponibles = useMemo(() => {
    const all = juegos.flatMap((j) => j.customTags || []);
    return Array.from(new Set(all)).sort();
  }, [juegos]);

  // Filtered dataset with full sorting support
  const filteredJuegos = useMemo(() => {
    const list = juegos.filter((j) => {
      // Search text
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const inName = j.nombre.toLowerCase().includes(q);
        const inClean = j.cleanTitle.toLowerCase().includes(q);
        const inDev = (j.desarrollador || '').toLowerCase().includes(q);
        const inDesc = (j.descripcion || '').toLowerCase().includes(q);
        const inTags = (j.customTags || []).some((t) => t.toLowerCase().includes(q));
        if (!inName && !inClean && !inDev && !inDesc && !inTags) return false;
      }

      // System
      if (filters.sistema !== 'ALL' && j.sistema !== filters.sistema) return false;

      // Genre
      if (filters.genero !== 'ALL' && j.genero !== filters.genero) return false;

      // Tag
      if (filters.tag !== 'ALL' && (!j.customTags || !j.customTags.includes(filters.tag))) return false;

      // Only selected
      if (filters.soloSeleccionados && !selectedIds.has(j.id)) return false;

      // Only M3U / Multidisc
      if (
        filters.soloM3U &&
        j.extension?.toLowerCase() !== '.m3u' &&
        (!j.dependencias || j.dependencias.length === 0)
      ) {
        return false;
      }

      // Only duplicates
      if (filters.soloDuplicados && !j.esDuplicado) return false;

      // Duplicate role
      if (filters.filtroRolDuplicado === 'original' && j.rolDuplicado !== 'original') return false;
      if (filters.filtroRolDuplicado === 'descarte' && j.rolDuplicado !== 'descarte') return false;
      if (filters.filtroRolDuplicado === 'ambos_validos' && j.rolDuplicado !== 'ambos_validos') return false;

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'nombre-asc') {
        return a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'nombre-desc') {
        return b.nombre.localeCompare(a.nombre, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'numerico') {
        return a.nombre.localeCompare(b.nombre, undefined, { numeric: true });
      }
      if (sortBy === 'tamano-desc') {
        return (b.tamanoBytes || 0) - (a.tamanoBytes || 0);
      }
      if (sortBy === 'tamano-asc') {
        return (a.tamanoBytes || 0) - (b.tamanoBytes || 0);
      }
      if (sortBy === 'anio-desc') {
        return (b.anio || '').localeCompare(a.anio || '');
      }
      if (sortBy === 'anio-asc') {
        return (a.anio || '').localeCompare(b.anio || '');
      }
      if (sortBy === 'sistema-asc') {
        return (a.sistema || '').localeCompare(b.sistema || '') || a.nombre.localeCompare(b.nombre);
      }
      return 0;
    });

    return list;
  }, [juegos, filters, selectedIds, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredJuegos.length / (itemsPerPage > 0 ? itemsPerPage : 1)));
  const paginatedJuegos = useMemo(() => {
    if (itemsPerPage === -1) return filteredJuegos;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredJuegos.slice(start, start + itemsPerPage);
  }, [filteredJuegos, currentPage, itemsPerPage]);

  const handleSelectMediaCacheFolder = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (handle) {
          await sourceFileRegistry.setMediaCacheDirectoryHandle(handle);
          setMediaCacheDirHandle(handle);
          setMediaCacheDirName(handle.name);
          setAppNotification({
            type: 'success',
            message: `Carpeta física vinculada: "${handle.name}". Ahora puedes sincronizar las imágenes y videos directamente aquí para verlos en tu explorador.`,
          });
        }
      }
    } catch {}
  };

  const handleSyncMediaCacheToDisk = async () => {
    let targetHandle = mediaCacheDirHandle;
    if (!targetHandle) {
      if ('showDirectoryPicker' in window) {
        try {
          targetHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
          if (targetHandle) {
            await sourceFileRegistry.setMediaCacheDirectoryHandle(targetHandle);
            setMediaCacheDirHandle(targetHandle);
            setMediaCacheDirName(targetHandle.name);
          } else {
            return;
          }
        } catch {
          return;
        }
      } else {
        setAppNotification({
          type: 'info',
          message: 'Tu navegador no soporta el selector nativo de carpetas.',
        });
        return;
      }
    }

    setIsExportingMediaCache(true);
    try {
      const res = await exportAllMediaToDirectoryHandle(targetHandle);
      setAppNotification({
        type: 'success',
        message: `¡Caché multimedia exportada con éxito! Se copiaron ${res.exportedCount} archivos en "${targetHandle.name}/images/" y "${targetHandle.name}/videos/" (${formatBytes(res.totalBytes)}).`,
      });
    } catch (err: any) {
      setAppNotification({
        type: 'info',
        message: `Error al exportar caché multimedia: ${err.message || err}`,
      });
    } finally {
      setIsExportingMediaCache(false);
    }
  };

  const handleQuickSavePdb = async () => {
    setIsSavingPdbQuick(true);
    try {
      downloadPdbDatabaseFile(juegos, colecciones, DEFAULT_PDB_FILENAME);
      setAppNotification({
        type: 'success',
        message: `Base de datos completa descargada como "${DEFAULT_PDB_FILENAME}".`,
      });
    } catch (e: any) {
      setAppNotification({
        type: 'info',
        message: `Error al guardar .pdb: ${e.message}`,
      });
    } finally {
      setIsSavingPdbQuick(false);
    }
  };

  const handleQuickLoadPdb = async () => {
    try {
      if (appDirHandle) {
        const result = await readPdbFromDirectoryHandle(appDirHandle, DEFAULT_PDB_FILENAME);
        if (result && result.juegos.length > 0) {
          const processed = processDuplicates1G1R(result.juegos);
          setJuegos(processed);
          if (result.colecciones && result.colecciones.length > 0) {
            setColecciones(result.colecciones);
          }
          setAppNotification({
            type: 'success',
            message: `Cargados ${processed.length} títulos desde "${appDirName}/${DEFAULT_PDB_FILENAME}".`,
          });
          return;
        }
      }

      // Fallback file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdb,.json';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const result = await parsePdbBinary(file);
          if (result && result.juegos.length > 0) {
            const processed = processDuplicates1G1R(result.juegos);
            setJuegos(processed);
            if (result.colecciones && result.colecciones.length > 0) {
              setColecciones(result.colecciones);
            }
            setAppNotification({
              type: 'success',
              message: `Cargados ${processed.length} títulos desde "${file.name}".`,
            });
          }
        } catch (err: any) {
          setAppNotification({
            type: 'info',
            message: `Error al leer .pdb: ${err.message}`,
          });
        }
      };
      input.click();
    } catch (e: any) {
      setAppNotification({
        type: 'info',
        message: `Error: ${e.message}`,
      });
    }
  };

  const handleMarkBothValid = (id: string | number) => {
    setJuegos((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          return { ...g, rolDuplicado: 'ambos_validos' };
        }
        return g;
      })
    );
    setAppNotification({
      type: 'success',
      message: 'Juego marcado como válido para conservar en la biblioteca.',
    });
  };

  const handleRemoveDuplicateTag = (id: string | number) => {
    setJuegos((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          return { ...g, esDuplicado: false, grupoDuplicadoId: undefined };
        }
        return g;
      })
    );
    setAppNotification({
      type: 'info',
      message: 'Etiqueta de duplicado removida con éxito.',
    });
  };

  // Selected games array
  const juegosSeleccionados = useMemo(() => {
    return juegos.filter((j) => selectedIds.has(j.id));
  }, [juegos, selectedIds]);

  const bytesSeleccionados = useMemo(() => {
    return juegosSeleccionados.reduce((acc, j) => acc + (j.tamanoBytes || 0), 0);
  }, [juegosSeleccionados]);

  // Library summary counts
  const totalLibraryBytes = useMemo(() => {
    return juegos.reduce((acc, j) => acc + (j.tamanoBytes || 0), 0);
  }, [juegos]);

  const totalDuplicatesCount = useMemo(() => {
    return juegos.filter((j) => j.esDuplicado).length;
  }, [juegos]);

  const totalM3uCount = useMemo(() => {
    return juegos.filter((j) => j.extension?.toLowerCase() === '.m3u').length;
  }, [juegos]);

  const selectedCountBySystem = useMemo(() => {
    const map = new Map<string, number>();
    juegosSeleccionados.forEach((j) => {
      const s = (j.sistema || 'custom').toUpperCase();
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [juegosSeleccionados]);

  const totalDependenciesCount = useMemo(() => {
    return juegos.reduce((acc, j) => acc + (j.dependencias?.length || 0), 0);
  }, [juegos]);

  const selectedDependenciesCount = useMemo(() => {
    return juegosSeleccionados.reduce((acc, j) => acc + (j.dependencias?.length || 0), 0);
  }, [juegosSeleccionados]);

  const getGridImageUrl = (j: Juego, type: 'caratula' | 'miniatura' | 'logo' | 'fondo') => {
    if (type === 'caratula') {
      return j.rutaThumb || j.imagen || j.rutaImage || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80';
    }
    if (type === 'miniatura') {
      return j.rutaImage || j.imagen || j.rutaThumb || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80';
    }
    if (type === 'logo') {
      return j.rutaMarquee || j.rutaThumb || j.imagen || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80';
    }
    if (type === 'fondo') {
      return j.rutaFanart || j.rutaImage || j.imagen || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80';
    }
    return j.rutaThumb || j.imagen || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80';
  };

  // Toggle selection
  const handleToggleSelectOne = (id: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAllFiltered = () => {
    if (selectedIds.size === filteredJuegos.length && filteredJuegos.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredJuegos.map((j) => j.id)));
    }
  };

  const handleSelectAllDuplicatesDiscards = () => {
    const discardIds = juegos.filter((j) => j.rolDuplicado === 'descarte').map((j) => j.id);
    setSelectedIds(new Set(discardIds));
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteSelected = () => {
    const count = selectedIds.size;
    setJuegos((prev) => prev.filter((j) => !selectedIds.has(j.id)));
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
    setAppNotification({
      type: 'info',
      message: `Se eliminaron ${count} títulos seleccionados de la biblioteca.`,
    });
  };

  const handleSaveGameDetails = (updated: Juego) => {
    setJuegos((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  };

  const handleImportGames = (
    scanned: Juego[],
    modo: 'merge' | 'replace',
    sistemaEspecifico?: string
  ) => {
    if (modo === 'replace') {
      const processed = processDuplicates1G1R(scanned);
      setJuegos(processed);
      setSelectedIds(new Set());
      setAppNotification({
        type: 'success',
        message: `Biblioteca reemplazada con éxito (${processed.length} títulos importados).`,
      });
    } else {
      // If single system specified, remove existing games of that system first
      let base = juegos;
      if (sistemaEspecifico) {
        base = base.filter((j) => j.sistema.toLowerCase() !== sistemaEspecifico.toLowerCase());
      }
      const map = new Map<string, Juego>();
      for (const j of base) {
        map.set(`${j.sistema}__${j.nombre}`, j);
      }
      for (const s of scanned) {
        map.set(`${s.sistema}__${s.nombre}`, s);
      }
      const combined = Array.from(map.values());
      const processed = processDuplicates1G1R(combined);
      setJuegos(processed);
      setAppNotification({
        type: 'success',
        message: `Se importaron ${scanned.length} títulos a la biblioteca (${processed.length} en total).`,
      });
    }
  };

  const handleStartUsbSync = (
    targetGames: Juego[],
    destination: string,
    destinationHandle?: any
  ) => {
    setUsbCopyTargetGames(targetGames);
    setUsbDestinationName(destination);
    setUsbDestHandle(destinationHandle || null);
    setIsUsbCopyOpen(true);
  };

  const handleImportSelectedList = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const { keys, titles } = parseImportedGameSelection(content);
      const keySet = new Set(keys.map((k) => k.toLowerCase()));
      const titleSet = new Set(titles.map((t) => t.toLowerCase()));

      const nextSelected = new Set(selectedIds);
      let matchedCount = 0;

      juegos.forEach((j) => {
        const k1 = `${j.sistema}__${j.nombre}`.toLowerCase();
        const k2 = `${j.sistema}__${j.cleanTitle}`.toLowerCase();
        const t1 = j.nombre.toLowerCase();
        const t2 = j.cleanTitle.toLowerCase();

        if (keySet.has(k1) || keySet.has(k2) || titleSet.has(t1) || titleSet.has(t2)) {
          if (!nextSelected.has(j.id)) {
            nextSelected.add(j.id);
            matchedCount++;
          }
        }
      });

      setSelectedIds(nextSelected);
      setAppNotification({
        type: 'success',
        message: `Archivo "${file.name}" cargado con éxito: Se marcaron ${matchedCount} títulos nuevos (${nextSelected.size} en total).`,
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="min-h-screen flex flex-col font-sans transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-app, #090D16)',
        color: 'var(--text-app, #E5E7EB)',
      }}
    >
      {/* Top Bar Contract (1-line Brand wordmark - clean Nav items - Primary Action) */}
      <header
        className="px-6 py-3.5 border-b sticky top-0 z-30 backdrop-blur-md flex items-center justify-between gap-6"
        style={{
          borderColor: 'var(--border-app, #1F2937)',
          backgroundColor: 'rgba(9, 13, 22, 0.85)',
        }}
      >
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <span
            className="text-base font-bold tracking-tight whitespace-nowrap"
            style={{ color: 'var(--title-app, #F9FAFB)' }}
          >
            RetroBat Manager Pro
          </span>
        </div>

        {/* Zone 2: Navigation Toolbar Actions */}
        <nav className="hidden lg:flex items-center gap-1.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <FolderSearch className="w-4 h-4 text-blue-400" /> Escanear Carpetas
          </button>

          <button
            type="button"
            onClick={() => setIsCollectionsOpen(true)}
            className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Star className="w-4 h-4 text-amber-400" /> Listas Personalizadas ({colecciones.length})
          </button>

          <button
            type="button"
            onClick={() => setIsDatabaseOpen(true)}
            className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Database className="w-4 h-4 text-purple-400" /> Base de Datos SQLite
          </button>

          <button
            type="button"
            onClick={() => setIsThemeOpen(true)}
            className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Palette className="w-4 h-4 text-pink-400" /> Temas y Colores
          </button>

          <button
            type="button"
            onClick={() => setIsMultiplatformOpen(true)}
            className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <FolderOpen className="w-4 h-4 text-emerald-400" /> Multiplataforma
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <label
            className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm whitespace-nowrap"
            title="Cargar archivo JSON o CSV para seleccionar automáticamente los títulos en la biblioteca"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" /> Cargar Marcados (.json / .csv)
            <input
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={handleImportSelectedList}
            />
          </label>

          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-blue-900/30 transition-all hover:opacity-95 whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'var(--accent-app, #3B82F6)' }}
          >
            <Download className="w-4 h-4" /> Exportar / USB
            {selectedIds.size > 0 && (
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[11px] font-mono">
                {selectedIds.size}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* KPI Strip & Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--card-app, #111827)',
              borderColor: 'var(--border-app, #1F2937)',
            }}
          >
            <span className="text-xs text-slate-400">Total Títulos</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-mono text-white tabular-nums">
                {juegos.length}
              </span>
              <span className="text-xs font-mono text-slate-400">{formatBytes(totalLibraryBytes)}</span>
            </div>
          </div>

          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--card-app, #111827)',
              borderColor: 'var(--border-app, #1F2937)',
            }}
          >
            <span className="text-xs text-slate-400">Sistemas Activos</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-mono text-blue-400 tabular-nums">
                {sistemasDisponibles.length}
              </span>
              <span className="text-[11px] text-slate-500 uppercase truncate">
                {sistemasDisponibles.slice(0, 3).join(', ')}
              </span>
            </div>
          </div>

          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--card-app, #111827)',
              borderColor: 'var(--border-app, #1F2937)',
            }}
          >
            <span className="text-xs text-slate-400">Multidisco / M3U</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-mono text-purple-400 tabular-nums">
                {totalM3uCount}
              </span>
              <span className="text-[11px] text-purple-400/80">Discos enlazados</span>
            </div>
          </div>

          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--card-app, #111827)',
              borderColor: 'var(--border-app, #1F2937)',
            }}
          >
            <span className="text-xs text-slate-400">Duplicados 1G1R</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                {totalDuplicatesCount}
              </span>
              <button
                type="button"
                onClick={handleSelectAllDuplicatesDiscards}
                className="text-[11px] text-amber-400 hover:underline"
                title="Marcar descartes para depuración"
              >
                Marcar descartes
              </button>
            </div>
          </div>

          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between col-span-2 sm:col-span-1"
            style={{
              backgroundColor: 'var(--card-app, #111827)',
              borderColor: 'var(--border-app, #1F2937)',
            }}
          >
            <span className="text-xs text-slate-400">Juegos Marcados</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {selectedIds.size}
              </span>
              <span className="text-xs font-mono text-emerald-400/80 truncate">
                {formatBytes(bytesSeleccionados)}
              </span>
            </div>
          </div>
        </div>

        {/* Local Automatic Database & Physical Media Cache Access Strip */}
        <div
          className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: 'var(--card-app, #111827)',
            borderColor: 'var(--border-app, #1F2937)',
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-400 font-medium">Base de Datos:</span>
              <span className="font-mono text-emerald-300 font-semibold truncate" title="Persistencia automática en IndexedDB y memoria local">
                ⚡ Auto-Sincronizada (IndexedDB / .pdb)
              </span>
            </div>
            <span className="text-slate-700 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-slate-400 font-medium">Caché Multimedia en PC:</span>
              <span className="font-mono text-white font-semibold truncate max-w-[220px]" title={mediaCacheDirName ? `Carpeta vinculada: ${mediaCacheDirName}` : 'Guarda las imágenes y videos en tu disco para abrirlos en Windows'}>
                {mediaCacheDirName ? `📂 ${mediaCacheDirName} (images/ & videos/)` : '📁 Sin asignar a carpeta de disco'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSelectMediaCacheFolder}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
              title="Selecciona la carpeta física en tu ordenador donde se guardarán las imágenes y videos"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              {mediaCacheDirName ? 'Cambiar Carpeta Caché' : '📁 Asignar Carpeta Caché'}
            </button>
            <button
              type="button"
              disabled={isExportingMediaCache}
              onClick={handleSyncMediaCacheToDisk}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
              title="Copia físicamente todas las carátulas, miniaturas y videos a tu disco para verlos directamente en tu explorador de archivos"
            >
              <Download className="w-3.5 h-3.5" />
              {isExportingMediaCache ? 'Escribiendo en disco...' : '⚡ Sincronizar Caché a Disco'}
            </button>
            <button
              type="button"
              disabled={isSavingPdbQuick}
              onClick={handleQuickSavePdb}
              className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
              title="Descargar archivo .pdb portable"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar .pdb
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          className="p-4 rounded-xl border space-y-3"
          style={{
            backgroundColor: 'var(--card-app, #111827)',
            borderColor: 'var(--border-app, #1F2937)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Buscar por título, desarrollador, género o etiqueta..."
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, search: '' })}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista de Tabla Detallada"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista de Cuadrícula con Carátulas"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped-system')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grouped-system' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista por Sistemas (Conteo y Peso de Cada Uno)"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Dropdowns and Quick Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
              {/* System selector */}
              <select
                value={filters.sistema}
                onChange={(e) => setFilters({ ...filters, sistema: e.target.value })}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Todos los Sistemas ({sistemasDisponibles.length})</option>
                {sistemasDisponibles.map((s) => {
                  const stat = systemStats.get(s);
                  return (
                    <option key={s} value={s}>
                      {s.toUpperCase()} ({stat?.count || 0} títulos · {formatBytes(stat?.bytes || 0)})
                    </option>
                  );
                })}
              </select>

              {/* Genre selector */}
              <select
                value={filters.genero}
                onChange={(e) => setFilters({ ...filters, genero: e.target.value })}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Todos los Géneros</option>
                {generosDisponibles.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              {/* Tag selector */}
              {tagsDisponibles.length > 0 && (
                <select
                  value={filters.tag}
                  onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
                >
                  <option value="ALL">Todas las Etiquetas</option>
                  {tagsDisponibles.map((t) => (
                    <option key={t} value={t}>
                      🏷️ {t}
                    </option>
                  ))}
                </select>
              )}

              {/* Duplicates Filter */}
              <select
                value={filters.filtroRolDuplicado}
                onChange={(e) =>
                  setFilters({ ...filters, filtroRolDuplicado: e.target.value as any })
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="all">Duplicados: Todos</option>
                <option value="original">Solo Originales (Recomendados 1G1R)</option>
                <option value="descarte">Solo Descartes (1G1R)</option>
                <option value="ambos_validos">Conservados (Ambos Válidos)</option>
              </select>

              {/* Sorting selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none font-medium"
                  title="Criterio de ordenamiento de la biblioteca"
                >
                  <option value="nombre-asc">Nombre: A → Z</option>
                  <option value="nombre-desc">Nombre: Z → A</option>
                  <option value="numerico">Alfanumérico (1, 2, 3, A...)</option>
                  <option value="tamano-desc">Mayor Peso (GB / MB)</option>
                  <option value="tamano-asc">Menor Peso (KB / MB)</option>
                  <option value="anio-desc">Año: Más reciente</option>
                  <option value="anio-asc">Año: Más antiguo</option>
                  <option value="sistema-asc">Sistema (A → Z)</option>
                </select>
              </div>
            </div>

            {/* Checkbox Toggles */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.soloM3U}
                  onChange={(e) => setFilters({ ...filters, soloM3U: e.target.checked })}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Solo M3U / Multidisco</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.soloSeleccionados}
                  onChange={(e) => setFilters({ ...filters, soloSeleccionados: e.target.checked })}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Solo Marcados ({selectedIds.size})</span>
              </label>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar (when games are marked) */}
        {selectedIds.size > 0 && (
          <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-300">
                  {selectedIds.size} títulos marcados ({formatBytes(bytesSeleccionados)})
                </span>
                <span className="text-[11px] text-slate-400">
                  · {selectedDependenciesCount} archivos vinculados
                </span>
              </div>
              {selectedCountBySystem.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Por consola:</span>
                  {selectedCountBySystem.map(([sys, count]) => (
                    <span
                      key={sys}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold"
                    >
                      {sys}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExportOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Exportar Selección
              </button>

              <button
                type="button"
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 font-medium flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar ({selectedIds.size})
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                Desmarcar todos
              </button>
            </div>
          </div>
        )}

        {/* Pagination Bar Helper */}
        {filteredJuegos.length > 0 && (
          <div
            className="px-4 py-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs"
            style={{
              backgroundColor: 'var(--card-app, #111827)',
              borderColor: 'var(--border-app, #1F2937)',
            }}
          >
            <div className="flex items-center gap-2 text-slate-400">
              <span>Mostrando</span>
              <span className="font-mono text-white font-bold">
                {itemsPerPage === -1
                  ? `1 - ${filteredJuegos.length}`
                  : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredJuegos.length)} - ${Math.min(
                      currentPage * itemsPerPage,
                      filteredJuegos.length
                    )}`}
              </span>
              <span>de</span>
              <span className="font-mono text-white font-bold">{filteredJuegos.length}</span>
              <span>títulos</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 mr-2">
                <span className="text-slate-400 text-[11px]">Por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs font-mono"
                >
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={96}>96</option>
                  <option value={192}>192</option>
                  <option value={-1}>Todos</option>
                </select>
              </div>

              {itemsPerPage !== -1 && totalPages > 1 && (
                <div className="flex items-center gap-1 font-mono">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                    title="Primera página"
                  >
                    ««
                  </button>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  >
                    Anterior
                  </button>

                  <span className="px-2.5 py-1 text-slate-300">
                    Pág. <strong className="text-white">{currentPage}</strong> / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  >
                    Siguiente
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                    title="Última página"
                  >
                    »»
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* View Mode: Table */}
        {viewMode === 'table' && (
          <div
            className="rounded-2xl border overflow-hidden shadow-sm"
            style={{
              backgroundColor: 'var(--card-app, #111827)',
              borderColor: 'var(--border-app, #1F2937)',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredJuegos.length > 0 &&
                          selectedIds.size === filteredJuegos.length
                        }
                        onChange={handleSelectAllFiltered}
                        className="rounded border-slate-700 text-blue-600"
                      />
                    </th>
                    <th className="py-3 px-3 font-semibold">Sistema</th>
                    <th className="py-3 px-4 font-semibold">Título del Juego</th>
                    <th className="py-3 px-3 font-semibold">Formato</th>
                    <th className="py-3 px-3 font-semibold text-right">Peso Total</th>
                    <th className="py-3 px-3 font-semibold">Región</th>
                    <th className="py-3 px-3 font-semibold">Género</th>
                    <th className="py-3 px-3 font-semibold text-center">Dependencias</th>
                    <th className="py-3 px-3 font-semibold text-center w-16">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedJuegos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-slate-500">
                        No se encontraron juegos con los criterios de búsqueda actuales.
                      </td>
                    </tr>
                  ) : (
                    paginatedJuegos.map((j) => {
                      const isChecked = selectedIds.has(j.id);
                      const badge = getGameBadge(j);

                      return (
                        <tr
                          key={j.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isChecked ? 'bg-blue-900/15' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectOne(j.id)}
                              className="rounded border-slate-700 text-blue-600"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono uppercase font-bold text-[11px] text-blue-400">
                              {j.sistema}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-white">
                            <div className="flex items-center gap-2 truncate max-w-sm">
                              <span className="truncate" title={j.nombre}>
                                {j.nombre}
                              </span>
                              {j.esDuplicado && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                                      j.rolDuplicado === 'original'
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : j.rolDuplicado === 'ambos_validos'
                                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    }`}
                                    title={
                                      j.rolDuplicado === 'original'
                                        ? 'Copia recomendada 1G1R'
                                        : j.rolDuplicado === 'ambos_validos'
                                        ? 'Conservado (ambos válidos)'
                                        : 'Copia secundaria / descarte 1G1R'
                                    }
                                  >
                                    {j.rolDuplicado === 'original'
                                      ? '1G1R Recomendado'
                                      : j.rolDuplicado === 'ambos_validos'
                                      ? 'Ambos Válidos'
                                      : '1G1R Descarte'}
                                  </span>
                                  {j.rolDuplicado === 'descarte' && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkBothValid(j.id);
                                      }}
                                      className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30 font-medium"
                                      title="Conservar ambos válidos (no descartar)"
                                    >
                                      Conservar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveDuplicateTag(j.id);
                                    }}
                                    className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 hover:text-white"
                                    title="Quitar etiqueta de duplicado"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${badge.colorClass}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-white">
                            {formatBytes(j.tamanoBytes)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{j.region || 'Global'}</td>
                          <td className="py-2.5 px-3 text-slate-400 truncate max-w-[140px]">
                            {j.genero || 'Varios'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono text-slate-400 text-xs">
                              {j.dependencias?.length || 0}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedGameForDetail(j)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Inspeccionar archivos y multimedia"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View Mode: Grid (Visual Boxart Cards) */}
        {viewMode === 'grid' && (
          <div className="space-y-4">
            {/* Grid Artwork Selector Toolbar */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border"
              style={{
                backgroundColor: 'var(--card-app, #111827)',
                borderColor: 'var(--border-app, #1F2937)',
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">Mostrar:</span>
                <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg text-xs border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setGridArtworkType('caratula')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      gridArtworkType === 'caratula'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Carátula
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridArtworkType('miniatura')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      gridArtworkType === 'miniatura'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Miniatura
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridArtworkType('logo')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      gridArtworkType === 'logo'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Logo
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridArtworkType('fondo')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      gridArtworkType === 'fondo'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Fondo
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

                <span className="text-xs font-semibold text-slate-300 hidden sm:inline">Proporción:</span>
                <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg text-xs border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setGridAspect('3/4')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      gridAspect === '3/4'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Boxart vertical estándar para consolas (PSX, PS2, PS3, Switch, Xbox...)"
                  >
                    Boxart (3:4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridAspect('4/3')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      gridAspect === '4/3'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Clásico horizontal (SNES, Mega Drive, Arcade)"
                  >
                    4:3
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridAspect('16/10')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      gridAspect === '16/10'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Panorámico (Fondos / Fanarts)"
                  >
                    16:10
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridAspect('1/1')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      gridAspect === '1/1'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Cuadrado (1:1)"
                  >
                    1:1
                  </button>
                </div>
              </div>

              {/* Grid Bulk Select Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Marcar todos los juegos visibles en la cuadrícula"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Marcar todos ({filteredJuegos.length})
                </button>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    Desmarcar ({selectedIds.size})
                  </button>
                )}
                <span className="text-[11px] text-slate-500 hidden sm:inline ml-1">
                  (El video se visualiza en detalles)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginatedJuegos.map((j) => {
                const isChecked = selectedIds.has(j.id);
                const badge = getGameBadge(j);
                const coverUrl = getGridImageUrl(j, gridArtworkType);

              return (
                <div
                  key={j.id}
                  className={`rounded-2xl border overflow-hidden flex flex-col group transition-all duration-200 relative ${
                    isChecked ? 'border-blue-500 shadow-md shadow-blue-900/20' : 'border-slate-800'
                  }`}
                  style={{
                    backgroundColor: 'var(--card-app, #111827)',
                  }}
                >
                  {/* Card Cover with Ambient Backdrop & Zero Cropping */}
                  <div
                    className={`relative ${
                      gridAspect === '3/4'
                        ? 'aspect-[3/4]'
                        : gridAspect === '4/3'
                        ? 'aspect-[4/3]'
                        : gridAspect === '1/1'
                        ? 'aspect-square'
                        : 'aspect-[16/10]'
                    } bg-slate-950 overflow-hidden cursor-pointer flex items-center justify-center`}
                    onClick={() => setSelectedGameForDetail(j)}
                  >
                    {/* Ambient Blurred Glow Backdrop */}
                    <img
                      src={coverUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none"
                    />
                    {/* Crisp 100% Uncropped Artwork */}
                    <img
                      src={coverUrl}
                      alt={j.nombre}
                      className="relative z-10 max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-md"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

                    {/* Top tags */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-blue-400">
                        {j.sistema}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectOne(j.id);
                        }}
                        className={`p-1.5 rounded-lg backdrop-blur-md transition-colors ${
                          isChecked ? 'bg-blue-600 text-white' : 'bg-black/60 text-slate-300 hover:text-white'
                        }`}
                      >
                        {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Bottom size badge */}
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-xs font-mono">
                      <span className="text-white font-bold">{formatBytes(j.tamanoBytes)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.colorClass}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 flex flex-col flex-1 justify-between">
                    <div>
                      <h3
                        className="text-xs font-bold text-white truncate cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => setSelectedGameForDetail(j)}
                        title={j.nombre}
                      >
                        {j.nombre}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                        <span>{j.anio || 'Año desc.'}</span>
                        <span>·</span>
                        <span>{j.region || 'Global'}</span>
                        <span>·</span>
                        <span className="truncate">{j.genero || 'Varios'}</span>
                      </div>

                      {/* 1G1R Card Duplicate Tag */}
                      {j.esDuplicado && (
                        <div className="mt-2 flex items-center gap-1">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                              j.rolDuplicado === 'original'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : j.rolDuplicado === 'ambos_validos'
                                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {j.rolDuplicado === 'original'
                              ? '1G1R Recomendado'
                              : j.rolDuplicado === 'ambos_validos'
                              ? 'Ambos Válidos'
                              : '1G1R Descarte'}
                          </span>
                          {j.rolDuplicado === 'descarte' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkBothValid(j.id);
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 font-medium"
                              title="Conservar ambos válidos"
                            >
                              Conservar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveDuplicateTag(j.id);
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                            title="Quitar etiqueta duplicado"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{j.dependencias?.length || 0} archivos adjuntos</span>
                      <button
                        type="button"
                        onClick={() => setSelectedGameForDetail(j)}
                        className="text-blue-400 hover:underline flex items-center gap-1"
                      >
                        Ver detalles →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* View Mode: Grouped by System */}
        {viewMode === 'grouped-system' && (
          <div className="space-y-6">
            {sistemasDisponibles.map((sys) => {
              const sysGames = filteredJuegos.filter((j) => (j.sistema || 'otros') === sys);
              if (sysGames.length === 0) return null;

              const sysBytes = sysGames.reduce((acc, j) => acc + (j.tamanoBytes || 0), 0);
              const sysM3u = sysGames.filter((j) => j.extension?.toLowerCase() === '.m3u').length;
              const sysDups = sysGames.filter((j) => j.esDuplicado).length;
              const allSysMarked = sysGames.every((j) => selectedIds.has(j.id));

              return (
                <div
                  key={sys}
                  className="rounded-2xl border overflow-hidden shadow-sm"
                  style={{
                    backgroundColor: 'var(--card-app, #111827)',
                    borderColor: 'var(--border-app, #1F2937)',
                  }}
                >
                  {/* System Header Banner */}
                  <div className="px-5 py-3.5 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-mono font-bold text-blue-400 text-xs uppercase">
                        {sys.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                            {sys}
                          </h3>
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            {sysGames.length} títulos
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {formatBytes(sysBytes)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          {sysM3u > 0 && <span>🔗 {sysM3u} multidisco</span>}
                          {sysDups > 0 && <span>⚠️ {sysDups} duplicados 1G1R</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Set(selectedIds);
                          sysGames.forEach((j) => {
                            if (allSysMarked) next.delete(j.id);
                            else next.add(j.id);
                          });
                          setSelectedIds(next);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          allSysMarked
                            ? 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {allSysMarked ? 'Desmarcar Sistema' : `Marcar Todo ${sys.toUpperCase()}`}
                      </button>
                    </div>
                  </div>

                  {/* System Games Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3.5 w-10"></th>
                          <th className="py-2.5 px-3 font-semibold">Título</th>
                          <th className="py-2.5 px-3 font-semibold">Formato</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Peso</th>
                          <th className="py-2.5 px-3 font-semibold">Región / Género</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Dependencias</th>
                          <th className="py-2.5 px-3 font-semibold text-center w-16">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {sysGames.map((j) => {
                          const isChecked = selectedIds.has(j.id);
                          const badge = getGameBadge(j);
                          return (
                            <tr
                              key={j.id}
                              className={`hover:bg-slate-800/30 transition-colors ${
                                isChecked ? 'bg-blue-900/15' : ''
                              }`}
                            >
                              <td className="py-2 px-3.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleSelectOne(j.id)}
                                  className="rounded border-slate-700 text-blue-600"
                                />
                              </td>
                              <td className="py-2 px-3 font-medium text-white truncate max-w-sm">
                                <div className="flex items-center gap-2">
                                  <span className="truncate">{j.nombre}</span>
                                  {j.esDuplicado && (
                                    <span
                                      className={`text-[9px] px-1 rounded font-mono ${
                                        j.rolDuplicado === 'original'
                                          ? 'bg-emerald-500/20 text-emerald-400'
                                          : 'bg-amber-500/20 text-amber-400'
                                      }`}
                                    >
                                      {j.rolDuplicado === 'original' ? '1G1R' : 'Descarte'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${badge.colorClass}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-white">
                                {formatBytes(j.tamanoBytes)}
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {j.region || 'Global'} · {j.genero || 'Varios'}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-slate-400">
                                {j.dependencias?.length || 0}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedGameForDetail(j)}
                                  className="p-1 rounded text-slate-400 hover:text-white"
                                  title="Ver detalles"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky Library Summary Bar (Total Juegos + Peso Total + Archivos Vinculados + Desglose por Sistema) */}
        <div
          className="sticky bottom-4 z-20 p-4 rounded-2xl border shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4 transition-all"
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.94)',
            borderColor: 'var(--border-app, #1F2937)',
          }}
        >
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 font-semibold">Total Biblioteca:</span>
              <span className="font-bold text-white text-sm">{juegos.length} juegos</span>
              <span className="text-slate-400">({formatBytes(totalLibraryBytes)})</span>
            </div>

            <div className="text-slate-600">|</div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>{totalDependenciesCount} archivos vinculados</span>
            </div>

            {selectedIds.size > 0 && (
              <>
                <div className="text-slate-600">|</div>
                <div className="flex items-center gap-1.5 text-blue-300 font-semibold">
                  <span>Marcados:</span>
                  <span className="text-white bg-blue-600 px-2 py-0.5 rounded-full text-[11px]">
                    {selectedIds.size} ({formatBytes(bytesSeleccionados)})
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    · {selectedDependenciesCount} deps
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Breakdown badges per system */}
          {selectedCountBySystem.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1 font-medium">Marcados por consola:</span>
              {selectedCountBySystem.map(([sys, count]) => (
                <span
                  key={sys}
                  className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold"
                >
                  {sys}: {count}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">
              Sistemas activos: {sistemasDisponibles.length}
            </span>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="px-6 py-4 border-t text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 mt-auto"
        style={{ borderColor: 'var(--border-app, #1F2937)' }}
      >
        <div className="flex items-center gap-2">
          <span>RetroBat &amp; Game Library Manager Pro</span>
          <span>·</span>
          <span>Soporte multiplataforma: Windows, Linux y Web</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsThemeOpen(true)}
            className="hover:text-slate-300 transition-colors"
          >
            Personalizar Tema
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="hover:text-slate-300 transition-colors"
          >
            Exportar CSV / PDF
          </button>
        </div>
      </footer>

      {/* Interactive Modals */}
      {isScannerOpen && (
        <ScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onImportGames={handleImportGames}
          sistemasExistentes={sistemasDisponibles}
        />
      )}

      {isCollectionsOpen && (
        <CustomListsModal
          isOpen={isCollectionsOpen}
          onClose={() => setIsCollectionsOpen(false)}
          colecciones={colecciones}
          onSaveColecciones={(updated) => setColecciones(updated)}
          todosLosJuegos={juegos}
        />
      )}

      {isDatabaseOpen && (
        <DatabaseManagerModal
          isOpen={isDatabaseOpen}
          onClose={() => setIsDatabaseOpen(false)}
          juegos={juegos}
          onSaveDatabase={(updated) => setJuegos(processDuplicates1G1R(updated))}
        />
      )}

      {isThemeOpen && (
        <ThemeCustomizerModal
          isOpen={isThemeOpen}
          onClose={() => setIsThemeOpen(false)}
          currentPreset={themePreset}
          currentColors={themeColors}
          onThemeChange={(preset, colors) => {
            setThemePreset(preset);
            setThemeColors(colors);
          }}
        />
      )}

      {isMultiplatformOpen && (
        <MultiplatformModal
          isOpen={isMultiplatformOpen}
          onClose={() => setIsMultiplatformOpen(false)}
        />
      )}

      {isExportOpen && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          juegosSeleccionados={juegosSeleccionados}
          todosLosJuegos={juegos}
          colecciones={colecciones}
          onStartUsbSync={handleStartUsbSync}
        />
      )}

      {selectedGameForDetail && (
        <GameDetailModal
          juego={selectedGameForDetail}
          isOpen={!!selectedGameForDetail}
          onClose={() => setSelectedGameForDetail(null)}
          onSave={handleSaveGameDetails}
        />
      )}

      {isUsbCopyOpen && (
        <CopyProgressModal
          isOpen={isUsbCopyOpen}
          onClose={() => setIsUsbCopyOpen(false)}
          juegos={usbCopyTargetGames}
          destinationName={usbDestinationName}
          destinationHandle={usbDestHandle}
        />
      )}

      {/* Bulk Delete Confirmation Modal (zero browser-locker confirm) */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-600/30 bg-slate-900 p-6 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">¿Eliminar títulos seleccionados?</h3>
                <p className="text-xs text-slate-400">Esta acción removerá los juegos de la biblioteca.</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              ¿Estás seguro de que deseas eliminar los <strong>{selectedIds.size}</strong> títulos seleccionados?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-900/30"
              >
                Sí, Eliminar ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating In-App Toast Notification */}
      {appNotification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm flex items-start gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-300 bg-slate-900/95 border-blue-500/30 text-white">
          <div className="p-1 rounded bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-200 leading-relaxed flex-1">{appNotification.message}</p>
          <button
            onClick={() => setAppNotification(null)}
            className="text-slate-400 hover:text-white p-1 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
