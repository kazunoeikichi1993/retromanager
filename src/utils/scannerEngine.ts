import { DependenciaItem, DependencyType, Juego } from '../types';
import {
  cleanTitle,
  extractRegionFromName,
  extractYear,
  formatBytes,
  normalizeRegion,
  processDuplicates1G1R,
} from './gameUtils';
import { putMediaBlob } from './mediaCache';
import { sourceFileRegistry } from './sourceFileRegistry';

export interface ScanProgressCallback {
  (progress: {
    fase: string;
    sistemaActual: string;
    juegosEncontrados: number;
    archivosProcesados: number;
    mensaje: string;
  }): void;
}

export interface SystemDirectoryStructure {
  sistema: string;
  xmlFile?: File;
  archivos: Map<string, File>; // lowerName -> File
  carpetas: Map<string, File[]>; // folderName -> files
}

/**
 * Escanea un sistema específico emparejando gamelist.xml con archivos físicos reales,
 * evitando duplicar juegos del XML y archivos de la carpeta, y usando los tamaños EXACTOS en bytes.
 */
export async function escanearSistemaEstructurado(
  nombreSistema: string,
  archivosMap: Map<string, File>,
  xmlFile?: File,
  onProgress?: ScanProgressCallback
): Promise<Juego[]> {
  const lista: Juego[] = [];
  const sysLower = nombreSistema.toLowerCase();
  const esWindows = sysLower === 'windows' || sysLower === 'pc';
  const esXbox360 = sysLower === 'xbox360' || sysLower === 'xbox' || sysLower === 'x360';
  const esPs3Ps4 = sysLower === 'ps3' || sysLower === 'ps4' || sysLower === 'ps3_iso';
  const esSwitch = sysLower === 'switch';

  const procesadosFisicos = new Set<string>();
  const archivosOmitirPorDependencia = new Set<string>();

  // PASO 1: Analizar todos los archivos .m3u del sistema
  const diccM3uDeps = new Map<string, DependenciaItem[]>();
  for (const [nameLower, file] of archivosMap.entries()) {
    if (nameLower.endsWith('.m3u')) {
      const deps: DependenciaItem[] = [];
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const lin = line.trim();
          if (!lin || lin.startsWith('#')) continue;
          const clean = lin.replace(/^\.\//, '').replace(/\\/g, '/');
          const targetName = (clean.split('/').pop() || clean).toLowerCase();

          // Buscar el archivo físico real del disco
          const matchFile = archivosMap.get(targetName);
          if (matchFile) {
            deps.push({
              tipo: 'DISC',
              nombreArchivo: matchFile.name,
              rutaCompleta: clean,
              tamanoBytes: matchFile.size,
            });
            archivosOmitirPorDependencia.add(targetName);
            procesadosFisicos.add(targetName);
          } else {
            // Si no está directamente en la raíz pero está declarado
            deps.push({
              tipo: 'DISC',
              nombreArchivo: clean.split('/').pop() || clean,
              rutaCompleta: clean,
              tamanoBytes: 500 * 1024 * 1024,
            });
          }
        }
      } catch {}
      diccM3uDeps.set(nameLower, deps);
    }
  }

  // PASO 2: Procesar gamelist.xml si existe
  if (xmlFile) {
    try {
      const xmlText = await xmlFile.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const gameNodes = xmlDoc.getElementsByTagName('game');

      for (let i = 0; i < gameNodes.length; i++) {
        const node = gameNodes[i];
        if (node.getElementsByTagName('hidden')[0]?.textContent?.trim() === 'true') continue;

        const rawPath = node.getElementsByTagName('path')[0]?.textContent?.trim() || '';
        if (!rawPath) continue;

        const pathClean = rawPath.replace(/^\.\//, '').replace(/\\/g, '/');
        const fileName = pathClean.split('/').pop() || pathClean;
        const fileNameLower = fileName.toLowerCase();
        const ext = fileNameLower.includes('.') ? fileNameLower.substring(fileNameLower.lastIndexOf('.')) : '';

        if (esXbox360 && ext === '.xex') continue;
        if (esWindows && ext !== '.game' && ext !== '.m3u') continue;
        if (esPs3Ps4 && (ext === '.bin' || ext === '.sfo' || ext === '.edat')) continue;

        // Comprobar si el archivo físico real existe en la carpeta o subcarpeta
        let physicalFile = archivosMap.get(fileNameLower);
        let folderExists = false;

        if (!physicalFile) {
          // Búsqueda sin extensión
          const baseNameLower = fileNameLower.replace(/\.[^/.]+$/, '');
          for (const [k, f] of archivosMap.entries()) {
            if (k.replace(/\.[^/.]+$/, '') === baseNameLower) {
              physicalFile = f;
              break;
            }
          }
        }

        // Búsqueda si es un juego en carpeta (ej: PS3, Windows, etc.)
        if (!physicalFile) {
          const folderPrefix = (pathClean.split('/')[0] || '').toLowerCase();
          if (folderPrefix && folderPrefix !== '.') {
            for (const k of archivosMap.keys()) {
              if (k.startsWith(folderPrefix + '/') || k.startsWith(folderPrefix + '\\')) {
                folderExists = true;
                break;
              }
            }
          }
        }

        // VALIDACIÓN DE EXISTENCIA FÍSICA:
        // Si el juego está en el gamelist.xml pero físicamente NO existe su archivo ni carpeta,
        // se descarta automáticamente para evitar registros fantasmas de juegos eliminados.
        if (!physicalFile && !folderExists) {
          continue;
        }

        // Si ya fue procesado como dependencia de un M3U, no duplicar como juego suelto
        if (physicalFile && archivosOmitirPorDependencia.has(physicalFile.name.toLowerCase())) {
          procesadosFisicos.add(physicalFile.name.toLowerCase());
          continue;
        }

        const dependencias: DependenciaItem[] = [];
        let tamanoTotal = physicalFile ? physicalFile.size : 0;

        // Si es M3U, asociar sus discos reales
        if (ext === '.m3u' && diccM3uDeps.has(fileNameLower)) {
          const m3uItems = diccM3uDeps.get(fileNameLower) || [];
          dependencias.push(...m3uItems);
          tamanoTotal += m3uItems.reduce((acc, d) => acc + d.tamanoBytes, 0);
        }

        // Marcar archivo físico como procesado para que el paso 3 no lo agregue otra vez
        if (physicalFile) {
          procesadosFisicos.add(physicalFile.name.toLowerCase());
        }

        // Buscar multimedia declarada en el XML (comprobando existencia real y tamaño real)
        // Convención RetroBat / EmulationStation:
        // <thumbnail> = Carátula frontal (Boxart)
        // <image>     = Miniatura / Captura in-game (Screenshot)
        // <marquee>   = Logo / Wheel
        // <fanart>    = Fondo
        // <video>     = Video preview
        // <manual>    = Guía manual PDF
        // <bezel>     = Marco bezel
        // <boxback>   = Contraportada
        // <map>       = Mapa del juego
        const mediaDefs: Array<{ tag: string; tipo: DependencyType }> = [
          { tag: 'thumbnail', tipo: 'THUMB' },
          { tag: 'image', tipo: 'IMAGE' },
          { tag: 'marquee', tipo: 'MARQUEE' },
          { tag: 'fanart', tipo: 'FANART' },
          { tag: 'video', tipo: 'VIDEO' },
          { tag: 'manual', tipo: 'MANUAL' },
          { tag: 'bezel', tipo: 'BEZEL' },
          { tag: 'boxback', tipo: 'BOXBACK' },
          { tag: 'map', tipo: 'MAP' },
        ];

        let coverUrl = '';
        let thumbUrl = '';
        let marqueeUrl = '';
        let fanartUrl = '';
        let videoUrl = '';
        let bezelUrl = '';
        let boxbackUrl = '';
        let mapUrl = '';
        let manualUrl = '';

        for (const def of mediaDefs) {
          const val = node.getElementsByTagName(def.tag)[0]?.textContent?.trim() || '';
          if (val) {
            const mClean = val.replace(/^\.\//, '').replace(/\\/g, '/');
            const mName = mClean.split('/').pop() || mClean;
            const mNameLower = mName.toLowerCase();
            const mediaPhysical = archivosMap.get(mNameLower);

            if (mediaPhysical) {
              const realBytes = mediaPhysical.size;
              dependencias.push({
                tipo: def.tipo,
                nombreArchivo: mediaPhysical.name,
                rutaCompleta: mClean,
                tamanoBytes: realBytes,
              });
              tamanoTotal += realBytes;
              procesadosFisicos.add(mNameLower);

              // Optimización de Memoria RAM:
              // Solo creamos ObjectURL inmediato para imágenes visuales (THUMB / IMAGE / MARQUEE)
              // Los videos y documentos pesados se resuelven bajo demanda para no saturar los 6 GB de RAM
              let blobUrl = '';
              if (def.tipo === 'THUMB' || def.tipo === 'IMAGE' || def.tipo === 'MARQUEE') {
                blobUrl = URL.createObjectURL(mediaPhysical);
                putMediaBlob(`${nombreSistema}__${mNameLower}`, mediaPhysical).catch(() => {});
              }

              if (def.tipo === 'THUMB') thumbUrl = blobUrl;
              else if (def.tipo === 'IMAGE') coverUrl = blobUrl;
              else if (def.tipo === 'MARQUEE') marqueeUrl = blobUrl;
              else if (def.tipo === 'FANART') fanartUrl = blobUrl;
              else if (def.tipo === 'VIDEO') videoUrl = ''; // Se carga bajo demanda en GameDetailModal
              else if (def.tipo === 'BEZEL') bezelUrl = blobUrl;
              else if (def.tipo === 'BOXBACK') boxbackUrl = blobUrl;
              else if (def.tipo === 'MAP') mapUrl = blobUrl;
              else if (def.tipo === 'MANUAL') manualUrl = blobUrl;
            }
          }
        }

        // Caso Switch: Buscar DLCs y Updates reales con titleId
        if (esSwitch && physicalFile) {
          const baseSwitch = physicalFile.name.replace(/\.[^/.]+$/, '').toLowerCase();
          const matchId = baseSwitch.match(/\[([0-9a-fA-F]{16})\]/);
          const titleIdPrefix = matchId ? matchId[1].toLowerCase().substring(0, 13) : '';

          for (const [k, f] of archivosMap.entries()) {
            if (f === physicalFile) continue;
            const isDlc = k.includes('[dlc]') || k.includes('[v');
            const matchesId = titleIdPrefix && k.includes(titleIdPrefix);

            if (matchesId || (k.startsWith(baseSwitch) && isDlc)) {
              dependencias.push({
                tipo: k.includes('[dlc]') ? 'SWITCH_DLC' : 'SWITCH_UPDATE',
                nombreArchivo: f.name,
                rutaCompleta: `./${f.name}`,
                tamanoBytes: f.size,
              });
              tamanoTotal += f.size;
              procesadosFisicos.add(k);
            }
          }
        }

        const gameId = node.getAttribute('id') || undefined;
        const name = node.getElementsByTagName('name')[0]?.textContent?.trim() || fileName.replace(/\.[^/.]+$/, '');
        const desc = node.getElementsByTagName('desc')[0]?.textContent?.trim() || 'Sin descripción registrada.';
        const releaseDate = node.getElementsByTagName('releasedate')[0]?.textContent?.trim() || '';
        const developer = node.getElementsByTagName('developer')[0]?.textContent?.trim() || 'Desconocido';
        const publisher = node.getElementsByTagName('publisher')[0]?.textContent?.trim() || '';
        const family = node.getElementsByTagName('family')[0]?.textContent?.trim() || '';
        const rating = node.getElementsByTagName('rating')[0]?.textContent?.trim() || '';
        const playcount = node.getElementsByTagName('playcount')[0]?.textContent?.trim() || '';
        const lastplayed = node.getElementsByTagName('lastplayed')[0]?.textContent?.trim() || '';
        const gametime = node.getElementsByTagName('gametime')[0]?.textContent?.trim() || '';
        const lang = node.getElementsByTagName('lang')[0]?.textContent?.trim() || '';
        const genre = node.getElementsByTagName('genre')[0]?.textContent?.trim() || 'Varios';
        const players = node.getElementsByTagName('players')[0]?.textContent?.trim() || '1 Jugador';
        const rawRegion = node.getElementsByTagName('region')[0]?.textContent?.trim() || extractRegionFromName(fileName);

        lista.push({
          id: `${nombreSistema}_${fileNameLower}_${i}`,
          gameId,
          nombre: name,
          cleanTitle: cleanTitle(name),
          ruta: `./${fileName}`,
          rutaCompleta: physicalFile ? (physicalFile as any).webkitRelativePath || fileName : `./${fileName}`,
          sistema: nombreSistema,
          extension: ext,
          tamanoBytes: tamanoTotal,
          region: normalizeRegion(rawRegion),
          genero: genre,
          desarrollador: developer,
          publisher,
          family,
          rating,
          playcount,
          lastplayed,
          gametime,
          lang,
          releasedate: releaseDate,
          anio: extractYear(releaseDate),
          descripcion: desc,
          imagen: thumbUrl || coverUrl,
          video: videoUrl,
          jugadores: players.includes('Jugador') ? players : `${players} Jugador(es)`,
          esVerificado: true,
          esCarpetaOEnlazado: ext === '.game',
          dependencias,
          rutaImage: coverUrl,
          rutaThumb: thumbUrl || coverUrl,
          rutaMarquee: marqueeUrl,
          rutaFanart: fanartUrl,
          rutaBezel: bezelUrl,
          rutaBoxback: boxbackUrl,
          rutaMap: mapUrl,
          rutaManual: manualUrl,
        });
      }
    } catch (e) {
      console.warn('Error al procesar gamelist.xml:', e);
    }
  }

  // PASO 3: Archivos físicos restantes que NO estaban en el gamelist.xml
  const extOmitir = new Set(['.xml', '.txt', '.db', '.log', '.ini', '.git', '.json', '.bat', '.sh']);
  const extMedia = new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mkv', '.avi', '.pdf']);

  for (const [nameLower, file] of archivosMap.entries()) {
    if (procesadosFisicos.has(nameLower) || archivosOmitirPorDependencia.has(nameLower)) continue;

    const ext = nameLower.includes('.') ? nameLower.substring(nameLower.lastIndexOf('.')) : '';
    if (extOmitir.has(ext) || extMedia.has(ext)) continue;

    if (esXbox360 && ext === '.xex') continue;
    if (esWindows && ext !== '.game' && ext !== '.m3u') continue;
    if (esPs3Ps4 && (ext === '.bin' || ext === '.sfo' || ext === '.edat')) continue;

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    let tamanoTotal = file.size;
    const dependencias: DependenciaItem[] = [];

    if (ext === '.m3u' && diccM3uDeps.has(nameLower)) {
      const m3uItems = diccM3uDeps.get(nameLower) || [];
      dependencias.push(...m3uItems);
      tamanoTotal += m3uItems.reduce((acc, d) => acc + d.tamanoBytes, 0);
    }

    // Buscar multimedia física con el mismo nombre base
    let coverUrl = '';
    const imgExts = ['.png', '.jpg', '.jpeg', '.webp'];
    for (const ie of imgExts) {
      const match1 = archivosMap.get(`${baseName.toLowerCase()}-image${ie}`);
      const match2 = archivosMap.get(`${baseName.toLowerCase()}${ie}`);
      const matchImg = match1 || match2;
      if (matchImg) {
        dependencias.push({
          tipo: 'IMAGE',
          nombreArchivo: matchImg.name,
          rutaCompleta: `./images/${matchImg.name}`,
          tamanoBytes: matchImg.size,
        });
        tamanoTotal += matchImg.size;
        coverUrl = URL.createObjectURL(matchImg);
        putMediaBlob(`${nombreSistema}__${matchImg.name.toLowerCase()}`, matchImg).catch(() => {});
        break;
      }
    }

    lista.push({
      id: `${nombreSistema}_${nameLower}_auto`,
      nombre: baseName,
      cleanTitle: cleanTitle(baseName),
      ruta: `./${file.name}`,
      rutaCompleta: (file as any).webkitRelativePath || file.name,
      sistema: nombreSistema,
      extension: ext,
      tamanoBytes: tamanoTotal,
      region: normalizeRegion(extractRegionFromName(file.name)),
      genero: 'Varios',
      desarrollador: 'Desconocido',
      anio: '',
      descripcion: 'Juego detectado directamente desde el almacenamiento físico.',
      imagen: coverUrl,
      rutaImage: coverUrl,
      rutaThumb: coverUrl,
      dependencias,
    });
  }

  return lista;
}

/**
 * Escáner optimizado para carpetas completas de RetroBat (roms/) o sistemas individuales
 */
export async function escanearDirectorioCompleto(
  files: FileList | File[],
  onProgress?: ScanProgressCallback
): Promise<Juego[]> {
  const fileArray = Array.from(files);
  const total = fileArray.length;

  // Organizar archivos por sistema
  // Ruta esperada: roms/<sistema>/archivo o <sistema>/archivo o archivo directo
  const sistemasMap = new Map<string, { archivos: Map<string, File>; xmlFile?: File }>();

  for (let i = 0; i < total; i++) {
    const f = fileArray[i];
    const rel = (f as any).webkitRelativePath || f.name;
    const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);

    // Determinar nombre del sistema
    let sysName = 'custom';
    if (parts.length >= 3 && parts[0].toLowerCase() === 'roms') {
      sysName = parts[1].toLowerCase();
    } else if (parts.length >= 2) {
      sysName = parts[0].toLowerCase();
    }

    if (!sistemasMap.has(sysName)) {
      sistemasMap.set(sysName, { archivos: new Map() });
    }

    const sysObj = sistemasMap.get(sysName)!;
    const fileName = f.name.toLowerCase();

    sourceFileRegistry.registerFile(sysName, f.name, f);

    if (fileName === 'gamelist.xml') {
      sysObj.xmlFile = f;
    } else {
      sysObj.archivos.set(fileName, f);
    }

    if (onProgress && i % 50 === 0) {
      onProgress({
        fase: 'Organizando archivos por consola',
        sistemaActual: sysName,
        juegosEncontrados: 0,
        archivosProcesados: i + 1,
        mensaje: `Catalogando ${f.name} en [${sysName.toUpperCase()}]...`,
      });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const allGames: Juego[] = [];
  const systemNames = Array.from(sistemasMap.keys()).sort();

  for (let sIdx = 0; sIdx < systemNames.length; sIdx++) {
    const sys = systemNames[sIdx];
    const sysData = sistemasMap.get(sys)!;

    if (onProgress) {
      onProgress({
        fase: `Escaneando sistema (${sIdx + 1} de ${systemNames.length})`,
        sistemaActual: sys.toUpperCase(),
        juegosEncontrados: allGames.length,
        archivosProcesados: total,
        mensaje: `Analizando ${sysData.archivos.size} archivos y gamelist.xml de [${sys.toUpperCase()}]...`,
      });
      await new Promise((r) => setTimeout(r, 0));
    }

    const sysGames = await escanearSistemaEstructurado(sys, sysData.archivos, sysData.xmlFile, onProgress);
    allGames.push(...sysGames);
  }

  return processDuplicates1G1R(allGames);
}

export function parseGamelistXml(
  xmlContent: string,
  sistemaNombre: string
): Juego[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
  const gameNodes = xmlDoc.getElementsByTagName('game');
  const result: Juego[] = [];

  for (let i = 0; i < gameNodes.length; i++) {
    const node = gameNodes[i];
    if (node.getElementsByTagName('hidden')[0]?.textContent?.trim() === 'true') continue;

    const rawPath = node.getElementsByTagName('path')[0]?.textContent?.trim() || '';
    if (!rawPath) continue;

    const cleanPath = rawPath.replace(/^\.\//, '').replace(/\\/g, '/');
    const fileName = cleanPath.split('/').pop() || cleanPath;
    const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase() : '';

    const gameId = node.getAttribute('id') || undefined;
    const name = node.getElementsByTagName('name')[0]?.textContent?.trim() || fileName.replace(/\.[^/.]+$/, '');
    const desc = node.getElementsByTagName('desc')[0]?.textContent?.trim() || 'Sin descripción registrada.';
    const image = node.getElementsByTagName('image')[0]?.textContent?.trim() || '';
    const thumbnail = node.getElementsByTagName('thumbnail')[0]?.textContent?.trim() || '';
    const video = node.getElementsByTagName('video')[0]?.textContent?.trim() || '';
    const marquee = node.getElementsByTagName('marquee')[0]?.textContent?.trim() || '';
    const fanart = node.getElementsByTagName('fanart')[0]?.textContent?.trim() || '';
    const manual = node.getElementsByTagName('manual')[0]?.textContent?.trim() || '';
    const bezel = node.getElementsByTagName('bezel')[0]?.textContent?.trim() || '';
    const boxback = node.getElementsByTagName('boxback')[0]?.textContent?.trim() || '';
    const map = node.getElementsByTagName('map')[0]?.textContent?.trim() || '';
    const releaseDate = node.getElementsByTagName('releasedate')[0]?.textContent?.trim() || '';
    const developer = node.getElementsByTagName('developer')[0]?.textContent?.trim() || 'Desconocido';
    const publisher = node.getElementsByTagName('publisher')[0]?.textContent?.trim() || '';
    const family = node.getElementsByTagName('family')[0]?.textContent?.trim() || '';
    const rating = node.getElementsByTagName('rating')[0]?.textContent?.trim() || '';
    const playcount = node.getElementsByTagName('playcount')[0]?.textContent?.trim() || '';
    const lastplayed = node.getElementsByTagName('lastplayed')[0]?.textContent?.trim() || '';
    const gametime = node.getElementsByTagName('gametime')[0]?.textContent?.trim() || '';
    const lang = node.getElementsByTagName('lang')[0]?.textContent?.trim() || '';
    const genre = node.getElementsByTagName('genre')[0]?.textContent?.trim() || 'Varios';
    const players = node.getElementsByTagName('players')[0]?.textContent?.trim() || '1 Jugador';
    const rawRegion = node.getElementsByTagName('region')[0]?.textContent?.trim() || extractRegionFromName(fileName);

    const dependencias: DependenciaItem[] = [];
    if (image) dependencias.push({ tipo: 'IMAGE', nombreArchivo: image, rutaCompleta: image, tamanoBytes: 0 });
    if (thumbnail) dependencias.push({ tipo: 'THUMB', nombreArchivo: thumbnail, rutaCompleta: thumbnail, tamanoBytes: 0 });
    if (video) dependencias.push({ tipo: 'VIDEO', nombreArchivo: video, rutaCompleta: video, tamanoBytes: 0 });
    if (marquee) dependencias.push({ tipo: 'MARQUEE', nombreArchivo: marquee, rutaCompleta: marquee, tamanoBytes: 0 });
    if (fanart) dependencias.push({ tipo: 'FANART', nombreArchivo: fanart, rutaCompleta: fanart, tamanoBytes: 0 });
    if (manual) dependencias.push({ tipo: 'MANUAL', nombreArchivo: manual, rutaCompleta: manual, tamanoBytes: 0 });
    if (bezel) dependencias.push({ tipo: 'BEZEL', nombreArchivo: bezel, rutaCompleta: bezel, tamanoBytes: 0 });
    if (boxback) dependencias.push({ tipo: 'BOXBACK', nombreArchivo: boxback, rutaCompleta: boxback, tamanoBytes: 0 });
    if (map) dependencias.push({ tipo: 'MAP', nombreArchivo: map, rutaCompleta: map, tamanoBytes: 0 });

    result.push({
      id: `${sistemaNombre}_${fileName}_${i}`,
      gameId,
      nombre: name,
      cleanTitle: cleanTitle(name),
      ruta: `./${fileName}`,
      rutaCompleta: `./${fileName}`,
      sistema: sistemaNombre,
      extension: ext,
      tamanoBytes: 0,
      region: normalizeRegion(rawRegion),
      genero: genre,
      desarrollador: developer,
      publisher,
      family,
      rating,
      playcount,
      lastplayed,
      gametime,
      lang,
      releasedate: releaseDate,
      anio: extractYear(releaseDate),
      descripcion: desc,
      imagen: thumbnail || image,
      video: video,
      jugadores: players.includes('Jugador') ? players : `${players} Jugador(es)`,
      esVerificado: true,
      esCarpetaOEnlazado: ext === '.game',
      dependencias,
      rutaImage: image || thumbnail,
      rutaThumb: thumbnail || image,
      rutaMarquee: marquee,
      rutaFanart: fanart,
      rutaManual: manual,
      rutaBezel: bezel,
      rutaBoxback: boxback,
      rutaMap: map,
    });
  }

  return processDuplicates1G1R(result);
}
