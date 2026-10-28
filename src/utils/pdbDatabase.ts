/**
 * Local .pdb Database Manager for RetroBat Game Manager.
 * Stores and loads entire game libraries, metadata, collections, and cache paths
 * in a high-speed structured portable database (.pdb) file.
 */

import { ColeccionPersonalizada, Juego } from '../types';

export interface PdbDatabasePayload {
  magic: 'RETROBAT_PDB_v1';
  version: string;
  createdAt: string;
  updatedAt: string;
  appVersion: string;
  stats: {
    totalJuegos: number;
    totalSistemas: number;
    totalBytes: number;
    totalM3u: number;
    totalDuplicados: number;
  };
  config: {
    baseDirName?: string;
    databaseFileName: string;
    cacheImagesDir: string;
    cacheVideosDir: string;
    preferredRegion: string;
  };
  sistemas: string[];
  colecciones: ColeccionPersonalizada[];
  juegos: Juego[];
}

const PDB_MAGIC = 'RETROBAT_PDB_v1';
export const DEFAULT_PDB_FILENAME = 'retrobat_library.pdb';

/**
 * Serializes games and collections into a structured .pdb binary blob
 */
export function generatePdbBinary(
  juegos: Juego[],
  colecciones: ColeccionPersonalizada[] = [],
  appDirName?: string
): Blob {
  const sistemas = Array.from(new Set(juegos.map((j) => j.sistema))).sort();
  const totalBytes = juegos.reduce((acc, j) => acc + (j.tamanoBytes || 0), 0);
  const totalM3u = juegos.filter((j) => j.extension?.toLowerCase() === '.m3u').length;
  const totalDuplicados = juegos.filter((j) => j.esDuplicado).length;

  // Clean games before persisting to .pdb (strip ephemeral blob: URLs so file remains pristine)
  const cleanGames: Juego[] = juegos.map((j) => ({
    ...j,
    imagen: j.imagen?.startsWith('blob:') ? undefined : j.imagen,
    rutaThumb: j.rutaThumb?.startsWith('blob:') ? undefined : j.rutaThumb,
    rutaImage: j.rutaImage?.startsWith('blob:') ? undefined : j.rutaImage,
    rutaMarquee: j.rutaMarquee?.startsWith('blob:') ? undefined : j.rutaMarquee,
    rutaFanart: j.rutaFanart?.startsWith('blob:') ? undefined : j.rutaFanart,
    video: j.video?.startsWith('blob:') ? undefined : j.video,
  }));

  const payload: PdbDatabasePayload = {
    magic: PDB_MAGIC,
    version: '1.2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    appVersion: '2.4.0',
    stats: {
      totalJuegos: cleanGames.length,
      totalSistemas: sistemas.length,
      totalBytes,
      totalM3u,
      totalDuplicados,
    },
    config: {
      baseDirName: appDirName || 'RetroBat_Manager_Local',
      databaseFileName: DEFAULT_PDB_FILENAME,
      cacheImagesDir: 'cache/images',
      cacheVideosDir: 'cache/videos',
      preferredRegion: 'ES',
    },
    sistemas,
    colecciones,
    juegos: cleanGames,
  };

  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(jsonStr);

  // PDB Header: 16 bytes magic + 8 bytes payload length + JSON payload
  const header = new TextEncoder().encode(PDB_MAGIC.padEnd(16, '\0'));
  const lengthBuffer = new Uint8Array(8);
  new DataView(lengthBuffer.buffer).setBigUint64(0, BigInt(jsonBytes.byteLength), false);

  const combined = new Uint8Array(header.length + lengthBuffer.length + jsonBytes.length);
  combined.set(header, 0);
  combined.set(lengthBuffer, header.length);
  combined.set(jsonBytes, header.length + lengthBuffer.length);

  return new Blob([combined], { type: 'application/octet-stream' });
}

/**
 * Parses a .pdb database file into games, collections and config
 */
export async function parsePdbBinary(
  data: ArrayBuffer | Blob | string
): Promise<{ juegos: Juego[]; colecciones: ColeccionPersonalizada[]; config: any; stats: any }> {
  let jsonString = '';

  if (typeof data === 'string') {
    jsonString = data;
  } else if (data instanceof Blob) {
    const buffer = await data.arrayBuffer();
    return parsePdbArrayBuffer(buffer);
  } else if (data instanceof ArrayBuffer) {
    return parsePdbArrayBuffer(data);
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.magic === PDB_MAGIC || Array.isArray(parsed.juegos) || Array.isArray(parsed)) {
      const juegos = Array.isArray(parsed) ? parsed : parsed.juegos || [];
      const colecciones = parsed.colecciones || [];
      return {
        juegos,
        colecciones,
        config: parsed.config || {},
        stats: parsed.stats || {},
      };
    }
  } catch (e) {
    throw new Error('Archivo .pdb no válido o corrupto');
  }

  throw new Error('Formato .pdb desconocido');
}

function parsePdbArrayBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');

  // Check magic header (first 16 bytes)
  const magicCandidate = decoder.decode(bytes.slice(0, 16)).trim().replace(/\0/g, '');
  if (magicCandidate === PDB_MAGIC) {
    const jsonBytes = bytes.slice(24);
    const jsonStr = decoder.decode(jsonBytes);
    const payload = JSON.parse(jsonStr) as PdbDatabasePayload;
    return {
      juegos: payload.juegos || [],
      colecciones: payload.colecciones || [],
      config: payload.config || {},
      stats: payload.stats || {},
    };
  }

  // Fallback direct JSON in .pdb container
  const rawText = decoder.decode(bytes);
  const parsed = JSON.parse(rawText);
  return {
    juegos: Array.isArray(parsed) ? parsed : parsed.juegos || [],
    colecciones: parsed.colecciones || [],
    config: parsed.config || {},
    stats: parsed.stats || {},
  };
}

/**
 * Saves .pdb database directly to connected local program directory handle
 */
export async function savePdbToDirectoryHandle(
  dirHandle: any,
  juegos: Juego[],
  colecciones: ColeccionPersonalizada[] = [],
  filename: string = DEFAULT_PDB_FILENAME
): Promise<{ success: boolean; bytesWritten: number }> {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    const pdbBlob = generatePdbBinary(juegos, colecciones, dirHandle.name);
    await writable.write(pdbBlob);
    await writable.close();
    return { success: true, bytesWritten: pdbBlob.size };
  } catch (err: any) {
    console.error('Error saving .pdb to directory handle:', err);
    throw err;
  }
}

/**
 * Reads .pdb database directly from connected local program directory handle
 */
export async function readPdbFromDirectoryHandle(
  dirHandle: any,
  filename: string = DEFAULT_PDB_FILENAME
): Promise<{ juegos: Juego[]; colecciones: ColeccionPersonalizada[]; config: any; stats: any } | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await parsePdbBinary(file);
  } catch {
    return null;
  }
}

/**
 * Triggers a direct browser download of the .pdb database file
 */
export function downloadPdbDatabaseFile(
  juegos: Juego[],
  colecciones: ColeccionPersonalizada[] = [],
  filename: string = DEFAULT_PDB_FILENAME
): void {
  const blob = generatePdbBinary(juegos, colecciones);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
