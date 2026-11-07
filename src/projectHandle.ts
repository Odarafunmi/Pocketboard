/** The browser may revoke access at any time; a stored handle is not a permission grant. */
const DATABASE = 'pocketboard-project-files'
const STORE = 'handles'
const TOKEN = 'pocketboard-project-file-token'
let queue: Promise<void> = Promise.resolve()

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function rememberProjectHandle(handle: unknown | null) {
  let token: string | null = null
  try {
    if (handle) { token = crypto.randomUUID(); localStorage.setItem(TOKEN, token) }
    else localStorage.removeItem(TOKEN)
  } catch { return }
  const entry = handle ? { token, handle } : null
  // Serialize updates so a slow earlier save cannot restore a stale association.
  queue = queue.catch(() => {}).then(async () => {
    const db = await database()
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite')
        const store = transaction.objectStore(STORE)
        if (entry) store.put(entry, 'current'); else store.delete('current')
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    } finally { db.close() }
  }).catch(() => { /* Some browsers cannot persist file handles. The current session still works. */ })
}

export async function restoreProjectHandle<T>(): Promise<T | null> {
  try {
    const token = localStorage.getItem(TOKEN)
    if (!token) return null
    await queue
    const db = await database()
    try {
      const entry = await new Promise<{ token: string; handle: T } | undefined>((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get('current')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return entry?.token === token && localStorage.getItem(TOKEN) === token ? entry.handle : null
    } finally { db.close() }
  } catch { return null }
}
