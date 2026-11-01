import { describe, expect, it } from 'vitest'
import { deskripsiMerdeka, getKurikulum, gradeHuruf, predikatK13 } from '../src/curricula'

const TP = ['Menjumlahkan pecahan', 'Mengukur luas', 'Membaca diagram']

describe('Kurikulum Merdeka', () => {
  const k = getKurikulum('merdeka')
  it('nilai akhir = rata-rata (rata-rata sumatif TP, SAS)', () => {
    expect(k.hitung({ tp0: 80, tp1: 90, tp2: 70, sas: 70 }, TP, 70).nilai).toBe(75)
    expect(k.hitung({ sas: 88 }, TP, 70).nilai).toBe(88)
    expect(k.hitung(undefined, TP, 70).nilai).toBeUndefined()
  })
  it('deskripsi menyorot TP tuntas dan TP yang perlu bimbingan', () => {
    const d = deskripsiMerdeka({ tp0: 90, tp1: 60, tp2: 80 }, TP, 70)
    expect(d).toBe('Menunjukkan penguasaan yang baik dalam menjumlahkan pecahan dan membaca diagram. Perlu bimbingan dalam mengukur luas.')
  })
  it('semua tuntas: TP terlemah tidak disebut dua kali', () => {
    const d = deskripsiMerdeka({ tp0: 90, tp1: 80 }, TP.slice(0, 2), 70)
    expect(d).toBe('Menunjukkan penguasaan yang baik dalam menjumlahkan pecahan. Perlu peningkatan dalam mengukur luas.')
  })
  it('deskripsi manual menggantikan deskripsi otomatis', () => {
    expect(k.hitung({ tp0: 90, deskripsi: 'Catatan guru' }, TP, 70).deskripsi).toBe('Catatan guru')
  })
})

describe('Kurikulum 2013', () => {
  it('predikat berdasarkan interval KKM', () => {
    expect(predikatK13(95, 70)).toBe('A')
    expect(predikatK13(84, 70)).toBe('B')
    expect(predikatK13(72, 70)).toBe('C')
    expect(predikatK13(69, 70)).toBe('D')
  })
  it('pengetahuan = (2 x rata-rata NH + PAS) / 3, keterampilan terpisah', () => {
    const h = getKurikulum('k13').hitung({ tp0: 80, tp1: 90, pas: 70, ket: 88 }, TP.slice(0, 2), 70)
    expect(h.nilai).toBe(80)
    expect(h.extra?.ket).toBe(88)
    expect(h.extra?.predKet).toBe('B') // KKM 70: A ≥ 90, B ≥ 80
  })
})

describe('PAUD & internasional', () => {
  it('PAUD memakai capaian naratif', () => {
    const h = getKurikulum('paud-merdeka').hitung({ capaian: 'BSH', deskripsi: 'Ananda mampu…' }, [], 0)
    expect(h.predikat).toBe('Berkembang Sesuai Harapan')
    expect(h.nilai).toBeUndefined()
  })
  it('skala huruf internasional', () => {
    expect(gradeHuruf(91)).toBe('A*')
    expect(gradeHuruf(55)).toBe('D')
    expect(gradeHuruf(10)).toBe('U')
    const h = getKurikulum('intl-letter').hitung({ tp0: 80, exam: 90 }, ['x'], 0)
    expect(h.nilai).toBe(86)
    expect(h.predikat).toBe('A')
  })
})
