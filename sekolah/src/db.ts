import { dekripsiJson, enkripsiJson, type Bungkus } from './security/crypto'
// Lapisan penyimpanan. Saat ini memakai IndexedDB lokal (berjalan sama di browser dan di Electron).
// Seluruh akses data melewati interface `Backend` agar kelak bisa diganti adaptor server (REST/SQL)
// untuk pemakaian multi-pengguna tanpa mengubah halaman-halaman aplikasi.
import { COLLECTIONS, type CollectionName, type Collections } from './types'

export interface Backend {
  loadAll(): Promise<{ [K in CollectionName]: Collections[K][] }>
  put<K extends CollectionName>(col: K, doc: Collections[K]): Promise<void>
  remove(col: CollectionName, id: string): Promise<void>
  clear(): Promise<void>
}

const DB_NAME = 'simas-sekolah'
const DB_VERSION = 3 // v2: tanah, bangunan, ruang, pengajuan · v3: arsip (administrasi)

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

export class IndexedDbBackend implements Backend {
  private dbp: Promise<IDBDatabase>
  constructor(name = DB_NAME) {
    this.dbp = new Promise((res, rej) => {
      const open = indexedDB.open(name, DB_VERSION)
      open.onupgradeneeded = () => {
        const db = open.result
        for (const c of COLLECTIONS) if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' })
      }
      open.onsuccess = () => res(open.result)
      open.onerror = () => rej(open.error)
    })
  }
  async loadAll() {
    const db = await this.dbp
    const tx = db.transaction(COLLECTIONS, 'readonly')
    const out = {} as { [K in CollectionName]: Collections[K][] }
    await Promise.all(COLLECTIONS.map(async (c) => {
      ;(out as Record<string, unknown>)[c] = await req(tx.objectStore(c).getAll())
    }))
    return out
  }
  async put<K extends CollectionName>(col: K, doc: Collections[K]) {
    const db = await this.dbp
    await req(db.transaction(col, 'readwrite').objectStore(col).put(doc))
  }
  async remove(col: CollectionName, id: string) {
    const db = await this.dbp
    await req(db.transaction(col, 'readwrite').objectStore(col).delete(id))
  }
  async clear() {
    const db = await this.dbp
    const tx = db.transaction(COLLECTIONS, 'readwrite')
    await Promise.all(COLLECTIONS.map((c) => req(tx.objectStore(c).clear())))
  }
}

// ---------- Enkripsi data saat tersimpan (at-rest) ----------

type Rekaman = { id: string; _e?: Bungkus }

/**
 * Membungkus IndexedDB: setiap dokumen disimpan sebagai { id, _e: AES-256-GCM(JSON) } dengan AAD "koleksi|id".
 * Dokumen lama yang masih teks biasa otomatis dienkripsi saat pertama dimuat (migrasi).
 */
export class EncryptedBackend implements Backend {
  constructor(private inner: IndexedDbBackend, private key: CryptoKey) {}
  async loadAll() {
    const raw = (await this.inner.loadAll()) as unknown as Record<CollectionName, Rekaman[]>
    const out = {} as { [K in CollectionName]: Collections[K][] }
    for (const c of COLLECTIONS) {
      const list: unknown[] = []
      for (const r of raw[c]) {
        if (r._e) list.push(await dekripsiJson(r._e, this.key, `${c}|${r.id}`))
        else { list.push(r); await this.put(c, r as never) } // migrasi teks biasa → terenkripsi
      }
      ;(out as Record<string, unknown[]>)[c] = list
    }
    return out
  }
  async put<K extends CollectionName>(col: K, doc: Collections[K]) {
    const _e = await enkripsiJson(doc, this.key, `${col}|${doc.id}`)
    await this.inner.put(col, { id: doc.id, _e } as never)
  }
  remove(col: CollectionName, id: string) { return this.inner.remove(col, id) }
  clear() { return this.inner.clear() }
}
