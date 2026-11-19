// --- Constants ---

const dbName = "TacstemVideosDB";
const storeName = "videos";
const projectStoreName = "projects";
const handlesStoreName = "handles";
const batchStoreName = "batches";
const boardProjectStoreName = "board_projects";

let cachedDbPromise: Promise<IDBDatabase> | null = null;
const sessionVideoFiles = new Map<string, File>();
const encodedImageSourceCache = new WeakMap<object, string>();

export const cacheVideoFileInMemory = (id: string, file: File) => {
  if (id && file && file.size > 0) {
    sessionVideoFiles.set(id, file);
  }
};

export const getCachedVideoFile = (id: string): File | null => {
  const cached = sessionVideoFiles.get(id);
  return cached && cached.size > 0 ? cached : null;
};

const openDB = (): Promise<IDBDatabase> => {
  if (cachedDbPromise) return cachedDbPromise;
  cachedDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 6);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
      if (!db.objectStoreNames.contains(projectStoreName)) {
        db.createObjectStore(projectStoreName);
      }
      if (!db.objectStoreNames.contains(handlesStoreName)) {
        db.createObjectStore(handlesStoreName);
      }
      if (!db.objectStoreNames.contains(batchStoreName)) {
        db.createObjectStore(batchStoreName);
      }
      if (!db.objectStoreNames.contains(boardProjectStoreName)) {
        db.createObjectStore(boardProjectStoreName);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        cachedDbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      cachedDbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn("IndexedDB open blocked");
    };
  });
  return cachedDbPromise;
};

export const saveFileHandle = async (projectId: string, handle: any) => {
  try {
      const db = await openDB();
      return new Promise<void>((resolve, reject) => {
          const tx = db.transaction(handlesStoreName, "readwrite");
          const store = tx.objectStore(handlesStoreName);
          store.put(handle, projectId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
      });
  } catch (e) {
      console.error("Local save error:", e);
  }
};

export const loadFileHandle = async (projectId: string): Promise<any | null> => {
  try {
      const db = await openDB();
      return new Promise<any | null>((resolve, reject) => {
          const tx = db.transaction(handlesStoreName, "readonly");
          const store = tx.objectStore(handlesStoreName);
          const request = store.get(projectId);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
      });
  } catch {
      return null;
  }
};

async function getOPFSVideosDir(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      return await root.getDirectoryHandle('tacstem_videos', { create: true });
    } catch (e) {
      console.warn("[OPFS] Directory handle error:", e);
    }
  }
  return null;
}

export const saveVideoLocally = async (id: string, file: File) => {
  cacheVideoFileInMemory(id, file);
  let savedToOPFS = false;

  // 1. Primary: Save to OPFS (Origin Private File System)
  try {
    const dir = await getOPFSVideosDir();
    if (dir) {
      const fileHandle = await dir.getFileHandle(`${id}.mp4`, { create: true });
      if ('createWritable' in fileHandle) {
        const writable = await (fileHandle as any).createWritable();
        await writable.write(file);
        await writable.close();
        savedToOPFS = true;
        console.log(`[Storage] Saved video ${id} (${file.name}) to OPFS successfully.`);
      }
    }
  } catch (e) {
    console.warn("[Storage] OPFS save failed, falling back to IndexedDB:", e);
  }

  // 2. Backup: Save to IndexedDB
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        if (savedToOPFS) resolve();
        else reject(tx.error);
      };
    });
  } catch (e) {
    if (!savedToOPFS) {
      console.error("Local video save error:", e);
    }
  }
};

export const loadVideoLocally = async (id: string): Promise<File | null> => {
    const cached = getCachedVideoFile(id);
    if (cached) return cached;

    // 1. Check OPFS first (instant, high performance)
    try {
      const dir = await getOPFSVideosDir();
      if (dir) {
        try {
          const fileHandle = await dir.getFileHandle(`${id}.mp4`, { create: false });
          const file = await fileHandle.getFile();
          if (file && file.size > 0) {
            cacheVideoFileInMemory(id, file);
            return file;
          }
        } catch {
          // Not found in OPFS
        }
      }
    } catch (e) {
      console.warn("[Storage] OPFS load error:", e);
    }

    // 2. Fallback to IndexedDB
    try {
        const db = await openDB();
        return new Promise<File | null>((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => {
              const result = (request.result as File) || null;
              if (result && result.size > 0) {
                cacheVideoFileInMemory(id, result);
              }
              resolve(result);
            };
            request.onerror = () => reject(request.error);
        });
    } catch {
        return null;
    }
};

