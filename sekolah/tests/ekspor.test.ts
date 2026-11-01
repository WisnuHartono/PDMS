import { describe, expect, it } from 'vitest'
import { buatXlsx, buatZip, crc32, csvDari, ratakan, susunLembar } from '../src/ekspor'

/** Pembaca ZIP minimal (hanya tanpa kompresi) untuk memeriksa hasil. */
function baca(z: Uint8Array) {
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength)
  const out: Record<string, string> = {}
  let p = 0
  while (v.getUint32(p, true) === 0x04034b50) {
    const crc = v.getUint32(p + 14, true), sz = v.getUint32(p + 18, true), ln = v.getUint16(p + 26, true)
    const nama = new TextDecoder().decode(z.slice(p + 30, p + 30 + ln))
    const isi = z.slice(p + 30 + ln, p + 30 + ln + sz)
    expect(crc32(isi)).toBe(crc)
    out[nama] = new TextDecoder().decode(isi)
    p += 30 + ln + sz
  }
  return out
}

describe('ekspor', () => {
  it('crc32 baku', () => expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926))
  it('zip dapat dibaca kembali', () => {
    const r = baca(buatZip([{ nama: 'a.txt', isi: 'halo' }, { nama: 'b/c.csv', isi: 'x;y' }]))
    expect(r).toEqual({ 'a.txt': 'halo', 'b/c.csv': 'x;y' })
  })
  it('meratakan data, membuang gambar dan kunci API', () => {
    const r = ratakan({ nama: 'A', ayah: { nama: 'B' }, foto: 'data:image/png;base64,xx', hobi: ['a', 'b'], ai: { kunci: 'rahasia' } })
    expect(r).toEqual({ nama: 'A', 'ayah.nama': 'B', foto: '[berkas]', hobi: 'a; b' })
    expect(ratakan({ ai: { kunci: 'rahasia' }, x: 1 })).toEqual({ x: 1 })
  })
  it('csv dengan BOM, kutip, dan pemisah titik koma', () => {
    const c = csvDari({ nama: 'S', kolom: ['nama', 'ket'], baris: [['Budi; "B"', 'a\nb'], ['Ani', undefined]] })
    expect(c.startsWith('﻿nama;ket')).toBe(true)
    expect(c).toContain('"Budi; ""B""";"a\nb"')
    expect(c).toContain('Ani;')
  })
  it('xlsx berisi lembar per koleksi dan NISN tetap teks', () => {
    const l = susunLembar({ siswa: [{ id: '1', nama: 'Budi', nisn: '0012345678', foto: 'data:x' }], pegawai: [], arsip: [{ id: 'a', register: 'surat-masuk', data: { perihal: 'Undangan' }, dibuat: '' }] })
    expect(l.map((x) => x.nama)).toContain('Peserta Didik')
    expect(l.find((x) => x.nama === 'Peserta Didik')!.kolom).toContain('nisn')
    const z = baca(buatXlsx(l))
    expect(Object.keys(z)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']))
    expect(z['xl/worksheets/sheet1.xml']).toContain('0012345678')
    expect(z['xl/workbook.xml']).toContain('name="Peserta Didik"')
  })
})

import { jatuhTempo } from '../src/cloud'
describe('cadangan otomatis', () => {
  const dasar = { tujuan: 'folder' as const, otomatis: 'harian' as const, sandiOto: 'kata-sandi-panjang-1' }
  it('jatuh tempo menurut jadwal', () => {
    const skrg = new Date('2026-11-10T08:00:00Z')
    expect(jatuhTempo({ ...dasar }, skrg)).toBe(true)
    expect(jatuhTempo({ ...dasar, terakhir: '2026-11-10T01:00:00Z' }, skrg)).toBe(false)
    expect(jatuhTempo({ ...dasar, terakhir: '2026-11-08T08:00:00Z' }, skrg)).toBe(true)
    expect(jatuhTempo({ ...dasar, otomatis: 'mingguan', terakhir: '2026-11-05T08:00:00Z' }, skrg)).toBe(false)
  })
  it('tidak berjalan tanpa sandi, saat mati, atau untuk Google Drive', () => {
    const skrg = new Date()
    expect(jatuhTempo({ ...dasar, sandiOto: 'pendek' }, skrg)).toBe(false)
    expect(jatuhTempo({ ...dasar, otomatis: 'mati' }, skrg)).toBe(false)
    expect(jatuhTempo({ ...dasar, tujuan: 'gdrive' }, skrg)).toBe(false)
    expect(jatuhTempo(undefined, skrg)).toBe(false)
  })
})
