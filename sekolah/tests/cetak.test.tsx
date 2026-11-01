import 'fake-indexeddb/auto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SEMUA_REGISTER, registerById } from '../src/administrasi'
import { CetakItem } from '../src/cetakAdministrasi'
import type { Arsip } from '../src/types'

const cetak = (id: string, data: Arsip['data']) => {
  const reg = registerById(id)!
  const a: Arsip = { id: 'x', register: id, data, dibuat: '2026-01-01T00:00:00Z' }
  return renderToStaticMarkup(<CetakItem reg={reg} a={a} d={data} />)
}

describe('template cetak administrasi', () => {
  it('setiap register ber-cetak punya template (bukan tampilan cadangan JSON)', () => {
    for (const r of SEMUA_REGISTER.filter((x) => x.cetak)) {
      const html = cetak(r.id, { tanggal: '2026-11-02', mulai: '2026-11-03', selesai: '2026-11-05' })
      expect(html, r.id).not.toContain('<pre>')
    }
  })
  it('surat keluar memuat isi, perihal, dan tembusan', () => {
    const h = cetak('surat-keluar', { tanggal: '2026-11-02', nomor: '001/421/X/XI/2026', tujuan: 'Dinas', perihal: 'Permohonan data', isi: 'Mohon data.\n\nTerima kasih.', tembusan: 'Yayasan; Arsip' })
    expect(h).toContain('Permohonan data'); expect(h).toContain('Mohon data.'); expect(h).toContain('Arsip')
  })
  it('cuti menghitung lama hari secara inklusif', () => {
    const h = cetak('cuti', { jenis: 'Cuti tahunan', mulai: '2026-11-03', selesai: '2026-11-05', alasan: 'Keluarga' })
    expect(h).toContain('3 (tiga) hari')
  })
  it('SK memuat menimbang, mengingat, dan diktum bernomor', () => {
    const h = cetak('sk', { nomor: '1/SK/2026', tentang: 'Pembagian Tugas', menimbang: 'a satu\nb dua', mengingat: 'UU 20/2003', menetapkan: 'Menetapkan A\nBerlaku' })
    expect(h).toContain('KESATU'); expect(h).toContain('KEDUA'); expect(h).toContain('Menimbang')
  })
  it('kuitansi umum memuat terbilang dan tiga kolom tanda tangan', () => {
    const h = cetak('kuitansi-umum', { noKw: 'BK/2026/001', tanggal: '2026-11-02', penerima: 'CV Maju', uraian: 'ATK', jumlah: 150000 })
    expect(h).toContain('Seratus lima puluh ribu'); expect(h).toContain('Penerima'); expect(h).toContain('Mengetahui')
  })
  it('slip honor menghitung diterima bersih', () => {
    const h = cetak('honor', { bulan: 'November', tahun: 2026, pokok: 1000000, tunjangan: 200000, potongan: 50000 })
    expect(h).toContain('1.150.000')
  })
  it('surat tugas, undangan, dan berita acara tidak error saat data minim', () => {
    expect(cetak('surat-tugas', { tanggal: '2026-11-02', kegiatan: 'Pelatihan' })).toContain('SURAT TUGAS')
    expect(cetak('undangan', { tanggal: '2026-11-02', acara: 'Rapat', hari: '2026-11-10', jam: '08:00' })).toContain('Pukul 08:00')
    expect(cetak('hapus-brg', { tanggal: '2026-11-02', barang: 'Kursi', jumlah: 2, alasan: 'Rusak berat' })).toContain('BERITA ACARA')
  })
})
