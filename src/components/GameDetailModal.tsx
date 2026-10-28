import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Disc,
  Film,
  Folder,
  Gamepad2,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Plus,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { DependenciaItem, DependencyType, Juego } from '../types';
import { formatBytes, getDependencyColor, parseSize } from '../utils/gameUtils';
import { sourceFileRegistry } from '../utils/sourceFileRegistry';

interface GameDetailModalProps {
  juego: Juego | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedJuego: Juego) => void;
}

export const GameDetailModal: React.FC<GameDetailModalProps> = ({
  juego,
  isOpen,
  onClose,
  onSave,
}) => {
  const [nombre, setNombre] = useState(juego?.nombre || '');
  const [extension, setExtension] = useState(juego?.extension || '');
  const mainRomSize = juego ? Math.max(0, juego.tamanoBytes - (juego.dependencias?.reduce((a, b) => a + b.tamanoBytes, 0) || 0)) : 0;
  const [baseSizeText, setBaseSizeText] = useState(formatBytes(mainRomSize));
  const [esDuplicado, setEsDuplicado] = useState(juego?.esDuplicado || false);
  const [rolDuplicado, setRolDuplicado] = useState(juego?.rolDuplicado || 'original');
  const [genero, setGenero] = useState(juego?.genero || 'Varios');
  const [desarrollador, setDesarrollador] = useState(juego?.desarrollador || 'Desconocido');
  const [anio, setAnio] = useState(juego?.anio || '');
  const [region, setRegion] = useState(juego?.region || 'Global');
  const [descripcion, setDescripcion] = useState(juego?.descripcion || '');
  const [dependencias, setDependencias] = useState<DependenciaItem[]>(juego?.dependencias || []);
  const [activeMediaTab, setActiveMediaTab] = useState<'thumb' | 'image' | 'marquee' | 'fanart' | 'video'>('thumb');
  const [newTagInput, setNewTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>(juego?.customTags || []);

  const manualFileInputRef = useRef<HTMLInputElement>(null);
  const manualFolderInputRef = useRef<HTMLInputElement>(null);

  // Inline Dependency Form State (eliminating prompt calls)
  const [isAddingDep, setIsAddingDep] = useState(false);
  const [newDepFilename, setNewDepFilename] = useState('');
  const [newDepSizeMb, setNewDepSizeMb] = useState('50');
  const [newDepType, setNewDepType] = useState<DependencyType>('DISC');
  const [depError, setDepError] = useState('');

  // Sync state whenever juego changes
  useEffect(() => {
    if (juego) {
      setNombre(juego.nombre);
      setExtension(juego.extension || '');
      const calcMainSize = Math.max(0, juego.tamanoBytes - (juego.dependencias?.reduce((a, b) => a + b.tamanoBytes, 0) || 0));
      setBaseSizeText(formatBytes(calcMainSize));
      setEsDuplicado(juego.esDuplicado || false);
      setRolDuplicado(juego.rolDuplicado || 'original');
      setGenero(juego.genero || 'Varios');
      setDesarrollador(juego.desarrollador || 'Desconocido');
      setAnio(juego.anio || '');
      setRegion(juego.region || 'Global');
      setDescripcion(juego.descripcion || '');
      setDependencias(juego.dependencias || []);
      setCustomTags(juego.customTags || []);
    }
  }, [juego]);

  if (!isOpen || !juego) return null;

  // Calculate live total size
  const parsedBaseBytes = parseSize(baseSizeText);
  const liveBaseBytes = parsedBaseBytes > 0 ? parsedBaseBytes : mainRomSize;
  const currentTotalBytes = liveBaseBytes + dependencias.reduce((acc, d) => acc + (d.tamanoBytes || 0), 0);

  const handlePickManualFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: DependenciaItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      // Register with real physical registry so it transfers real bytes
      sourceFileRegistry.registerFile(juego.sistema, f.name, f);

      const ext = f.name.toLowerCase().substring(f.name.lastIndexOf('.'));
      let tipo: DependencyType = 'DISC';
      if (['.pkg', '.nsp', '.xci'].includes(ext)) {
        tipo = f.name.toLowerCase().includes('upd') ? 'SWITCH_UPDATE' : 'SWITCH_DLC';
      } else if (['.jpg', '.png', '.jpeg', '.webp'].includes(ext)) {
        tipo = 'IMAGE';
      } else if (['.mp4', '.mkv', '.avi'].includes(ext)) {
        tipo = 'VIDEO';
      } else if (['.pdf', '.txt', '.doc'].includes(ext)) {
        tipo = 'MANUAL';
      }

      newItems.push({
        tipo,
        nombreArchivo: f.name,
        rutaCompleta: `${juego.rutaCompleta || '/roms/' + juego.sistema}/${f.name}`,
        tamanoBytes: f.size,
      });
    }

    setDependencias((prev) => [...prev, ...newItems]);
    setIsAddingDep(false);
    if (manualFileInputRef.current) manualFileInputRef.current.value = '';
  };

  const handlePickManualFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const currentSystem = juego.sistema;
        // Register directory handle in registry for recursive transfer
        sourceFileRegistry.registerDirectoryHandle(currentSystem, dirHandle.name, dirHandle);

        let totalFolderBytes = 0;

        async function calcDir(handle: any) {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              try {
                const f = await entry.getFile();
                sourceFileRegistry.registerFile(currentSystem, `${dirHandle.name}/${entry.name}`, f);
                totalFolderBytes += f.size;
              } catch {}
            } else if (entry.kind === 'directory') {
              await calcDir(entry);
            }
          }
        }

        await calcDir(dirHandle);

        const isPs3 = currentSystem.toLowerCase().includes('ps3');
        const folderItem: DependenciaItem = {
          tipo: isPs3 ? 'PS3_FOLDER' : 'WIN_FOLDER',
          nombreArchivo: dirHandle.name,
          rutaCompleta: `${juego.rutaCompleta || '/roms/' + currentSystem}/${dirHandle.name}`,
          tamanoBytes: totalFolderBytes,
        };

        setDependencias((prev) => [...prev, folderItem]);
        setIsAddingDep(false);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    manualFolderInputRef.current?.click();
  };

  const handleFolderInputFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let totalBytes = 0;
    const firstRel = (files[0] as any).webkitRelativePath || files[0].name;
    const folderName = firstRel.split('/')[0] || files[0].name;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      sourceFileRegistry.registerFile(juego.sistema, f.name, f);
      const rel = (f as any).webkitRelativePath;
      if (rel) {
        sourceFileRegistry.registerFile(juego.sistema, rel, f);
      }
      totalBytes += f.size;
    }

    const isPs3 = juego.sistema.toLowerCase().includes('ps3');
    const folderItem: DependenciaItem = {
      tipo: isPs3 ? 'PS3_FOLDER' : 'WIN_FOLDER',
      nombreArchivo: folderName,
      rutaCompleta: `${juego.rutaCompleta || '/roms/' + juego.sistema}/${folderName}`,
      tamanoBytes: totalBytes,
    };

    setDependencias((prev) => [...prev, folderItem]);
    setIsAddingDep(false);
    if (manualFolderInputRef.current) manualFolderInputRef.current.value = '';
  };

  const handleOpenAddDependency = () => {
    setIsAddingDep(true);
    setNewDepFilename('');
    setNewDepSizeMb('50');
    setNewDepType('DISC');
    setDepError('');
  };

  const handleSaveNewDependency = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newDepFilename.trim()) {
      setDepError('Por favor ingresa el nombre del archivo a vincular.');
      return;
    }

    const sizeMb = parseFloat(newDepSizeMb) || 0;
    const bytes = Math.max(1024, Math.floor(sizeMb * 1024 * 1024));

    const newItem: DependenciaItem = {
      tipo: newDepType,
      nombreArchivo: newDepFilename.trim(),
      rutaCompleta: `${juego.rutaCompleta || '/roms/' + juego.sistema}/${newDepFilename.trim()}`,
      tamanoBytes: bytes,
    };

    setDependencias([...dependencias, newItem]);
    setNewDepFilename('');
    setNewDepSizeMb('50');
    setDepError('');
    setIsAddingDep(false);
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    if (!customTags.includes(newTagInput.trim())) {
      setCustomTags([...customTags, newTagInput.trim()]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setCustomTags(customTags.filter((t) => t !== tagToRemove));
  };

  const handleRemoveDependency = (idx: number) => {
    setDependencias(dependencias.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    let ext = extension.trim().toLowerCase();
    if (ext && !ext.startsWith('.')) ext = '.' + ext;

    const updated: Juego = {
      ...juego,
      nombre: nombre.trim(),
      cleanTitle: nombre.trim(),
      extension: ext,
      genero: genero.trim(),
      desarrollador: desarrollador.trim(),
      anio: anio.trim(),
      region: region.trim(),
      descripcion: descripcion.trim(),
      dependencias,
      tamanoBytes: currentTotalBytes,
      customTags,
      esDuplicado,
      rolDuplicado,
    };
    onSave(updated);
    onClose();
  };

  // Determine current active media url
  const getActiveMediaUrl = () => {
    if (activeMediaTab === 'thumb') return juego.rutaThumb || juego.imagen || juego.rutaImage;
    if (activeMediaTab === 'image') return juego.rutaImage || juego.imagen || juego.rutaThumb;
    if (activeMediaTab === 'marquee') return juego.rutaMarquee || juego.rutaThumb || juego.imagen;
    if (activeMediaTab === 'fanart') return juego.rutaFanart || juego.rutaImage || juego.imagen;
    return juego.rutaThumb || juego.imagen || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--card-app, #111827)',
          borderColor: 'var(--border-app, #1F2937)',
          color: 'var(--text-app, #F3F4F6)',
        }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
              {juego.sistema}
            </span>
            <div>
              <h2 className="text-base font-bold text-white truncate max-w-md">{nombre}</h2>
              <p className="text-xs text-slate-400">Detalles de Metadatos, Dependencias y Multimedia</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Grid: Artwork / Media Preview & Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Media Inspector */}
            <div className="md:col-span-5 flex flex-col">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black/60 border border-slate-800 flex items-center justify-center group mb-3">
                {activeMediaTab === 'video' ? (
                  juego.video ? (
                    <video
                      src={juego.video}
                      controls
                      autoPlay
                      muted
                      loop
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4 text-slate-500 text-xs">
                      <Film className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No hay video preview asignado
                    </div>
                  )
                ) : (
                  <>
                    <img
                      src={getActiveMediaUrl()}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none"
                    />
                    <img
                      src={getActiveMediaUrl()}
                      alt={nombre}
                      className="relative z-10 max-w-full max-h-full object-contain transition-transform group-hover:scale-105 duration-300 drop-shadow-md"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                  </>
                )}
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-mono text-white">
                  {formatBytes(currentTotalBytes)}
                </div>
              </div>

              {/* Media Switcher Tabs */}
              <div className="grid grid-cols-5 gap-1 p-1 bg-slate-900/60 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveMediaTab('thumb')}
                  className={`py-1.5 px-1 rounded font-medium text-center truncate transition-colors ${
                    activeMediaTab === 'thumb' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Carátula
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaTab('image')}
                  className={`py-1.5 px-1 rounded font-medium text-center truncate transition-colors ${
                    activeMediaTab === 'image' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Miniatura
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaTab('marquee')}
                  className={`py-1.5 px-1 rounded font-medium text-center truncate transition-colors ${
                    activeMediaTab === 'marquee' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Logo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaTab('fanart')}
                  className={`py-1.5 px-1 rounded font-medium text-center truncate transition-colors ${
                    activeMediaTab === 'fanart' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fondo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaTab('video')}
                  className={`py-1.5 px-1 rounded font-medium text-center truncate transition-colors ${
                    activeMediaTab === 'video' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Video
                </button>
              </div>
            </div>

            {/* Right Column: Editable Metadata Fields */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Nombre del Juego
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Formato y Peso de ROM Base */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Formato / Extensión
                  </label>
                  <input
                    type="text"
                    value={extension}
                    onChange={(e) => setExtension(e.target.value)}
                    placeholder=".chd, .iso, .zip, .m3u..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Peso ROM Base (Aprox.)
                  </label>
                  <input
                    type="text"
                    value={baseSizeText}
                    onChange={(e) => setBaseSizeText(e.target.value)}
                    placeholder="ej: 650 MB, 1.4 GB"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 1G1R Duplicate Status & Override Control */}
              {esDuplicado && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-300">
                      Estado 1G1R:
                    </span>
                    <span className="font-mono text-amber-200">
                      {rolDuplicado === 'original'
                        ? '⭐ Copia Recomendada'
                        : rolDuplicado === 'ambos_validos'
                        ? '✅ Ambos Válidos (Conservar)'
                        : '⚠️ Descarte Secundario'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rolDuplicado !== 'ambos_validos' && (
                      <button
                        type="button"
                        onClick={() => setRolDuplicado('ambos_validos')}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px]"
                      >
                        Conservar Ambos Válidos
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEsDuplicado(false)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                    >
                      Quitar Marca Duplicado
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Género
                  </label>
                  <input
                    type="text"
                    value={genero}
                    onChange={(e) => setGenero(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Año
                  </label>
                  <input
                    type="text"
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    placeholder="ej: 1998"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Desarrollador
                  </label>
                  <input
                    type="text"
                    value={desarrollador}
                    onChange={(e) => setDesarrollador(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Región
                  </label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Descripción / Sinopsis
                </label>
                <textarea
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Custom Tags Section */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-400" /> Etiquetas Personalizadas
                </label>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {customTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-blue-900/30 text-blue-300 border border-blue-700/40"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Añadir etiqueta (ej: RPG, Favorito, Castellano)..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Attached Dependencies / Discs / DLCs Table */}
          <div className="border-t pt-5" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Archivos y Dependencias Vinculadas ({dependencias.length})
                </h4>
                <p className="text-xs text-slate-400">
                  Suma total calculada: <span className="font-mono text-emerald-400 font-bold">{formatBytes(currentTotalBytes)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Hidden file & folder inputs */}
                <input
                  type="file"
                  ref={manualFileInputRef}
                  onChange={handlePickManualFiles}
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={manualFolderInputRef}
                  onChange={handleFolderInputFallback}
                  /* @ts-ignore */
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => manualFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Seleccionar archivo físico directamente y analizar su peso exacto"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-400" /> Seleccionar Archivo
                </button>

                <button
                  type="button"
                  onClick={handlePickManualFolder}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Seleccionar carpeta completa, analizar su peso total y copiar su contenido exacto"
                >
                  <Folder className="w-3.5 h-3.5 text-emerald-400" /> Seleccionar Carpeta
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingDep(!isAddingDep)}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {isAddingDep ? 'Cerrar' : '+ Manual'}
                </button>
              </div>
            </div>

            {/* Inline Add Dependency Form */}
            {isAddingDep && (
              <form
                onSubmit={handleSaveNewDependency}
                className="mb-4 p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                    Vincular Archivo Adicional (Disco / DLC / Update / Manual)
                  </h5>
                  <button
                    type="button"
                    onClick={() => setIsAddingDep(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {depError && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                    {depError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-300 font-medium mb-1">
                      Nombre del Archivo (ej: disco2.chd o update_v1.0.pkg)
                    </label>
                    <input
                      type="text"
                      value={newDepFilename}
                      onChange={(e) => setNewDepFilename(e.target.value)}
                      placeholder="archivo_adicional.ext"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 font-medium mb-1">
                      Tipo de Archivo
                    </label>
                    <select
                      value={newDepType}
                      onChange={(e) => setNewDepType(e.target.value as DependencyType)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="DISC">DISC (Disco 2/3/4...)</option>
                      <option value="SWITCH_UPDATE">SWITCH_UPDATE (Parche)</option>
                      <option value="SWITCH_DLC">SWITCH_DLC (Contenido)</option>
                      <option value="IMAGE">IMAGE (Carátula/Arte)</option>
                      <option value="VIDEO">VIDEO (Trailer/Clip)</option>
                      <option value="MANUAL">MANUAL (Guía PDF)</option>
                      <option value="WIN_FOLDER">WIN_FOLDER (Carpeta datos)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-300 font-medium whitespace-nowrap">
                      Tamaño Aprox. (MB):
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={newDepSizeMb}
                      onChange={(e) => setNewDepSizeMb(e.target.value)}
                      className="w-24 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingDep(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" /> Vincular Ahora
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-3 font-semibold">Tipo</th>
                    <th className="py-2.5 px-3 font-semibold">Nombre de Archivo</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tamaño</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-12">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {/* Main Rom Entry */}
                  <tr className="bg-slate-800/20 text-slate-300">
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        ROM BASE
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono truncate max-w-xs">{juego.ruta}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-300">{formatBytes(mainRomSize)}</td>
                    <td className="py-2 px-3 text-center text-slate-500">-</td>
                  </tr>

                  {/* Attached Dependencies */}
                  {dependencias.map((dep, idx) => (
                    <tr key={`${dep.nombreArchivo}_${idx}`} className="hover:bg-slate-800/30 text-slate-300">
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${getDependencyColor(dep.tipo)}`}>
                          {dep.tipo}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono truncate max-w-xs" title={dep.nombreArchivo}>
                        {dep.nombreArchivo}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-400">
                        {formatBytes(dep.tamanoBytes)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveDependency(idx)}
                          className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                          title="Desvincular archivo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-slate-900/60" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <span className="text-xs text-slate-400 font-mono">
            {juego.extension?.toUpperCase()} · {juego.sistema?.toUpperCase()}
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
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-colors"
            >
              <Save className="w-4 h-4" /> Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
