// Aturan data prasarana dan alur pengajuan perubahan data prasarana.
import type {
  AlasanPenghapusan, Bangunan, JenisDokumen, JenisPengajuan, ObjekPrasarana, PengajuanPrasarana, Ruang, StatusKepemilikan, StatusPengajuan, Tanah,
} from './types'

export const STATUS_KEPEMILIKAN_TANAH: StatusKepemilikan[] = ['Milik', 'Sewa', 'Pinjam Pakai', 'Bukan Milik']
export const STATUS_KEPEMILIKAN_BANGUNAN: StatusKepemilikan[] = ['Milik', 'Sewa', 'Pinjam', 'Bukan Milik']

export const JENIS_BANGUNAN = [
  'Bangunan', 'Asrama Siswa', 'Bangunan Tempat Ibadah', 'Kebun', 'Lapangan', 'Parkir', 'Rumah Dinas Guru',
  'Rumah Dinas Kepala Sekolah', 'Rumah Penjaga Sekolah', 'Taman', 'Tempat Bermain', 'Unit Produksi',
]

export const JENIS_RUANG = [
  'Ruang Teori/Kelas', 'Ruang Guru', 'Ruang Kepala Sekolah', 'Ruang Tata Usaha', 'Perpustakaan', 'Laboratorium IPA',
  'Laboratorium Komputer', 'Laboratorium Bahasa', 'Ruang UKS', 'Ruang Ibadah', 'Ruang BK', 'Ruang OSIS',
  'Ruang Bermain', 'Ruang Gudang', 'Toilet/Jamban', 'Kantin', 'Ruang Lainnya',
]

export const ALASAN_PENGHAPUSAN: { v: AlasanPenghapusan; ket: string }[] = [
  { v: 'Bencana', ket: 'Rusak atau musnah akibat bencana dan tidak lagi dapat digunakan/dikuasai.' },
  { v: 'Dibongkar', ket: 'Bangunan/prasarana telah dibongkar berdasarkan keputusan resmi (umumnya tidak untuk tanah).' },
  { v: 'Dipindahtangankan', ket: 'Kepemilikan atau penguasaan dialihkan kepada pihak lain dengan dokumen sah.' },
  { v: 'Disita', ket: 'Disita oleh pihak berwenang berdasarkan keputusan resmi.' },
  { v: 'Koreksi Data', ket: 'Tercatat ganda, salah objek, atau seharusnya tidak tercatat di satuan pendidikan.' },
]

export const JENIS_PENGAJUAN: JenisPengajuan[] = ['Penambahan', 'Perbaikan', 'Penghapusan']
export const STATUS_PENGAJUAN: StatusPengajuan[] = ['Draf', 'Diajukan', 'Proses Verifikasi', 'Disetujui', 'Ditolak', 'Dibatalkan']

export const KET_STATUS: Record<StatusPengajuan, { ket: string; tindakan: string; pill: string }> = {
  Draf: { ket: 'Belum diajukan', tindakan: 'Lengkapi data, dokumen, dan daftar periksa', pill: '' },
  Diajukan: { ket: 'Pengajuan telah diajukan', tindakan: 'Menunggu proses verifikasi', pill: 'info' },
  'Proses Verifikasi': { ket: 'Pengajuan sedang diperiksa pihak yang berwenang', tindakan: 'Memantau status pengajuan', pill: 'warn' },
  Disetujui: { ket: 'Pengajuan telah disetujui', tindakan: 'Realisasikan perubahan data lalu periksa hasilnya', pill: 'ok' },
  Ditolak: { ket: 'Pengajuan tidak dapat disetujui', tindakan: 'Baca catatan penolakan, perbaiki, lalu buat pengajuan baru bila perlu', pill: 'bad' },
  Dibatalkan: { ket: 'Pengajuan dibatalkan', tindakan: 'Buat pengajuan baru jika masih diperlukan', pill: '' },
}

/** Status yang memblokir pembuatan pengajuan baru (BAB II A.8 & BAB III C). */
export const STATUS_AKTIF: StatusPengajuan[] = ['Diajukan', 'Proses Verifikasi']
export const pengajuanAktif = (list: PengajuanPrasarana[]) => list.find((p) => STATUS_AKTIF.includes(p.status))

export const JENIS_DOKUMEN: JenisDokumen[] = ['Sertifikat tanah', 'Foto lahan', 'Foto bangunan', 'Denah sekolah', 'Surat BPKAD/yayasan', 'Surat keterangan kepala sekolah', 'Dokumen lain']

