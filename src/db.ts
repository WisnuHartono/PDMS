// Penyimpanan lokal: metadata di localStorage, file (blob) di IndexedDB.
import type { AppState } from './types'

const LS_KEY = 'docontrol.state.v1'

export function loadLocal(): AppState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as AppState) : null
  } catch {
    return null
  }
}

export function saveLocal(s: AppState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch (e) {
    console.warn('Gagal menyimpan lokal', e)
  }
}

// Cadangan di memori bila IndexedDB tidak tersedia (mis. mode privat / pratinjau tersandbox).
const mem = new Map<string, Blob>()

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('docontrol-files', 2)
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains('files')) r.result.createObjectStore('files')
        if (!r.result.objectStoreNames.contains('handles')) r.result.createObjectStore('handles')
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    } catch (e) {
      rej(e)
    }
  })
}

export async function putFile(key: string, blob: Blob) {
  mem.set(key, blob)
  try {
    const db = await openDb()
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('files', 'readwrite')
      tx.objectStore('files').put(blob, key)
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
  } catch (e) {
    console.warn('IndexedDB tidak tersedia, file hanya disimpan sementara di memori', e)
  }
}

export async function getFile(key: string): Promise<Blob | undefined> {
  if (mem.has(key)) return mem.get(key)
  try {
    const db = await openDb()
    return await new Promise((res, rej) => {
      const r = db.transaction('files').objectStore('files').get(key)
      r.onsuccess = () => res(r.result as Blob | undefined)
      r.onerror = () => rej(r.error)
    })
  } catch {
    return undefined
  }
}

export async function deleteFile(key: string) {
  mem.delete(key)
  try {
    const db = await openDb()
    await new Promise<void>((res) => {
      const tx = db.transaction('files', 'readwrite')
      tx.objectStore('files').delete(key)
      tx.oncomplete = () => res()
      tx.onerror = () => res()
    })
  } catch {
    /* abaikan */
  }
}

// Handle folder lokal (File System Access API) disimpan di IndexedDB agar bisa dipakai lagi.
export async function putHandle(h: unknown) {
  const db = await openDb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').put(h, 'root')
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

export async function getHandle<T = any>(): Promise<T | undefined> {
  try {
    const db = await openDb()
    return await new Promise((res, rej) => {
      const r = db.transaction('handles').objectStore('handles').get('root')
      r.onsuccess = () => res(r.result as T | undefined)
      r.onerror = () => rej(r.error)
    })
  } catch {
    return undefined
  }
}

export async function deleteHandle() {
  try {
    const db = await openDb()
    await new Promise<void>((res) => {
      const tx = db.transaction('handles', 'readwrite')
      tx.objectStore('handles').delete('root')
      tx.oncomplete = () => res()
      tx.onerror = () => res()
    })
  } catch { /* abaikan */ }
}
