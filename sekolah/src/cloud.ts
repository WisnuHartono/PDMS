// Penyimpanan cadangan: folder di perangkat (termasuk folder sinkron Google Drive/OneDrive/Dropbox desktop),
// Google Drive (izin OAuth "drive.file": aplikasi hanya melihat berkas yang dibuatnya sendiri), dan WebDAV.
import type { CloudSetting } from './types'

export interface BerkasCloud { id: string; nama: string; ukuran?: number; waktu?: string }
type Res = { status: number; text: string }
interface Desktop {
  dav?: (r: { method: string; url: string; headers: Record<string, string>; body?: string; bodyB64?: string }) => Promise<Res>
  pilihFolder?: () => Promise<string | null>
  folderTulis?: (r: { dir: string; nama: string; b64: string; simpan?: number }) => Promise<{ ok: boolean; pesan?: string }>
  folderDaftar?: (dir: string) => Promise<{ ok: boolean; berkas?: { nama: string; ukuran: number; waktu: string }[]; pesan?: string }>
  folderBaca?: (r: { dir: string; nama: string }) => Promise<{ ok: boolean; teks?: string; pesan?: string }>
}
const desktop = () => (globalThis as unknown as { simas?: Desktop }).simas
export const adaDesktop = () => !!desktop()?.pilihFolder

export const KOSONG: CloudSetting = { tujuan: 'lokal', otomatis: 'mati', simpanTerbaru: 10 }

const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
const bytes = (x: string | Uint8Array) => (typeof x === 'string' ? new TextEncoder().encode(x) : x)
const aman = (n: string) => n.replace(/[\\/:*?"<>|]+/g, '-')

// ---------- Google Drive ----------
const GSI = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FOLDER_GD = 'SIMAS Cadangan'
let gToken: { v: string; exp: number } | null = null
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void }
type GoogleLib = { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: { access_token?: string; expires_in?: number; error?: string; error_description?: string }) => void; error_callback?: (e: { type?: string; message?: string }) => void }) => TokenClient; revoke: (t: string, cb?: () => void) => void } } }

function muatGsi(): Promise<GoogleLib> {
  const g = (globalThis as unknown as { google?: GoogleLib }).google
  if (g?.accounts?.oauth2) return Promise.resolve(g)
  return new Promise((ok, gagal) => {
    const s = document.createElement('script')
    s.src = GSI; s.async = true
    s.onload = () => { const x = (globalThis as unknown as { google?: GoogleLib }).google; x?.accounts?.oauth2 ? ok(x) : gagal(new Error('Pustaka Google gagal dimuat.')) }
    s.onerror = () => gagal(new Error('Tidak dapat memuat layanan masuk Google. Periksa koneksi internet.'))
    document.head.appendChild(s)
  })
}

/** Minta izin Google (jendela persetujuan Google muncul). Token hanya disimpan di memori selama sesi. */
export async function hubungkanGoogle(clientId: string): Promise<void> {
  if (!clientId.trim()) throw new Error('Isi OAuth Client ID terlebih dahulu.')
  const g = await muatGsi()
  await new Promise<void>((ok, gagal) => {
    const tc = g.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(), scope: SCOPE,
      callback: (r) => {
        if (r.access_token) { gToken = { v: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 - 60000 }; ok() }
        else gagal(new Error(r.error_description || r.error || 'Izin Google ditolak.'))
      },
      error_callback: (e) => gagal(new Error(e.type === 'popup_closed' ? 'Jendela izin Google ditutup sebelum selesai.' : e.message || 'Gagal meminta izin Google.')),
    })
    tc.requestAccessToken({ prompt: gToken ? '' : 'consent' })
  })
}
export const googleTerhubung = () => !!gToken && gToken.exp > Date.now()
export function putusGoogle() {
  const t = gToken?.v; gToken = null
  if (t) void muatGsi().then((g) => g.accounts.oauth2.revoke(t)).catch(() => undefined)
}

