/**
 * High-speed IndexedDB cache for game media (images, thumbnails, marquees, videos).
 * Enables instant loading without rescanning disk and persists across sessions.
 */

import { Juego } from '../types';

const DB_NAME = 'RetroBatMediaCacheDB';
const STORE_NAME = 'media_blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function putMediaBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Could not cache media blob', e);
  }
}

export async function getMediaBlob(key: string): Promise<Blob | null> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function hasMediaBlob(key: string): Promise<boolean> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count(key);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function clearMediaCache(): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Error clearing media cache', e);
  }
}

/**
 * Rehydrates ephemeral blob URLs from IndexedDB for games loaded from persistent storage.
 * Eliminates generic placeholder fallback when the app is refreshed or reopened.
 */
export async function rehydrateGameMedia(juegos: Juego[]): Promise<Juego[]> {
  try {
    const db = await getDb();
    const updated = await Promise.all(
      juegos.map(async (j) => {
        return await rehydrateSingleGameWithDb(db, j);
      })
    );
    return updated;
  } catch (e) {
    console.warn('Could not rehydrate media from IndexedDB:', e);
    return juegos;
  }
}

async function rehydrateSingleGameWithDb(db: IDBDatabase, j: Juego): Promise<Juego> {
  const sysLower = (j.sistema || 'custom').toLowerCase();
  const romBase = j.ruta.replace(/^\.\//, '').replace(/\.[^/.]+$/, '').toLowerCase();

  const getBlob = (key: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  };

  let newThumb = isLiveUrl(j.rutaThumb) ? j.rutaThumb : undefined;
  let newImage = isLiveUrl(j.rutaImage) ? j.rutaImage : undefined;
  let newMarquee = isLiveUrl(j.rutaMarquee) ? j.rutaMarquee : undefined;
  let newFanart = isLiveUrl(j.rutaFanart) ? j.rutaFanart : undefined;
  let newVideo = isLiveUrl(j.video) ? j.video : undefined;

  // 1. Try from registered dependencies
  if (j.dependencias && j.dependencias.length > 0) {
    for (const dep of j.dependencias) {
      const fileNameLower = dep.nombreArchivo.split('/').pop()?.toLowerCase() || '';
      if (!fileNameLower) continue;

      const blob = await getBlob(`${sysLower}__${fileNameLower}`);
      if (blob) {
        const freshUrl = URL.createObjectURL(blob);
        if (dep.tipo === 'THUMB') newThumb = freshUrl;
        else if (dep.tipo === 'IMAGE') newImage = freshUrl;
        else if (dep.tipo === 'MARQUEE') newMarquee = freshUrl;
        else if (dep.tipo === 'FANART') newFanart = freshUrl;
        else if (dep.tipo === 'VIDEO') newVideo = freshUrl;
      }
    }
  }

  // 2. Try conventional naming fallbacks if not found
  if (!newThumb) {
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const b =
        (await getBlob(`${sysLower}__${romBase}-thumb${ext}`)) ||
        (await getBlob(`${sysLower}__${romBase}-image${ext}`));
      if (b) {
        newThumb = URL.createObjectURL(b);
        break;
      }
    }
  }

  if (!newImage) {
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const b =
        (await getBlob(`${sysLower}__${romBase}-image${ext}`)) ||
        (await getBlob(`${sysLower}__${romBase}${ext}`));
      if (b) {
        newImage = URL.createObjectURL(b);
        break;
      }
    }
  }

  if (!newMarquee) {
    for (const ext of ['.png', '.jpg']) {
      const b = await getBlob(`${sysLower}__${romBase}-marquee${ext}`);
      if (b) {
        newMarquee = URL.createObjectURL(b);
        break;
      }
    }
  }

  if (!newFanart) {
    for (const ext of ['.jpg', '.png']) {
      const b = await getBlob(`${sysLower}__${romBase}-fanart${ext}`);
      if (b) {
        newFanart = URL.createObjectURL(b);
        break;
      }
    }
  }

  if (!newVideo) {
    for (const ext of ['.mp4', '.mkv']) {
      const b = await getBlob(`${sysLower}__${romBase}-video${ext}`);
      if (b) {
        newVideo = URL.createObjectURL(b);
        break;
      }
    }
  }

  return {
    ...j,
    rutaThumb: newThumb,
    rutaImage: newImage,
    rutaMarquee: newMarquee,
    rutaFanart: newFanart,
    video: newVideo,
    imagen: newThumb || newImage || (isLiveUrl(j.imagen) ? j.imagen : undefined),
  };
}

function isLiveUrl(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith('blob:')) return false; // Stored blob URLs are dead across reloads
  return url.startsWith('http') || url.startsWith('data:');
}

/**
 * Retrieves all cached media blobs from IndexedDB.
 */
export async function getAllMediaEntries(): Promise<Array<{ key: string; blob: Blob }>> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const results: Array<{ key: string; blob: Blob }> = [];

      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push({ key: String(cursor.key), blob: cursor.value as Blob });
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorReq.onerror = () => resolve(results);
    });
  } catch (err) {
    console.warn('Error reading all media entries', err);
    return [];
  }
}

/**
 * Physically exports all cached media (images and videos) to a real user-selected folder on disk.
 * Organizes into <targetFolder>/images/ and <targetFolder>/videos/.
 */
export async function exportAllMediaToDirectoryHandle(
  dirHandle: any,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ exportedCount: number; totalBytes: number }> {
  const entries = await getAllMediaEntries();
  if (entries.length === 0) return { exportedCount: 0, totalBytes: 0 };

  const imagesDir = await dirHandle.getDirectoryHandle('images', { create: true });
  const videosDir = await dirHandle.getDirectoryHandle('videos', { create: true });

  let exportedCount = 0;
  let totalBytes = 0;

  for (let i = 0; i < entries.length; i++) {
    const { key, blob } = entries[i];
    // Key format: `<sistema>__<filename>`
    const rawName = key.includes('__') ? key.split('__')[1] : key;
    const isVideo = rawName.endsWith('.mp4') || rawName.endsWith('.mkv') || rawName.endsWith('.avi') || blob.type.startsWith('video/');
    const targetDir = isVideo ? videosDir : imagesDir;

    try {
      const fileHandle = await targetDir.getFileHandle(rawName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      exportedCount++;
      totalBytes += blob.size;
      onProgress?.(i + 1, entries.length, rawName);
    } catch (e) {
      console.warn(`Could not export media file ${rawName}`, e);
    }
  }

  return { exportedCount, totalBytes };
}