export const getAllStoredVideoIds = async (): Promise<string[]> => {
    const ids = new Set<string>();

    // 1. OPFS keys
    try {
      const dir = await getOPFSVideosDir();
      if (dir) {
        for await (const name of (dir as any).keys()) {
          if (typeof name === 'string') {
            ids.add(name.replace(/\.mp4$/i, ''));
          }
        }
      }
    } catch (e) {
      console.warn("[Storage] OPFS keys error:", e);
    }

    // 2. IndexedDB keys
    try {
        const db = await openDB();
        const idbKeys = await new Promise<string[]>((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const request = store.getAllKeys();
            request.onsuccess = () => {
                const keys = request.result || [];
                resolve(keys.map(k => String(k)));
            };
            request.onerror = () => reject(request.error);
        });
        idbKeys.forEach(k => ids.add(k));
    } catch {}

    return Array.from(ids);
};

export const hasVideoLocally = async (id: string): Promise<boolean> => {
    if (getCachedVideoFile(id)) return true;
    // Check OPFS
    try {
      const dir = await getOPFSVideosDir();
      if (dir) {
        try {
          await dir.getFileHandle(`${id}.mp4`, { create: false });
          return true;
        } catch {}
      }
    } catch {}

    // Check IndexedDB
    try {
        const db = await openDB();
        return new Promise<boolean>((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const request = store.count(id);
            request.onsuccess = () => resolve((request.result || 0) > 0);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return false;
    }
};

export const requestPersistentStorage = async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        try {
            const isPersisted = await navigator.storage.persist();
            return isPersisted;
        } catch (e) {
            console.warn("[Storage] Persistent storage request error:", e);
        }
    }
    return false;
};

function encodeVisualSourceOnce(src: any): any {
  if (!src) return src;
  if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) {
    const cached = encodedImageSourceCache.get(src);
    if (cached) return cached;
    try {
      const dataUrl = src.toDataURL('image/png');
      encodedImageSourceCache.set(src, dataUrl);
      return dataUrl;
    } catch {
      return undefined;
    }
  }
  if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) {
    const cached = encodedImageSourceCache.get(src);
    if (cached) return cached;
    try {
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(src, 0, 0);
        const dataUrl = c.toDataURL('image/png');
        encodedImageSourceCache.set(src, dataUrl);
        return dataUrl;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) {
    return src.src;
  }
  return src;
}

export function sanitizeShapeForStorage(shape: any): any {
  if (!shape || typeof shape !== 'object') return shape;
  if (!shape.img && !shape.bgImg) return shape;

  const nextImg = shape.img ? encodeVisualSourceOnce(shape.img) : shape.img;
  const nextBgImg = shape.bgImg ? encodeVisualSourceOnce(shape.bgImg) : shape.bgImg;

  if (nextImg === shape.img && nextBgImg === shape.bgImg) {
    return shape;
  }

  return {
    ...shape,
    img: nextImg,
    bgImg: nextBgImg,
  };
}

export function sanitizeProjectForStorage(project: any): any {
  if (!project || typeof project !== 'object') return project;
  try {
    const clone = { ...project };
    if (clone.data && typeof clone.data === 'object') {
      clone.data = { ...clone.data };
      if (Array.isArray(clone.data.shapes)) {
        clone.data.shapes = clone.data.shapes.map(sanitizeShapeForStorage);
      }
    } else if (Array.isArray(clone.shapes)) {
      clone.shapes = clone.shapes.map(sanitizeShapeForStorage);
    }
    return clone;
  } catch (err) {
    console.warn("[Storage] Error sanitizing project:", err);
    return project;
  }
}

function getActiveOwnerIdSafe(): string | undefined {
    try {
        const id = localStorage.getItem('tacstem_current_user_id_v2');
        return id || undefined;
    } catch {
        return undefined;
    }
}

function emitDbMutationSafe(action: string, extra: Record<string, any>) {
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tacstem_db_mutated', { detail: { action, ...extra } }));
        }
    } catch {
        // Silent guard
    }
}

export type DbMutationEvent = { action: string; [key: string]: any };

export function subscribeDbMutationSafe(callback: (event: DbMutationEvent) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = (e: any) => {
        if (e.detail) callback(e.detail);
    };
    window.addEventListener('tacstem_db_mutated', handler);
    return () => window.removeEventListener('tacstem_db_mutated', handler);
}

