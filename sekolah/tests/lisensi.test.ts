import 'fake-indexeddb/auto'
import { generateKeyPairSync } from 'node:crypto'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { aktifkanSerial, hitungStatus, ikatanInstalasi, kodeInstalasiBaru, periksaSerial, dariHex, hex, HARI_TRIAL } from '../src/lisensi'

const require_ = createRequire(import.meta.url)
const gen = require_('../generator/lib.cjs') as { buatSerial: (o: Record<string, unknown>) => { serial: string; noSeri: string } }

const kp = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pem = kp.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
const spki = kp.publicKey.export({ type: 'spki', format: 'der' })
const PUB = spki.subarray(spki.length - 65).toString('hex')
const HARI = 86_400_000

describe('serial lisensi', () => {
  it('serial dari generator diverifikasi aplikasi (permanen, tidak terikat)', async () => {
    const h = gen.buatSerial({ nama: 'SDN 1 Harapan', kunciPrivatPem: pem })
    const l = await periksaSerial(h.serial, kodeInstalasiBaru(), Date.now(), PUB)
    expect(l.nama).toBe('SDN 1 Harapan'); expect(l.kedaluwarsa).toBeNull(); expect(l.berakhir).toBe(false); expect(l.noSeri).toBe(h.noSeri)
  })
  it('serial tahunan berakhir setelah tanggalnya', async () => {
    const t = Date.now()
    const tgl = new Date(t + 10 * HARI).toISOString().slice(0, 10)
    const h = gen.buatSerial({ nama: 'Sekolah A', kedaluwarsa: tgl, kunciPrivatPem: pem })
    expect((await periksaSerial(h.serial, 'x', t, PUB)).berakhir).toBe(false)
    expect((await periksaSerial(h.serial, 'x', t + 12 * HARI, PUB)).berakhir).toBe(true)
  })
  it('serial terikat hanya cocok dengan kode instalasi yang sama', async () => {
    const kode = kodeInstalasiBaru()
    const h = gen.buatSerial({ nama: 'Sekolah B', kodeInstalasi: kode, kunciPrivatPem: pem })
    await expect(periksaSerial(h.serial, kode, Date.now(), PUB)).resolves.toBeTruthy()
    await expect(periksaSerial(h.serial, kodeInstalasiBaru(), Date.now(), PUB)).rejects.toThrow(/instalasi lain/)
    expect(hex(await ikatanInstalasi(kode))).toHaveLength(8)
  })
  it('menolak serial yang diubah atau ditandatangani kunci lain', async () => {
    const h = gen.buatSerial({ nama: 'Sekolah C', kunciPrivatPem: pem })
    const rusak = h.serial.slice(0, 20) + (h.serial[20] === 'A' ? 'B' : 'A') + h.serial.slice(21)
    await expect(periksaSerial(rusak, 'x', Date.now(), PUB)).rejects.toThrow()
    const lain = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
    const h2 = gen.buatSerial({ nama: 'Palsu', kunciPrivatPem: lain })
    await expect(periksaSerial(h2.serial, 'x', Date.now(), PUB)).rejects.toThrow(/tidak valid/)
    await expect(periksaSerial('SIMAS-ABCDE', 'x', Date.now(), PUB)).rejects.toThrow()
  })
  it('format serial dapat ditempel dengan spasi/huruf kecil', async () => {
    const h = gen.buatSerial({ nama: 'Sekolah D', kunciPrivatPem: pem })
    const kacau = h.serial.toLowerCase().replace(/-/g, ' \n')
    await expect(periksaSerial(kacau, 'x', Date.now(), PUB)).resolves.toBeTruthy()
    expect(dariHex(PUB)).toHaveLength(65)
  })
})

describe('masa percobaan', () => {
  it('mulai trial 7 hari lalu habis, jam mundur terkunci, serial resmi membuka', async () => {
    const t0 = 1_800_000_000_000
    const s0 = await hitungStatus(t0)
    expect(s0.mode).toBe('trial'); if (s0.mode === 'trial') expect(s0.sisaHari).toBe(HARI_TRIAL)
    const s3 = await hitungStatus(t0 + 3 * HARI + 1000)
    expect(s3.mode).toBe('trial'); if (s3.mode === 'trial') expect(s3.sisaHari).toBe(4)
    const s8 = await hitungStatus(t0 + 8 * HARI)
    expect(s8.mode).toBe('habis')
    // jam dimundurkan setelah habis: tetap terkunci
    expect((await hitungStatus(t0 + 1 * HARI)).mode).toBe('habis')
  })
})
