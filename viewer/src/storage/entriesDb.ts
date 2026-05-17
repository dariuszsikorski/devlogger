// @purpose IndexedDB persistent layer - LRU ~10k log entries + meta (heartbeat).
// Survives tab cold-kill on Android so we can rehydrate the stream on relaunch.
import type { StreamItem } from '../types'

const DB_NAME = 'devlogger-viewer'
const DB_VERSION = 1
const STORE_ENTRIES = 'entries'
const STORE_META = 'meta'

// Soft cap. Trim happens in batches so we don't pay the cursor cost on every put.
// Newer entries are NEVER blocked - we always insert first, then prune oldest.
const MAX_ENTRIES = 10_000
const TRIM_BATCH  = 500
const TRIM_HEADROOM = 200 // start trimming when count exceeds MAX + headroom

interface StoredEntry {
  id?: number
  item: StreamItem
}

interface StoredMeta {
  key: string
  value: unknown
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
        db.createObjectStore(STORE_ENTRIES, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  work: (t: IDBTransaction) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(stores, mode)
    t.oncomplete = () => resolve()
    t.onabort    = () => reject(t.error)
    t.onerror    = () => reject(t.error)
    try { work(t) } catch (err) { reject(err); try { t.abort() } catch { /* ignore */ } }
  })
}

export async function putEntries(items: StreamItem[]): Promise<void> {
  if (items.length === 0) return
  try {
    const db = await openDb()
    await tx(db, [STORE_ENTRIES], 'readwrite', (t) => {
      const s = t.objectStore(STORE_ENTRIES)
      for (const item of items) s.add({ item } satisfies StoredEntry)
    })
    void trimIfNeeded()
  } catch (err) {
    // Persistence is best-effort. Live stream still works without IDB.
    console.warn('[devlogger-viewer] putEntries failed:', err)
  }
}

async function trimIfNeeded(): Promise<void> {
  try {
    const db = await openDb()
    const count = await countEntries(db)
    if (count <= MAX_ENTRIES + TRIM_HEADROOM) return
    const toDelete = Math.min(count - MAX_ENTRIES, TRIM_BATCH)
    await tx(db, [STORE_ENTRIES], 'readwrite', (t) => {
      const s = t.objectStore(STORE_ENTRIES)
      const req = s.openCursor()
      let deleted = 0
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor || deleted >= toDelete) return
        cursor.delete()
        deleted += 1
        cursor.continue()
      }
    })
  } catch (err) {
    console.warn('[devlogger-viewer] trimIfNeeded failed:', err)
  }
}

function countEntries(db: IDBDatabase): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const req = db.transaction(STORE_ENTRIES, 'readonly').objectStore(STORE_ENTRIES).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function getAllEntries(): Promise<StreamItem[]> {
  try {
    const db = await openDb()
    return await new Promise<StreamItem[]>((resolve, reject) => {
      const req = db.transaction(STORE_ENTRIES, 'readonly').objectStore(STORE_ENTRIES).getAll()
      req.onsuccess = () => resolve((req.result as StoredEntry[]).map((r) => r.item))
      req.onerror   = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[devlogger-viewer] getAllEntries failed:', err)
    return []
  }
}

export async function clearEntries(): Promise<void> {
  try {
    const db = await openDb()
    await tx(db, [STORE_ENTRIES], 'readwrite', (t) => { t.objectStore(STORE_ENTRIES).clear() })
  } catch (err) {
    console.warn('[devlogger-viewer] clearEntries failed:', err)
  }
}

export async function getMeta<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb()
    return await new Promise<T | null>((resolve, reject) => {
      const req = db.transaction(STORE_META, 'readonly').objectStore(STORE_META).get(key)
      req.onsuccess = () => {
        const r = req.result as StoredMeta | undefined
        resolve(r ? (r.value as T) : null)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[devlogger-viewer] getMeta failed:', err)
    return null
  }
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb()
    await tx(db, [STORE_META], 'readwrite', (t) => {
      t.objectStore(STORE_META).put({ key, value } satisfies StoredMeta)
    })
  } catch (err) {
    console.warn('[devlogger-viewer] setMeta failed:', err)
  }
}
