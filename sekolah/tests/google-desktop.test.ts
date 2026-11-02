import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { ujiKonfigurasi } from '../src/security/ujiGoogle'

const require = createRequire(import.meta.url)
const { mulaiMasukGoogle, halaman } = require('../electron/google-masuk.cjs') as {
  mulaiMasukGoogle: (o: { clientId: string; nonce?: string; bukaBrowser: (u: string) => void; port?: number; batasMs?: number; jenis?: 'id' | 'token'; scope?: string }) => Promise<{ ok: boolean; credential?: string; access_token?: string; expires_in?: number; pesan?: string }>
  halaman: (c: string, n: string, s: string) => string
}
const CID = '1090946658709-abc.apps.googleusercontent.com'
const NONCE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

describe('masuk Google desktop (server lokal)', () => {
  it('menyajikan halaman, menerima kredensial dengan state yang benar, dan menolak yang lain', async () => {
    let url = ''
    const p = mulaiMasukGoogle({ clientId: CID, nonce: NONCE, port: 0, bukaBrowser: (u) => { url = u } })
    await new Promise((r) => setTimeout(r, 100))
    expect(url).toMatch(/^http:\/\/localhost:\d+\/masuk\/[0-9a-f]{36}$/)
    const base = url.replace(/\/masuk\/.*/, '').replace('localhost', '127.0.0.1'), state = url.split('/').pop()
    const html = await (await fetch(url.replace('localhost', '127.0.0.1'))).text()
    expect(html).toContain(CID); expect(html).toContain(NONCE)
    expect((await fetch(`${base}/masuk/salah`)).status).toBe(404)
    expect((await fetch(`${base}/kredensial/salah`, { method: 'POST', body: '{}' })).status).toBe(404)
    expect((await fetch(`${base}/kredensial/${state}`, { method: 'POST', body: JSON.stringify({ credential: 'bukan-jwt' }) })).status).toBe(400)
    expect((await fetch(`${base}/kredensial/${state}`, { method: 'POST', headers: { Host: 'jahat.example' }, body: '{}' }).catch(() => ({ status: 400 }))).status).toBe(400)
    const jwt = 'aaa.bbb.ccc'
    expect((await fetch(`${base}/kredensial/${state}`, { method: 'POST', body: JSON.stringify({ credential: jwt }) })).status).toBe(200)
    expect(await p).toEqual({ ok: true, credential: jwt })
  })
  it('menolak Client ID/nonce tidak valid dan habis waktu', async () => {
    expect((await mulaiMasukGoogle({ clientId: 'x', nonce: NONCE, bukaBrowser: () => undefined })).ok).toBe(false)
    expect((await mulaiMasukGoogle({ clientId: CID, nonce: '<script>', bukaBrowser: () => undefined })).ok).toBe(false)
    const r = await mulaiMasukGoogle({ clientId: CID, nonce: NONCE, port: 0, batasMs: 150, bukaBrowser: () => undefined })
    expect(r).toMatchObject({ ok: false, pesan: expect.stringMatching(/Waktu habis/) })
  })
  it('halaman tidak dapat disisipi skrip lewat data', () => {
    expect(halaman(CID, NONCE, 's')).not.toMatch(/<\/script><script/)
  })
})

describe('izin Google Drive di desktop (mode token)', () => {
  const SC = 'https://www.googleapis.com/auth/drive.file'
  it('menerima access token lewat browser sistem dan menolak scope di luar daftar', async () => {
    expect((await mulaiMasukGoogle({ clientId: CID, jenis: 'token', scope: 'https://www.googleapis.com/auth/drive', bukaBrowser: () => undefined })).ok).toBe(false)
    let url = ''
    const p = mulaiMasukGoogle({ clientId: CID, jenis: 'token', scope: SC, port: 0, bukaBrowser: (u) => { url = u } })
    await new Promise((r) => setTimeout(r, 100))
    const base = url.replace(/\/masuk\/.*/, '').replace('localhost', '127.0.0.1'), state = url.split('/').pop()
    const html = await (await fetch(url.replace('localhost', '127.0.0.1'))).text()
    expect(html).toContain('initTokenClient'); expect(html).toContain(SC)
    expect((await fetch(`${base}/kredensial/${state}`, { method: 'POST', body: JSON.stringify({ access_token: 'ya29.token', expires_in: 3599 }) })).status).toBe(200)
    expect(await p).toEqual({ ok: true, access_token: 'ya29.token', expires_in: 3599 })
  })
  it('izin ditolak dilaporkan sebagai galat', async () => {
    let url = ''
    const p = mulaiMasukGoogle({ clientId: CID, jenis: 'token', scope: SC, port: 0, bukaBrowser: (u) => { url = u } })
    await new Promise((r) => setTimeout(r, 100))
    const base = url.replace(/\/masuk\/.*/, '').replace('localhost', '127.0.0.1'), state = url.split('/').pop()
    await fetch(`${base}/kredensial/${state}`, { method: 'POST', body: JSON.stringify({ error: 'access_denied', error_description: 'Pengguna menolak' }) })
    expect(await p).toMatchObject({ ok: false, pesan: 'Pengguna menolak' })
  })
})

describe('uji koneksi di aplikasi desktop', () => {
  it('mencantumkan alamat localhost yang harus didaftarkan dan melewati uji prompt', async () => {
    const r = await ujiKonfigurasi({ clientId: CID }, { desktop: true, online: () => true, origin: 'app://simas', ambil: (u) => Promise.resolve({ ok: true, json: () => Promise.resolve(u.includes('certs') ? { keys: [{}] } : {}) } as Response), tunggu: 200 })
    expect(r.find((l) => l.id === 'origin')).toMatchObject({ status: 'ok', detail: expect.stringContaining('http://localhost:47831') })
    expect(r.at(-1)).toMatchObject({ id: 'prompt', status: 'lewati' })
  })
})
