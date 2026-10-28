import { DependenciaItem, DependencyType, Juego } from '../types';

export function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let dbl = bytes;
  while (dbl >= 1024 && i < units.length - 1) {
    dbl /= 1024;
    i++;
  }
  const formatted = parseFloat(dbl.toFixed(2));
  return `${formatted} ${units[i]}`;
}

export function parseSize(input: string): number {
  if (!input || typeof input !== 'string') return 0;
  const trimmed = input.trim().toUpperCase();
  try {
    if (trimmed.endsWith('GB') || trimmed.endsWith('G')) {
      const num = trimmed.replace('GB', '').replace('G', '').trim().replace(',', '.');
      return Math.floor(parseFloat(num) * 1024 * 1024 * 1024);
    }
    if (trimmed.endsWith('MB') || trimmed.endsWith('M')) {
      const num = trimmed.replace('MB', '').replace('M', '').trim().replace(',', '.');
      return Math.floor(parseFloat(num) * 1024 * 1024);
    }
    if (trimmed.endsWith('KB') || trimmed.endsWith('K')) {
      const num = trimmed.replace('KB', '').replace('K', '').trim().replace(',', '.');
      return Math.floor(parseFloat(num) * 1024);
    }
    const rawBytes = parseInt(trimmed.replace('B', '').trim(), 10);
    return isNaN(rawBytes) ? 0 : rawBytes;
  } catch {
    return 0;
  }
}

export function cleanTitle(titulo: string): string {
  if (!titulo) return '';
  let limpio = titulo.replace(/\s*\([^)]*\)/g, '');
  limpio = limpio.replace(/\s*\[[^\]]*\]/g, '');
  return limpio.trim();
}

export function extractRegionFromName(archivo: string): string {
  if (!archivo) return 'Global';
  if (archivo.includes('(Europe)') || archivo.includes('(Spain)') || archivo.includes('(ES)')) return 'Spain';
  if (archivo.includes('(USA)') || archivo.includes('(US)')) return 'USA';
  if (archivo.includes('(Japan)') || archivo.includes('(JA)')) return 'Japan';
  if (archivo.includes('(World)')) return 'World';
  return 'Global';
}

