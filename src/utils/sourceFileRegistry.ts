/**
 * In-memory and IndexedDB persistent registry for source files and source directory handles.
 * Allows reading real ROM files directly from physical disk or network share across app restarts,
 * completely preventing 1KB dummy file generation.
 */

const registry = new Map<string, File>();
let activeSourceDirHandle: any = null;

const IDB_NAME = 'RetroBatAppStorageDB';
const IDB_STORE = 'app_handles';
const IDB_KEY_SOURCE_DIR = 'source_roms_directory_handle';
const IDB_KEY_APP_DIR = 'local_app_directory_handle';

function makeKey(sistema: string, filename: string): string {
  const cleanSys = (sistema || '').toLowerCase().trim();
  const cleanName = (filename || '')
    .replace(/^\.\//, '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    .toLowerCase()
    .trim();
  return `${cleanSys}:::${cleanName}`;
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandleToDb(key: string, handle: any): Promise<void> {
  try {
    const db = await openHandleDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(handle, key);
  } catch (e) {
    console.warn('Could not persist directory handle to IndexedDB', e);
  }
}

export async function loadDirectoryHandleFromDb(key: string): Promise<any | null> {
  try {
    const db = await openHandleDb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

const registeredFolderHandles = new Map<string, any>();
let activeMediaCacheDirHandle: any = null;
const IDB_KEY_MEDIA_CACHE_DIR = 'custom_media_cache_directory_handle';

async function findFileInHandleDeep(rootHandle: any, relativePath: string): Promise<File | null> {
  const parts = relativePath.replace(/^\.\//, '').replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0) return null;

  let current = rootHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      current = await current.getDirectoryHandle(parts[i]);
    } catch {
      return null;
    }
  }

  try {
    const fh = await current.getFileHandle(parts[parts.length - 1]);
    return await fh.getFile();
  } catch {
    return null;
  }
}

export const sourceFileRegistry = {
  registerFile(sistema: string, filename: string, file: File): void {
    const key = makeKey(sistema, filename);
    registry.set(key, file);
    registry.set(file.name.toLowerCase(), file);
    // Also register full clean relative name if applicable
    const cleanFull = filename.replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase();
    registry.set(`${(sistema || '').toLowerCase()}:::${cleanFull}`, file);
  },

  registerBatch(sistema: string, files: File[]): void {
    for (const f of files) {
      this.registerFile(sistema, f.name, f);
    }
  },

  registerDirectoryHandle(sistema: string, folderName: string, handle: any): void {
    const key = makeKey(sistema, folderName);
    registeredFolderHandles.set(key, handle);
    registeredFolderHandles.set(folderName.toLowerCase(), handle);
  },

  getFile(sistema: string, filename: string): File | undefined {
    const key = makeKey(sistema, filename);
    if (registry.has(key)) return registry.get(key);

    const cleanFull = filename.replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase();
    const fullKey = `${(sistema || '').toLowerCase()}:::${cleanFull}`;
    if (registry.has(fullKey)) return registry.get(fullKey);

    const baseName = filename.replace(/^\.\//, '').replace(/\\/g, '/').split('/').pop()?.toLowerCase();
    if (baseName && registry.has(baseName)) return registry.get(baseName);

    if (baseName) {
      for (const [k, f] of registry.entries()) {
        if (k.endsWith(`:::${baseName}`) || f.name.toLowerCase() === baseName) {
          return f;
        }
      }
    }
    return undefined;
  },

  hasFile(sistema: string, filename: string): boolean {
    return !!this.getFile(sistema, filename);
  },

  setSourceDirectoryHandle(handle: any): void {
    activeSourceDirHandle = handle;
    if (handle) {
      saveDirectoryHandleToDb(IDB_KEY_SOURCE_DIR, handle);
    }
  },

  getSourceDirectoryHandle(): any {
    return activeSourceDirHandle;
  },

  async setAppDirectoryHandle(handle: any): Promise<void> {
    if (handle) {
      await saveDirectoryHandleToDb(IDB_KEY_APP_DIR, handle);
    }
  },

  async getAppDirectoryHandle(): Promise<any | null> {
    return await loadDirectoryHandleFromDb(IDB_KEY_APP_DIR);
  },

  async setMediaCacheDirectoryHandle(handle: any): Promise<void> {
    activeMediaCacheDirHandle = handle;
    if (handle) {
      await saveDirectoryHandleToDb(IDB_KEY_MEDIA_CACHE_DIR, handle);
    }
  },

  async getMediaCacheDirectoryHandle(): Promise<any | null> {
    if (activeMediaCacheDirHandle) return activeMediaCacheDirHandle;
    const saved = await loadDirectoryHandleFromDb(IDB_KEY_MEDIA_CACHE_DIR);
    if (saved) activeMediaCacheDirHandle = saved;
    return saved;
  },

  async initFromStorage(): Promise<{ sourceHandle: any | null; appHandle: any | null; mediaCacheHandle: any | null }> {
    const source = await loadDirectoryHandleFromDb(IDB_KEY_SOURCE_DIR);
    if (source) {
      activeSourceDirHandle = source;
    }
    const app = await loadDirectoryHandleFromDb(IDB_KEY_APP_DIR);
    const mediaCache = await loadDirectoryHandleFromDb(IDB_KEY_MEDIA_CACHE_DIR);
    if (mediaCache) {
      activeMediaCacheDirHandle = mediaCache;
    }
    return { sourceHandle: source, appHandle: app, mediaCacheHandle: mediaCache };
  },

  /**
   * Guarda un archivo multimedia en la carpeta de caché física si el usuario vinculó una carpeta propia
   */
  async saveToDiskCache(subfolder: 'images' | 'videos', filename: string, data: Blob): Promise<boolean> {
    try {
      const cacheHandle = (await this.getMediaCacheDirectoryHandle()) || (await this.getAppDirectoryHandle());
      if (!cacheHandle) return false;

      let targetSubDir = cacheHandle;
      try {
        const subDir = await cacheHandle.getDirectoryHandle(subfolder, { create: true });
        targetSubDir = subDir;
      } catch {
        targetSubDir = cacheHandle;
      }

      const fileHandle = await targetSubDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Lee un archivo multimedia desde la carpeta de caché propia si ya existe
   */
  async getFromDiskCache(subfolder: 'images' | 'videos', filename: string): Promise<Blob | null> {
    try {
      const cacheHandle = (await this.getMediaCacheDirectoryHandle()) || (await this.getAppDirectoryHandle());
      if (!cacheHandle) return null;

      try {
        const subDir = await cacheHandle.getDirectoryHandle(subfolder);
        const fileHandle = await subDir.getFileHandle(filename);
        return await fileHandle.getFile();
      } catch {
        const fileHandle = await cacheHandle.getFileHandle(filename);
        return await fileHandle.getFile();
      }
    } catch {
      return null;
    }
  },

  /**
   * Resuelve una carpeta física completa (ej. carpeta de juego de PS3 o Windows)
   */
  async resolvePhysicalFolder(sistema: string, folderName: string): Promise<any | null> {
    const key = makeKey(sistema, folderName);
    if (registeredFolderHandles.has(key)) return registeredFolderHandles.get(key);
    if (registeredFolderHandles.has(folderName.toLowerCase())) return registeredFolderHandles.get(folderName.toLowerCase());

    const dirHandle = activeSourceDirHandle;
    if (dirHandle) {
      const cleanName = folderName.replace(/^\.\//, '').replace(/\\/g, '/').split('/').pop() || folderName;
      const sysClean = (sistema || '').toLowerCase();

      // Check <dirHandle>/<sysClean>/<cleanName>
      try {
        const sysDir = await dirHandle.getDirectoryHandle(sysClean);
        return await sysDir.getDirectoryHandle(cleanName);
      } catch {}

      // Check <dirHandle>/roms/<sysClean>/<cleanName>
      try {
        const romsDir = await dirHandle.getDirectoryHandle('roms');
        const sysDir = await romsDir.getDirectoryHandle(sysClean);
        return await sysDir.getDirectoryHandle(cleanName);
      } catch {}

      // Check root <dirHandle>/<cleanName>
      try {
        return await dirHandle.getDirectoryHandle(cleanName);
      } catch {}
    }

    return null;
  },

  /**
   * Retrieves the physical File object either from memory or by reading the connected physical directory handle
   * Supports subfolder paths (e.g. M3U discs, Switch DLCs, and subfolder ROMs)
   */
  async resolvePhysicalFile(sistema: string, filename: string): Promise<File | null> {
    // 1. Check in-memory registry
    const inMem = this.getFile(sistema, filename);
    if (inMem) return inMem;

    // 2. Check source directory handle if connected
    const dirHandle = activeSourceDirHandle;
    if (dirHandle) {
      const rawClean = filename.replace(/^\.\//, '').replace(/\\/g, '/');
      const baseName = rawClean.split('/').pop() || rawClean;
      const sysClean = (sistema || '').toLowerCase();

      // Path options to test in priority order
      const attempts = [
        `${sysClean}/${rawClean}`,
        `roms/${sysClean}/${rawClean}`,
        `${sysClean}/${baseName}`,
        `roms/${sysClean}/${baseName}`,
        `${sysClean}/images/${baseName}`,
        rawClean,
        baseName,
      ];

      for (const attemptPath of attempts) {
        try {
          const f = await findFileInHandleDeep(dirHandle, attemptPath);
          if (f) {
            this.registerFile(sistema, baseName, f);
            this.registerFile(sistema, rawClean, f);
            return f;
          }
        } catch {}
      }
    }

    return null;
  },

  clear(): void {
    registry.clear();
    registeredFolderHandles.clear();
  },

  size(): number {
    return registry.size;
  },
};


