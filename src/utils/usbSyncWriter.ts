/**
 * Real USB and Local Disk File Transfer Engine using File System Access API.
 * Physically writes system directories, real ROM files, gamelist.xml and media to destination drive.
 */

import { DependenciaItem, Juego } from '../types';
import { getMediaBlob } from './mediaCache';
import { parseGamelistXml } from './scannerEngine';
import { sourceFileRegistry } from './sourceFileRegistry';

export interface FileCopyProgressCallback {
  (update: {
    juegoIdx: number;
    totalJuegos: number;
    juegoNombre: string;
    archivoActual: string;
    bytesCopiadosIncrement: number;
    log: { time: string; msg: string; type: 'info' | 'success' | 'warn' | 'error' | 'skip' };
  }): void;
}

export async function writeFilesToDestinationDirectory(
  destHandle: any, // FileSystemDirectoryHandle
  juegos: Juego[],
  syncGamelist: boolean,
  includeMedia: boolean,
  onProgress: FileCopyProgressCallback,
  isCancelled: () => boolean
): Promise<{ totalCopied: number; totalErrors: number }> {
  let totalCopied = 0;
  let totalErrors = 0;
  const processedSystems = new Set<string>();

  for (let i = 0; i < juegos.length; i++) {
    if (isCancelled()) break;

    const j = juegos[i];
    const sysName = j.sistema || 'custom';

    try {
      // 1. Create or get system directory: <dest>/<sistema>/
      const sysDirHandle = await destHandle.getDirectoryHandle(sysName, { create: true });

      // 2. Incremental sync / merge gamelist.xml once per system
      if (syncGamelist && !processedSystems.has(sysName)) {
        processedSystems.add(sysName);
        try {
          // Read existing destination gamelist.xml if present so we NEVER wipe previously transferred games!
          let existingGamesOnDest: Juego[] = [];
          try {
            const existingGamelistFile = await sysDirHandle.getFileHandle('gamelist.xml');
            const file = await existingGamelistFile.getFile();
            const text = await file.text();
            if (text && text.includes('<gameList>')) {
              existingGamesOnDest = parseGamelistXml(text, sysName);
            }
          } catch {
            // Brand new destination gamelist.xml
          }

          // Merge: preserve all previously transferred games on destination, update/append new transfers
          const mergedMap = new Map<string, Juego>();
          for (const eg of existingGamesOnDest) {
            const k = (eg.ruta || eg.nombre).replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase().trim();
            mergedMap.set(k, eg);
          }
          const sysNewGames = juegos.filter((x) => x.sistema === sysName);
          for (const ng of sysNewGames) {
            const k = (ng.ruta || ng.nombre).replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase().trim();
            mergedMap.set(k, ng);
          }

          const finalGamesList = Array.from(mergedMap.values());
          const gamelistHandle = await sysDirHandle.getFileHandle('gamelist.xml', { create: true });
          const writable = await gamelistHandle.createWritable();
          const xmlContent = generateCleanGamelistXml(finalGamesList);
          await writable.write(xmlContent);
          await writable.close();

          const preservedCount = existingGamesOnDest.length;
          onProgress({
            juegoIdx: i + 1,
            totalJuegos: juegos.length,
            juegoNombre: j.nombre,
            archivoActual: `${sysName}/gamelist.xml`,
            bytesCopiadosIncrement: xmlContent.length,
            log: {
              time: new Date().toLocaleTimeString(),
              msg: `📄 gamelist.xml actualizado: ${finalGamesList.length} títulos totales (${preservedCount} preservados + ${sysNewGames.length} transferidos)`,
              type: 'info',
            },
          });
        } catch (e: any) {
          console.warn('Could not write gamelist.xml to disk', e);
        }
      }

      if (isCancelled()) break;

      // 3. Write main ROM file entry (STREAMING REAL BYTES)
      const mainFileName = j.ruta.replace(/^\.\//, '').split('/').pop() || `${j.nombre}${j.extension || '.rom'}`;
      try {
        if (j.extension?.toLowerCase() === '.m3u') {
          // Actual .m3u playlist text with CRLF line breaks
          const fileHandle = await sysDirHandle.getFileHandle(mainFileName, { create: true });
          const writable = await fileHandle.createWritable();
          const m3uLines = j.dependencias
            .filter((d) => d.tipo === 'DISC')
            .map((d) => d.nombreArchivo)
            .join('\r\n');
          await writable.write(m3uLines || `# M3U Playlist for ${j.nombre}\r\n${mainFileName.replace(/\.m3u$/i, '.cue')}`);
          await writable.close();
          totalCopied++;
          onProgress({
            juegoIdx: i + 1,
            totalJuegos: juegos.length,
            juegoNombre: j.nombre,
            archivoActual: `${sysName}/${mainFileName}`,
            bytesCopiadosIncrement: 512,
            log: {
              time: new Date().toLocaleTimeString(),
              msg: `✅ Lista de discos M3U escrita: ${sysName}/${mainFileName}`,
              type: 'success',
            },
          });
        } else {
          // Resolve real physical file either from in-memory registry OR from physical source directory handle
          const realSourceFile = await sourceFileRegistry.resolvePhysicalFile(sysName, mainFileName);

          if (realSourceFile) {
            const fileHandle = await sysDirHandle.getFileHandle(mainFileName, { create: true });
            const writable = await fileHandle.createWritable();
            // Stream the real file in chunks with responsive cancellation
            const stream = realSourceFile.stream();
            const reader = stream.getReader();
            let fileWrittenBytes = 0;

            try {
              while (true) {
                if (isCancelled()) {
                  try {
                    await reader.cancel();
                  } catch {}
                  break;
                }
                const { done, value } = await reader.read();
                if (done) break;

                await writable.write(value);
                fileWrittenBytes += value.byteLength;

                onProgress({
                  juegoIdx: i + 1,
                  totalJuegos: juegos.length,
                  juegoNombre: j.nombre,
                  archivoActual: `${sysName}/${mainFileName}`,
                  bytesCopiadosIncrement: value.byteLength,
                  log: {
                    time: new Date().toLocaleTimeString(),
                    msg: `Escribiendo ${mainFileName} (${(fileWrittenBytes / (1024 * 1024)).toFixed(1)} MB)...`,
                    type: 'info',
                  },
                });

                // Yield to event loop to keep UI 100% smooth and reactive
                await new Promise((r) => setTimeout(r, 0));
              }
            } finally {
              await writable.close();
            }

            if (!isCancelled()) {
              totalCopied++;
              onProgress({
                juegoIdx: i + 1,
                totalJuegos: juegos.length,
                juegoNombre: j.nombre,
                archivoActual: `${sysName}/${mainFileName}`,
                bytesCopiadosIncrement: 0,
                log: {
                  time: new Date().toLocaleTimeString(),
                  msg: `✅ ROM completa copiada en disco (${(fileWrittenBytes / (1024 * 1024)).toFixed(1)} MB): ${sysName}/${mainFileName}`,
                  type: 'success',
                },
              });
            }
          } else {
            totalErrors++;
            onProgress({
              juegoIdx: i + 1,
              totalJuegos: juegos.length,
              juegoNombre: j.nombre,
              archivoActual: mainFileName,
              bytesCopiadosIncrement: 0,
              log: {
                time: new Date().toLocaleTimeString(),
                msg: `⚠️ Archivo físico no encontrado en carpeta origen: "${mainFileName}". Vincula la carpeta origen de ROMs para transferir los gigabytes reales.`,
                type: 'error',
              },
            });
          }
        }
      } catch (e: any) {
        totalErrors++;
        onProgress({
          juegoIdx: i + 1,
          totalJuegos: juegos.length,
          juegoNombre: j.nombre,
          archivoActual: mainFileName,
          bytesCopiadosIncrement: 0,
          log: {
            time: new Date().toLocaleTimeString(),
            msg: `❌ Error al escribir ${mainFileName}: ${e.message || e}`,
            type: 'error',
          },
        });
      }

      if (isCancelled()) break;

      // 4. Write game content dependencies (DISC, SWITCH updates/DLCs, PS3/PC folders) and media files
      if (j.dependencias && j.dependencias.length > 0) {
        for (const dep of j.dependencias) {
          if (isCancelled()) break;

          const isGameData =
            ['DISC', 'SWITCH_DLC', 'SWITCH_UPDATE', 'PS3_FOLDER', 'WIN_FOLDER', 'EXTRA_FILE'].includes(dep.tipo) ||
            dep.nombreArchivo.endsWith('.chd') ||
            dep.nombreArchivo.endsWith('.iso') ||
            dep.nombreArchivo.endsWith('.cue') ||
            dep.nombreArchivo.endsWith('.bin') ||
            dep.nombreArchivo.endsWith('.nsp') ||
            dep.nombreArchivo.endsWith('.nsz') ||
            dep.nombreArchivo.endsWith('.xci') ||
            dep.nombreArchivo.endsWith('.pkg');

          // If it's media and user opted out of media, skip it
          if (!isGameData && !includeMedia) continue;

          try {
            const depFileName = dep.nombreArchivo.split('/').pop() || dep.nombreArchivo;

            if (isGameData) {
              // A) Directory / Folder dependency (PS3 folder game like BLES01234 or PC folder game)
              const isFolderDep =
                dep.tipo === 'PS3_FOLDER' ||
                dep.tipo === 'WIN_FOLDER' ||
                dep.nombreArchivo.endsWith('/') ||
                !dep.nombreArchivo.includes('.');

              if (isFolderDep) {
                const folderName = dep.nombreArchivo.replace(/\/$/, '').split('/').pop() || dep.nombreArchivo;
                const sourceDirHandle =
                  sourceFileRegistry.resolvePhysicalFolder(sysName, folderName) ||
                  sourceFileRegistry.resolvePhysicalFolder(sysName, dep.nombreArchivo);

                if (sourceDirHandle) {
                  const targetFolderHandle = await sysDirHandle.getDirectoryHandle(folderName, { create: true });
                  const copiedCount = await copyDirectoryRecursive(
                    sourceDirHandle,
                    targetFolderHandle,
                    isCancelled,
                    (fileName, bytes) => {
                      onProgress({
                        juegoIdx: i + 1,
                        totalJuegos: juegos.length,
                        juegoNombre: j.nombre,
                        archivoActual: `${sysName}/${folderName}/${fileName}`,
                        bytesCopiadosIncrement: bytes,
                        log: {
                          time: new Date().toLocaleTimeString(),
                          msg: `   ↳ 📁 [Carpeta ${dep.tipo}] ${folderName}/${fileName} (${(bytes / 1024).toFixed(0)} KB)`,
                          type: 'info',
                        },
                      });
                    }
                  );
                  totalCopied++;
                  onProgress({
                    juegoIdx: i + 1,
                    totalJuegos: juegos.length,
                    juegoNombre: j.nombre,
                    archivoActual: `${sysName}/${folderName}`,
                    bytesCopiadosIncrement: 0,
                    log: {
                      time: new Date().toLocaleTimeString(),
                      msg: `✅ Carpeta de juego transferida por completo (${copiedCount} archivos): ${folderName}`,
                      type: 'success',
                    },
                  });
                } else {
                  totalErrors++;
                  onProgress({
                    juegoIdx: i + 1,
                    totalJuegos: juegos.length,
                    juegoNombre: j.nombre,
                    archivoActual: dep.nombreArchivo,
                    bytesCopiadosIncrement: 0,
                    log: {
                      time: new Date().toLocaleTimeString(),
                      msg: `⚠️ Carpeta física no encontrada en origen: "${dep.nombreArchivo}". Vincula la carpeta correspondiente en el detalle del juego.`,
                      type: 'error',
                    },
                  });
                }
                continue;
              }

              // B) Disc / DLC / Update / Extra File
              const realDepFile =
                (await sourceFileRegistry.resolvePhysicalFile(sysName, dep.nombreArchivo)) ||
                (await sourceFileRegistry.resolvePhysicalFile(sysName, depFileName)) ||
                sourceFileRegistry.getFile(sysName, depFileName);

              if (realDepFile) {
                // Game content files belong directly in the system ROM folder (or matching subpath)
                let targetDir = sysDirHandle;
                let targetFileName = depFileName;

                if (dep.nombreArchivo.includes('/') && !dep.nombreArchivo.startsWith('http')) {
                  const parts = dep.nombreArchivo.replace(/^\.\//, '').split('/');
                  targetFileName = parts.pop() || depFileName;
                  for (const part of parts) {
                    if (part && part !== '.') {
                      targetDir = await targetDir.getDirectoryHandle(part, { create: true });
                    }
                  }
                }

                const depHandle = await targetDir.getFileHandle(targetFileName, { create: true });
                const writable = await depHandle.createWritable();
                const stream = realDepFile.stream();
                const reader = stream.getReader();
                let depWrittenBytes = 0;

                try {
                  while (true) {
                    if (isCancelled()) {
                      try {
                        await reader.cancel();
                      } catch {}
                      break;
                    }
                    const { done, value } = await reader.read();
                    if (done) break;
                    await writable.write(value);
                    depWrittenBytes += value.byteLength;
                    onProgress({
                      juegoIdx: i + 1,
                      totalJuegos: juegos.length,
                      juegoNombre: j.nombre,
                      archivoActual: `${sysName}/${targetFileName}`,
                      bytesCopiadosIncrement: value.byteLength,
                      log: {
                        time: new Date().toLocaleTimeString(),
                        msg: `Escribiendo ${dep.tipo}: ${targetFileName} (${(depWrittenBytes / (1024 * 1024)).toFixed(1)} MB)...`,
                        type: 'info',
                      },
                    });
                    await new Promise((r) => setTimeout(r, 0));
                  }
                } finally {
                  await writable.close();
                }

                if (!isCancelled()) {
                  totalCopied++;
                  onProgress({
                    juegoIdx: i + 1,
                    totalJuegos: juegos.length,
                    juegoNombre: j.nombre,
                    archivoActual: `${sysName}/${targetFileName}`,
                    bytesCopiadosIncrement: 0,
                    log: {
                      time: new Date().toLocaleTimeString(),
                      msg: `✅ [${dep.tipo}] Archivo físico completo copiado (${(depWrittenBytes / (1024 * 1024)).toFixed(1)} MB): ${targetFileName}`,
                      type: 'success',
                    },
                  });
                }
              } else {
                totalErrors++;
                onProgress({
                  juegoIdx: i + 1,
                  totalJuegos: juegos.length,
                  juegoNombre: j.nombre,
                  archivoActual: depFileName,
                  bytesCopiadosIncrement: 0,
                  log: {
                    time: new Date().toLocaleTimeString(),
                    msg: `⚠️ Archivo físico de ${dep.tipo} no encontrado: "${depFileName}". Por favor agrégalo o vincúlalo en el detalle del juego.`,
                    type: 'error',
                  },
                });
              }
            } else {
              // C) Strictly Media files (images/, videos/, manuals/) - NEVER written in root ROM folder!
              let folderName = 'images';
              if (dep.tipo === 'VIDEO') folderName = 'videos';
              else if (dep.tipo === 'MANUAL') folderName = 'manuals';

              const targetDir = await sysDirHandle.getDirectoryHandle(folderName, { create: true });
              const depHandle = await targetDir.getFileHandle(depFileName, { create: true });
              const writable = await depHandle.createWritable();

              // Check memory registry or physical folder
              const realDepFile =
                sourceFileRegistry.getFile(sysName, depFileName) ||
                (await sourceFileRegistry.resolvePhysicalFile(sysName, depFileName));

              if (realDepFile) {
                const stream = realDepFile.stream();
                const reader = stream.getReader();
                try {
                  while (true) {
                    if (isCancelled()) {
                      try {
                        await reader.cancel();
                      } catch {}
                      break;
                    }
                    const { done, value } = await reader.read();
                    if (done) break;
                    await writable.write(value);
                    await new Promise((r) => setTimeout(r, 0));
                  }
                } finally {
                  await writable.close();
                }
              } else {
                // Check if cached blob exists in IndexedDB
                const cachedBlob =
                  (await getMediaBlob(`${sysName.toLowerCase()}__${depFileName.toLowerCase()}`)) ||
                  (await getMediaBlob(`${sysName.toLowerCase()}__${cleanBaseMediaName(depFileName)}`));

                if (cachedBlob) {
                  await writable.write(cachedBlob);
                }
                await writable.close();
              }

              if (!isCancelled()) {
                totalCopied++;
                onProgress({
                  juegoIdx: i + 1,
                  totalJuegos: juegos.length,
                  juegoNombre: j.nombre,
                  archivoActual: `${sysName}/${folderName}/${depFileName}`,
                  bytesCopiadosIncrement: dep.tamanoBytes || 1024,
                  log: {
                    time: new Date().toLocaleTimeString(),
                    msg: `   ↳ [${dep.tipo}] ${folderName}/${depFileName}`,
                    type: 'info',
                  },
                });
              }
            }
          } catch (e: any) {
            console.warn('Could not write dependency', dep, e);
          }
        }
      }
    } catch (err: any) {
      totalErrors++;
      onProgress({
        juegoIdx: i + 1,
        totalJuegos: juegos.length,
        juegoNombre: j.nombre,
        archivoActual: 'Error de directorio',
        bytesCopiadosIncrement: 0,
        log: {
          time: new Date().toLocaleTimeString(),
          msg: `❌ Error en sistema ${sysName}: ${err.message || err}`,
          type: 'error',
        },
      });
    }
  }

  return { totalCopied, totalErrors };
}

/**
 * Recursively copies an entire directory handle to another directory handle.
 */
async function copyDirectoryRecursive(
  sourceDir: any,
  targetDir: any,
  isCancelled: () => boolean,
  onFileProgress: (fileName: string, bytes: number) => void
): Promise<number> {
  let count = 0;
  for await (const entry of sourceDir.values()) {
    if (isCancelled()) break;
    if (entry.kind === 'file') {
      try {
        const file = await entry.getFile();
        const targetFileHandle = await targetDir.getFileHandle(entry.name, { create: true });
        const writable = await targetFileHandle.createWritable();
        const stream = file.stream();
        const reader = stream.getReader();
        try {
          while (true) {
            if (isCancelled()) {
              try {
                await reader.cancel();
              } catch {}
              break;
            }
            const { done, value } = await reader.read();
            if (done) break;
            await writable.write(value);
          }
        } finally {
          await writable.close();
        }
        count++;
        onFileProgress(entry.name, file.size);
      } catch (err) {
        console.warn(`Error copying file ${entry.name} in folder`, err);
      }
    } else if (entry.kind === 'directory') {
      const nextTargetDir = await targetDir.getDirectoryHandle(entry.name, { create: true });
      count += await copyDirectoryRecursive(entry, nextTargetDir, isCancelled, onFileProgress);
    }
  }
  return count;
}

function cleanBaseMediaName(fileName: string): string {
  return fileName.replace(/^\.\//, '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';
}

/**
 * Generates 100% compliant, standard EmulationStation / RetroBat gamelist.xml.
 * Never writes internal blob: or http: URLs; strictly formats relative paths starting with ./
 */
export function generateCleanGamelistXml(games: Juego[]): string {
  const items = games
    .map((g) => {
      const romFileName = g.ruta.replace(/^\.\//, '').replace(/\\/g, '/').split('/').pop() || `${g.nombre}${g.extension || ''}`;
      const romBaseName = romFileName.replace(/\.[^/.]+$/, '');

      // Resolve relative path for each media tag - NEVER write blob: into XML!
      const resolveMediaPath = (declaredPath: string | undefined, tag: string, ext: string = '.png'): string => {
        if (declaredPath && !declaredPath.startsWith('blob:') && !declaredPath.startsWith('http')) {
          return declaredPath.startsWith('./') ? declaredPath : `./${declaredPath}`;
        }
        // Check if matching dependency exists
        if (g.dependencias && g.dependencias.length > 0) {
          const match = g.dependencias.find((d) => d.tipo === tag.toUpperCase());
          if (match && match.rutaCompleta && !match.rutaCompleta.startsWith('blob:')) {
            const clean = match.rutaCompleta.replace(/^\.\//, '').replace(/\\/g, '/');
            return `./${clean}`;
          }
        }
        // Standard RetroBat conventions
        if (tag === 'video') return `./videos/${romBaseName}-video.mp4`;
        if (tag === 'manual') return `./manuals/${romBaseName}-manual.pdf`;
        if (tag === 'fanart') return `./images/${romBaseName}-fanart.jpg`;
        if (tag === 'thumbnail') return `./images/${romBaseName}-thumb.png`;
        if (tag === 'marquee') return `./images/${romBaseName}-marquee.png`;
        if (tag === 'bezel') return `./images/${romBaseName}-bezel.png`;
        if (tag === 'boxback') return `./images/${romBaseName}-boxback.png`;
        if (tag === 'map') return `./images/${romBaseName}-map.jpg`;
        return `./images/${romBaseName}-image${ext}`;
      };

      const imagePath = resolveMediaPath(g.rutaImage, 'image');
      const thumbPath = resolveMediaPath(g.rutaThumb, 'thumbnail');
      const marqueePath = resolveMediaPath(g.rutaMarquee, 'marquee');
      const fanartPath = resolveMediaPath(g.rutaFanart, 'fanart', '.jpg');
      const videoPath = g.video ? resolveMediaPath(g.video, 'video', '.mp4') : '';
      const manualPath = g.rutaManual ? resolveMediaPath(g.rutaManual, 'manual', '.pdf') : '';
      const bezelPath = g.rutaBezel ? resolveMediaPath(g.rutaBezel, 'bezel') : '';
      const boxbackPath = g.rutaBoxback ? resolveMediaPath(g.rutaBoxback, 'boxback') : '';
      const mapPath = g.rutaMap ? resolveMediaPath(g.rutaMap, 'map', '.jpg') : '';

      const idAttr = g.gameId ? ` id="${escapeXml(g.gameId)}"` : '';
      const releaseDateVal = g.releasedate || (g.anio ? `${g.anio}0101T000000` : '');

      return `\t<game${idAttr}>
\t\t<path>./${escapeXml(romFileName)}</path>
\t\t<name>${escapeXml(g.nombre)}</name>
\t\t<desc>${escapeXml(g.descripcion)}</desc>
\t\t<genre>${escapeXml(g.genero || 'Varios')}</genre>
\t\t<image>${escapeXml(imagePath)}</image>
\t\t<thumbnail>${escapeXml(thumbPath)}</thumbnail>
\t\t<marquee>${escapeXml(marqueePath)}</marquee>
\t\t<fanart>${escapeXml(fanartPath)}</fanart>${videoPath ? `\n\t\t<video>${escapeXml(videoPath)}</video>` : ''}${manualPath ? `\n\t\t<manual>${escapeXml(manualPath)}</manual>` : ''}${bezelPath ? `\n\t\t<bezel>${escapeXml(bezelPath)}</bezel>` : ''}${boxbackPath ? `\n\t\t<boxback>${escapeXml(boxbackPath)}</boxback>` : ''}${mapPath ? `\n\t\t<map>${escapeXml(mapPath)}</map>` : ''}${g.rating ? `\n\t\t<rating>${escapeXml(String(g.rating))}</rating>` : ''}${releaseDateVal ? `\n\t\t<releasedate>${escapeXml(releaseDateVal)}</releasedate>` : ''}
\t\t<developer>${escapeXml(g.desarrollador || 'Desconocido')}</developer>${g.publisher ? `\n\t\t<publisher>${escapeXml(g.publisher)}</publisher>` : ''}${g.family ? `\n\t\t<family>${escapeXml(g.family)}</family>` : ''}
\t\t<players>${escapeXml(g.jugadores || '1')}</players>${g.playcount ? `\n\t\t<playcount>${escapeXml(String(g.playcount))}</playcount>` : ''}${g.lastplayed ? `\n\t\t<lastplayed>${escapeXml(g.lastplayed)}</lastplayed>` : ''}${g.gametime ? `\n\t\t<gametime>${escapeXml(String(g.gametime))}</gametime>` : ''}${g.lang ? `\n\t\t<lang>${escapeXml(g.lang)}</lang>` : ''}
\t\t<region>${escapeXml(g.region || 'Global')}</region>
\t</game>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gameList>\n${items}\n</gameList>`;
}

function escapeXml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