/** Matriks dokumen wajib per objek dan jenis pengajuan (BAB IV B). */
const W: Record<ObjekPrasarana, Record<JenisPengajuan, JenisDokumen[]>> = {
  Tanah: {
    Penambahan: ['Sertifikat tanah', 'Foto lahan', 'Denah sekolah'],
    Perbaikan: ['Surat keterangan kepala sekolah'],
    Penghapusan: ['Surat BPKAD/yayasan', 'Surat keterangan kepala sekolah'],
  },
  Bangunan: {
    Penambahan: ['Foto bangunan', 'Denah sekolah', 'Surat BPKAD/yayasan'],
    Perbaikan: ['Surat keterangan kepala sekolah'],
    Penghapusan: ['Surat BPKAD/yayasan', 'Surat keterangan kepala sekolah'],
  },
  Ruang: {
    Penambahan: ['Foto bangunan', 'Surat BPKAD/yayasan'],
    Perbaikan: ['Surat keterangan kepala sekolah'],
    Penghapusan: ['Surat keterangan kepala sekolah'],
  },
}
export const dokumenWajib = (o: ObjekPrasarana, j: JenisPengajuan) => W[o][j]

export const BATAS_DOKUMEN = 2 * 1024 * 1024 // PDF maksimal 2 MB per dokumen

export const DAFTAR_PERIKSA = [
  'Objek prasarana yang dipilih sudah sesuai.',
  'Jenis pengajuan sudah tepat.',
  'Data pengajuan telah diisi secara lengkap dan benar.',
  'Data pengajuan sudah sesuai dengan dokumen pendukung.',
  'Dokumen pendukung yang dipersyaratkan telah diunggah.',
  'Dokumen pendukung dapat dibaca dengan jelas, berupa PDF, dan berukuran kurang dari 2 MB.',
  'Data dan dokumen telah diperiksa oleh kepala satuan pendidikan.',
]

/**
 * Klasifikasi kerusakan dari bobot kerusakan (%). Panduan hanya memberi contoh (0 = tidak ada kerusakan,
 * 25 = Rusak Ringan); ambang lain mengikuti klasifikasi kerusakan bangunan sekolah yang umum dipakai.
 */
export function klasifikasiKerusakan(bobot: number | undefined): string {
  if (bobot === undefined || bobot === null || Number.isNaN(bobot)) return '-'
  if (bobot <= 0) return 'Tidak ada kerusakan'
  if (bobot <= 30) return 'Rusak Ringan'
  if (bobot <= 45) return 'Rusak Sedang'
  if (bobot <= 65) return 'Rusak Berat'
  return 'Rusak Total'
}
export const pillKerusakan = (k: string) => (k === 'Tidak ada kerusakan' ? 'ok' : k === 'Rusak Ringan' ? 'warn' : k === '-' ? '' : 'bad')

const isNum = (v: unknown) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))

// ---------- Validasi isian (Ketentuan Pengisian pada BAB V) ----------

export function validasiTanah(t: Tanah): string[] {
  const e: string[] = []
  if (!t.nama?.trim()) e.push('Nama tanah wajib diisi.')
  if (!t.noSertifikat?.trim()) e.push('Nomor sertifikat / dokumen kepemilikan wajib diisi.')
  for (const [k, l] of [['panjang', 'Panjang'], ['lebar', 'Lebar'], ['luas', 'Luas'], ['luasTersedia', 'Luas lahan tersedia']] as const) {
    if (!isNum(t[k])) e.push(`${l} wajib diisi dengan angka.`)
    else if (Number(t[k]) < 0) e.push(`${l} tidak boleh negatif.`)
  }
  if (isNum(t.luas) && isNum(t.luasTersedia) && Number(t.luasTersedia) > Number(t.luas)) e.push('Luas lahan tersedia tidak boleh melebihi luas tanah.')
  if (!t.statusKepemilikan) e.push('Status kepemilikan wajib dipilih.')
  if (t.kodePos && !/^\d{5}$/.test(t.kodePos)) e.push('Kode pos harus lima digit angka.')
  if (t.rt && !/^\d+$/.test(t.rt)) e.push('RT cukup diisi angka (tanpa tulisan "RT").')
  if (t.rw && !/^\d+$/.test(t.rw)) e.push('RW cukup diisi angka (tanpa tulisan "RW").')
  if (t.lintang !== undefined && (t.lintang < -11.5 || t.lintang > 6.5)) e.push('Lintang di luar wilayah Indonesia (umumnya bernilai negatif, mis. -7.0737).')
  if (t.bujur !== undefined && (t.bujur < 94 || t.bujur > 141.5)) e.push('Bujur di luar wilayah Indonesia (mis. 110.4141).')
  return e
}

