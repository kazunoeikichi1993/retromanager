import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { ColeccionPersonalizada, Juego } from '../types';
import { formatBytes } from './gameUtils';
import { getMediaBlob } from './mediaCache';
import { sourceFileRegistry } from './sourceFileRegistry';

export function exportToCsv(juegos: Juego[], filename: string = 'biblioteca_juegos.csv'): void {
  const headers = [
    'Sistema',
    'Nombre',
    'Titulo_Limpio',
    'Extension',
    'Tamano_Bytes',
    'Tamano_Formateado',
    'Region',
    'Genero',
    'Anio',
    'Desarrollador',
    'Total_Dependencias',
    'Es_Multidisco_M3U',
    'Rol_Duplicado',
    'Ruta_Archivo',
    'Etiquetas',
  ];

  const escapeField = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = juegos.map((j) => [
    escapeField(j.sistema),
    escapeField(j.nombre),
    escapeField(j.cleanTitle),
    escapeField(j.extension),
    escapeField(j.tamanoBytes),
    escapeField(formatBytes(j.tamanoBytes)),
    escapeField(j.region),
    escapeField(j.genero),
    escapeField(j.anio),
    escapeField(j.desarrollador),
    escapeField(j.dependencias?.length || 0),
    escapeField(j.extension?.toLowerCase() === '.m3u' ? 'SI' : 'NO'),
    escapeField(j.rolDuplicado || 'original'),
    escapeField(j.rutaCompleta || j.ruta),
    escapeField(j.customTags?.join(', ') || ''),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function exportToPdf(juegos: Juego[], title: string = 'Catálogo de Juegos'): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 54, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`RetroBat & Game Manager - ${title}`, 30, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')} | Total: ${juegos.length} títulos`, pageWidth - 240, 34);

  // Table header
  let y = 80;
  const colX = [30, 100, 360, 420, 500, 560, 640, 720];
  const colTitles = ['Sistema', 'Título del Juego', 'Extensión', 'Tamaño', 'Año', 'Región', 'Género', 'Dependencias'];

  doc.setFillColor(241, 245, 249);
  doc.rect(26, y - 14, pageWidth - 52, 22, 'F');

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  colTitles.forEach((t, idx) => {
    doc.text(t, colX[idx], y);
  });

  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  juegos.forEach((j, index) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 40;

      // Re-draw table header on new page
      doc.setFillColor(241, 245, 249);
      doc.rect(26, y - 14, pageWidth - 52, 22, 'F');
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      colTitles.forEach((t, idx) => {
        doc.text(t, colX[idx], y);
      });
      y += 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(26, y - 11, pageWidth - 52, 17, 'F');
    }

    doc.setTextColor(30, 41, 59);
    doc.text((j.sistema || 'custom').toUpperCase(), colX[0], y);

    // Truncate game title if needed
    const truncatedName = doc.splitTextToSize(j.nombre || j.cleanTitle, 240)[0];
    doc.text(truncatedName, colX[1], y);

    doc.text((j.extension || '').toUpperCase(), colX[2], y);
    doc.text(formatBytes(j.tamanoBytes), colX[3], y);
    doc.text(j.anio || '-', colX[4], y);
    doc.text(j.region || 'Global', colX[5], y);

    const truncatedGenre = doc.splitTextToSize(j.genero || 'Varios', 75)[0];
    doc.text(truncatedGenre, colX[6], y);

    const depCount = j.dependencias?.length || 0;
    doc.text(depCount > 0 ? `${depCount} archivos` : '1 archivo', colX[7], y);

    y += 18;
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
}

export function generateInteractiveHtmlContent(juegos: Juego[], collectionName: string = 'Mi Biblioteca de Juegos'): string {
  const jsonPayload = JSON.stringify(juegos);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${collectionName} - Galería Interactiva y Selección</title>
  <style>
    :root {
      --bg: #090D16;
      --card: #111827;
      --border: #1F2937;
      --text: #F3F4F6;
      --muted: #9CA3AF;
      --accent: #3B82F6;
      --emerald: #10B981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    body { background: var(--bg); color: var(--text); padding-bottom: 110px; }
    header { background: rgba(17, 24, 39, 0.95); backdrop-filter: blur(8px); position: sticky; top: 0; z-index: 40; border-bottom: 1px solid var(--border); padding: 14px 24px; }
    .header-content { max-width: 1400px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; }
    h1 { font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    .controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    input, select { background: #0F172A; border: 1px solid var(--border); color: #fff; padding: 7px 12px; border-radius: 8px; outline: none; font-size: 13px; }
    input:focus, select:focus { border-color: var(--accent); }
    
    .nav-systems { max-width: 1400px; margin: 16px auto 0; padding: 0 24px; display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; }
    .nav-tab { background: #111827; border: 1px solid var(--border); color: var(--muted); padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
    .nav-tab:hover { background: #1F2937; color: #fff; }
    .nav-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }

    .main-wrap { max-width: 1400px; margin: 18px auto; padding: 0 24px; }
    
    .system-section { margin-bottom: 32px; }
    .system-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
    .system-title { font-size: 16px; font-weight: 700; text-transform: uppercase; color: #93c5fd; display: flex; align-items: center; gap: 8px; }
    .system-actions { display: flex; gap: 8px; }
    .btn-small { background: #1e293b; border: 1px solid var(--border); color: #cbd5e1; font-size: 11px; padding: 4px 10px; border-radius: 6px; cursor: pointer; }
    .btn-small:hover { background: #334155; color: #fff; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.15s, border-color 0.15s; position: relative; }
    .card:hover { transform: translateY(-2px); border-color: var(--accent); }
    .card.selected { border-color: var(--emerald); box-shadow: 0 0 0 1px var(--emerald); }

    .cover-wrap { position: relative; height: 165px; background: #0f172a; overflow: hidden; }
    .cover-wrap img { width: 100%; height: 100%; object-fit: cover; }
    .card-checkbox { position: absolute; top: 10px; left: 10px; z-index: 10; width: 20px; height: 20px; cursor: pointer; accent-color: var(--emerald); }
    .badge { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); color: #fff; font-size: 10px; padding: 3px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
    
    .content { padding: 14px; display: flex; flex-direction: column; flex: 1; }
    .title { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: #fff; }
    .meta { font-size: 12px; color: var(--muted); margin-bottom: 8px; display: flex; gap: 6px; }
    .desc { font-size: 12px; color: #94a3b8; line-height: 1.4; margin-bottom: 12px; flex: 1; max-height: 52px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
    .footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 8px; font-size: 11px; color: var(--muted); font-mono: monospace; }
    
    .floating-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #111827; border-top: 1px solid var(--border); padding: 10px 24px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; z-index: 50; box-shadow: 0 -4px 16px rgba(0,0,0,0.5); gap: 10px; }
    .bar-info { display: flex; flex-direction: column; gap: 4px; }
    .bar-title-line { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #fff; }
    .bar-badge { background: #064e3b; color: #6ee7b7; padding: 3px 8px; border-radius: 9999px; font-size: 12px; font-mono: monospace; }
    .bar-breakdown { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .sys-pill { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.35); color: #93c5fd; padding: 1px 7px; border-radius: 6px; font-size: 11px; font-mono: monospace; font-weight: 600; }
    .bar-actions { display: flex; gap: 8px; align-items: center; }
    .btn-export { background: var(--emerald); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .btn-export:hover { opacity: 0.9; }
    .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid var(--border); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-secondary:hover { background: #334155; color: #fff; }
    .empty { max-width: 600px; margin: 60px auto; text-align: center; color: var(--muted); font-size: 15px; }
  </style>
</head>
<body>
  <header>
    <div class="header-content">
      <div>
        <h1>🎮 ${collectionName}</h1>
        <p style="color: var(--muted); font-size: 12px; margin-top: 2px;" id="countLabel">Cargando catálogo...</p>
      </div>
      <div class="controls">
        <input type="text" id="searchInput" placeholder="Buscar título, desarrollador o género..." style="width: 260px;">
        <select id="systemSelect">
          <option value="ALL">Todos los sistemas</option>
        </select>
      </div>
    </div>
  </header>

  <div class="nav-systems" id="navSystems"></div>

  <main class="main-wrap" id="mainContainer"></main>
  <div class="empty" id="emptyState" style="display: none;">No se encontraron juegos que coincidan con la búsqueda.</div>

  <div class="floating-bar" id="floatingBar">
    <div class="bar-info">
      <div class="bar-title-line">
        <span>Juegos Seleccionados:</span>
        <span class="bar-badge" id="selectedCountBadge">0 títulos</span>
        <span style="color: #94a3b8; font-size: 12px;" id="selectedSizeLabel">(0 B)</span>
      </div>
      <div class="bar-breakdown" id="systemBreakdownBadges"></div>
    </div>
    <div class="bar-actions">
      <button class="btn-secondary" onclick="clearAllSelections()">Desmarcar Todos</button>
      <button class="btn-secondary" onclick="exportSelectedCsv()">📄 Descargar CSV</button>
      <button class="btn-export" onclick="exportSelectedJson()">📥 Guardar Lista para el Gestor (.json)</button>
    </div>
  </div>

  <script>
    const games = ${jsonPayload};
    const selectedKeys = new Set();
    let currentActiveSystem = 'ALL';

    const systemSelect = document.getElementById('systemSelect');
    const navSystems = document.getElementById('navSystems');

    const systemMap = new Map();
    games.forEach(g => {
      const s = g.sistema || 'otros';
      if (!systemMap.has(s)) systemMap.set(s, []);
      systemMap.get(s).push(g);
    });

    const systems = Array.from(systemMap.keys()).sort();

    // Populate systems select & nav tabs
    const allTab = document.createElement('button');
    allTab.className = 'nav-tab active';
    allTab.textContent = 'TODOS (' + games.length + ')';
    allTab.onclick = () => filterBySystem('ALL');
    navSystems.appendChild(allTab);

    systems.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.toUpperCase() + ' (' + systemMap.get(s).length + ')';
      systemSelect.appendChild(opt);

      const tab = document.createElement('button');
      tab.className = 'nav-tab';
      tab.dataset.sys = s;
      tab.textContent = s.toUpperCase() + ' (' + systemMap.get(s).length + ')';
      tab.onclick = () => filterBySystem(s);
      navSystems.appendChild(tab);
    });

    function formatBytes(bytes) {
      if (!bytes || bytes <= 0) return '0 B';
      const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    function getGameKey(j) {
      return j.sistema + '__' + j.nombre;
    }

    function filterBySystem(sys) {
      currentActiveSystem = sys;
      systemSelect.value = sys;
      document.querySelectorAll('.nav-tab').forEach(t => {
        if ((sys === 'ALL' && !t.dataset.sys) || t.dataset.sys === sys) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
      render();
    }

    function toggleSelectGame(key) {
      if (selectedKeys.has(key)) selectedKeys.delete(key);
      else selectedKeys.add(key);
      updateSelectionUI();
    }

    function selectSystemGames(sysName, selectAll) {
      const sysGames = games.filter(g => (g.sistema || 'otros') === sysName);
      sysGames.forEach(g => {
        const k = getGameKey(g);
        if (selectAll) selectedKeys.add(k);
        else selectedKeys.delete(k);
      });
      updateSelectionUI();
      render();
    }

    function clearAllSelections() {
      selectedKeys.clear();
      updateSelectionUI();
      render();
    }

    function updateSelectionUI() {
      const selectedGames = games.filter(g => selectedKeys.has(getGameKey(g)));
      const totalBytes = selectedGames.reduce((acc, g) => acc + (g.tamanoBytes || 0), 0);
      document.getElementById('selectedCountBadge').textContent = selectedKeys.size + ' títulos';
      document.getElementById('selectedSizeLabel').textContent = '(' + formatBytes(totalBytes) + ')';

      // Actualizar conteo desglosado por sistemas
      const sysCounts = {};
      selectedGames.forEach(g => {
        const s = (g.sistema || 'otros').toUpperCase();
        sysCounts[s] = (sysCounts[s] || 0) + 1;
      });

      const badgeContainer = document.getElementById('systemBreakdownBadges');
      if (badgeContainer) {
        const entries = Object.entries(sysCounts).sort((a,b) => b[1] - a[1]);
        if (entries.length > 0) {
          badgeContainer.innerHTML = entries.map(([s, c]) => '<span class="sys-pill">' + s + ': ' + c + '</span>').join('');
        } else {
          badgeContainer.innerHTML = '<span style="color:#64748b;font-size:11px;">Marca juegos con la casilla para ver desglose por consola</span>';
        }
      }

      document.querySelectorAll('.card').forEach(card => {
        const k = card.dataset.gameKey;
        const cb = card.querySelector('.card-checkbox');
        if (selectedKeys.has(k)) {
          card.classList.add('selected');
          if (cb) cb.checked = true;
        } else {
          card.classList.remove('selected');
          if (cb) cb.checked = false;
        }
      });
    }

    function showNotify(msg) {
      let el = document.getElementById('web-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'web-toast';
        el.style.cssText = 'position:fixed;bottom:90px;right:24px;background:#1e293b;border:1px solid #3b82f6;color:#f8fafc;padding:12px 20px;border-radius:12px;font-size:13px;z-index:9999;box-shadow:0 10px 25px rgba(0,0,0,0.5);transition:opacity 0.3s;';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = '1';
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 3500);
    }

    function exportSelectedJson() {
      if (selectedKeys.size === 0) {
        showNotify('Por favor selecciona al menos un juego para exportar.');
        return;
      }
      const selectedGames = games.filter(g => selectedKeys.has(getGameKey(g)));
      const payload = {
        exportedAt: new Date().toISOString(),
        total: selectedGames.length,
        selectedKeys: Array.from(selectedKeys),
        games: selectedGames.map(g => ({
          id: g.id,
          sistema: g.sistema,
          nombre: g.nombre,
          cleanTitle: g.cleanTitle,
          ruta: g.ruta,
          tamanoBytes: g.tamanoBytes
        }))
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'juegos_marcados_retrobat.json');
    }

    function exportSelectedCsv() {
      if (selectedKeys.size === 0) {
        showNotify('Por favor selecciona al menos un juego para exportar.');
        return;
      }
      const selectedGames = games.filter(g => selectedKeys.has(getGameKey(g)));
      const headers = ['Sistema', 'Nombre', 'Titulo_Limpio', 'Tamano_Bytes', 'Tamano', 'Ruta'];
      const rows = selectedGames.map(g => [
        '"' + (g.sistema || '') + '"',
        '"' + (g.nombre || '').replace(/"/g, '""') + '"',
        '"' + (g.cleanTitle || '').replace(/"/g, '""') + '"',
        g.tamanoBytes || 0,
        '"' + formatBytes(g.tamanoBytes) + '"',
        '"' + (g.ruta || '').replace(/"/g, '""') + '"'
      ]);
      const csv = '\\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\\r\\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, 'juegos_marcados_retrobat.csv');
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function getFallbackSvg(name, sys) {
      const safeName = (name || 'Juego').replace(/["'<>]/g, '');
      const safeSys = (sys || '').toUpperCase().replace(/["'<>]/g, '');
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350">' +
        '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs>' +
        '<rect width="100%" height="100%" fill="url(#g)"/>' +
        '<rect x="20" y="20" width="560" height="310" rx="12" fill="none" stroke="#334155" stroke-width="2"/>' +
        '<circle cx="300" cy="130" r="40" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>' +
        '<text x="300" y="137" fill="#60a5fa" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle">[' + safeSys + ']</text>' +
        '<text x="300" y="220" fill="#f8fafc" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">' + (safeName.length > 32 ? safeName.substring(0, 30) + '...' : safeName) + '</text>' +
        '<text x="300" y="250" fill="#94a3b8" font-family="sans-serif" font-size="12" text-anchor="middle">RetroBat Catalog</text>' +
        '</svg>'
      );
    }

    function render() {
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      const selSys = currentActiveSystem;
      const filtered = games.filter(g => {
        const matchesQuery = !q || g.nombre.toLowerCase().includes(q) || (g.desarrollador && g.desarrollador.toLowerCase().includes(q)) || (g.genero && g.genero.toLowerCase().includes(q));
        const matchesSys = selSys === 'ALL' || (g.sistema || 'otros') === selSys;
        return matchesQuery && matchesSys;
      });

      document.getElementById('countLabel').textContent = 'Mostrando ' + filtered.length + ' de ' + games.length + ' juegos';
      const container = document.getElementById('mainContainer');
      container.innerHTML = '';
      document.getElementById('emptyState').style.display = filtered.length === 0 ? 'block' : 'none';

      // Group filtered games by system
      const groups = new Map();
      filtered.forEach(g => {
        const sys = g.sistema || 'otros';
        if (!groups.has(sys)) groups.set(sys, []);
        groups.get(sys).push(g);
      });

      Array.from(groups.keys()).sort().forEach(sys => {
        const sysGames = groups.get(sys);
        const sec = document.createElement('div');
        sec.className = 'system-section';

        const sysBytes = sysGames.reduce((acc, g) => acc + (g.tamanoBytes || 0), 0);

        sec.innerHTML = \`
          <div class="system-header">
            <div class="system-title">
              <span>\${sys}</span>
              <span style="font-size: 12px; color: #94a3b8; font-weight: normal;">
                (\${sysGames.length} juegos · \${formatBytes(sysBytes)})
              </span>
            </div>
            <div class="system-actions">
              <button class="btn-small" onclick="selectSystemGames('\${sys}', true)">+ Marcar todo \${sys.toUpperCase()}</button>
              <button class="btn-small" onclick="selectSystemGames('\${sys}', false)">- Desmarcar</button>
            </div>
          </div>
          <div class="grid" id="grid_\${sys}"></div>
        \`;
        container.appendChild(sec);

        const grid = sec.querySelector('#grid_' + sys);
        sysGames.forEach(j => {
          const key = getGameKey(j);
          const isSelected = selectedKeys.has(key);
          const card = document.createElement('div');
          card.className = 'card' + (isSelected ? ' selected' : '');
          card.dataset.gameKey = key;
          
          const fallbackSrc = getFallbackSvg(j.nombre, j.sistema);
          const coverImg = j.imagen || j.rutaThumb || j.rutaImage || fallbackSrc;
          
          card.innerHTML = \`
            <div class="cover-wrap">
              <input type="checkbox" class="card-checkbox" \${isSelected ? 'checked' : ''}>
              <img src="\${coverImg}" alt="\${j.nombre}" loading="lazy" onerror="this.src='\${fallbackSrc}'">
              <span class="badge">\${j.extension || ''}</span>
            </div>
            <div class="content">
              <div class="title">\${j.nombre}</div>
              <div class="meta">
                <span>\${j.anio || 'Año desc.'}</span> · 
                <span>\${j.region || 'Global'}</span> · 
                <span>\${j.genero || 'Varios'}</span>
              </div>
              <div class="desc">\${j.descripcion || 'Sin descripción disponible.'}</div>
              <div class="footer">
                <span>\${formatBytes(j.tamanoBytes)}</span>
                <span>\${j.dependencias ? j.dependencias.length : 1} archivos</span>
              </div>
            </div>
          \`;

          const cb = card.querySelector('.card-checkbox');
          cb.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleSelectGame(key);
          });

          card.addEventListener('click', (e) => {
            if (e.target !== cb) {
              toggleSelectGame(key);
            }
          });

          grid.appendChild(card);
        });
      });
    }

    document.getElementById('searchInput').addEventListener('input', render);
    document.getElementById('systemSelect').addEventListener('change', (e) => {
      filterBySystem(e.target.value);
    });

    render();
    updateSelectionUI();
  </script>
</body>
</html>`;
}

export function exportToInteractiveWebHtml(juegos: Juego[], collectionName: string = 'Mi Biblioteca de Juegos'): void {
  const html = generateInteractiveHtmlContent(juegos, collectionName);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  triggerDownload(blob, `${collectionName.toLowerCase().replace(/\s+/g, '_')}_galeria.html`);
}

/**
 * Exporta la galería web interactiva en un paquete .ZIP autónomo conteniendo:
 * - index.html
 * - carpeta images/ con todas las carátulas y capturas reales
 */
export async function exportToInteractiveWebZip(
  juegos: Juego[],
  collectionName: string = 'Mi Biblioteca de Juegos',
  onProgress?: (progress: { current: number; total: number; message: string; percent: number }) => void
): Promise<void> {
  const zip = new JSZip();
  const imgFolder = zip.folder('images');
  const total = juegos.length;

  // Procesar juegos y guardar imágenes reales en la carpeta images/
  const processedGames: Juego[] = [];
  for (let i = 0; i < total; i++) {
    const j = juegos[i];
    const sysName = j.sistema || 'custom';
    const cleanName = j.nombre.replace(/[^a-zA-Z0-9_\-]/g, '_');
    let localImagePath = '';

    if (onProgress && (i % 5 === 0 || i === total - 1)) {
      const pct = Math.round(((i + 1) / total) * 75);
      onProgress({
        current: i + 1,
        total,
        message: `Extrayendo carátula (${i + 1}/${total}): ${j.nombre}...`,
        percent: pct,
      });
      // Yield thread to UI
      await new Promise((r) => setTimeout(r, 0));
    }

    // Buscar blob en mediaCache IndexedDB, o resolver desde disco físico o URL blob
    let foundBlob: Blob | null = null;
    const thumbDep = j.dependencias?.find((d) => d.tipo === 'THUMB');
    const imageDep = j.dependencias?.find((d) => d.tipo === 'IMAGE');

    const thumbName = thumbDep?.nombreArchivo.toLowerCase();
    const imageName = imageDep?.nombreArchivo.toLowerCase();

    if (thumbName) {
      foundBlob = await getMediaBlob(`${sysName}__${thumbName}`);
    }
    if (!foundBlob && imageName) {
      foundBlob = await getMediaBlob(`${sysName}__${imageName}`);
    }

    // Si no está en IndexedDB, resolver directamente desde el disco de origen conectado
    if (!foundBlob && thumbDep) {
      try {
        const diskFile = await sourceFileRegistry.resolvePhysicalFile(sysName, thumbDep.nombreArchivo);
        if (diskFile) foundBlob = diskFile;
      } catch {}
    }
    if (!foundBlob && imageDep) {
      try {
        const diskFile = await sourceFileRegistry.resolvePhysicalFile(sysName, imageDep.nombreArchivo);
        if (diskFile) foundBlob = diskFile;
      } catch {}
    }

    if (!foundBlob && j.imagen && j.imagen.startsWith('blob:')) {
      try {
        const resp = await fetch(j.imagen);
        foundBlob = await resp.blob();
      } catch {}
    }

    if (foundBlob && imgFolder) {
      const ext = foundBlob.type.includes('png') ? 'png' : 'jpg';
      const fileName = `${sysName}_${cleanName}.${ext}`;
      imgFolder.file(fileName, foundBlob);
      localImagePath = `images/${fileName}`;
    }

    processedGames.push({
      ...j,
      imagen: localImagePath || j.imagen || '',
      rutaThumb: localImagePath || j.rutaThumb || '',
      rutaImage: localImagePath || j.rutaImage || '',
    });
  }

  if (onProgress) {
    onProgress({
      current: total,
      total,
      message: 'Compilando HTML y empaquetando archivo ZIP...',
      percent: 85,
    });
  }

  const htmlContent = generateInteractiveHtmlContent(processedGames, collectionName);
  zip.file('index.html', htmlContent);

  if (onProgress) {
    onProgress({
      current: total,
      total,
      message: 'Comprimiendo paquete ZIP para descarga...',
      percent: 92,
    });
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  });

  if (onProgress) {
    onProgress({
      current: total,
      total,
      message: '¡Descarga lista!',
      percent: 100,
    });
  }

  triggerDownload(zipBlob, `${collectionName.toLowerCase().replace(/\s+/g, '_')}_galeria_completa.zip`);
}

/**
 * Exporta la galería web interactiva enlazada a las rutas locales de RetroBat.
 * Cero consumo de RAM: no crea zips pesados, sino un archivo HTML directo que enlaza a ./roms/<sistema>/images/...
 * o ./images/... ideal para bibliotecas de más de 9,000 juegos.
 */
export function exportToInteractiveWebLinkedHtml(
  juegos: Juego[],
  collectionName: string = 'Mi Biblioteca RetroBat'
): void {
  // Ajustar rutas de imagen para apuntar a la estructura estándar de RetroBat: ./roms/<sistema>/images/<nombre>
  const processedGames: Juego[] = juegos.map((j) => {
    const sys = j.sistema || 'custom';
    const thumbDep = j.dependencias?.find((d) => d.tipo === 'THUMB');
    const imageDep = j.dependencias?.find((d) => d.tipo === 'IMAGE');
    const imgFilename = thumbDep?.nombreArchivo || imageDep?.nombreArchivo;

    let relativePath = '';
    if (imgFilename) {
      const cleanImgName = imgFilename.replace(/^\.\//, '').replace(/\\/g, '/').split('/').pop() || imgFilename;
      relativePath = `./roms/${sys}/images/${cleanImgName}`;
    }

    return {
      ...j,
      imagen: relativePath || j.imagen || '',
      rutaThumb: relativePath || j.rutaThumb || '',
      rutaImage: relativePath || j.rutaImage || '',
    };
  });

  const html = generateInteractiveHtmlContent(processedGames, collectionName);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  triggerDownload(blob, `${collectionName.toLowerCase().replace(/\s+/g, '_')}_enlazada_local.html`);
}

export function parseImportedGameSelection(rawContent: string): { keys: string[]; titles: string[] } {
  const keys: string[] = [];
  const titles: string[] = [];

  const trimmed = rawContent.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item.sistema && item.nombre) keys.push(`${item.sistema}__${item.nombre}`);
          if (item.nombre) titles.push(item.nombre);
          if (item.cleanTitle) titles.push(item.cleanTitle);
        });
      } else if (data.selectedKeys && Array.isArray(data.selectedKeys)) {
        keys.push(...data.selectedKeys);
      } else if (data.games && Array.isArray(data.games)) {
        data.games.forEach((item: any) => {
          if (item.sistema && item.nombre) keys.push(`${item.sistema}__${item.nombre}`);
          if (item.nombre) titles.push(item.nombre);
          if (item.cleanTitle) titles.push(item.cleanTitle);
        });
      }
      return { keys, titles };
    } catch {}
  }

  // Fallback parse CSV
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // CSV columns: Sistema, Nombre, Titulo_Limpio, ...
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((p) => p.replace(/^"|"$/g, '').trim());
    if (parts.length >= 2) {
      const sys = parts[0];
      const name = parts[1];
      if (sys && name) keys.push(`${sys}__${name}`);
      if (name) titles.push(name);
      if (parts[2]) titles.push(parts[2]);
    }
  }

  return { keys, titles };
}

export function exportToJsonDatabase(juegos: Juego[], colecciones: ColeccionPersonalizada[]): void {
  const payload = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalJuegos: juegos.length,
    juegos,
    colecciones,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, `RetroBat_BaseDatos_${new Date().toISOString().slice(0, 10)}.json`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