export const saveProjectDataLocally = async (id: string, data: any) => {
    if (!id || !data) return;
    const sanitizedData = sanitizeProjectForStorage(data);
    if (sanitizedData && typeof sanitizedData === 'object' && (!sanitizedData.ownerId || sanitizedData.ownerId === 'guest')) {
        const currentOwner = getActiveOwnerIdSafe();
        if (currentOwner) sanitizedData.ownerId = currentOwner;
    }

    // 1. Save to localStorage for instant backup & fallback
    try {
        const existingRaw = localStorage.getItem('tacstem_projects');
        let projList: any[] = existingRaw ? JSON.parse(existingRaw) : [];
        const idx = projList.findIndex((p: any) => p.id === id);
        if (idx >= 0) {
            projList[idx] = sanitizedData;
        } else {
            projList.push(sanitizedData);
        }
        localStorage.setItem('tacstem_projects', JSON.stringify(projList));
    } catch (e) {
        console.warn("localStorage project save backup error:", e);
    }

    // 2. Save to IndexedDB
    try {
        const db = await openDB();
        await new Promise<void>((resolve) => {
            try {
                const tx = db.transaction(projectStoreName, "readwrite");
                const store = tx.objectStore(projectStoreName);
                const req = store.put(sanitizedData, id);
                req.onsuccess = () => resolve();
                req.onerror = (err) => {
                    console.warn("[Storage] store.put error:", err);
                    resolve();
                };
                tx.oncomplete = () => resolve();
                tx.onerror = (err) => {
                    console.warn("[Storage] tx error:", err);
                    resolve();
                };
            } catch (innerErr) {
                console.warn("[Storage] put error:", innerErr);
                resolve();
            }
        });
    } catch (e) {
        console.error("Local save error:", e);
    }
    emitDbMutationSafe('project_saved', { id, payload: sanitizedData });
};

