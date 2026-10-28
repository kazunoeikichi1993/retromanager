import React, { useEffect, useState } from 'react';
import {
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  FolderPlus,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { ColeccionPersonalizada, Juego } from '../types';
import { exportToCsv, exportToInteractiveWebHtml, exportToPdf } from '../utils/exporter';
import { formatBytes } from '../utils/gameUtils';

interface CustomListsModalProps {
  isOpen: boolean;
  onClose: () => void;
  colecciones: ColeccionPersonalizada[];
  onSaveColecciones: (updated: ColeccionPersonalizada[]) => void;
  todosLosJuegos: Juego[];
}

const ICON_OPTIONS = ['⭐', '🔥', '🏆', '🕹️', '👥', '💎', '👑', '🚀', '🎮', '❤️', '⚡', '🎯'];

export const CustomListsModal: React.FC<CustomListsModalProps> = ({
  isOpen,
  onClose,
  colecciones,
  onSaveColecciones,
  todosLosJuegos,
}) => {
  const [listas, setListas] = useState<ColeccionPersonalizada[]>(colecciones);
  const [activeListId, setActiveListId] = useState<string>(listas[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGameToAdd, setSelectedGameToAdd] = useState<string>('');

  useEffect(() => {
    setListas(colecciones);
    if (!activeListId && colecciones.length > 0) {
      setActiveListId(colecciones[0].id);
    }
  }, [colecciones, isOpen]);

  if (!isOpen) return null;

  const activeLista = listas.find((l) => l.id === activeListId) || listas[0];

  // Games present in the active list (support both exact name and clean title)
  const activeListKeySet = new Set(activeLista?.juegosIds || []);
  const juegosEnLista = todosLosJuegos.filter(
    (j) =>
      activeListKeySet.has(`${j.sistema}__${j.nombre}`) ||
      activeListKeySet.has(`${j.sistema}__${j.cleanTitle}`)
  );

  // Games matching search for 1-by-1 addition
  const searchResults =
    searchQuery.trim().length >= 2
      ? todosLosJuegos
          .filter(
            (j) =>
              (j.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                j.cleanTitle.toLowerCase().includes(searchQuery.toLowerCase())) &&
              !activeListKeySet.has(`${j.sistema}__${j.nombre}`)
          )
          .slice(0, 15)
      : [];

  const handleCreateList = () => {
    const nueva: ColeccionPersonalizada = {
      id: `col_${Date.now()}`,
      nombre: `Nueva Lista ${listas.length + 1}`,
      icono: '⭐',
      descripcion: '',
      juegosIds: [],
    };
    const updated = [...listas, nueva];
    setListas(updated);
    setActiveListId(nueva.id);
  };

  const handleDeleteList = (idToDelete: string) => {
    if (listas.length <= 1) {
      return;
    }
    const updated = listas.filter((l) => l.id !== idToDelete);
    setListas(updated);
    if (activeListId === idToDelete) {
      setActiveListId(updated[0]?.id || '');
    }
  };

  const handleAddGameToList = (juego: Juego) => {
    if (!activeLista) return;
    const key = `${juego.sistema}__${juego.nombre}`;
    if (!activeLista.juegosIds.includes(key)) {
      const updatedList: ColeccionPersonalizada = {
        ...activeLista,
        juegosIds: [...activeLista.juegosIds, key],
      };
      setListas(listas.map((l) => (l.id === activeLista.id ? updatedList : l)));
    }
    setSearchQuery('');
  };

  const handleRemoveGameFromList = (juego: Juego) => {
    if (!activeLista) return;
    const key = `${juego.sistema}__${juego.nombre}`;
    const updatedList: ColeccionPersonalizada = {
      ...activeLista,
      juegosIds: activeLista.juegosIds.filter((k) => k !== key),
    };
    setListas(listas.map((l) => (l.id === activeLista.id ? updatedList : l)));
  };

  const [selectedSystemToAdd, setSelectedSystemToAdd] = useState<string>('');

  const sistemasInfo = React.useMemo(() => {
    const map = new Map<string, { count: number; bytes: number }>();
    todosLosJuegos.forEach((j) => {
      const s = j.sistema || 'otros';
      const curr = map.get(s) || { count: 0, bytes: 0 };
      curr.count++;
      curr.bytes += j.tamanoBytes || 0;
      map.set(s, curr);
    });
    return Array.from(map.entries())
      .map(([name, info]) => ({
        name,
        count: info.count,
        bytes: info.bytes,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [todosLosJuegos]);

  const handleAddFullSystem = (systemName: string) => {
    if (!activeLista || !systemName) return;

    const matchedGames = todosLosJuegos.filter(
      (j) => j.sistema.toLowerCase() === systemName.trim().toLowerCase()
    );
    if (matchedGames.length === 0) return;

    const newKeys = matchedGames.map((j) => `${j.sistema}__${j.nombre}`);
    const merged = Array.from(new Set([...activeLista.juegosIds, ...newKeys]));

    const updatedList: ColeccionPersonalizada = {
      ...activeLista,
      juegosIds: merged,
    };
    setListas(listas.map((l) => (l.id === activeLista.id ? updatedList : l)));
    setSelectedSystemToAdd('');
  };

  const handleSaveAndClose = () => {
    onSaveColecciones(listas);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-5xl h-[85vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--card-app, #111827)',
          borderColor: 'var(--border-app, #1F2937)',
          color: 'var(--text-app, #F3F4F6)',
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Colecciones y Listas Personalizadas</h2>
              <p className="text-xs text-slate-400">Organiza listas selectas, favoritos y recopilatorios para exportar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: List of Collections */}
          <div className="w-72 border-r flex flex-col p-4 bg-slate-900/40" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Mis Listas ({listas.length})
              </span>
              <button
                type="button"
                onClick={handleCreateList}
                className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs flex items-center gap-1 font-medium transition-colors"
                title="Nueva Lista"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {listas.map((l) => (
                <div
                  key={l.id}
                  onClick={() => setActiveListId(l.id)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors flex items-center justify-between group ${
                    l.id === activeListId
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span>{l.icono}</span>
                    <span className="truncate">{l.nombre}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${l.id === activeListId ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {l.juegosIds?.length || 0}
                    </span>
                    {listas.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteList(l.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-1 transition-opacity"
                        title="Eliminar lista"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Collection Editor & Games inside */}
          {activeLista && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
              {/* Collection Settings Card */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Icon Selector */}
                  <div>
                    <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1">
                      Ícono
                    </label>
                    <select
                      value={activeLista.icono}
                      onChange={(e) => {
                        const updated = { ...activeLista, icono: e.target.value };
                        setListas(listas.map((l) => (l.id === activeLista.id ? updated : l)));
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none"
                    >
                      {ICON_OPTIONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Name Input */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1">
                      Nombre de la Colección
                    </label>
                    <input
                      type="text"
                      value={activeLista.nombre}
                      onChange={(e) => {
                        const updated = { ...activeLista, nombre: e.target.value };
                        setListas(listas.map((l) => (l.id === activeLista.id ? updated : l)));
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Bulk Add System */}
                  <div className="flex items-end gap-1.5">
                    <div>
                      <label className="block text-[11px] uppercase font-semibold text-slate-400 mb-1">
                        + Añadir Sistema Completo
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={selectedSystemToAdd}
                          onChange={(e) => setSelectedSystemToAdd(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none"
                        >
                          <option value="">Selecciona un sistema...</option>
                          {sistemasInfo.map((sys) => (
                            <option key={sys.name} value={sys.name}>
                              {sys.name.toUpperCase()} ({sys.count} títulos · {formatBytes(sys.bytes)})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedSystemToAdd}
                          onClick={() => handleAddFullSystem(selectedSystemToAdd)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                        >
                          <FolderPlus className="w-3.5 h-3.5" /> Añadir Todos
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Game Search & Add 1-by-1 */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Buscar y Agregar Juego a la Lista
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Escribe el nombre del juego (ej: Zelda, Mario, Fantasy)..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Suggestions drop */}
                {searchResults.length > 0 && (
                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-900 shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-800 z-10">
                    {searchResults.map((j) => (
                      <div
                        key={j.id}
                        className="px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono uppercase text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {j.sistema}
                          </span>
                          <span className="font-medium text-white truncate">{j.nombre}</span>
                          <span className="text-slate-500 font-mono text-[11px]">({formatBytes(j.tamanoBytes)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddGameToList(j)}
                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] shrink-0"
                        >
                          + Añadir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Games Table in Active List */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Juegos en esta lista ({juegosEnLista.length})
                  </h4>

                  {/* Export Options for this list */}
                  {juegosEnLista.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportToCsv(juegosEnLista, `${activeLista.nombre}.csv`)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1"
                        title="Exportar a CSV"
                      >
                        <FileSpreadsheet className="w-3 h-3 text-emerald-400" /> CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => exportToPdf(juegosEnLista, activeLista.nombre)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1"
                        title="Exportar a PDF"
                      >
                        <FileText className="w-3 h-3 text-rose-400" /> PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => exportToInteractiveWebHtml(juegosEnLista, activeLista.nombre)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1"
                        title="Generar Web Interactiva"
                      >
                        <FileCode className="w-3 h-3 text-sky-400" /> Web
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/60 text-slate-400 sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Sistema</th>
                          <th className="py-2.5 px-3 font-semibold">Título</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Peso</th>
                          <th className="py-2.5 px-3 font-semibold text-center w-12">Quitar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {juegosEnLista.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500">
                              Esta colección está vacía. Busca títulos arriba o añade un sistema completo.
                            </td>
                          </tr>
                        ) : (
                          juegosEnLista.map((j) => (
                            <tr key={j.id} className="hover:bg-slate-800/30 text-slate-300">
                              <td className="py-2 px-3 font-mono text-blue-400 uppercase text-[11px]">
                                {j.sistema}
                              </td>
                              <td className="py-2 px-3 font-medium text-white truncate max-w-xs">{j.nombre}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-400">
                                {formatBytes(j.tamanoBytes)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGameFromList(j)}
                                  className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                                  title="Quitar de la lista"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-slate-900/60" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <span className="text-xs text-slate-400">
            Los cambios se guardan localmente y persisten para todas las sesiones.
          </span>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Guardar Listas y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
