// Penyimpanan berkas terstruktur: Proyek / Disiplin / Jenis dokumen ke folder lokal, Google Drive, dan WebDAV.
import type { Doc, Project, Revision, Settings, StorageDest, StorageMap, StorageResult } from './types'
import * as drive from './drive'
import { getHandle, putHandle, deleteHandle } from './db'
import { nowIso } from './util'

export const clean = (s: string, max = 80) =>
  s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').replace(/^\.+/, '').trim().slice(0, max) || '-'

export const TOKENS: [string, string][] = [
  ['{projectcode}', 'Kode proyek'], ['{project}', 'Nama proyek'], ['{discipline}', 'Disiplin'], ['{category}', 'Jenis dokumen'],
  ['{docnumber}', 'Nomor dokumen'], ['{rev}', 'Revisi'], ['{status}', 'Status (IFR/IFA/...)'], ['{title}', 'Nama dokumen'], ['{year}', 'Tahun terbit'], ['{name}', 'Nama file asli'],
]

export const PRESETS: [string, string][] = [
  ['{projectcode} - {project}/{discipline}/{category}', 'Proyek / Disiplin / Jenis dokumen'],
  ['{projectcode} - {project}/{category}/{discipline}', 'Proyek / Jenis dokumen / Disiplin'],
  ['{projectcode} - {project}/{discipline}/{category}/{docnumber}', 'Proyek / Disiplin / Jenis dokumen / No. dokumen'],
  ['{projectcode} - {project}/{discipline}/{category}/{status}', 'Proyek / Disiplin / Jenis dokumen / Status'],
]

export const FILE_PRESETS: [string, string][] = [
  ['{docnumber}-{title}-{status}', 'No.Dokumen-Nama Dokumen-Status'],
  ['{docnumber}-{title}-Rev{rev}-{status}', 'No.Dokumen-Nama Dokumen-Revisi-Status'],
  ['{docnumber}_Rev{rev}_{status}_{name}', 'No.Dokumen_Revisi_Status_NamaFileAsli'],
  ['{name}', 'Nama file asli'],
]

function expand(tpl: string, v: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m))
}

export function varsFor(p: Project, d: Doc, r: Pick<Revision, 'rev' | 'status' | 'issuedDate'>, orig: string) {
  return {
    projectcode: p.code, project: p.name, discipline: d.discipline, category: d.category, docnumber: d.number, title: d.title || '',
    rev: r.rev, status: r.status, year: (r.issuedDate || '').slice(0, 4) || String(new Date().getFullYear()), name: orig,
  }
}

export function folderSegments(s: Settings, p: Project, d: Doc, r: Pick<Revision, 'rev' | 'status' | 'issuedDate'>): string[] {
  return expand(s.storage.pathTemplate, varsFor(p, d, r, '')).split('/').map((x) => clean(x)).filter((x) => x && x !== '-')
}

export function fileNameFor(s: Settings, p: Project, d: Doc, r: Pick<Revision, 'rev' | 'status' | 'issuedDate'>, orig: string) {
  // ekstensi file asli selalu dipertahankan walau pola tidak memuat {name}
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(orig)?.[0] || ''
  let base = expand(s.storage.fileTemplate, varsFor(p, d, r, orig))
  if (ext && base.toLowerCase().endsWith(ext.toLowerCase())) base = base.slice(0, -ext.length)
  return clean(base, 180 - ext.length) + ext
}

// ---------- Folder lokal (File System Access API) ----------
export const fsSupported = () => typeof (window as any).showDirectoryPicker === 'function'

export async function pickLocalRoot(): Promise<string> {
  const h = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
  await putHandle(h)
  return h.name
}
export const clearLocalRoot = () => deleteHandle()
export async function localRootName(): Promise<string | undefined> {
  return (await getHandle())?.name
}

async function writeLocal(segs: string[], name: string, blob: Blob): Promise<string> {
  const root = await getHandle()
  if (!root) throw new Error('Folder lokal belum dipilih (Pengaturan > Penyimpanan File).')
  let perm = await root.queryPermission({ mode: 'readwrite' })
  if (perm !== 'granted') perm = await root.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') throw new Error('Izin akses folder lokal ditolak.')
  let dir = root
  for (const s of segs) dir = await dir.getDirectoryHandle(s, { create: true })
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(blob)
  await w.close()
  return [root.name, ...segs, name].join('/')
}