async function gFetch(url: string, init: RequestInit = {}) {
  if (!googleTerhubung()) throw new Error('Google Drive belum terhubung. Tekan "Hubungkan Google Drive" dan beri izin.')
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${gToken!.v}` } })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    if (res.status === 401) gToken = null
    throw new Error(`Google Drive menolak permintaan (${res.status}). ${t.slice(0, 160)}`)
  }
  return res
}
async function gFolder(): Promise<string> {
  const q = encodeURIComponent(`name='${FOLDER_GD}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const r = (await (await gFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`)).json()) as { files: { id: string }[] }
  if (r.files[0]) return r.files[0].id
  const c = (await (await gFetch('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER_GD, mimeType: 'application/vnd.google-apps.folder' }) })).json()) as { id: string }
  return c.id
}
async function gUnggah(nama: string, isi: Uint8Array, mime: string) {
  const parent = await gFolder()
  const batas = 'simas' + Math.random().toString(36).slice(2)
  const awal = new TextEncoder().encode(`--${batas}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nama, parents: [parent] })}\r\n--${batas}\r\nContent-Type: ${mime}\r\n\r\n`)
  const akhir = new TextEncoder().encode(`\r\n--${batas}--`)
  await gFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${batas}` }, body: new Blob([awal, isi as BlobPart, akhir]) })
}
async function gDaftar(): Promise<BerkasCloud[]> {
  const parent = await gFolder()
  const q = encodeURIComponent(`'${parent}' in parents and trashed=false`)
  const r = (await (await gFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,size,createdTime)`)).json()) as { files: { id: string; name: string; size?: string; createdTime: string }[] }
  return r.files.map((f) => ({ id: f.id, nama: f.name, ukuran: f.size ? Number(f.size) : undefined, waktu: f.createdTime }))
}

