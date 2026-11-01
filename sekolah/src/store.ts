// State aplikasi di memori + sinkron ke Backend. Halaman memakai hook useCol().
import { useSyncExternalStore } from 'react'
import { IndexedDbBackend, type Backend } from './db'
import { COLLECTIONS, type CollectionName, type Collections, type Sekolah } from './types'

type State = { [K in CollectionName]: Collections[K][] }

const empty = (): State => Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as State

let backend: Backend | null = null
let state: State = empty()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export async function initStore(b: Backend = new IndexedDbBackend()) {
  backend = b
  state = await b.loadAll()
  emit()
}

export function getState() {
  return state
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useCol<K extends CollectionName>(col: K): Collections[K][] {
  return useSyncExternalStore(subscribe, () => state[col])
}

export async function put<K extends CollectionName>(col: K, doc: Collections[K]) {
  const list = state[col] as Collections[K][]
  const i = list.findIndex((d) => d.id === doc.id)
  const next = i >= 0 ? list.map((d, j) => (j === i ? doc : d)) : [...list, doc]
  state = { ...state, [col]: next }
  emit()
  await backend?.put(col, doc)
}

export async function putMany<K extends CollectionName>(col: K, docs: Collections[K][]) {
  for (const d of docs) await put(col, d)
}

export async function remove(col: CollectionName, id: string) {
  state = { ...state, [col]: (state[col] as { id: string }[]).filter((d) => d.id !== id) } as State
  emit()
  await backend?.remove(col, id)
}

export function byId<K extends CollectionName>(col: K, id: string | undefined): Collections[K] | undefined {
  if (!id) return undefined
  return (state[col] as Collections[K][]).find((d) => d.id === id)
}

export const DEFAULT_SEKOLAH: Sekolah = {
  id: 'profil',
  nama: 'Nama Sekolah',
  npsn: '',
  jenjang: ['SD'],
  alamat: '',
  tahunAjaranAktif: defaultTahunAjaran(),
  semesterAktif: new Date().getMonth() >= 6 ? 1 : 2,
}

export function defaultTahunAjaran(d = new Date()) {
  const y = d.getFullYear()
  return d.getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

export function useSekolah(): Sekolah {
  const list = useCol('sekolah')
  return list[0] ?? DEFAULT_SEKOLAH
}

export function getSekolah(): Sekolah {
  return state.sekolah[0] ?? DEFAULT_SEKOLAH
}

/** Cadangan seluruh data ke satu berkas JSON. */
export function exportJson(): string {
  return JSON.stringify({ app: 'simas-sekolah', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 1)
}

export async function importJson(text: string) {
  const parsed = JSON.parse(text)
  if (parsed?.app !== 'simas-sekolah' || !parsed.data) throw new Error('Berkas bukan cadangan SIMAS')
  await backend?.clear()
  state = empty()
  for (const c of COLLECTIONS) {
    const docs = parsed.data[c]
    if (Array.isArray(docs)) for (const d of docs) await put(c, d)
  }
  emit()
}

export async function resetAll() {
  await backend?.clear()
  state = empty()
  emit()
}
