import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { BIDANG, SEMUA_REGISTER, barisRegister, dokumenJatuhTempo, nomorOtomatis, predikatSupervisi, registerById } from '../src/administrasi'
import { terbilang } from '../src/cetakAdministrasi'
import { buatNarasi, bintang, elemenDari, kelompokUsia, usiaTahunBulan } from '../src/narasiPaud'
import type { Arsip } from '../src/types'

const a = (register: string, data: Arsip['data'], i = 0): Arsip => ({ id: `${register}${i}`, register, data, dibuat: `2026-01-01T00:00:0${i}Z` })

describe('administrasi', () => {
  it('memiliki 8 bidang dengan id register unik', () => {
    expect(BIDANG.map((b) => b.no)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08'])
    const ids = SEMUA_REGISTER.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of SEMUA_REGISTER) for (const f of r.fields) if (f.t === 'select') expect(f.opsi?.length).toBeGreaterThan(0)
  })
  it('BKU menghitung saldo berjalan urut tanggal', () => {
    const bku = registerById('bku')!
    const rows = barisRegister(bku, [a('bku', { tanggal: '2026-02-01', keluar: 300 }, 1), a('bku', { tanggal: '2026-01-01', masuk: 1000 }, 2)])
    expect(rows.map((r) => r.saldo)).toEqual([1000, 700])
  })
  it('nomor surat keluar otomatis per tahun dengan bulan romawi', () => {
    const r = registerById('surat-keluar')!
    const lama = [a('surat-keluar', { tanggal: '2026-03-02', nomor: 'x' })]
    const d = nomorOtomatis(r, lama, { tanggal: '2026-11-05', klas: '421' })
    expect(String(d.nomor)).toMatch(/^002\/421\/.+\/XI\/2026$/)
  })
  it('kolom hitung: RKAS, supervisi, predikat', () => {
    expect(registerById('rkas')!.hitung!({ volume: 2, harga: 1500 }).jumlah).toBe(3000)
    expect(registerById('supervisi')!.hitung!({ perencanaan: 90, pelaksanaan: 92, penilaian: 94 }).predikat).toBe('Amat Baik')
    expect(predikatSupervisi(75)).toBe('Cukup')
  })
  it('dokumen jatuh tempo', () => {
    const arsip = [a('_dok', { status: 'Ada', berlaku: '2026-01-10' })]
    arsip[0].id = 'dok|akreditasi'
    const t = dokumenJatuhTempo(arsip, 90, new Date('2026-02-01'))
    expect(t[0]).toMatchObject({ nama: 'Sertifikat Akreditasi', lewat: true })
  })
  it('terbilang', () => {
    expect(terbilang(250000)).toBe('dua ratus lima puluh ribu')
    expect(terbilang(1_115_011)).toBe('satu juta seratus lima belas ribu sebelas')
  })
})

describe('narasi PAUD', () => {
  it('elemen, usia, bintang', () => {
    expect(elemenDari('Nilai Agama dan Budi Pekerti')).toBe('nab')
    expect(elemenDari('Dasar-dasar Literasi, Matematika, Sains')).toBe('steam')
    expect(kelompokUsia('2020-08-01', new Date('2026-06-01'))).toBe('5-6 tahun')
    expect(usiaTahunBulan('2020-08-15', new Date('2026-06-01'))).toBe('5 tahun 9 bulan')
    expect(bintang('BSH')).toBe('★★★☆')
  })
  it('menyusun narasi dengan nama dan TP, deterministik, bank sekolah didahulukan', () => {
    const o = { nama: 'Raka', namaMapel: 'Jati Diri', capaian: 'BSH' as const, tujuan: ['Mengenali emosi diri'] }
    const t = buatNarasi(o)
    expect(t).toContain('Raka')
    expect(t.toLowerCase()).toContain('mengenali emosi diri')
    expect(t).not.toContain('{nama}')
    expect(buatNarasi(o)).toBe(t)
    const bank = [a('bank-narasi', { elemen: 'Jati Diri', capaian: 'BSH', usia: 'Semua', teks: '{nama} hebat.' })]
    expect(buatNarasi({ ...o, bank })).toBe('Raka hebat.')
  })
})