export const listProjectsLocally = async (): Promise<any[]> => {
    let idbProjects: any[] = [];
    try {
        const db = await openDB();
        idbProjects = await new Promise<any[]>((resolve, reject) => {
            const tx = db.transaction(projectStoreName, "readonly");
            const store = tx.objectStore(projectStoreName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn("IndexedDB listProjects error:", e);
    }

    let lsProjects: any[] = [];
    try {
        const raw = localStorage.getItem('tacstem_projects');
        if (raw) lsProjects = JSON.parse(raw);
    } catch (e) {
        console.warn("localStorage listProjects error:", e);
    }

    // Merge IndexedDB and localStorage projects by ID (latest modified wins)
    const map = new Map<string, any>();
    for (const p of lsProjects) {
        if (p && p.id) map.set(p.id, p);
    }
    for (const p of idbProjects) {
        if (p && p.id) {
            const existing = map.get(p.id);
            if (!existing || (p.lastModified || 0) >= (existing.lastModified || 0)) {
                map.set(p.id, p);
            }
        }
    }

    const merged = Array.from(map.values());
    if (merged.length > 0) {
        try {
            localStorage.setItem('tacstem_projects', JSON.stringify(merged));
        } catch {}
    }
    return merged;
};

export const deleteProjectLocally = async (id: string) => {
    sessionVideoFiles.delete(id);
    try {
        const dir = await getOPFSVideosDir();
        if (dir) {
            try {
                await dir.removeEntry(`${id}.mp4`);
            } catch {}
        }
    } catch {}

    try {
        const raw = localStorage.getItem('tacstem_projects');
        if (raw) {
            const filtered = JSON.parse(raw).filter((p: any) => p.id !== id);
            localStorage.setItem('tacstem_projects', JSON.stringify(filtered));
        }
    } catch {}

    try {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction([projectStoreName, storeName, handlesStoreName], "readwrite");
            tx.objectStore(projectStoreName).delete(id);
            tx.objectStore(storeName).delete(id);
            tx.objectStore(handlesStoreName).delete(id);
            tx.oncomplete = () => {
                emitDbMutationSafe('project_deleted', { id });
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Local delete error:", e);
        emitDbMutationSafe('project_deleted', { id });
    }
};

export const saveBatchLocally = async (batch: any) => {
    try {
        if (batch && typeof batch === 'object' && (!batch.ownerId || batch.ownerId === 'guest')) {
            const currentOwner = getActiveOwnerIdSafe();
            if (currentOwner) batch.ownerId = currentOwner;
        }
        // Also persist in localStorage for instant fallback
        const existingRaw = localStorage.getItem('tacstem_batches');
        let batchesList = existingRaw ? JSON.parse(existingRaw) : [];
        const idx = batchesList.findIndex((b: any) => b.id === batch.id);
        if (idx >= 0) {
            batchesList[idx] = batch;
        } else {
            batchesList.push(batch);
        }
        localStorage.setItem('tacstem_batches', JSON.stringify(batchesList));

        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(batchStoreName, "readwrite");
            const store = tx.objectStore(batchStoreName);
            store.put(batch, batch.id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("Local batch save error:", e);
    }
    emitDbMutationSafe('batch_mutated', { id: batch?.id });
};

export const listBatchesLocally = async (): Promise<any[]> => {
    try {
        const db = await openDB();
        const idbBatches = await new Promise<any[]>((resolve, reject) => {
            const tx = db.transaction(batchStoreName, "readonly");
            const store = tx.objectStore(batchStoreName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });

        if (idbBatches && idbBatches.length > 0) {
            return idbBatches;
        }
    } catch {
        // Fallback to localStorage
    }

    try {
        const raw = localStorage.getItem('tacstem_batches');
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const deleteBatchLocally = async (id: string) => {
    try {
        const existingRaw = localStorage.getItem('tacstem_batches');
        if (existingRaw) {
            const batchesList = JSON.parse(existingRaw).filter((b: any) => b.id !== id);
            localStorage.setItem('tacstem_batches', JSON.stringify(batchesList));
        }

        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(batchStoreName, "readwrite");
            tx.objectStore(batchStoreName).delete(id);
            tx.oncomplete = () => {
                emitDbMutationSafe('batch_mutated', { id });
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("Local batch delete error:", e);
        emitDbMutationSafe('batch_mutated', { id });
    }
};

// --- Tactical Board Projects Storage ---

export const saveBoardProjectLocally = async (boardProject: any) => {
    try {
        if (boardProject && typeof boardProject === 'object' && (!boardProject.ownerId || boardProject.ownerId === 'guest')) {
            const currentOwner = getActiveOwnerIdSafe();
            if (currentOwner) boardProject.ownerId = currentOwner;
        }
        const existingRaw = localStorage.getItem('tacstem_board_projects');
        let projectsList = existingRaw ? JSON.parse(existingRaw) : [];
        const idx = projectsList.findIndex((p: any) => p.id === boardProject.id);
        if (idx >= 0) {
            projectsList[idx] = boardProject;
        } else {
            projectsList.push(boardProject);
        }
        localStorage.setItem('tacstem_board_projects', JSON.stringify(projectsList));

        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(boardProjectStoreName, "readwrite");
            const store = tx.objectStore(boardProjectStoreName);
            store.put(boardProject, boardProject.id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("Local board project save error:", e);
    }
    emitDbMutationSafe('board_saved', { id: boardProject?.id, payload: boardProject });
};

export const listBoardProjectsLocally = async (): Promise<any[]> => {
    try {
        const db = await openDB();
        const idbProjects = await new Promise<any[]>((resolve, reject) => {
            const tx = db.transaction(boardProjectStoreName, "readonly");
            const store = tx.objectStore(boardProjectStoreName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });

        if (idbProjects && idbProjects.length > 0) {
            return idbProjects;
        }
    } catch {
        // Fallback to localStorage
    }

    try {
        const raw = localStorage.getItem('tacstem_board_projects');
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const getBoardProjectLocally = async (id: string): Promise<any | null> => {
    try {
        const db = await openDB();
        const project = await new Promise<any | null>((resolve, reject) => {
            const tx = db.transaction(boardProjectStoreName, "readonly");
            const store = tx.objectStore(boardProjectStoreName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });

        if (project) return project;
    } catch {
        // Fallback
    }

    try {
        const raw = localStorage.getItem('tacstem_board_projects');
        if (raw) {
            const list = JSON.parse(raw);
            return list.find((p: any) => p.id === id) || null;
        }
    } catch {
        // ignore
    }
    return null;
};

export const deleteBoardProjectLocally = async (id: string) => {
    try {
        const existingRaw = localStorage.getItem('tacstem_board_projects');
        if (existingRaw) {
            const projectsList = JSON.parse(existingRaw).filter((p: any) => p.id !== id);
            localStorage.setItem('tacstem_board_projects', JSON.stringify(projectsList));
        }

        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(boardProjectStoreName, "readwrite");
            tx.objectStore(boardProjectStoreName).delete(id);
            tx.oncomplete = () => {
                emitDbMutationSafe('board_deleted', { id });
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("Local board project delete error:", e);
        emitDbMutationSafe('board_deleted', { id });
    }
};


