import { describe, expect, it } from 'vitest'
import { BANK_DESKRIPSI, setGayaDeskripsi, susunDeskripsi, tingkatDari } from '../src/deskripsiRapor'

const tp = (...v: number[]) => v.map((x, i) => ({ t: `materi ${i + 1}`, v: x }))

describe('deskripsi rapor otomatis', () => {
  it('tingkat sesuai pembobotan KKM', () => {
    expect(tingkatDari(95, 75)).toBe(5)
    expect(tingkatDari(85, 75)).toBe(4)
    expect(tingkatDari(76, 75)).toBe(3)
    expect(tingkatDari(68, 75)).toBe(2)
    expect(tingkatDari(40, 75)).toBe(1)
  })
  it('kosong bila tidak ada nilai TP', () => {
    expect(susunDeskripsi({ tp: [], kkm: 75 })).toBe('')
  })
  it('deterministik dan lengkap lebih panjang dari standar', () => {
    const m = { tp: tp(95, 90, 60), akhir: 70, nilai: 80, kkm: 75 }
    setGayaDeskripsi('lengkap')
    const a = susunDeskripsi(m), b = susunDeskripsi(m)
    expect(a).toBe(b)
    const s = susunDeskripsi({ ...m, gaya: 'standar' })
    expect(a.length).toBeGreaterThan(s.length)
    expect(a).toContain('materi 1')
    expect(a).not.toContain('{tp}')
  })
  it('bank memiliki isi tiap tingkat', () => {
    for (const k of [1, 2, 3, 4, 5] as const) expect(BANK_DESKRIPSI.UMUM[k].length).toBeGreaterThanOrEqual(4)
  })
  it('nilai rendah menyebut bimbingan', () => {
    const d = susunDeskripsi({ tp: tp(50, 55), akhir: 50, nilai: 52, kkm: 75, gaya: 'lengkap' })
    expect(d.toLowerCase()).toMatch(/bimbing|pendampingan|remedi|penguatan|ulang/)
  })
})
