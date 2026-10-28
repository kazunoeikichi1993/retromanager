import React, { useEffect, useState } from 'react';
import { Check, Palette, RotateCcw, Sparkles, X } from 'lucide-react';
import { ThemeColors, ThemePreset } from '../types';
import { applyThemeCssVars, saveTheme, THEME_PRESETS } from '../utils/themeManager';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreset: ThemePreset;
  currentColors: ThemeColors;
  onThemeChange: (preset: ThemePreset, colors: ThemeColors) => void;
}

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({
  isOpen,
  onClose,
  currentPreset,
  currentColors,
  onThemeChange,
}) => {
  const [preset, setPreset] = useState<ThemePreset>(currentPreset);
  const [colors, setColors] = useState<ThemeColors>(currentColors);

  useEffect(() => {
    setPreset(currentPreset);
    setColors(currentColors);
  }, [currentPreset, currentColors, isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (p: Exclude<ThemePreset, 'custom'>) => {
    const presetColors = THEME_PRESETS[p];
    setPreset(p);
    setColors(presetColors);
    applyThemeCssVars(presetColors);
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const updated = { ...colors, [key]: value };
    setPreset('custom');
    setColors(updated);
    applyThemeCssVars(updated);
  };

  const handleResetToDefault = () => {
    const def = THEME_PRESETS.dark;
    setPreset('dark');
    setColors(def);
    applyThemeCssVars(def);
  };

  const handleSaveAndClose = () => {
    saveTheme(preset, colors);
    onThemeChange(preset, colors);
    onClose();
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
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Personalización de Temas y Colores</h2>
              <p className="text-xs text-slate-400">
                Ajusta títulos, fondos, bordes y botones a tu gusto o elige un tema predeterminado
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
          {/* Preset Buttons */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Temas Predefinidos
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'dark', label: 'Oscuro Pro (Default)', color: '#090D16', border: '#1F2937' },
                { id: 'light', label: 'Claro Limpio', color: '#F8FAFC', border: '#CBD5E1' },
                { id: 'retro-cyber', label: 'Retro Cyber 80s', color: '#0D0E1C', border: '#282C52' },
                { id: 'nord', label: 'Nord Polar', color: '#242933', border: '#3B4252' },
                { id: 'emerald', label: 'Bosque Esmeralda', color: '#061A14', border: '#134E3A' },
                { id: 'sunset', label: 'Atardecer Neón', color: '#140E1B', border: '#3E2554' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectPreset(item.id as any)}
                  className={`p-3 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                    preset === item.id
                      ? 'border-blue-500 bg-blue-500/10 text-white ring-2 ring-blue-500/20'
                      : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border shrink-0"
                      style={{ backgroundColor: item.color, borderColor: item.border }}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {preset === item.id && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Granular Color Pickers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Personalización Detallada de Colores
              </label>
              {preset === 'custom' && (
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Modo Personalizado Activo
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Color Títulos */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">Color de Títulos</span>
                  <span className="text-[11px] text-slate-400 font-mono">{colors.title}</span>
                </div>
                <input
                  type="color"
                  value={colors.title}
                  onChange={(e) => handleColorChange('title', e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                />
              </div>

              {/* Color Fondo */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">Color de Fondo General</span>
                  <span className="text-[11px] text-slate-400 font-mono">{colors.bg}</span>
                </div>
                <input
                  type="color"
                  value={colors.bg}
                  onChange={(e) => handleColorChange('bg', e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                />
              </div>

              {/* Color Tarjetas */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">Color de Tarjetas / Paneles</span>
                  <span className="text-[11px] text-slate-400 font-mono">{colors.card}</span>
                </div>
                <input
                  type="color"
                  value={colors.card}
                  onChange={(e) => handleColorChange('card', e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                />
              </div>

              {/* Color Bordes */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">Color de Bordes</span>
                  <span className="text-[11px] text-slate-400 font-mono">{colors.border}</span>
                </div>
                <input
                  type="color"
                  value={colors.border}
                  onChange={(e) => handleColorChange('border', e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                />
              </div>

              {/* Color Acento */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">Color de Acento / Botones</span>
                  <span className="text-[11px] text-slate-400 font-mono">{colors.accent}</span>
                </div>
                <input
                  type="color"
                  value={colors.accent}
                  onChange={(e) => handleColorChange('accent', e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                />
              </div>

              {/* Color Texto */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">Color de Texto Principal</span>
                  <span className="text-[11px] text-slate-400 font-mono">{colors.text}</span>
                </div>
                <input
                  type="color"
                  value={colors.text}
                  onChange={(e) => handleColorChange('text', e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                />
              </div>
            </div>
          </div>

          {/* Live Preview Sample Card */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Vista Previa en Vivo
            </label>
            <div
              className="p-4 rounded-xl border transition-colors shadow-sm"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <h3 className="text-sm font-bold mb-1" style={{ color: colors.title }}>
                Final Fantasy VII (Spain) [PSX]
              </h3>
              <p className="text-xs mb-3" style={{ color: colors.textMuted }}>
                1997 · Square · JRPG / Aventura · 3 Discos M3U
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: colors.text }}>
                  1.98 GB
                </span>
                <button
                  type="button"
                  className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition-colors"
                  style={{ backgroundColor: colors.accent }}
                >
                  Acción de Ejemplo
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-slate-900/60" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restablecer Predeterminado
          </button>

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
              Guardar y Aplicar Tema
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
