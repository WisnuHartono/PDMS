import { describe, expect, it } from 'vitest'
import { KELOMPOK_ALAT, registerById } from '../src/administrasi'
import { bebanKln, implementasiKurikulum, jalankanValidasi, jenisRombelTersedia, validasiRombel } from '../src/validasi'
import type { Rombel, Sekolah, Siswa } from '../src/types'

const sekolah = (x: Partial<Sekolah> = {}): Sekolah => ({
  id: 'profil', nama: 'SD Uji', npsn: '12345678', jenjang: ['SD'], alamat: 'Jl. Uji', kepalaSekolahId: 'k', tahunAjaranAktif: '2026/2027', semesterAktif: 1,
  statusSekolah: 'Negeri', akreditasi: 'A', telepon: '1', ...x,
} as Sekolah)
const siswa = (id: string, x: Partial<Siswa> = {}): Siswa => ({
  id, noInduk: id, nama: `Siswa ${id}`, jk: 'L', nisn: id.padStart(10, '0'), tempatLahir: 'Bandung', tanggalLahir: '2016-01-01', nik: `${'1'.repeat(15)}${id.slice(-1)}`, agama: 'Islam', jenjang: 'SD', status: 'Aktif',
  ayah: { nama: 'Ayah', statusHidup: 'Hidup' }, ibu: { nama: 'Ibu', statusHidup: 'Hidup' }, wali: {}, ...x,
} as Siswa)
const rombel = (id: string, x: Partial<Rombel> = {}): Rombel => ({ id, nama: id, jenjang: 'SD', tingkat: '4', tahunAjaran: '2026/2027', kurikulumId: 'merdeka', waliKelasId: 'g', siswaIds: [], ...x })
const data = (s: Siswa[], r: Rombel[], sk = sekolah()) => ({ sekolah: sk, siswa: s, pegawai: [], rombel: r, mapel: [], tanah: [], bangunan: [], ruang: [], arsip: [] })

