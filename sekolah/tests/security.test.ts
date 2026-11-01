import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { EncryptedBackend, IndexedDbBackend } from '../src/db'
import {
  _setDbName, aktifkan2fa, buatAkun, cekSandi, daftarAkun, daftarAudit, gantiSandi, masuk, pasangAwal, pulihkan, resetAkun, type Sesi,
} from '../src/security/akun'
import { base32, cekTotp, dekBaru, kdfBaru, totp, totpSecretBaru, turunkan, unbase32 } from '../src/security/crypto'
import { exportTerenkripsi, getState, importJson, initStore, put } from '../src/store'

const SANDI = 'Kuat#Sekali2026'

describe('kriptografi', () => {
  it('Argon2id dipakai dan verifier deterministik per salt', async () => {
    const k = await kdfBaru()
    expect(k.alg).toBe('argon2id')
    const a = await turunkan('rahasia', k)
    const b = await turunkan('rahasia', k)
    const c = await turunkan('rahasib', k)
    expect(a.verifier).toBe(b.verifier)
    expect(a.verifier).not.toBe(c.verifier)
  })
  it('TOTP sesuai vektor uji RFC 6238 (SHA-1)', async () => {
    const secret = base32(new TextEncoder().encode('12345678901234567890'))
    expect(await totp(secret, 59_000, 30, 8)).toBe('94287082')
    expect(await totp(secret, 1111111109_000, 30, 8)).toBe('07081804')
    expect(unbase32(secret)).toEqual(new TextEncoder().encode('12345678901234567890'))
  })
  it('kebijakan kata sandi', () => {
    expect(cekSandi('pendek', 'budi').length).toBeGreaterThan(0)
    expect(cekSandi('budi-Rahasia-2026', 'budi').some((e) => e.includes('nama pengguna'))).toBe(true)
    expect(cekSandi(SANDI, 'admin')).toEqual([])
  })
})

describe('akun & sesi', () => {
  _setDbName('uji-akun')
  let admin: Sesi
  let kode = ''
  it('pemasangan awal + login + kunci akun', async () => {
    const r = await pasangAwal({ username: 'Admin', nama: 'Admin', password: SANDI })
    admin = r.sesi
    kode = r.kodePemulihan
    expect(kode).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){4}$/)
    expect((await masuk('admin', 'salah')).ok).toBe(false)
    const ok = await masuk('ADMIN', SANDI)
    expect(ok.ok).toBe(true)
    const nobody = await masuk('tidakada', SANDI)
    expect(nobody.ok === false && nobody.pesan).toBe('Nama pengguna atau kata sandi salah.')
  }, 30_000)
  it('akun baru wajib ganti sandi; data terenkripsi & kunci sama', async () => {
    await buatAkun(admin, { username: 'guru1', nama: 'Guru Satu', peranId: 'guru', sandiSementara: 'Sementara#9876x' })
    const h = await masuk('guru1', 'Sementara#9876x')
    expect(h.ok).toBe(true)
    if (h.ok !== true) return
    expect(h.sesi.akun.wajibGantiSandi).toBe(true)
    expect(h.sesi.peran.halaman).not.toContain('pengaturan')
    await gantiSandi(h.sesi, 'Sementara#9876x', 'GuruBaru#2026xy')
    expect((await masuk('guru1', 'GuruBaru#2026xy')).ok).toBe(true)
    // kunci data dari akun guru bisa membaca data yang ditulis admin
    await initStore(new EncryptedBackend(new IndexedDbBackend('uji-data'), admin.dek))
    await put('ekskul', { id: 'e1', nama: 'Pramuka' })
    const mentah = await new IndexedDbBackend('uji-data').loadAll()
    expect(JSON.stringify(mentah.ekskul)).not.toContain('Pramuka')
    await initStore(new EncryptedBackend(new IndexedDbBackend('uji-data'), h.sesi.dek))
    expect(getState().ekskul[0].nama).toBe('Pramuka')
    await expect(new EncryptedBackend(new IndexedDbBackend('uji-data'), await dekBaru()).loadAll()).rejects.toThrow()
  }, 60_000)
  it('penguncian setelah 5 kali gagal', async () => {
    for (let i = 0; i < 5; i++) await masuk('guru1', 'salah')
    const h = await masuk('guru1', 'GuruBaru#2026xy')
    expect(h.ok === false && h.pesan).toContain('terkunci')
    const g = (await daftarAkun()).find((a) => a.username === 'guru1')!
    await resetAkun(admin, g, 'Reset#Guru2026x', false)
    expect((await masuk('guru1', 'Reset#Guru2026x')).ok).toBe(true)
  }, 60_000)
  it('verifikasi 2 langkah & anti pemakaian ulang', async () => {
    const secret = totpSecretBaru()
    await aktifkan2fa(admin, secret, await totp(secret, Date.now() - 30_000))
    const h = await masuk('admin', SANDI)
    expect(h.ok).toBe('totp')
    if (h.ok !== 'totp') return
    expect((await h.lanjut('000000')).ok).toBe(false)
    const kodeSkrg = await totp(secret)
    expect((await h.lanjut(kodeSkrg)).ok).toBe(true)
    const h2 = await masuk('admin', SANDI)
    if (h2.ok === 'totp') expect((await h2.lanjut(kodeSkrg)).ok).toBe(false) // kode yang sama ditolak
    expect(await cekTotp(secret, 'abc')).toBeNull()
  }, 60_000)
  it('pemulihan Administrator dengan kode pemulihan', async () => {
    expect((await pulihkan('admin', 'SALAH-KODE', 'BaruLagi#2026xy')).ok).toBe(false)
    const r = await pulihkan('admin', kode.toLowerCase(), 'BaruLagi#2026xy')
    expect(r.ok).toBe(true)
    const log = await daftarAudit()
    expect(log.some((l) => l.aksi.startsWith('Pemulihan akun'))).toBe(true)
  }, 60_000)
  it('cadangan terenkripsi', async () => {
    const teks = await exportTerenkripsi('SandiCadangan#1')
    expect(teks).not.toContain('Pramuka')
    await expect(importJson(teks, 'salah-sandi')).rejects.toThrow('Kata sandi cadangan salah')
    await importJson(teks, 'SandiCadangan#1')
    expect(getState().ekskul[0].nama).toBe('Pramuka')
  }, 60_000)
})