export function validasiBangunan(b: Bangunan, tanah?: Tanah): string[] {
  const e: string[] = []
  if (!b.tanahId) e.push('Pilih tanah tempat bangunan berdiri.')
  if (!b.jenisPrasarana) e.push('Jenis prasarana wajib dipilih.')
  if (!b.nama?.trim()) e.push('Nama bangunan wajib diisi.')
  for (const [k, l] of [['panjang', 'Panjang'], ['lebar', 'Lebar'], ['luasTapak', 'Luas tapak'], ['jumlahLantai', 'Jumlah lantai'], ['tahunPembangunan', 'Tahun pembangunan']] as const) {
    if (!isNum(b[k])) e.push(`${l} wajib diisi dengan angka.`)
  }
  if (isNum(b.luasTapak) && tanah?.luas !== undefined && Number(b.luasTapak) > tanah.luas) e.push(`Luas tapak (${b.luasTapak} m²) melebihi luas tanah "${tanah.nama}" (${tanah.luas} m²).`)
  if (isNum(b.luasTapak) && isNum(b.panjang) && isNum(b.lebar) && Number(b.luasTapak) > Number(b.panjang) * Number(b.lebar) * 1.05)
    e.push('Luas tapak tidak sesuai dengan panjang x lebar bangunan.')
  if (isNum(b.tahunPembangunan) && (Number(b.tahunPembangunan) < 1800 || Number(b.tahunPembangunan) > new Date().getFullYear())) e.push('Tahun pembangunan tidak wajar.')
  if (!b.statusKepemilikan) e.push('Status kepemilikan wajib dipilih.')
  if (b.bobotKerusakan !== undefined && (b.bobotKerusakan < 0 || b.bobotKerusakan > 100)) e.push('Bobot kerusakan berupa angka 0-100 (tanpa tanda persen).')
  return e
}

export function validasiRuang(r: Ruang, semua: Ruang[], bangunan?: Bangunan): string[] {
  const e: string[] = []
  if (!r.bangunanId) e.push('Ruang harus dikaitkan dengan bangunan yang sudah tercatat.')
  if (!r.jenisPrasarana) e.push('Jenis prasarana (fungsi ruang) wajib dipilih.')
  if (!r.kode?.trim()) e.push('Kode ruang wajib diisi.')
  else if (semua.some((x) => x.id !== r.id && !x.dihapus && x.kode.trim().toLowerCase() === r.kode.trim().toLowerCase())) e.push(`Kode ruang "${r.kode}" sudah dipakai ruang lain.`)
  if (!r.nama?.trim()) e.push('Nama ruang wajib diisi.')
  for (const [k, l] of [['lantaiKe', 'Lantai ke'], ['panjang', 'Panjang'], ['lebar', 'Lebar'], ['luas', 'Luas ruang'], ['kapasitas', 'Kapasitas']] as const) {
    if (!isNum(r[k])) e.push(`${l} wajib diisi dengan angka.`)
  }
  if (isNum(r.lantaiKe) && bangunan?.jumlahLantai !== undefined && Number(r.lantaiKe) > bangunan.jumlahLantai) e.push(`Lantai ke-${r.lantaiKe} melebihi jumlah lantai bangunan (${bangunan.jumlahLantai}).`)
  if (r.bobotKerusakan !== undefined && (r.bobotKerusakan < 0 || r.bobotKerusakan > 100)) e.push('Bobot kerusakan berupa angka 0-100 (tanpa tanda persen).')
  return e
}

/** Pemeriksaan pengajuan sebelum dikirim: isian, alasan, dokumen wajib, daftar periksa. */
export function validasiPengajuan(p: PengajuanPrasarana, semua: PengajuanPrasarana[], objekErr: string[]): string[] {
  const e: string[] = []
  const aktif = pengajuanAktif(semua.filter((x) => x.id !== p.id))
  if (aktif) e.push(`Masih ada pengajuan "${aktif.nama}" berstatus ${aktif.status}. Pengajuan baru dapat dikirim setelah status akhir (Disetujui, Ditolak, atau Dibatalkan).`)
  if (!p.nama.trim()) e.push('Nama ajuan wajib diisi.')
  if (!p.objekId) e.push(`Pilih data ${p.objek.toLowerCase()} yang diajukan.`)
  if (!p.alasan.trim()) e.push('Alasan pengajuan wajib diisi.')
  if (p.jenis === 'Penghapusan') {
    if (!p.tanggalPenghapusan) e.push('Tanggal penghapusan wajib diisi sesuai SK/berita acara.')
    if (!p.alasanPenghapusan) e.push('Alasan penghapusan wajib dipilih.')
  } else e.push(...objekErr)
  for (const d of dokumenWajib(p.objek, p.jenis)) if (!p.dokumen.some((x) => x.jenis === d)) e.push(`Dokumen wajib belum diunggah: ${d}.`)
  for (const d of p.dokumen) if (d.ukuran > BATAS_DOKUMEN) e.push(`Dokumen "${d.namaBerkas}" melebihi 2 MB.`)
  DAFTAR_PERIKSA.forEach((t, i) => { if (!p.periksa[i]) e.push(`Daftar periksa belum dicentang: ${t}`) })
  return e
}
