import React, { useState } from 'react';
import {
  Check,
  Code,
  Copy,
  Cpu,
  Download,
  FileCode,
  Globe,
  HardDrive,
  Monitor,
  Terminal,
  X,
} from 'lucide-react';

interface MultiplatformModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MultiplatformModal: React.FC<MultiplatformModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'windows' | 'linux' | 'web' | 'docker'>('windows');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
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
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Compilación Multiplataforma
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Windows · Linux · Web · Docker
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Instrucciones y scripts listos para construir ejecutables nativos e instaladores
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

        {/* Platform Tabs */}
        <div className="px-6 pt-4 border-b bg-slate-900/40 flex items-center gap-2" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          {[
            { id: 'windows', label: '🪟 Windows (.exe / NSIS)', icon: Monitor },
            { id: 'linux', label: '🐧 Linux (.AppImage / .deb)', icon: Terminal },
            { id: 'web', label: '🌐 Web & PWA (Offline)', icon: Globe },
            { id: 'docker', label: '🐳 Docker / Servidor', icon: HardDrive },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[65vh] text-xs">
          {activeTab === 'windows' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="p-1 rounded bg-blue-500/20 text-blue-400">1</span>
                  Compilación de Instalador Nativo de Windows (.exe / Portable)
                </h4>
                <p className="text-slate-400">
                  Genera un paquete instalador NSIS completo y una versión comprimida portátil en la carpeta <code className="text-blue-400">dist-electron/</code>.
                </p>
                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-black/60 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    npm run build:win
                  </pre>
                  <button
                    onClick={() => copyToClipboard('npm run build:win', 'win1')}
                    className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                    title="Copiar comando"
                  >
                    {copiedCmd === 'win1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="p-1 rounded bg-blue-500/20 text-blue-400">2</span>
                  Ejecutor Directo en Windows (Sin compilar instaladores)
                </h4>
                <p className="text-slate-400">
                  Haz doble clic en el archivo incluido <code className="text-blue-400">run-desktop.bat</code> en la raíz del proyecto para abrir la aplicación instantáneamente en ventana de escritorio sin barra de navegación del explorador.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'linux' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="p-1 rounded bg-blue-500/20 text-blue-400">1</span>
                  Compilación de AppImage y Paquete Debian (.deb)
                </h4>
                <p className="text-slate-400">
                  Crea un ejecutable universal AppImage compatible con Ubuntu, Debian, Fedora, Arch, Manjaro y SteamOS (Steam Deck).
                </p>
                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-black/60 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    npm run build:linux
                  </pre>
                  <button
                    onClick={() => copyToClipboard('npm run build:linux', 'lin1')}
                    className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'lin1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="p-1 rounded bg-blue-500/20 text-blue-400">2</span>
                  Script Lanzador Linux (<code className="text-blue-400">run-desktop.sh</code>)
                </h4>
                <p className="text-slate-400">
                  Ejecuta en terminal para menú interactivo de inicio rápido o despliegue en red:
                </p>
                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-black/60 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    chmod +x run-desktop.sh && ./run-desktop.sh
                  </pre>
                  <button
                    onClick={() => copyToClipboard('chmod +x run-desktop.sh && ./run-desktop.sh', 'lin2')}
                    className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'lin2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'web' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="p-1 rounded bg-blue-500/20 text-blue-400">1</span>
                  Compilación Web Estática &amp; PWA
                </h4>
                <p className="text-slate-400">
                  Genera la versión estática optimizada en <code className="text-blue-400">dist/</code> con Service Worker y manifiesto PWA. Puede alojarse en cualquier servidor web (Nginx, GitHub Pages, Vercel, Cloudflare, etc.).
                </p>
                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-black/60 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    npm run build:web
                  </pre>
                  <button
                    onClick={() => copyToClipboard('npm run build:web', 'web1')}
                    className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'web1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="p-1 rounded bg-blue-500/20 text-blue-400">2</span>
                  Previsualización Local de Producción
                </h4>
                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-black/60 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    npm run preview
                  </pre>
                  <button
                    onClick={() => copyToClipboard('npm run preview', 'web2')}
                    className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'web2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'docker' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span className="p-1 rounded bg-blue-500/20 text-blue-400">1</span>
                  Despliegue con Docker Compose (Servidores / NAS / Red Local)
                </h4>
                <p className="text-slate-400">
                  Ideal para montar un servidor en casa (Raspberry Pi, TrueNAS, Unraid o servidor local) y acceder desde cualquier PC, tablet o consola en la red.
                </p>
                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-black/60 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    docker compose up -d --build
                  </pre>
                  <button
                    onClick={() => copyToClipboard('docker compose up -d --build', 'doc1')}
                    className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'doc1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Disponible inmediatamente en <code className="text-blue-400">http://localhost:8080</code>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-slate-900/60" style={{ borderColor: 'var(--border-app, #1F2937)' }}>
          <span className="text-slate-400 text-[11px]">
            Consulta el archivo <code className="text-white font-mono">README.md</code> para la guía completa detallada.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Cerrar Guía
          </button>
        </div>
      </div>
    </div>
  );
};
