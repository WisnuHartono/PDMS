// Integrasi Google Drive (scope drive.file: hanya file/folder yang dibuat aplikasi ini).
import type { AppState } from './types'

declare const google: any

const SCOPE = 'https://www.googleapis.com/auth/drive.file openid email profile'
const ROOT_NAME = 'DocControl'
const DATA_NAME = 'docontrol-data.json'

let token = ''
let tokenExp = 0
let tokenClient: any
let rootId = ''
let dataFileId = ''
const folderCache = new Map<string, string>()

export interface GUser {
  email: string
  name: string
  picture?: string
  verified?: boolean // email sudah diverifikasi Google
}

export function isConnected() {
  return !!token && Date.now() < tokenExp
}

const GIS_URL = 'https://accounts.google.com/gsi/client'
let gisLoading: Promise<void> | null = null

/** Memuat skrip Google Identity Services bila belum ada (dengan batas waktu); dicoba ulang pada klik berikutnya. */
export function loadGis(timeoutMs = 10000): Promise<void> {
  if (typeof google !== 'undefined' && google.accounts) return Promise.resolve()
  if (gisLoading) return gisLoading
  gisLoading = new Promise<void>((res, rej) => {
    const fail = (m: string) => { gisLoading = null; document.querySelectorAll(`script[data-gis]`).forEach((s) => s.remove()); rej(new Error(m)) }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return fail('Perangkat sedang offline. Sambungkan internet lalu coba lagi.')
    const s = document.createElement('script')
    s.src = GIS_URL
    s.async = true
    s.setAttribute('data-gis', '1')
    const t = setTimeout(() => fail('Layanan Google tidak merespons. Periksa koneksi internet, lalu klik lagi.'), timeoutMs)
    s.onload = () => { clearTimeout(t); typeof google !== 'undefined' && google.accounts ? res() : fail('Layanan Google gagal dimuat.') }
    s.onerror = () => { clearTimeout(t); fail('Skrip Google (accounts.google.com) terblokir. Matikan adblock/VPN/firewall yang memblokirnya, lalu coba lagi.') }
    document.head.appendChild(s)
  })
  return gisLoading
}

export async function signIn(clientId: string): Promise<GUser> {
  if (!clientId) throw new Error('Google Client ID belum diisi di Pengaturan.')
  await loadGis()
  if (!clientId) throw new Error('Google Client ID belum diisi di Pengaturan.')
  await new Promise<void>((res, rej) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r: any) => {
        if (r.error) return rej(new Error(r.error_description || r.error))
        token = r.access_token
        tokenExp = Date.now() + (Number(r.expires_in) - 60) * 1000
        res()
      },
      error_callback: (e: any) => rej(new Error(e?.type === "popup_failed_to_open" ? "Popup login diblokir browser. Izinkan popup lalu coba lagi." : e?.type === "popup_closed" ? "Jendela login Google ditutup." : e?.message || e?.type || "Login dibatalkan")),
    })
    tokenClient.requestAccessToken({ prompt: token ? '' : 'consent' })
  })
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: auth() })
  const u = await r.json()
  return { email: u.email, name: u.name, picture: u.picture, verified: u.email_verified === true || u.email_verified === 'true' }
}

export function signOut() {
  if (token && typeof google !== 'undefined') google.accounts.oauth2.revoke(token, () => {})
  token = ''
  tokenExp = 0
  rootId = ''
  dataFileId = ''
  folderCache.clear()
}

const auth = () => ({ Authorization: `Bearer ${token}` })

async function api(url: string, init: RequestInit = {}) {
  if (!isConnected()) throw new Error('Sesi Google berakhir, silakan hubungkan ulang.')
  const r = await fetch(url, { ...init, headers: { ...auth(), ...(init.headers || {}) } })
  if (!r.ok) throw new Error(`Drive ${r.status}: ${await r.text()}`)
  return r
}

async function findOne(q: string): Promise<string | undefined> {
  const r = await api(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`)
  return (await r.json()).files?.[0]?.id
}

export async function ensureFolder(name: string, parent?: string): Promise<string> {
  const safe = name.replace(/'/g, "\\'")
  const q = `name='${safe}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (parent ? ` and '${parent}' in parents` : '')
  const found = await findOne(q)
  if (found) return found
  const r = await api('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : undefined }),
  })
  return (await r.json()).id
}

async function root() {
  if (!rootId) rootId = await ensureFolder(ROOT_NAME)
  return rootId
}

function multipart(meta: object, blob: Blob) {
  const b = 'dcb' + Math.random().toString(36).slice(2)
  const body = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${b}--`,
  ])
  return { body, type: `multipart/related; boundary=${b}` }
}

export async function ensureProjectFolder(projectCode: string, projectName: string): Promise<string> {
  return ensureFolder(`${projectCode} - ${projectName}`, await root())
}

export async function uploadFile(file: Blob, name: string, parentId: string): Promise<string> {
  const { body, type } = multipart({ name, parents: [parentId] }, file)
  const r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': type },
    body,
  })
  return (await r.json()).id
}

export async function downloadDriveFile(id: string): Promise<Blob> {
  const r = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
  return r.blob()
}

export function driveViewUrl(id: string) {
  return `https://drive.google.com/file/d/${id}/view`
}

export async function pullState(): Promise<AppState | null> {
  const parent = await root()
  dataFileId = (await findOne(`name='${DATA_NAME}' and '${parent}' in parents and trashed=false`)) || ''
  if (!dataFileId) return null
  const r = await api(`https://www.googleapis.com/drive/v3/files/${dataFileId}?alt=media`)
  return (await r.json()) as AppState
}

export async function pushState(s: AppState) {
  const parent = await root()
  const blob = new Blob([JSON.stringify(s)], { type: 'application/json' })
  if (!dataFileId) {
    const { body, type } = multipart({ name: DATA_NAME, parents: [parent] }, blob)
    const r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': type },
      body,
    })
    dataFileId = (await r.json()).id
  } else {
    await api(`https://www.googleapis.com/upload/drive/v3/files/${dataFileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: blob,
    })
  }
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

/** Membuat folder bertingkat di dalam DocControl/ dan mengembalikan id folder terdalam. */
export async function ensurePath(segs: string[]): Promise<string> {
  let parent = await root()
  let key = ''
  for (const s of segs) {
    key += '/' + s
    let id = folderCache.get(key)
    if (!id) {
      id = await ensureFolder(s, parent)
      folderCache.set(key, id)
    }
    parent = id
  }
  return parent
}

/** Unggah file ke folder; bila nama yang sama sudah ada, isinya diperbarui (tidak menggandakan). */
export async function uploadOrReplace(file: Blob, name: string, parentId: string): Promise<string> {
  const existing = await findOne(`name='${esc(name)}' and '${parentId}' in parents and trashed=false`)
  if (existing) {
    await api(`https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    return existing
  }
  return uploadFile(file, name, parentId)
}

export const driveFolderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`
