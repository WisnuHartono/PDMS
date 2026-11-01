// Kunci perangkat: kunci AES-GCM yang tidak dapat diekspor, disimpan di IndexedDB terpisah.
// Dipakai agar "Masuk dengan Google" dapat membuka kunci data di perangkat yang sudah dipercaya (opt-in per akun).
const NAMA = 'simas-kunci'
const dbp = (): Promise<IDBDatabase> => new Promise((ok, no) => {
  const r = indexedDB.open(NAMA, 1)
  r.onupgradeneeded = () => r.result.createObjectStore('k')
  r.onsuccess = () => ok(r.result)
  r.onerror = () => no(r.error)
})
const req = <T>(r: IDBRequest<T>) => new Promise<T>((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })

export async function buatKunciPerangkat(akunId: string): Promise<CryptoKey> {
  const key = await globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await req((await dbp()).transaction('k', 'readwrite').objectStore('k').put(key, akunId))
  return key
}
export async function ambilKunciPerangkat(akunId: string): Promise<CryptoKey | undefined> {
  return (await req((await dbp()).transaction('k').objectStore('k').get(akunId))) as CryptoKey | undefined
}
export async function hapusKunciPerangkat(akunId: string) {
  await req((await dbp()).transaction('k', 'readwrite').objectStore('k').delete(akunId))
}