describe('validasi Dapodik 2027', () => {
  it('jenis rombel khusus hanya tersedia dengan flag sekolah', () => {
    expect(jenisRombelTersedia(sekolah(), 'SD')).toEqual(['Reguler'])
    expect(jenisRombelTersedia(sekolah({ flag: { kelasRangkap: 'SK-1' } }), 'SD')).toContain('Kelas Rangkap')
    expect(jenisRombelTersedia(sekolah({ statusSekolah: 'Swasta', flag: { kelasRangkap: 'SK-1' } }), 'SD')).not.toContain('Kelas Rangkap')
    expect(jenisRombelTersedia(sekolah({ flag: { pjj: 'SK' } }), 'SMA')).toContain('PJJ')
    expect(jenisRombelTersedia(sekolah({ flag: { kln: 'SK' } }), 'SMK')).toContain('Kebekerjaan LN')
    expect(jenisRombelTersedia(sekolah(), 'PKBM')).toContain('Keaksaraan')
  })

  it('kelas rangkap: anggota wajib punya induk dan tidak boleh berisi pembelajaran', () => {
    const sk = sekolah({ flag: { kelasRangkap: 'SK-1' } })
    const induk = rombel('I', { jenis: 'Kelas Rangkap', rombelInduk: true, pembelajaran: [{ mapelId: 'm', guruId: 'g', jp: 4 }] })
    const tanpaInduk = rombel('A', { jenis: 'Kelas Rangkap', tingkat: '5' })
    const salah = rombel('B', { jenis: 'Kelas Rangkap', indukId: 'I', pembelajaran: [{ mapelId: 'm', jp: 2 }] })
    const benar = rombel('C', { jenis: 'Kelas Rangkap', indukId: 'I', tingkat: '6' })
    const semua = [induk, tanpaInduk, salah, benar]
    expect(validasiRombel(tanpaInduk, semua, [], sk).some((e) => e.level === 'invalid' && /Rombel Induk/.test(e.pesan))).toBe(true)
    expect(validasiRombel(salah, semua, [], sk).some((e) => /hanya diinput pada Rombel Induk/.test(e.pesan))).toBe(true)
    expect(validasiRombel(benar, semua, [], sk).filter((e) => e.level === 'invalid')).toEqual([])
  })

  it('beban Kebekerjaan LN: 46 JP, Bahasa Asing ≥ 60%, Produktif + PJOK ≤ 40%', () => {
    const r = (id: string, kategoriMapel: Rombel['kategoriMapel'], jp: number): Rombel => rombel(id, { jenjang: 'SMK', jenis: 'Kebekerjaan LN', negaraTujuan: 'Jepang', kategoriMapel, pembelajaran: [{ mapelId: id, jp }] })
    const ok = bebanKln([r('a', 'Bahasa Asing', 28), r('b', 'Produktif', 14), r('c', 'PJOK', 4)])
    expect(ok[0]).toMatchObject({ negara: 'Jepang', total: 46, msg: [] })
    const kurang = bebanKln([r('a', 'Bahasa Asing', 20), r('b', 'Produktif', 22), r('c', 'PJOK', 4)])
    expect(kurang[0].msg.length).toBe(2)
  })

  it('rombel Produktif LN tidak boleh menggabungkan kompetensi berbeda', () => {
    const sk = sekolah({ flag: { kln: 'SK' } })
    const s = [siswa('1', { jenjang: 'SMK', pesertaKln: true, negaraTujuan: 'Jepang', kompetensiKeahlian: 'TKR' }), siswa('2', { jenjang: 'SMK', pesertaKln: true, negaraTujuan: 'Jepang', kompetensiKeahlian: 'TBSM' })]
    const r = rombel('p', { jenjang: 'SMK', jenis: 'Kebekerjaan LN', negaraTujuan: 'Jepang', kategoriMapel: 'Produktif', kompetensi: 'TKR', siswaIds: ['1', '2'], pembelajaran: [{ mapelId: 'm', jp: 14 }] })
    expect(validasiRombel(r, [r], s, sk).some((e) => /tidak boleh menggabungkan/.test(e.pesan))).toBe(true)
  })

  it('menandai NISN ganda, status hidup kosong, dan siswa di dua rombel', () => {
    const s = [siswa('1'), siswa('2', { nisn: '0000000001' }), siswa('3', { ayah: { nama: 'A' } })]
    const t = jalankanValidasi(data(s, [rombel('4A', { siswaIds: ['1', '2', '3'] }), rombel('4B', { siswaIds: ['1'] })]))
    const inv = t.filter((x) => x.level === 'invalid').map((x) => x.pesan).join('\n')
    expect(inv).toMatch(/NISN/)
    expect(inv).toMatch(/Status hidup/)
    expect(t.some((x) => /4A.*4B|lebih dari satu/i.test(x.pesan))).toBe(true)
  })

  it('data lengkap tidak menghasilkan invalid; implementasi kurikulum dihitung dari rombel', () => {
    const r = [rombel('4A', { siswaIds: ['1'] }), rombel('5A', { siswaIds: ['2'], kurikulumId: 'k13', tingkat: '5' })]
    expect(jalankanValidasi(data([siswa('1'), siswa('2')], r)).filter((x) => x.level === 'invalid')).toEqual([])
    expect(implementasiKurikulum(r, '2026/2027').map((x) => x.kurikulumId).sort()).toEqual(['k13', 'merdeka'])
  })

  it('inventaris memakai kelompok alat Dapodik dan ada register buku teks SIBI', () => {
    expect(KELOMPOK_ALAT).toContain('APE Sensori Motorik')
    expect(registerById('inventaris')?.fields.some((f) => f.k === 'kelompok')).toBe(true)
    expect(registerById('buku-teks')?.fields.map((f) => f.k)).toEqual(expect.arrayContaining(['judul', 'mapel', 'isbn', 'jumlah']))
  })
})
