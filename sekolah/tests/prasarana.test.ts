import { describe, expect, it } from 'vitest'
import { DAFTAR_PERIKSA, dokumenWajib, klasifikasiKerusakan, validasiBangunan, validasiPengajuan, validasiRuang, validasiTanah } from '../src/prasarana'
import type { PengajuanPrasarana, Ruang, Tanah } from '../src/types'

const tanah: Tanah = { id: 't', nama: 'Tanah Utama', noSertifikat: '12.34', panjang: 100, lebar: 80, luas: 8000, luasTersedia: 3500, statusKepemilikan: 'Milik', samaDenganSekolah: true }

describe('aturan prasarana ', () => {
  it('klasifikasi kerusakan otomatis', () => {
    expect(klasifikasiKerusakan(0)).toBe('Tidak ada kerusakan')
    expect(klasifikasiKerusakan(25)).toBe('Rusak Ringan') // contoh di panduan
    expect(klasifikasiKerusakan(undefined)).toBe('-')
  })
  it('validasi tanah', () => {
    expect(validasiTanah(tanah)).toEqual([])
    expect(validasiTanah({ ...tanah, luasTersedia: 9000 })).toContain('Luas lahan tersedia tidak boleh melebihi luas tanah.')
    expect(validasiTanah({ ...tanah, kodePos: '4013' })).toContain('Kode pos harus lima digit angka.')
    expect(validasiTanah({ ...tanah, rt: 'RT 03' }).some((e) => e.startsWith('RT'))).toBe(true)
  })
  it('luas tapak bangunan tidak melebihi luas tanah', () => {
    const e = validasiBangunan({ id: 'b', tanahId: 't', jenisPrasarana: 'Bangunan', nama: 'G', panjang: 100, lebar: 100, luasTapak: 9000, jumlahLantai: 1, tahunPembangunan: 2015, statusKepemilikan: 'Milik' }, tanah)
    expect(e.some((x) => x.includes('melebihi luas tanah'))).toBe(true)
  })
  it('kode ruang unik dan lantai sesuai bangunan', () => {
    const r: Ruang = { id: 'r2', bangunanId: 'b', jenisPrasarana: 'Ruang Teori/Kelas', kode: 'rk-07', nama: 'Kelas', lantaiKe: 3, panjang: 8, lebar: 7, luas: 56, kapasitas: 32 }
    const e = validasiRuang(r, [{ ...r, id: 'r1', kode: 'RK-07' }], { id: 'b', jenisPrasarana: 'Bangunan', nama: 'G', jumlahLantai: 2 })
    expect(e.some((x) => x.includes('sudah dipakai'))).toBe(true)
    expect(e.some((x) => x.includes('melebihi jumlah lantai'))).toBe(true)
  })
  it('matriks dokumen wajib', () => {
    expect(dokumenWajib('Tanah', 'Penambahan')).toEqual(['Sertifikat tanah', 'Foto lahan', 'Denah sekolah'])
    expect(dokumenWajib('Ruang', 'Penambahan')).not.toContain('Sertifikat tanah')
    expect(dokumenWajib('Bangunan', 'Penghapusan')).toEqual(['Surat BPKAD/yayasan', 'Surat keterangan kepala sekolah'])
  })
  it('pengajuan baru diblokir selama ada pengajuan Diajukan / Proses Verifikasi', () => {
    const base: PengajuanPrasarana = { id: 'p2', nama: 'Perbaikan', objek: 'Tanah', jenis: 'Perbaikan', objekId: 't', alasan: 'x', periksa: DAFTAR_PERIKSA.map(() => true), status: 'Draf', dibuat: '2026-11-01',
      dokumen: [{ id: 'd', jenis: 'Surat keterangan kepala sekolah', namaBerkas: 'a.pdf', ukuran: 1000 }] }
    expect(validasiPengajuan(base, [], [])).toEqual([])
    const lain = { ...base, id: 'p1', status: 'Proses Verifikasi' as const }
    expect(validasiPengajuan(base, [lain], []).some((e) => e.includes('Masih ada pengajuan'))).toBe(true)
    expect(validasiPengajuan(base, [{ ...lain, status: 'Ditolak' }], [])).toEqual([])
    expect(validasiPengajuan({ ...base, dokumen: [] }, [], []).some((e) => e.includes('Dokumen wajib'))).toBe(true)
  })
})
