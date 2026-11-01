import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/csv'
import type { Absensi } from '../src/types'
import { fmtTanggal, rekapAbsensi, rentangSemester, umur } from '../src/util'

describe('util', () => {
  it('format tanggal Indonesia', () => {
    expect(fmtTanggal('2025-08-17')).toBe('17 Agustus 2025')
  })
  it('umur', () => {
    expect(umur('2015-05-10', new Date(2025, 4, 9))).toBe(9)
    expect(umur('2015-05-10', new Date(2025, 4, 10))).toBe(10)
  })
  it('rentang semester', () => {
    expect(rentangSemester('2025/2026', 1)).toEqual(['2025-07-01', '2025-12-31'])
    expect(rentangSemester('2025/2026', 2)).toEqual(['2026-01-01', '2026-06-30'])
  })
  it('rekap absensi per orang dalam rentang', () => {
    const a: Absensi[] = [
      { id: '1', jenis: 'siswa', tanggal: '2025-08-01', rombelId: 'r', data: { x: { status: 'H' }, y: { status: 'S' } } },
      { id: '2', jenis: 'siswa', tanggal: '2025-08-02', rombelId: 'r', data: { x: { status: 'A' }, y: { status: 'S' } } },
      { id: '3', jenis: 'siswa', tanggal: '2025-09-01', rombelId: 'r', data: { x: { status: 'I' } } },
    ]
    const r = rekapAbsensi(a, '2025-08-01', '2025-08-31')
    expect(r.x.H).toBe(1)
    expect(r.x.A).toBe(1)
    expect(r.x.I).toBe(0)
    expect(r.y.S).toBe(2)
  })
  it('parse CSV dengan kutip dan titik koma', () => {
    expect(parseCsv('Nama;Alamat\r\n"Budi; S.";"Jl. ""A"""\n')).toEqual([['Nama', 'Alamat'], ['Budi; S.', 'Jl. "A"']])
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

import { TAMPILAN_DEFAULT, tampilanDari, tinggiBrand } from '../src/logo'
describe('tampilan aplikasi', () => {
  it('nilai undefined kembali ke bawaan dan tinggi bilah memuat lampu', () => {
    const t = tampilanDari({ tampilan: { appNama: undefined, appNamaUkuran: 24 } })
    expect(t.appNama).toBe(TAMPILAN_DEFAULT.appNama)
    expect(t.appNamaUkuran).toBe(24)
    expect(tinggiBrand({ ...t, appTampilLampu: true })).toBeGreaterThan(tinggiBrand({ ...t, appTampilLampu: false }))
  })
})