// ---------- WebDAV (Nextcloud, ownCloud, Synology, dsb.) ----------
const PW_KEY = 'docontrol.webdav.pw'
let memPw = ''
export const getWebdavPassword = () => { try { return localStorage.getItem(PW_KEY) ?? memPw } catch { return memPw } }
export const setWebdavPassword = (v: string) => { memPw = v; try { localStorage.setItem(PW_KEY, v) } catch { /* sandbox */ } }

const dav = (s: Settings) => {
  const w = s.storage.webdav
  const base = w.url.replace(/\/+$/, '')
  const auth = 'Basic ' + btoa(unescape(encodeURIComponent(`${w.username}:${getWebdavPassword()}`)))
  return { base, auth }
}
const enc = (segs: string[]) => segs.map(encodeURIComponent).join('/')

export async function testWebdav(s: Settings): Promise<string> {
  const { base, auth } = dav(s)
  if (!base) throw new Error('URL WebDAV belum diisi.')
  const r = await fetch(base + '/', { method: 'PROPFIND', headers: { Authorization: auth, Depth: '0' } })
  if (r.status === 401) throw new Error('Username / kata sandi aplikasi salah (401).')
  if (!r.ok && r.status !== 207) throw new Error(`Server menjawab ${r.status}.`)
  return 'Terhubung ✓'
}

async function writeWebdav(s: Settings, segs: string[], name: string, blob: Blob): Promise<string> {
  const { base, auth } = dav(s)
  if (!base) throw new Error('URL WebDAV belum diisi.')
  for (let i = 1; i <= segs.length; i++) {
    const r = await fetch(`${base}/${enc(segs.slice(0, i))}/`, { method: 'MKCOL', headers: { Authorization: auth } })
    if (![201, 405, 301, 200].includes(r.status) && r.status !== 409) throw new Error(`MKCOL ${r.status}`)
    if (r.status === 409) throw new Error('Folder induk WebDAV tidak ditemukan (409).')
  }
  const r = await fetch(`${base}/${enc([...segs, name])}`, { method: 'PUT', headers: { Authorization: auth }, body: blob })
  if (!r.ok) throw new Error(`PUT ${r.status}`)
  return `${base}/${segs.join('/')}/${name}`
}

// ---------- Orkestrasi ----------
export const enabledDests = (s: Settings): StorageDest[] => [
  ...(s.storage.local ? (['local'] as const) : []),
  ...(s.storage.drive ? (['drive'] as const) : []),
  ...(s.storage.webdav.enabled ? (['webdav'] as const) : []),
]

/** Simpan satu file ke semua tujuan aktif (atau subset `only`). Kegagalan satu tujuan tidak menghentikan yang lain. */
export async function saveEverywhere(s: Settings, segs: string[], name: string, blob: Blob, only?: StorageDest[], prev?: StorageMap): Promise<StorageMap> {
  const out: StorageMap = { ...(prev || {}) }
  const dests = (only || enabledDests(s)).filter((d) => enabledDests(s).includes(d))
  // Urutan: lokal dulu (butuh izin dari klik pengguna), lalu cloud
  for (const d of ['local', 'drive', 'webdav'] as const) {
    if (!dests.includes(d)) continue
    const res = (path: string, extra: Partial<StorageResult> = {}): StorageResult => ({ ok: true, path, at: nowIso(), ...extra })
    try {
      if (d === 'local') {
        if (!fsSupported()) throw new Error('Browser ini tidak mendukung penyimpanan ke folder lokal. Gunakan Chrome/Edge di komputer, atau unduh ZIP di halaman Berkas.')
        out.local = res(await writeLocal(segs, name, blob))
      } else if (d === 'drive') {
        if (!drive.isConnected()) throw new Error('Google Drive belum terhubung.')
        const folder = await drive.ensurePath(segs)
        const id = await drive.uploadOrReplace(blob, name, folder)
        out.drive = res(['DocControl', ...segs, name].join('/'), { id, error: undefined })
        ;(out.drive as any).folderId = folder
      } else {
        out.webdav = res(await writeWebdav(s, segs, name, blob))
      }
    } catch (e: any) {
      out[d] = { ok: false, path: [...segs, name].join('/'), at: nowIso(), error: e?.message || String(e) }
    }
  }
  return out
}

export const DEST_LABEL: Record<StorageDest, string> = { local: 'Komputer', drive: 'Google Drive', webdav: 'WebDAV' }