// ---------- WebDAV ----------
const FOLDER_DAV = 'SIMAS Cadangan'
function davBase(c: CloudSetting) {
  const u = (c.davUrl ?? '').trim().replace(/\/+$/, '')
  if (!/^https:\/\//i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(u)) throw new Error('Alamat WebDAV harus diawali https://')
  return u
}
async function davKirim(c: CloudSetting, method: string, url: string, extra: Record<string, string> = {}, body?: Uint8Array | string): Promise<Res> {
  const auth = 'Basic ' + b64(new TextEncoder().encode(`${c.davUser ?? ''}:${c.davSandi ?? ''}`))
  const headers = { Authorization: auth, ...extra }
  const d = desktop()
  if (d?.dav) return d.dav({ method, url, headers, ...(typeof body === 'string' ? { body } : body ? { bodyB64: b64(body) } : {}) })
  try {
    const res = await fetch(url, { method, headers, body: body as BodyInit | undefined })
    return { status: res.status, text: await res.text() }
  } catch {
    throw new Error('Tidak dapat terhubung ke server WebDAV. Di versi web server harus mengizinkan CORS; gunakan aplikasi Windows atau periksa pengaturan server.')
  }
}
const davPath = (c: CloudSetting, nama = '') => `${davBase(c)}/${encodeURIComponent(FOLDER_DAV)}${nama ? '/' + encodeURIComponent(nama) : ''}`
function cekDav(r: Res, apa: string) {
  if (r.status === 401 || r.status === 403) throw new Error('Nama pengguna atau kata sandi WebDAV ditolak (gunakan "kata sandi aplikasi" bila akun memakai verifikasi 2 langkah).')
  if (r.status >= 400) throw new Error(`${apa} gagal (kode ${r.status}).`)
}
async function davSiapkan(c: CloudSetting) {
  const r = await davKirim(c, 'MKCOL', davPath(c))
  if (r.status !== 405 && r.status !== 301) cekDav(r, 'Membuat folder di server')
}
async function davDaftar(c: CloudSetting): Promise<BerkasCloud[]> {
  const r = await davKirim(c, 'PROPFIND', davPath(c) + '/', { Depth: '1', 'Content-Type': 'application/xml' }, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>')
  if (r.status === 404) return []
  cekDav(r, 'Membaca daftar berkas')
  const doc = new DOMParser().parseFromString(r.text, 'application/xml')
  const out: BerkasCloud[] = []
  for (const x of Array.from(doc.getElementsByTagNameNS('*', 'response'))) {
    const href = decodeURIComponent(x.getElementsByTagNameNS('*', 'href')[0]?.textContent ?? '')
    const nama = href.replace(/\/+$/, '').split('/').pop() ?? ''
    if (!/\.(simas\.json|xlsx|zip)$/i.test(nama)) continue
    out.push({ id: nama, nama, ukuran: Number(x.getElementsByTagNameNS('*', 'getcontentlength')[0]?.textContent) || undefined, waktu: x.getElementsByTagNameNS('*', 'getlastmodified')[0]?.textContent ?? undefined })
  }
  return out.sort((a, b) => (b.waktu ? Date.parse(b.waktu) : 0) - (a.waktu ? Date.parse(a.waktu) : 0))
}

// ---------- Antarmuka umum ----------
export async function unggah(c: CloudSetting, nama: string, isi: string | Uint8Array, mime: string): Promise<string> {
  nama = aman(nama)
  const u8 = bytes(isi)
  if (c.tujuan === 'gdrive') { await gUnggah(nama, u8, mime); return `Tersimpan di Google Drive › ${FOLDER_GD}` }
  if (c.tujuan === 'webdav') { await davSiapkan(c); cekDav(await davKirim(c, 'PUT', davPath(c, nama), { 'Content-Type': mime }, u8), 'Mengunggah'); return `Tersimpan di server WebDAV › ${FOLDER_DAV}` }
  if (c.tujuan === 'folder') {
    const d = desktop()
    if (!d?.folderTulis || !c.folder) throw new Error('Pilih folder tujuan lebih dulu (khusus aplikasi Windows).')
    const r = await d.folderTulis({ dir: c.folder, nama, b64: b64(u8), simpan: nama.endsWith('.simas.json') ? c.simpanTerbaru : undefined })
    if (!r.ok) throw new Error(r.pesan || 'Gagal menulis ke folder.')
    return `Tersimpan di ${c.folder}`
  }
  throw new Error('Tujuan penyimpanan belum dipilih.')
}
export async function daftar(c: CloudSetting): Promise<BerkasCloud[]> {
  if (c.tujuan === 'gdrive') return (await gDaftar()).filter((b) => b.nama.endsWith('.simas.json'))
  if (c.tujuan === 'webdav') return (await davDaftar(c)).filter((b) => b.nama.endsWith('.simas.json'))
  if (c.tujuan === 'folder') {
    const r = await desktop()?.folderDaftar?.(c.folder ?? '')
    if (!r?.ok) throw new Error(r?.pesan || 'Folder tidak dapat dibaca.')
    return (r.berkas ?? []).filter((b) => b.nama.endsWith('.simas.json')).map((b) => ({ id: b.nama, ...b }))
  }
  return []
}
export async function unduh(c: CloudSetting, b: BerkasCloud): Promise<string> {
  if (c.tujuan === 'gdrive') return (await gFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(b.id)}?alt=media`)).text()
  if (c.tujuan === 'webdav') { const r = await davKirim(c, 'GET', davPath(c, b.nama)); cekDav(r, 'Mengunduh'); return r.text }
  if (c.tujuan === 'folder') { const r = await desktop()?.folderBaca?.({ dir: c.folder ?? '', nama: b.nama }); if (!r?.ok) throw new Error(r?.pesan || 'Gagal membaca berkas.'); return r.teks ?? '' }
  throw new Error('Tujuan penyimpanan belum dipilih.')
}
export async function pilihFolder() { return (await desktop()?.pilihFolder?.()) ?? null }

/** Uji koneksi: membaca daftar cadangan di tujuan. */
export async function uji(c: CloudSetting): Promise<string> {
  const n = (await daftar(c)).length
  return `Terhubung. ${n} berkas cadangan ditemukan.`
}

// ---------- Cadangan otomatis ----------
export const HARI = { harian: 1, mingguan: 7 } as const
export function jatuhTempo(c: CloudSetting | undefined, ref = new Date()) {
  if (!c || !c.otomatis || c.otomatis === 'mati' || !c.sandiOto || c.sandiOto.length < 12) return false
  if (c.tujuan !== 'folder' && c.tujuan !== 'webdav') return false // Google Drive butuh persetujuan interaktif
  if (!c.terakhir) return true
  return ref.getTime() - Date.parse(c.terakhir) >= HARI[c.otomatis] * 864e5 - 36e5
}