export function normalizeRegion(raw: string): string {
  if (!raw) return 'Global';
  const lower = raw.toLowerCase().trim();
  switch (lower) {
    case 'es':
    case 'spain':
    case 'españa':
      return 'Spain';
    case 'eu':
    case 'europe':
    case 'europa':
      return 'Europe';
    case 'us':
    case 'usa':
    case 'estados unidos':
      return 'USA';
    case 'jp':
    case 'japan':
    case 'japón':
    case 'japon':
      return 'Japan';
    case 'world':
    case 'wr':
    case 'mundial':
      return 'World';
    default:
      return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}

export function extractYear(releaseDate?: string): string {
  if (!releaseDate) return '';
  const trimmed = releaseDate.trim();
  if (trimmed.length >= 4) {
    const match = trimmed.match(/\b(19\d{2}|20\d{2})\b/);
    if (match) return match[1];
    return trimmed.substring(0, 4);
  }
  return '';
}

export function evaluate1G1RScore(j: Juego, preferredRegion: string = 'ES'): number {
  let score = 0;
  const reg = (j.region || '').toUpperCase();
  const pref = preferredRegion.toUpperCase();

  if (reg.includes('ESPAÑA') || reg.includes('SPAIN') || reg.includes('ES')) {
    score += pref === 'ES' ? 1000 : 500;
  }
  if (reg.includes('EUROPE') || reg.includes('EU')) {
    score += 400;
  }
  if (reg.includes('USA') || reg.includes('US')) {
    score += 300;
  }
  if (reg.includes('WORLD') || reg.includes('GLOBAL')) {
    score += 200;
  }

  const ext = (j.extension || '').toLowerCase();
  if (ext === '.chd' || ext === '.zcci' || ext === '.cxi' || ext === '.rvz') score += 80;
  if (ext === '.m3u') score += 120;
  if (ext === '.iso') score += 40;

  // Prefer games with verified or richer dependencies
  if (j.dependencias && j.dependencias.length > 0) {
    score += Math.min(j.dependencias.length * 5, 50);
  }

  return score;
}

export function processDuplicates1G1R(juegos: Juego[], preferredRegion: string = 'ES'): Juego[] {
  // Group by system + cleanTitle (lowercased)
  const groupMap = new Map<string, Juego[]>();

  for (const j of juegos) {
    const key = `${(j.sistema || 'other').toLowerCase()}:::${(j.cleanTitle || j.nombre || '').toLowerCase()}`;
    const list = groupMap.get(key) || [];
    list.push(j);
    groupMap.set(key, list);
  }

  return juegos.map((j) => {
    const key = `${(j.sistema || 'other').toLowerCase()}:::${(j.cleanTitle || j.nombre || '').toLowerCase()}`;
    const grp = groupMap.get(key) || [];

    if (grp.length > 1) {
      // Find the best game according to 1G1R scoring
      const sorted = [...grp].sort((a, b) => {
        const scoreA = (a.extension?.toLowerCase() === '.m3u' ? 2000 : 0) + evaluate1G1RScore(a, preferredRegion);
        const scoreB = (b.extension?.toLowerCase() === '.m3u' ? 2000 : 0) + evaluate1G1RScore(b, preferredRegion);
        return scoreB - scoreA;
      });

      const best = sorted[0];
      const isOriginal = best.id === j.id;
      const role = j.rolDuplicado === 'ambos_validos' ? 'ambos_validos' : isOriginal ? 'original' : 'descarte';

      return {
        ...j,
        esDuplicado: true,
        grupoDuplicadoId: key,
        rolDuplicado: role,
      };
    } else {
      return {
        ...j,
        esDuplicado: false,
        rolDuplicado: j.rolDuplicado === 'ambos_validos' ? 'ambos_validos' : 'original',
        grupoDuplicadoId: undefined,
      };
    }
  });
}

export function filterGamesByFormat(
  juegos: Juego[],
  extensionToDelete: string,
  targetSystem?: string
): { remaining: Juego[]; countRemoved: number } {
  let targetExt = extensionToDelete.trim().toLowerCase();
  if (!targetExt.startsWith('.')) targetExt = '.' + targetExt;

  const remaining: Juego[] = [];
  let countRemoved = 0;

  for (const j of juegos) {
    const sysMatch = !targetSystem || targetSystem === 'Todos los Sistemas' || j.sistema === targetSystem;
    const extMatch = (j.extension || '').toLowerCase() === targetExt;

    if (sysMatch && extMatch) {
      countRemoved++;
    } else {
      remaining.push(j);
    }
  }

  return { remaining, countRemoved };
}

export function calculateGameTotalBytes(j: Juego): number {
  let total = j.tamanoBytes || 0;
  if (j.dependencias && j.dependencias.length > 0) {
    const depsSum = j.dependencias.reduce((acc, d) => acc + (d.tamanoBytes || 0), 0);
    // If tamanoBytes already reflects only the main ROM, total is base + depsSum
    // If tamanoBytes is 0 or less than deps, ensure it accounts for dependencies
    if (total < depsSum) {
      total = depsSum;
    }
  }
  return total;
}

export function getDependencyColor(tipo: DependencyType): string {
  switch (tipo) {
    case 'DISC':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'TRACK':
      return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
    case 'IMAGE':
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'THUMB':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'MARQUEE':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'FANART':
      return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    case 'VIDEO':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'MANUAL':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'SWITCH_DLC':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'SWITCH_UPDATE':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'WIN_FOLDER':
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    default:
      return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

export function getGameBadge(j: Juego): { label: string; colorClass: string } {
  const ext = (j.extension || '').toLowerCase();
  const sys = (j.sistema || '').toLowerCase();

  if (ext === '.m3u') {
    return {
      label: 'M3U MULTIDISCO',
      colorClass: 'bg-purple-950/60 text-purple-300 border border-purple-700/50',
    };
  }
  if (ext === '.game') {
    return {
      label: '.GAME (CARPETA)',
      colorClass: 'bg-blue-950/60 text-blue-300 border border-blue-700/50',
    };
  }
  if (sys === 'switch' && j.dependencias && j.dependencias.some((d) => d.tipo.startsWith('SWITCH_'))) {
    return {
      label: `${ext.toUpperCase()} + DLC/UPD`,
      colorClass: 'bg-rose-950/60 text-rose-300 border border-rose-700/50',
    };
  }
  if (j.esCarpetaOEnlazado) {
    return {
      label: 'CARPETA VINCULADA',
      colorClass: 'bg-teal-950/60 text-teal-300 border border-teal-700/50',
    };
  }
  return {
    label: ext.replace('.', '').toUpperCase() || 'ROM',
    colorClass: 'bg-slate-800/80 text-slate-300 border border-slate-700/50',
  };
}
