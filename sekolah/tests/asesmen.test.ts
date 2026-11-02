import { describe, expect, it } from 'vitest'
import { INSTRUMEN_BAWAAN, asesmenFinal, bacaRekam, catatRiwayat, deskriptor, idRekam, kelengkapan, predikat, ringkasan, tulisRekam, type Rekam } from '../src/asesmen'

const inst = INSTRUMEN_BAWAAN.find((i) => i.id === 'diagnostik')!
const rekam = (skor: Record<string, number>, bukti: Record<string, string> = {}, final = false): Rekam => ({ skor, bukti, umum: '', final, riwayat: [] })

describe('asesmen siswa', () => {
  it('predikat dari rata-rata skor', () => {
    expect(predikat(3.6)).toBe('Sangat Baik'); expect(predikat(3)).toBe('Baik'); expect(predikat(2)).toBe('Cukup'); expect(predikat(1.2)).toBe('Perlu Bimbingan')
  })
  it('deskriptor tersusun dari perilaku, dan dapat ditimpa', () => {
    const a = inst.aspek[0]
    expect(deskriptor(a, 4)).toContain('Konsisten'); expect(deskriptor(a, 1)).toContain('Belum tampak')
    expect(deskriptor({ ...a, level: ['a', 'b', 'c', 'd'] }, 2)).toBe('b')
  })
  it('skor ekstrem wajib bukti sebelum dapat dikunci', () => {
    const k1 = kelengkapan(inst, rekam({ literasi: 4, numerasi: 3, kesiapan: 3 }))
    expect(k1.bisaFinal).toBe(false); expect(k1.butuhBukti).toEqual(['Literasi'])
    expect(kelengkapan(inst, rekam({ literasi: 4, numerasi: 3, kesiapan: 3 }, { literasi: 'Membaca lancar saat lomba 12 Okt' })).bisaFinal).toBe(true)
    expect(kelengkapan(inst, rekam({ literasi: 3 })).bisaFinal).toBe(false)
  })
  it('ringkasan menyorot aspek kuat dan lemah', () => {
    const r = ringkasan(inst, rekam({ literasi: 4, numerasi: 2, kesiapan: 2 }))
    expect(r.predikat).toBe('Cukup'); expect(r.narasi).toContain('literasi'); expect(r.narasi).toContain('Perlu pembinaan')
  })
  it('tulis/baca rekam bolak-balik dan riwayat mencatat perubahan', () => {
    const lama = rekam({ literasi: 2 })
    const baru = { ...rekam({ literasi: 3 }), penilai: 'Bu Rina', tanggal: '2026-11-01', final: true }
    baru.riwayat = catatRiwayat(lama, baru, 'Bu Rina', inst.aspek)
    expect(baru.riwayat[0]).toMatchObject({ aspek: 'Literasi', dari: 2, ke: 3, oleh: 'Bu Rina' })
    const a = tulisRekam('x', { ta: '2026/2027', sem: 1, rombelId: 'r', instrumenId: inst.id, siswaId: 's' }, baru)
    expect(bacaRekam(a)).toMatchObject({ skor: { literasi: 3 }, final: true, penilai: 'Bu Rina' })
  })
  it('hanya asesmen terkunci yang masuk rapor', () => {
    const meta = { ta: '2026/2027', sem: 1, rombelId: 'r', instrumenId: inst.id, siswaId: 's1' }
    const draf = tulisRekam(idRekam('2026/2027', 1, inst.id, 's1'), meta, rekam({ literasi: 3, numerasi: 3, kesiapan: 3 }))
    const kunci = tulisRekam(idRekam('2026/2027', 1, inst.id, 's2'), { ...meta, siswaId: 's2' }, rekam({ literasi: 3, numerasi: 3, kesiapan: 3 }, {}, true))
    expect(asesmenFinal([draf, kunci], '2026/2027', 1, 's1')).toHaveLength(0)
    expect(asesmenFinal([draf, kunci], '2026/2027', 1, 's2')).toHaveLength(1)
  })
})
