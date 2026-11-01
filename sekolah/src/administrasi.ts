// Definisi 8 bidang administrasi sekolah beserta isinya.
// Setiap bidang berisi: tautan ke modul yang sudah ada, buku/register (tabel + formulir + cetak),
// dan daftar dokumen wajib (status ada/belum, nomor, masa berlaku, lampiran PDF).
// Register didefinisikan secara deklaratif sehingga mudah ditambah tanpa membuat halaman baru.
import { getSekolah, getState, put } from './store'
import type { Arsip, NilaiArsip, Sekolah } from './types'
import type { PageId } from './ui'

export type TipeField = 'text' | 'textarea' | 'date' | 'time' | 'number' | 'rupiah' | 'select' | 'pegawai' | 'siswa' | 'rombel' | 'mapel' | 'ruang'

export interface FieldDef {
  k: string
  l: string
  t?: TipeField
  opsi?: string[]
  wajib?: boolean
  span?: 1 | 2 | 3 | 4
  /** tampil sebagai kolom di tabel daftar */
  daftar?: boolean
  ph?: string
}

export interface KolomHitung { k: string; l: string; rupiah?: boolean }

export type JenisCetak = 'disposisi' | 'kuitansi' | 'suket' | 'supervisi' | 'notulen'

export interface RegisterDef {
  id: string
  nama: string
  ket: string
  fields: FieldDef[]
  /** field tanggal utama: untuk urutan dan filter bulan/tahun */
  tanggal?: string
  /** buku kas: hitung saldo berjalan dari kolom masuk/keluar */
  kas?: { masuk: string; keluar: string; kelompok?: string }
  /** kolom angka yang dijumlahkan di bawah tabel */
  total?: string[]
  hitung?: (d: Record<string, NilaiArsip>) => Record<string, NilaiArsip>
  kolomHitung?: KolomHitung[]
  /** nomor otomatis (agenda/kuitansi/surat) */
  nomor?: { k: string; buat: (urut: number, d: Record<string, NilaiArsip>, s: Sekolah) => string }
  cetak?: JenisCetak
  /** cetak daftar dikelompokkan per nilai field ini (mis. Kartu Inventaris Ruang) */
  kelompokCetak?: { k: string; judul: string }
  lampiran?: boolean
  onSimpan?: (d: Record<string, NilaiArsip>) => Promise<void>
}

export type ItemDef =
  | { jenis: 'register'; reg: RegisterDef }
  | { jenis: 'halaman'; page: PageId; nama: string; ket: string }
  | { jenis: 'dokumen'; id: string; nama: string; ket: string; berlaku?: boolean }

export interface Bidang { id: string; no: string; nama: string; ket: string; tema: string; ikon: string; items: ItemDef[] }

// ---------- utilitas ----------
const n = (v: NilaiArsip) => (v === undefined || v === '' ? 0 : Number(v) || 0)
export const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const pad3 = (x: number) => String(x).padStart(3, '0')
const blnRomawi = (tgl: NilaiArsip) => ROMAWI[(tgl ? new Date(String(tgl)).getMonth() : new Date().getMonth())] ?? 'I'
const thn = (tgl: NilaiArsip) => (tgl ? String(tgl).slice(0, 4) : String(new Date().getFullYear()))
export const kodeSekolah = (s: Sekolah) => s.kodeSurat || s.npsn || 'SKL'

export const SUMBER_DANA = ['BOSP Reguler', 'BOP PAUD', 'BOS Daerah', 'Komite/Orang Tua', 'Yayasan', 'Lainnya']
const KONDISI = ['Baik', 'Rusak Ringan', 'Rusak Berat']
const STATUS_DOK = ['Ada', 'Belum ada', 'Perlu diperbarui']
export const STATUS_DOKUMEN = STATUS_DOK

export function predikatSupervisi(v: number) {
  return v >= 91 ? 'Amat Baik' : v >= 81 ? 'Baik' : v >= 71 ? 'Cukup' : v > 0 ? 'Kurang' : ''
}

const reg = (r: RegisterDef): ItemDef => ({ jenis: 'register', reg: r })
const hal = (page: PageId, nama: string, ket: string): ItemDef => ({ jenis: 'halaman', page, nama, ket })
const dok = (id: string, nama: string, ket: string, berlaku = false): ItemDef => ({ jenis: 'dokumen', id, nama, ket, berlaku })

// ---------- 01 Anak Didik ----------
const anak: Bidang = {
  id: 'anak', no: '01', nama: 'Administrasi Anak Didik', ket: 'Data dan rekam jejak peserta didik', tema: 'hijau', ikon: 'anak',
  items: [
    hal('siswa', 'Data Peserta Didik', 'Identitas, orang tua/wali, foto, impor CSV'),
    hal('induk', 'Buku Induk', 'Buku induk resmi dan cetak lembar induk'),
    hal('absensiSiswa', 'Daftar Hadir Peserta Didik', 'Absensi harian dan rekap bulanan'),
    hal('rapor', 'Rapor', 'Catatan wali kelas dan cetak rapor'),
    reg({
      id: 'spmb', nama: 'Pendaftaran Peserta Didik Baru (SPMB)', ket: 'Buku pendaftaran dan hasil seleksi', tanggal: 'tanggal',
      nomor: { k: 'noDaftar', buat: (u, d) => `PD-${thn(d.tanggal)}-${pad3(u)}` },
      fields: [
        { k: 'noDaftar', l: 'No. pendaftaran', daftar: true }, { k: 'tanggal', l: 'Tanggal daftar', t: 'date', wajib: true, daftar: true },
        { k: 'nama', l: 'Nama calon peserta didik', wajib: true, span: 2, daftar: true }, { k: 'jk', l: 'L/P', t: 'select', opsi: ['L', 'P'], daftar: true },
        { k: 'tglLahir', l: 'Tanggal lahir', t: 'date' }, { k: 'jalur', l: 'Jalur', t: 'select', opsi: ['Domisili/Zonasi', 'Afirmasi', 'Prestasi', 'Mutasi', 'Reguler'], daftar: true },
        { k: 'asal', l: 'Asal sekolah', daftar: true }, { k: 'ortu', l: 'Nama orang tua/wali' }, { k: 'telp', l: 'No. HP orang tua' },
        { k: 'hasil', l: 'Hasil', t: 'select', opsi: ['Diproses', 'Diterima', 'Cadangan', 'Tidak diterima', 'Mengundurkan diri'], daftar: true },
      ],
    }),
    reg({
      id: 'mutasi', nama: 'Buku Mutasi Peserta Didik', ket: 'Peserta didik masuk dan keluar (pindahan)', tanggal: 'tanggal',
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'jenis', l: 'Jenis', t: 'select', opsi: ['Masuk', 'Keluar'], wajib: true, daftar: true },
        { k: 'siswa', l: 'Peserta didik', t: 'siswa', wajib: true, span: 2, daftar: true }, { k: 'kelas', l: 'Kelas', daftar: true },
        { k: 'sekolahLain', l: 'Sekolah asal / tujuan', span: 2, daftar: true }, { k: 'noSurat', l: 'No. surat pindah' },
        { k: 'alasan', l: 'Alasan', t: 'textarea', span: 4 },
      ],
      onSimpan: async (d) => {
        if (d.jenis !== 'Keluar' || !d.siswa) return
        const s = getState().siswa.find((x) => x.id === d.siswa)
        if (s && s.status === 'Aktif') await put('siswa', { ...s, status: 'Mutasi Keluar', tanggalKeluar: String(d.tanggal ?? ''), alasanKeluar: String(d.alasan ?? ''), melanjutkanKe: String(d.sekolahLain ?? '') || s.melanjutkanKe })
      },
    }),
    reg({
      id: 'anekdot', nama: 'Catatan Anekdot / Perkembangan Anak', ket: 'Catatan peristiwa bermakna sebagai bahan asesmen PAUD', tanggal: 'tanggal', lampiran: true,
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'siswa', l: 'Anak', t: 'siswa', wajib: true, daftar: true },
        { k: 'tempat', l: 'Tempat / kegiatan', span: 2, daftar: true }, { k: 'peristiwa', l: 'Peristiwa yang diamati', t: 'textarea', span: 4, wajib: true, daftar: true },
        { k: 'analisis', l: 'Analisis capaian (elemen CP)', t: 'textarea', span: 2 }, { k: 'tindak', l: 'Rencana tindak lanjut', t: 'textarea', span: 2 },
      ],
    }),
    reg({
      id: 'tumbuh', nama: 'Pertumbuhan Anak (BB/TB)', ket: 'Penimbangan dan pengukuran berkala, deteksi dini tumbuh kembang', tanggal: 'tanggal',
      hitung: (d) => { const tb = n(d.tb) / 100; return { imt: tb > 0 && n(d.bb) > 0 ? Math.round((n(d.bb) / (tb * tb)) * 10) / 10 : undefined } },
      kolomHitung: [{ k: 'imt', l: 'IMT' }],
      fields: [
        { k: 'tanggal', l: 'Tanggal ukur', t: 'date', wajib: true, daftar: true }, { k: 'siswa', l: 'Anak', t: 'siswa', wajib: true, daftar: true },
        { k: 'bb', l: 'Berat badan (kg)', t: 'number', daftar: true }, { k: 'tb', l: 'Tinggi badan (cm)', t: 'number', daftar: true },
        { k: 'lk', l: 'Lingkar kepala (cm)', t: 'number', daftar: true }, { k: 'ket', l: 'Keterangan (gizi, gigi, mata, telinga)', span: 3, daftar: true },
      ],
    }),
    reg({
      id: 'bk', nama: 'Buku Bimbingan dan Konseling', ket: 'Layanan BK, kunjungan rumah, panggilan orang tua', tanggal: 'tanggal',
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'siswa', l: 'Peserta didik', t: 'siswa', wajib: true, daftar: true },
        { k: 'layanan', l: 'Jenis layanan', t: 'select', opsi: ['Konseling individu', 'Konseling kelompok', 'Bimbingan klasikal', 'Kunjungan rumah', 'Panggilan orang tua', 'Konferensi kasus', 'Alih tangan'], daftar: true },
        { k: 'masalah', l: 'Permasalahan', t: 'textarea', span: 2, daftar: true }, { k: 'tindak', l: 'Tindak lanjut / hasil', t: 'textarea', span: 2 },
      ],
    }),
    reg({
      id: 'prestasi', nama: 'Buku Prestasi Peserta Didik', ket: 'Lomba dan penghargaan', tanggal: 'tanggal', lampiran: true,
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', daftar: true }, { k: 'siswa', l: 'Peserta didik', t: 'siswa', wajib: true, daftar: true },
        { k: 'lomba', l: 'Nama lomba / kegiatan', span: 2, wajib: true, daftar: true },
        { k: 'tingkat', l: 'Tingkat', t: 'select', opsi: ['Sekolah', 'Kecamatan', 'Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional'], daftar: true },
        { k: 'juara', l: 'Peringkat', daftar: true }, { k: 'penyelenggara', l: 'Penyelenggara', span: 2 },
      ],
    }),
    reg({
      id: 'tatib', nama: 'Buku Catatan Kedisiplinan', ket: 'Pelanggaran tata tertib, poin, dan pembinaan', tanggal: 'tanggal', total: ['poin'],
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'siswa', l: 'Peserta didik', t: 'siswa', wajib: true, daftar: true },
        { k: 'pelanggaran', l: 'Pelanggaran', span: 2, wajib: true, daftar: true }, { k: 'poin', l: 'Poin', t: 'number', daftar: true },
        { k: 'pembinaan', l: 'Pembinaan', span: 3, daftar: true },
      ],
    }),
    reg({
      id: 'pip', nama: 'Penerima Bantuan / Beasiswa (PIP)', ket: 'Catatan internal; usulan PIP kini lewat SIPINTAR/DTSEN, bukan Dapodik', tanggal: 'tanggal', total: ['nominal'],
      fields: [
        { k: 'tanggal', l: 'Tanggal cair', t: 'date', daftar: true }, { k: 'siswa', l: 'Peserta didik', t: 'siswa', wajib: true, daftar: true },
        { k: 'program', l: 'Program', t: 'select', opsi: ['PIP/KIP', 'Beasiswa Daerah', 'Beasiswa Yayasan', 'Lainnya'], daftar: true },
        { k: 'nominal', l: 'Nominal', t: 'rupiah', daftar: true }, { k: 'ket', l: 'Keterangan', span: 2 },
      ],
    }),
    reg({
      id: 'penghubung', nama: 'Buku Penghubung Orang Tua', ket: 'Komunikasi guru dan orang tua', tanggal: 'tanggal',
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'siswa', l: 'Peserta didik', t: 'siswa', wajib: true, daftar: true },
        { k: 'dari', l: 'Dari', t: 'select', opsi: ['Guru', 'Orang tua'], daftar: true }, { k: 'pesan', l: 'Pesan', t: 'textarea', span: 4, daftar: true },
        { k: 'tanggapan', l: 'Tanggapan', t: 'textarea', span: 4 },
      ],
    }),
    dok('pedoman-spmb', 'Juknis / Pedoman SPMB', 'Pedoman penerimaan peserta didik baru tahun berjalan'),
    dok('tatib-siswa', 'Tata Tertib Peserta Didik', 'Disahkan kepala sekolah dan disosialisasikan ke orang tua'),
    dok('sk-lulus', 'SK Kelulusan / Kenaikan Kelas', 'Hasil rapat dewan guru akhir tahun'),
  ],
}

// ---------- 02 Guru / Perangkat Pembelajaran ----------
const guru: Bidang = {
  id: 'guru', no: '02', nama: 'Administrasi Guru / Perangkat Pembelajaran', ket: 'Dokumen perencanaan dan pelaksanaan pembelajaran', tema: 'merah', ikon: 'mapel',
  items: [
    hal('mapel', 'Mata Pelajaran / Elemen CP', 'Daftar mapel atau elemen capaian PAUD per jenjang'),
    hal('nilai', 'Penilaian / Asesmen', 'Nilai per tujuan pembelajaran dan narasi PAUD'),
    reg({
      id: 'kaldik', nama: 'Kalender Pendidikan', ket: 'Hari efektif, libur, asesmen, dan kegiatan', tanggal: 'mulai',
      fields: [
        { k: 'mulai', l: 'Mulai', t: 'date', wajib: true, daftar: true }, { k: 'selesai', l: 'Selesai', t: 'date', daftar: true },
        { k: 'kegiatan', l: 'Kegiatan', span: 2, wajib: true, daftar: true },
        { k: 'jenis', l: 'Jenis', t: 'select', opsi: ['Hari efektif', 'Libur semester', 'Libur nasional', 'Asesmen', 'Kegiatan sekolah', 'Pembagian rapor', 'MPLS'], daftar: true },
      ],
    }),
    reg({
      id: 'jadwal', nama: 'Jadwal Pelajaran', ket: 'Jadwal mengajar per rombel',
      fields: [
        { k: 'hari', l: 'Hari', t: 'select', opsi: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], wajib: true, daftar: true },
        { k: 'jam', l: 'Jam (mis. 07.00–08.10)', daftar: true }, { k: 'rombel', l: 'Rombel', t: 'rombel', wajib: true, daftar: true },
        { k: 'mapel', l: 'Mata pelajaran', t: 'mapel', daftar: true }, { k: 'guru', l: 'Guru', t: 'pegawai', daftar: true },
      ],
    }),
    reg({
      id: 'atp', nama: 'Alur Tujuan Pembelajaran (ATP)', ket: 'Urutan TP per fase dan mata pelajaran',
      fields: [
        { k: 'fase', l: 'Fase', t: 'select', opsi: ['Fondasi', 'A', 'B', 'C', 'D', 'E', 'F'], daftar: true }, { k: 'mapel', l: 'Mata pelajaran', t: 'mapel', daftar: true },
        { k: 'elemen', l: 'Elemen', span: 2, daftar: true }, { k: 'tp', l: 'Tujuan pembelajaran', t: 'textarea', span: 4, wajib: true, daftar: true },
        { k: 'jp', l: 'Alokasi (JP)', t: 'number', daftar: true }, { k: 'semester', l: 'Semester', t: 'select', opsi: ['1', '2'], daftar: true },
      ],
    }),
    reg({
      id: 'prota', nama: 'Program Tahunan & Semester', ket: 'Distribusi materi/TP per bulan dan minggu', total: ['jp'],
      fields: [
        { k: 'rombel', l: 'Rombel', t: 'rombel', daftar: true }, { k: 'mapel', l: 'Mata pelajaran', t: 'mapel', daftar: true },
        { k: 'semester', l: 'Semester', t: 'select', opsi: ['1', '2'], daftar: true }, { k: 'bulan', l: 'Bulan / minggu ke', daftar: true },
        { k: 'materi', l: 'Materi / TP / tema', span: 3, wajib: true, daftar: true }, { k: 'jp', l: 'JP', t: 'number', daftar: true },
      ],
    }),
    reg({
      id: 'modul', nama: 'Modul Ajar / RPP / RPPH', ket: 'Rencana pembelajaran dan status pengesahan', tanggal: 'tanggal', lampiran: true,
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', daftar: true }, { k: 'guru', l: 'Guru', t: 'pegawai', daftar: true },
        { k: 'rombel', l: 'Rombel', t: 'rombel', daftar: true }, { k: 'mapel', l: 'Mapel / elemen', t: 'mapel', daftar: true },
        { k: 'topik', l: 'Topik / tema', span: 2, wajib: true, daftar: true }, { k: 'jenis', l: 'Jenis', t: 'select', opsi: ['Modul Ajar', 'RPP', 'RPPH (harian)', 'RPPM (mingguan)'], daftar: true },
        { k: 'status', l: 'Status', t: 'select', opsi: ['Draf', 'Diperiksa', 'Disahkan'], daftar: true },
        { k: 'tujuan', l: 'Tujuan pembelajaran', t: 'textarea', span: 4 }, { k: 'kegiatan', l: 'Langkah kegiatan', t: 'textarea', span: 4 }, { k: 'asesmen', l: 'Asesmen', t: 'textarea', span: 4 },
      ],
    }),
    reg({
      id: 'jurnal', nama: 'Jurnal Mengajar', ket: 'Catatan harian pelaksanaan pembelajaran', tanggal: 'tanggal',
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'guru', l: 'Guru', t: 'pegawai', daftar: true },
        { k: 'rombel', l: 'Rombel', t: 'rombel', daftar: true }, { k: 'mapel', l: 'Mapel', t: 'mapel', daftar: true }, { k: 'jamKe', l: 'Jam ke', daftar: true },
        { k: 'materi', l: 'Materi / kegiatan', span: 3, wajib: true, daftar: true }, { k: 'absen', l: 'Tidak hadir', span: 2 }, { k: 'catatan', l: 'Catatan / kendala', span: 2 },
      ],
    }),
    reg({
      id: 'remedial', nama: 'Program Remedial & Pengayaan', ket: 'Tindak lanjut hasil asesmen', tanggal: 'tanggal',
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', daftar: true }, { k: 'rombel', l: 'Rombel', t: 'rombel', daftar: true }, { k: 'mapel', l: 'Mapel', t: 'mapel', daftar: true },
        { k: 'jenis', l: 'Jenis', t: 'select', opsi: ['Remedial', 'Pengayaan'], daftar: true }, { k: 'siswa', l: 'Peserta didik', t: 'siswa', daftar: true },
        { k: 'tp', l: 'TP yang belum/sudah tuntas', span: 2, daftar: true }, { k: 'kegiatan', l: 'Bentuk kegiatan', span: 2 }, { k: 'hasil', l: 'Hasil', daftar: true },
      ],
    }),
    reg({
      id: 'bank-narasi', nama: 'Bank Narasi Rapor PAUD', ket: 'Kalimat narasi per elemen, kelompok usia, dan capaian. Dipakai tombol "Buat narasi" di Penilaian.',
      fields: [
        { k: 'elemen', l: 'Elemen', t: 'select', opsi: ['Nilai Agama dan Budi Pekerti', 'Jati Diri', 'Dasar Literasi, Matematika, Sains, Teknologi, Rekayasa, dan Seni', 'Kokurikuler / P5'], wajib: true, span: 2, daftar: true },
        { k: 'usia', l: 'Kelompok usia', t: 'select', opsi: ['Semua', '2-3 tahun', '3-4 tahun', '4-5 tahun', '5-6 tahun'], daftar: true },
        { k: 'capaian', l: 'Capaian', t: 'select', opsi: ['BB', 'MB', 'BSH', 'BSB'], wajib: true, daftar: true },
        { k: 'teks', l: 'Teks narasi (pakai {nama} untuk nama anak)', t: 'textarea', span: 4, wajib: true, daftar: true },
      ],
    }),
    dok('kosp-guru', 'Capaian Pembelajaran per Fase', 'Salinan CP terbaru dari BSKAP'),
    dok('kktp', 'Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)', 'Ditetapkan per mapel dan fase'),
    dok('pedoman-asesmen', 'Pedoman Asesmen dan Pelaporan', 'Termasuk format rapor yang dipakai'),
  ],
}

// ---------- 03 SDM dan Humas ----------
const sdm: Bidang = {
  id: 'sdm', no: '03', nama: 'Administrasi SDM dan Humas', ket: 'Pengelolaan SDM dan hubungan eksternal lembaga', tema: 'cyan', ikon: 'guru',
  items: [
    hal('pegawai', 'Data Guru & Tenaga Kependidikan', 'Identitas, NIP/NUPTK, status kepegawaian'),
    hal('absensiPegawai', 'Daftar Hadir Guru & Pegawai', 'Absensi harian, jam masuk/pulang, rekap'),
    reg({
      id: 'sk-tugas', nama: 'SK Pembagian Tugas', ket: 'Tugas mengajar dan tugas tambahan', tanggal: 'tanggal', lampiran: true, total: ['jp'],
      fields: [
        { k: 'noSk', l: 'Nomor SK', daftar: true }, { k: 'tanggal', l: 'Tanggal SK', t: 'date', daftar: true }, { k: 'pegawai', l: 'Guru / pegawai', t: 'pegawai', wajib: true, daftar: true },
        { k: 'tugas', l: 'Tugas pokok / mengajar', span: 2, daftar: true }, { k: 'tambahan', l: 'Tugas tambahan', span: 2, daftar: true }, { k: 'jp', l: 'JP per minggu', t: 'number', daftar: true },
      ],
    }),
    reg({
      id: 'cuti', nama: 'Cuti dan Izin Pegawai', ket: 'Pengajuan dan persetujuan cuti', tanggal: 'mulai',
      fields: [
        { k: 'pegawai', l: 'Pegawai', t: 'pegawai', wajib: true, daftar: true },
        { k: 'jenis', l: 'Jenis', t: 'select', opsi: ['Cuti tahunan', 'Cuti sakit', 'Cuti melahirkan', 'Cuti alasan penting', 'Izin', 'Dinas luar'], daftar: true },
        { k: 'mulai', l: 'Mulai', t: 'date', wajib: true, daftar: true }, { k: 'selesai', l: 'Selesai', t: 'date', daftar: true },
        { k: 'alasan', l: 'Alasan', span: 2, daftar: true }, { k: 'status', l: 'Status', t: 'select', opsi: ['Diajukan', 'Disetujui', 'Ditolak'], daftar: true },
      ],
    }),
    reg({
      id: 'diklat', nama: 'Pengembangan Diri / Diklat', ket: 'Pelatihan, workshop, seminar, KKG/MGMP', tanggal: 'tanggal', lampiran: true, total: ['jp'],
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', daftar: true }, { k: 'pegawai', l: 'Peserta', t: 'pegawai', wajib: true, daftar: true },
        { k: 'kegiatan', l: 'Nama kegiatan', span: 2, wajib: true, daftar: true }, { k: 'penyelenggara', l: 'Penyelenggara', daftar: true },
        { k: 'jp', l: 'JP', t: 'number', daftar: true }, { k: 'sertifikat', l: 'No. sertifikat' },
      ],
    }),
    reg({
      id: 'kinerja', nama: 'Penilaian Kinerja (PKG/SKP)', ket: 'Hasil penilaian kinerja tahunan',
      hitung: (d) => ({ predikat: predikatSupervisi(n(d.nilai)) }), kolomHitung: [{ k: 'predikat', l: 'Predikat' }],
      fields: [
        { k: 'periode', l: 'Periode / tahun', wajib: true, daftar: true }, { k: 'pegawai', l: 'Guru / pegawai', t: 'pegawai', wajib: true, daftar: true },
        { k: 'nilai', l: 'Nilai akhir (0-100)', t: 'number', daftar: true }, { k: 'penilai', l: 'Penilai', t: 'pegawai', daftar: true }, { k: 'catatan', l: 'Rekomendasi', span: 4 },
      ],
    }),
    reg({
      id: 'tamu', nama: 'Buku Tamu', ket: 'Kunjungan tamu dinas dan umum', tanggal: 'tanggal',
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'jam', l: 'Jam', t: 'time', daftar: true },
        { k: 'nama', l: 'Nama tamu', wajib: true, daftar: true }, { k: 'instansi', l: 'Instansi / alamat', daftar: true },
        { k: 'keperluan', l: 'Keperluan', span: 2, daftar: true }, { k: 'bertemu', l: 'Bertemu dengan', daftar: true }, { k: 'telp', l: 'No. HP' },
      ],
    }),
    reg({
      id: 'mou', nama: 'Kerja Sama / MoU', ket: 'Kemitraan dengan instansi, DUDI, puskesmas, dll.', tanggal: 'mulai', lampiran: true,
      fields: [
        { k: 'mitra', l: 'Mitra', span: 2, wajib: true, daftar: true }, { k: 'bidang', l: 'Bidang kerja sama', span: 2, daftar: true },
        { k: 'nomor', l: 'Nomor', daftar: true }, { k: 'mulai', l: 'Mulai', t: 'date', daftar: true }, { k: 'selesai', l: 'Berakhir', t: 'date', daftar: true },
      ],
    }),
    reg({
      id: 'komite', nama: 'Komite Sekolah / Paguyuban', ket: 'Susunan pengurus dan unsur',
      fields: [
        { k: 'nama', l: 'Nama', wajib: true, daftar: true }, { k: 'jabatan', l: 'Jabatan', daftar: true },
        { k: 'unsur', l: 'Unsur', t: 'select', opsi: ['Orang tua/wali', 'Tokoh masyarakat', 'Pakar pendidikan'], daftar: true }, { k: 'telp', l: 'No. HP', daftar: true },
      ],
    }),
    reg({
      id: 'humas', nama: 'Kegiatan Humas & Publikasi', ket: 'Publikasi, kunjungan, sosialisasi', tanggal: 'tanggal', lampiran: true,
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', daftar: true }, { k: 'kegiatan', l: 'Kegiatan', span: 2, wajib: true, daftar: true },
        { k: 'media', l: 'Media / sasaran', daftar: true }, { k: 'tautan', l: 'Tautan publikasi', span: 2 },
      ],
    }),
    dok('duk', 'Daftar Urut Kepangkatan (DUK)', 'Untuk sekolah negeri, diperbarui tiap tahun'),
    dok('adart-komite', 'AD/ART dan SK Komite Sekolah', 'Masa bakti komite', true),
  ],
}

// ---------- 04 Umum / Kelembagaan ----------
const umum: Bidang = {
  id: 'umum', no: '04', nama: 'Administrasi Umum / Kelembagaan', ket: 'Dokumen legal dan operasional lembaga', tema: 'ungu', ikon: 'umum',
  items: [
    hal('pengaturan', 'Profil Sekolah', 'Identitas, NPSN, alamat, logo, tahun ajaran'),
    reg({
      id: 'notulen', nama: 'Notulen Rapat', ket: 'Rapat dinas, dewan guru, komite, orang tua', tanggal: 'tanggal', cetak: 'notulen', lampiran: true,
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'jam', l: 'Waktu', t: 'time' }, { k: 'tempat', l: 'Tempat' },
        { k: 'jenis', l: 'Jenis rapat', t: 'select', opsi: ['Rapat dinas', 'Rapat dewan guru', 'Rapat komite', 'Rapat orang tua', 'Rapat yayasan'], daftar: true },
        { k: 'pimpinan', l: 'Pimpinan rapat', t: 'pegawai', daftar: true }, { k: 'notulis', l: 'Notulis', t: 'pegawai' },
        { k: 'peserta', l: 'Peserta (jumlah / daftar)', span: 2 }, { k: 'agenda', l: 'Agenda', t: 'textarea', span: 4, wajib: true, daftar: true },
        { k: 'hasil', l: 'Hasil / keputusan', t: 'textarea', span: 4 },
      ],
    }),
    reg({
      id: 'agenda', nama: 'Agenda Kegiatan Sekolah', ket: 'Rencana dan realisasi kegiatan', tanggal: 'tanggal',
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'kegiatan', l: 'Kegiatan', span: 2, wajib: true, daftar: true },
        { k: 'tempat', l: 'Tempat', daftar: true }, { k: 'pj', l: 'Penanggung jawab', t: 'pegawai', daftar: true },
        { k: 'status', l: 'Status', t: 'select', opsi: ['Rencana', 'Terlaksana', 'Ditunda', 'Batal'], daftar: true },
      ],
    }),
    reg({
      id: 'struktur', nama: 'Struktur Organisasi', ket: 'Jabatan dan pejabat sekolah',
      fields: [
        { k: 'jabatan', l: 'Jabatan', wajib: true, daftar: true }, { k: 'pegawai', l: 'Pejabat', t: 'pegawai', daftar: true },
        { k: 'sk', l: 'Dasar SK', daftar: true }, { k: 'urut', l: 'Urutan', t: 'number' },
      ],
    }),
    dok('izin-op', 'Izin Operasional', 'Izin pendirian/operasional dari dinas pendidikan', true),
    dok('akta-yys', 'Akta Pendirian Yayasan & SK Kemenkumham', 'Untuk sekolah swasta'),
    dok('npsn', 'Sertifikat NPSN', 'Unduh dari laman referensi data kemendikdasmen'),
    dok('akreditasi', 'Sertifikat Akreditasi', 'BAN-PDM, catat masa berlakunya', true),
    dok('kosp', 'Kurikulum Operasional Satuan Pendidikan (KOSP)', 'Disahkan kepala sekolah/dinas tiap tahun', true),
    dok('visi-misi', 'Visi, Misi, dan Tujuan Sekolah', 'Dipasang dan termuat di KOSP'),
    dok('rkjm', 'RKJM / RKS (4 tahunan)', 'Rencana kerja jangka menengah', true),
    dok('rkt', 'Rencana Kerja Tahunan (RKT)', 'Selaras dengan RKAS dan rapor pendidikan', true),
    dok('rapor-pend', 'Rapor Pendidikan & Perencanaan Berbasis Data', 'Unduhan rapor pendidikan dan rencana tindak lanjut'),
    dok('tatib-sekolah', 'Tata Tertib Sekolah', 'Untuk warga sekolah'),
    dok('sop', 'SOP Layanan Sekolah', 'Layanan mutasi, legalisir, pengaduan'),
  ],
}

// ---------- 05 Kepala Sekolah ----------
const kepsek: Bidang = {
  id: 'kepsek', no: '05', nama: 'Administrasi Kepala Sekolah', ket: 'Dokumen manajerial kepala sekolah', tema: 'biru', ikon: 'kepsek',
  items: [
    reg({
      id: 'prokerks', nama: 'Program Kerja Kepala Sekolah', ket: 'Program tahunan, sasaran, dan capaian', total: ['anggaran'],
      fields: [
        { k: 'bidang', l: 'Bidang', t: 'select', opsi: ['Kurikulum', 'Kesiswaan', 'SDM', 'Sarpras', 'Keuangan', 'Humas', 'Kelembagaan'], daftar: true },
        { k: 'program', l: 'Program / kegiatan', span: 2, wajib: true, daftar: true }, { k: 'sasaran', l: 'Sasaran / indikator', span: 2, daftar: true },
        { k: 'waktu', l: 'Waktu', daftar: true }, { k: 'anggaran', l: 'Anggaran', t: 'rupiah', daftar: true }, { k: 'pj', l: 'PJ', t: 'pegawai', daftar: true },
        { k: 'status', l: 'Status', t: 'select', opsi: ['Belum mulai', 'Berjalan', 'Selesai'], daftar: true },
      ],
    }),
    reg({
      id: 'supervisi', nama: 'Supervisi Akademik', ket: 'Jadwal dan hasil supervisi pembelajaran guru', tanggal: 'tanggal', cetak: 'supervisi',
      hitung: (d) => {
        const xs = [d.perencanaan, d.pelaksanaan, d.penilaian].map(n).filter((x) => x > 0)
        const v = xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : undefined
        return { nilai: v, predikat: v ? predikatSupervisi(v) : undefined }
      },
      kolomHitung: [{ k: 'nilai', l: 'Nilai' }, { k: 'predikat', l: 'Predikat' }],
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'guru', l: 'Guru', t: 'pegawai', wajib: true, daftar: true },
        { k: 'rombel', l: 'Kelas', t: 'rombel', daftar: true }, { k: 'mapel', l: 'Mapel', t: 'mapel', daftar: true },
        { k: 'status', l: 'Status', t: 'select', opsi: ['Terjadwal', 'Selesai'], daftar: true },
        { k: 'perencanaan', l: 'Skor perencanaan (0-100)', t: 'number' }, { k: 'pelaksanaan', l: 'Skor pelaksanaan (0-100)', t: 'number' }, { k: 'penilaian', l: 'Skor asesmen (0-100)', t: 'number' },
        { k: 'temuan', l: 'Temuan / kekuatan', t: 'textarea', span: 2 }, { k: 'tindak', l: 'Rekomendasi tindak lanjut', t: 'textarea', span: 2 },
      ],
    }),
    reg({
      id: 'pembinaan', nama: 'Buku Pembinaan Guru & Pegawai', ket: 'Catatan pembinaan, teguran, dan pendampingan', tanggal: 'tanggal',
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'pegawai', l: 'Guru / pegawai', t: 'pegawai', wajib: true, daftar: true },
        { k: 'masalah', l: 'Permasalahan', span: 2, daftar: true }, { k: 'pembinaan', l: 'Bentuk pembinaan', span: 2, daftar: true }, { k: 'hasil', l: 'Hasil', span: 4 },
      ],
    }),
    reg({
      id: 'agenda-ks', nama: 'Buku Agenda Kepala Sekolah', ket: 'Kegiatan harian kepala sekolah', tanggal: 'tanggal',
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'kegiatan', l: 'Kegiatan', span: 2, wajib: true, daftar: true },
        { k: 'tempat', l: 'Tempat', daftar: true }, { k: 'hasil', l: 'Hasil / catatan', span: 4, daftar: true },
      ],
    }),
    reg({
      id: 'pbd', nama: 'Tindak Lanjut Rapor Pendidikan (PBD)', ket: 'Identifikasi, refleksi, benahi',
      fields: [
        { k: 'indikator', l: 'Indikator rapor pendidikan', span: 2, wajib: true, daftar: true }, { k: 'capaian', l: 'Capaian', t: 'select', opsi: ['Baik', 'Sedang', 'Kurang'], daftar: true },
        { k: 'akar', l: 'Akar masalah', span: 2, daftar: true }, { k: 'benahi', l: 'Kegiatan benahi', span: 2, daftar: true }, { k: 'ket', l: 'Catatan', span: 4 },
      ],
    }),
    dok('sk-ks', 'SK Pengangkatan Kepala Sekolah', 'Termasuk masa tugas', true),
    dok('pkks', 'Penilaian Kinerja Kepala Sekolah (PKKS)', 'Hasil penilaian dari pengawas'),
    dok('lpj-ks', 'Laporan Pertanggungjawaban Kepala Sekolah', 'Laporan akhir tahun pelajaran'),
    dok('prog-supervisi', 'Program Supervisi Akademik', 'Jadwal dan instrumen supervisi tahun ini'),
  ],
}

// ---------- 06 Keuangan ----------
const keuangan: Bidang = {
  id: 'keuangan', no: '06', nama: 'Administrasi Keuangan', ket: 'Pengelolaan dan pertanggungjawaban keuangan lembaga', tema: 'kuning', ikon: 'uang',
  items: [
    reg({
      id: 'bku', nama: 'Buku Kas Umum (BKU)', ket: 'Penerimaan dan pengeluaran dengan saldo berjalan', tanggal: 'tanggal', lampiran: true,
      kas: { masuk: 'masuk', keluar: 'keluar', kelompok: 'sumber' },
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'bukti', l: 'No. bukti', daftar: true },
        { k: 'kode', l: 'Kode rekening / kegiatan', daftar: true }, { k: 'uraian', l: 'Uraian', span: 2, wajib: true, daftar: true },
        { k: 'sumber', l: 'Sumber dana', t: 'select', opsi: SUMBER_DANA, wajib: true, daftar: true },
        { k: 'masuk', l: 'Penerimaan', t: 'rupiah', daftar: true }, { k: 'keluar', l: 'Pengeluaran', t: 'rupiah', daftar: true },
      ],
    }),
    reg({
      id: 'pajak', nama: 'Buku Pembantu Pajak', ket: 'Pajak dipungut dan disetor', tanggal: 'tanggal', total: ['pungut', 'setor'],
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'bukti', l: 'No. bukti', daftar: true }, { k: 'uraian', l: 'Uraian', span: 2, daftar: true },
        { k: 'jenis', l: 'Jenis pajak', t: 'select', opsi: ['PPN', 'PPh 21', 'PPh 22', 'PPh 23', 'PPh Final', 'Pajak Daerah'], daftar: true },
        { k: 'pungut', l: 'Dipungut', t: 'rupiah', daftar: true }, { k: 'setor', l: 'Disetor', t: 'rupiah', daftar: true }, { k: 'ntpn', l: 'NTPN / kode billing' },
      ],
    }),
    reg({
      id: 'rkas', nama: 'Rencana Kegiatan dan Anggaran Sekolah (RKAS)', ket: 'Anggaran per kegiatan dan sumber dana', total: ['jumlah'],
      hitung: (d) => ({ jumlah: n(d.volume) * n(d.harga) || undefined }), kolomHitung: [{ k: 'jumlah', l: 'Jumlah', rupiah: true }],
      fields: [
        { k: 'kode', l: 'Kode', daftar: true }, { k: 'kegiatan', l: 'Kegiatan / komponen', span: 2, wajib: true, daftar: true },
        { k: 'sumber', l: 'Sumber dana', t: 'select', opsi: SUMBER_DANA, daftar: true }, { k: 'volume', l: 'Volume', t: 'number', daftar: true },
        { k: 'satuan', l: 'Satuan', daftar: true }, { k: 'harga', l: 'Harga satuan', t: 'rupiah', daftar: true },
        { k: 'tw', l: 'Triwulan', t: 'select', opsi: ['I', 'II', 'III', 'IV'], daftar: true },
      ],
    }),
    reg({
      id: 'bayar', nama: 'Pembayaran Peserta Didik', ket: 'SPP, uang pangkal, seragam, kegiatan; cetak kuitansi', tanggal: 'tanggal', cetak: 'kuitansi', total: ['jumlah'],
      nomor: { k: 'noKw', buat: (u, d) => `KW/${thn(d.tanggal)}/${pad3(u)}` },
      fields: [
        { k: 'noKw', l: 'No. kuitansi', daftar: true }, { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true },
        { k: 'siswa', l: 'Peserta didik', t: 'siswa', wajib: true, daftar: true },
        { k: 'jenis', l: 'Jenis', t: 'select', opsi: ['SPP', 'Uang pangkal', 'Seragam', 'Buku', 'Kegiatan', 'Infak/Sumbangan', 'Lainnya'], daftar: true },
        { k: 'periode', l: 'Bulan / periode', daftar: true }, { k: 'jumlah', l: 'Jumlah', t: 'rupiah', wajib: true, daftar: true },
        { k: 'metode', l: 'Metode', t: 'select', opsi: ['Tunai', 'Transfer', 'QRIS'], daftar: true },
      ],
    }),
    reg({
      id: 'honor', nama: 'Daftar Gaji / Honor', ket: 'Honor guru dan pegawai per bulan', total: ['bersih'],
      hitung: (d) => ({ bersih: n(d.pokok) + n(d.tunjangan) - n(d.potongan) || undefined }), kolomHitung: [{ k: 'bersih', l: 'Diterima', rupiah: true }],
      fields: [
        { k: 'bulan', l: 'Bulan', t: 'select', opsi: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'], wajib: true, daftar: true },
        { k: 'tahun', l: 'Tahun', t: 'number', daftar: true }, { k: 'pegawai', l: 'Pegawai', t: 'pegawai', wajib: true, daftar: true },
        { k: 'pokok', l: 'Honor pokok', t: 'rupiah', daftar: true }, { k: 'tunjangan', l: 'Tunjangan', t: 'rupiah', daftar: true }, { k: 'potongan', l: 'Potongan', t: 'rupiah', daftar: true },
      ],
    }),
    dok('sk-bendahara', 'SK Bendahara Sekolah', 'Bendahara BOSP / BOP', true),
    dok('lap-bosp', 'Laporan Realisasi Penggunaan Dana BOSP', 'Laporan per tahap di ARKAS/SIPLah'),
    dok('rek-koran', 'Rekening Koran', 'Salinan per bulan'),
    dok('spj', 'SPJ dan Bukti Pengeluaran', 'Kuitansi, nota, faktur, bukti pajak'),
  ],
}

/** Kelompok alat sesuai referensi Dapodik (sarana PAUD + umum). */
export const KELOMPOK_ALAT = [
  'APE Sensori Motorik', 'APE Bermain Pembangunan', 'APE Bermain Peran', 'APE Bermain Keaksaraan', 'Bahan Bermain dari Lingkungan', 'APE Outdoor',
  'Meubelair', 'Elektronik / TIK', 'Alat Peraga / Laboratorium', 'Olahraga', 'Kesenian', 'Lainnya',
]

// ---------- 07 Sarana Prasarana ----------
const sarpras: Bidang = {
  id: 'sarpras', no: '07', nama: 'Administrasi Perlengkapan / Sarana Prasarana', ket: 'Inventaris dan pengelolaan fasilitas lembaga', tema: 'lavender', ikon: 'prasarana',
  items: [
    hal('prasarana', 'Prasarana (Dapodik)', 'Tanah, bangunan, ruang, dan pengajuan perubahan data'),
    reg({
      id: 'inventaris', nama: 'Buku Inventaris Barang', ket: 'Sarana/barang milik sekolah; cetak Kartu Inventaris Ruang (KIR)', total: ['jumlah', 'nilai'],
      hitung: (d) => ({ nilai: n(d.jumlah) * n(d.harga) || undefined }), kolomHitung: [{ k: 'nilai', l: 'Nilai', rupiah: true }],
      kelompokCetak: { k: 'ruang', judul: 'KARTU INVENTARIS RUANG' }, lampiran: true,
      fields: [
        { k: 'kode', l: 'Kode barang', daftar: true }, { k: 'nama', l: 'Nama barang', span: 2, wajib: true, daftar: true }, { k: 'merk', l: 'Merek / tipe', daftar: true },
        { k: 'ruang', l: 'Lokasi / ruang', t: 'ruang', daftar: true }, { k: 'tahun', l: 'Tahun perolehan', t: 'number', daftar: true },
        { k: 'sumber', l: 'Sumber dana', t: 'select', opsi: SUMBER_DANA, daftar: true }, { k: 'jumlah', l: 'Jumlah', t: 'number', wajib: true, daftar: true },
        { k: 'satuan', l: 'Satuan', ph: 'unit, buah, set' }, { k: 'harga', l: 'Harga satuan', t: 'rupiah' },
        { k: 'kondisi', l: 'Kondisi', t: 'select', opsi: KONDISI, daftar: true },
        { k: 'kelompok', l: 'Kelompok alat (Dapodik)', t: 'select', opsi: KELOMPOK_ALAT, daftar: true },
        { k: 'kepemilikan', l: 'Kepemilikan', t: 'select', opsi: ['Milik', 'Sewa', 'Pinjam'] },
      ],
    }),
    reg({
      id: 'buku-teks', nama: 'Buku Teks & Pendamping (SIBI)', ket: 'Buku pelajaran sesuai referensi SIBI Kemendikdasmen', total: ['jumlah'],
      fields: [
        { k: 'judul', l: 'Judul buku', span: 2, wajib: true, daftar: true }, { k: 'mapel', l: 'Mata pelajaran', daftar: true },
        { k: 'kelas', l: 'Kelas / tingkat', daftar: true }, { k: 'kurikulum', l: 'Kurikulum', t: 'select', opsi: ['Kurikulum Merdeka', 'Kurikulum 2013', 'Lainnya'], daftar: true },
        { k: 'jenis', l: 'Jenis', t: 'select', opsi: ['Buku Siswa', 'Buku Guru', 'Buku Pendamping', 'Buku Nonteks'], daftar: true },
        { k: 'penerbit', l: 'Penerbit', daftar: true }, { k: 'tahun', l: 'Tahun terbit', t: 'number' }, { k: 'isbn', l: 'ISBN', daftar: true },
        { k: 'jumlah', l: 'Jumlah eksemplar', t: 'number', wajib: true, daftar: true }, { k: 'kondisi', l: 'Kondisi', t: 'select', opsi: KONDISI },
      ],
    }),
    reg({
      id: 'pinjam', nama: 'Peminjaman Barang / Ruang', ket: 'Pencatatan pinjam dan pengembalian', tanggal: 'tanggal',
      hitung: (d) => ({ status: d.kembali ? 'Dikembalikan' : d.rencana && String(d.rencana) < new Date().toISOString().slice(0, 10) ? 'Terlambat' : 'Dipinjam' }),
      kolomHitung: [{ k: 'status', l: 'Status' }],
      fields: [
        { k: 'tanggal', l: 'Tanggal pinjam', t: 'date', wajib: true, daftar: true }, { k: 'peminjam', l: 'Peminjam', wajib: true, daftar: true },
        { k: 'barang', l: 'Barang / ruang', span: 2, wajib: true, daftar: true }, { k: 'jumlah', l: 'Jumlah', t: 'number', daftar: true },
        { k: 'rencana', l: 'Rencana kembali', t: 'date', daftar: true }, { k: 'kembali', l: 'Tanggal kembali', t: 'date', daftar: true }, { k: 'ket', l: 'Kondisi saat kembali', span: 2 },
      ],
    }),
    reg({
      id: 'pelihara', nama: 'Pemeliharaan & Perbaikan', ket: 'Perawatan berkala dan perbaikan kerusakan', tanggal: 'tanggal', total: ['biaya'], lampiran: true,
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'objek', l: 'Barang / ruang', span: 2, wajib: true, daftar: true },
        { k: 'kerusakan', l: 'Kerusakan / kegiatan', span: 2, daftar: true }, { k: 'pelaksana', l: 'Pelaksana', daftar: true }, { k: 'biaya', l: 'Biaya', t: 'rupiah', daftar: true },
      ],
    }),
    reg({
      id: 'persediaan', nama: 'Buku Persediaan (Barang Habis Pakai)', ket: 'ATK, bahan kebersihan, bahan ajar', tanggal: 'tanggal', total: ['masuk', 'keluar'],
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'barang', l: 'Barang', span: 2, wajib: true, daftar: true }, { k: 'satuan', l: 'Satuan', daftar: true },
        { k: 'masuk', l: 'Masuk', t: 'number', daftar: true }, { k: 'keluar', l: 'Keluar', t: 'number', daftar: true }, { k: 'ket', l: 'Keterangan / pemakai', span: 2, daftar: true },
      ],
    }),
    reg({
      id: 'hapus-brg', nama: 'Penghapusan Barang', ket: 'Barang rusak berat/hilang yang dihapus dari inventaris', tanggal: 'tanggal', lampiran: true,
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'barang', l: 'Barang', span: 2, wajib: true, daftar: true }, { k: 'jumlah', l: 'Jumlah', t: 'number', daftar: true },
        { k: 'alasan', l: 'Alasan', t: 'select', opsi: ['Rusak berat', 'Hilang', 'Usang', 'Dihibahkan'], daftar: true }, { k: 'ba', l: 'No. berita acara', daftar: true },
      ],
    }),
    dok('sk-sarpras', 'SK Tim / Wakasek Sarana Prasarana', 'Penanggung jawab inventaris'),
    dok('bast', 'Berita Acara Serah Terima (BAST) Barang', 'Bantuan pemerintah / pengadaan'),
    dok('denah', 'Denah Sekolah', 'Sesuai data prasarana Dapodik'),
  ],
}

// ---------- 08 TU / Persuratan ----------
const tu: Bidang = {
  id: 'tu', no: '08', nama: 'Administrasi TU / Persuratan', ket: 'Surat-menyurat dan kearsipan dokumen lembaga', tema: 'jingga', ikon: 'surat',
  items: [
    reg({
      id: 'surat-masuk', nama: 'Buku Agenda Surat Masuk', ket: 'Penerimaan surat dan lembar disposisi', tanggal: 'tglTerima', cetak: 'disposisi', lampiran: true,
      nomor: { k: 'agenda', buat: (u) => String(u) },
      fields: [
        { k: 'agenda', l: 'No. agenda', daftar: true }, { k: 'tglTerima', l: 'Tanggal terima', t: 'date', wajib: true, daftar: true },
        { k: 'nomor', l: 'Nomor surat', daftar: true }, { k: 'tglSurat', l: 'Tanggal surat', t: 'date' },
        { k: 'pengirim', l: 'Pengirim', span: 2, wajib: true, daftar: true }, { k: 'perihal', l: 'Perihal', span: 2, wajib: true, daftar: true },
        { k: 'sifat', l: 'Sifat', t: 'select', opsi: ['Biasa', 'Penting', 'Segera', 'Rahasia'], daftar: true },
        { k: 'kepada', l: 'Disposisi kepada', t: 'pegawai', daftar: true }, { k: 'disposisi', l: 'Isi disposisi', t: 'textarea', span: 2 },
      ],
    }),
    reg({
      id: 'surat-keluar', nama: 'Buku Agenda Surat Keluar', ket: 'Penomoran surat otomatis dan arsip', tanggal: 'tanggal', lampiran: true,
      nomor: { k: 'nomor', buat: (u, d, s) => `${pad3(u)}/${d.klas || '421'}/${kodeSekolah(s)}/${blnRomawi(d.tanggal)}/${thn(d.tanggal)}` },
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true },
        { k: 'klas', l: 'Kode klasifikasi', t: 'select', opsi: ['421', '421.1', '421.2', '421.3', '422', '423', '005', '800', '900'], daftar: false },
        { k: 'nomor', l: 'Nomor surat (otomatis)', span: 2, daftar: true }, { k: 'tujuan', l: 'Tujuan', span: 2, wajib: true, daftar: true },
        { k: 'perihal', l: 'Perihal', span: 2, wajib: true, daftar: true }, { k: 'pembuat', l: 'Konseptor', t: 'pegawai' },
      ],
    }),
    reg({
      id: 'suket', nama: 'Surat Keterangan Peserta Didik', ket: 'Buat dan cetak surat keterangan aktif, pindah, berkelakuan baik', tanggal: 'tanggal', cetak: 'suket',
      nomor: { k: 'nomor', buat: (u, d, s) => `${pad3(u)}/421.2/${kodeSekolah(s)}/${blnRomawi(d.tanggal)}/${thn(d.tanggal)}` },
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', wajib: true, daftar: true }, { k: 'nomor', l: 'Nomor (otomatis)', span: 2, daftar: true },
        { k: 'jenis', l: 'Jenis surat', t: 'select', opsi: ['Keterangan Aktif Belajar', 'Keterangan Pindah Sekolah', 'Keterangan Berkelakuan Baik'], wajib: true, span: 2, daftar: true },
        { k: 'siswa', l: 'Peserta didik', t: 'siswa', wajib: true, span: 2, daftar: true }, { k: 'keperluan', l: 'Keperluan', span: 2, daftar: true },
      ],
    }),
    reg({
      id: 'sk', nama: 'Register Surat Keputusan (SK)', ket: 'SK kepala sekolah / yayasan', tanggal: 'tanggal', lampiran: true,
      fields: [
        { k: 'nomor', l: 'Nomor SK', daftar: true }, { k: 'tanggal', l: 'Tanggal', t: 'date', daftar: true }, { k: 'tentang', l: 'Tentang', span: 2, wajib: true, daftar: true },
        { k: 'penandatangan', l: 'Penandatangan', daftar: true },
      ],
    }),
    reg({
      id: 'arsip', nama: 'Daftar Arsip', ket: 'Lokasi penyimpanan dan masa retensi arsip', tanggal: 'tanggal', lampiran: true,
      fields: [
        { k: 'tanggal', l: 'Tanggal arsip', t: 'date', daftar: true }, { k: 'nama', l: 'Nama berkas', span: 2, wajib: true, daftar: true },
        { k: 'kategori', l: 'Kategori', t: 'select', opsi: ['Kesiswaan', 'Kepegawaian', 'Keuangan', 'Kurikulum', 'Sarpras', 'Kelembagaan', 'Lainnya'], daftar: true },
        { k: 'lokasi', l: 'Lokasi (lemari/rak/boks)', daftar: true }, { k: 'retensi', l: 'Retensi', t: 'select', opsi: ['Aktif 1 th', 'Aktif 2 th', 'Inaktif 5 th', 'Permanen'], daftar: true },
      ],
    }),
    dok('tnd', 'Pedoman Tata Naskah Dinas', 'Format surat dinas yang berlaku'),
    dok('klas-arsip', 'Pedoman Klasifikasi Arsip', 'Kode klasifikasi untuk penomoran surat'),
  ],
}

export const BIDANG: Bidang[] = [anak, guru, sdm, umum, kepsek, keuangan, sarpras, tu]

export const SEMUA_REGISTER: RegisterDef[] = BIDANG.flatMap((b) => b.items.flatMap((i) => (i.jenis === 'register' ? [i.reg] : [])))
export const registerById = (id: string) => SEMUA_REGISTER.find((r) => r.id === id)
export const DOK_REGISTER = '_dok'
export const dokId = (id: string) => `dok|${id}`

/** Nomor urut berikutnya dalam register (per tahun dari field tanggal bila ada). */
export function urutBerikut(reg: RegisterDef, semua: Arsip[], d: Record<string, NilaiArsip>) {
  const tahun = reg.tanggal ? thn(d[reg.tanggal]) : undefined
  const sama = semua.filter((a) => a.register === reg.id && (!tahun || !reg.tanggal || thn(a.data[reg.tanggal]) === tahun))
  return sama.length + 1
}

export function nomorOtomatis(reg: RegisterDef, semua: Arsip[], d: Record<string, NilaiArsip>) {
  if (!reg.nomor) return d
  if (d[reg.nomor.k]) return d
  return { ...d, [reg.nomor.k]: reg.nomor.buat(urutBerikut(reg, semua, d), d, getSekolah()) }
}

/** Baris dengan kolom hitung, diurutkan tanggal; untuk buku kas ditambah saldo berjalan. */
export function barisRegister(reg: RegisterDef, arsip: Arsip[]) {
  const list = arsip.filter((a) => a.register === reg.id)
  const tg = reg.tanggal
  list.sort((a, b) => (tg ? String(a.data[tg] ?? '').localeCompare(String(b.data[tg] ?? '')) : 0) || a.dibuat.localeCompare(b.dibuat))
  let saldo = 0
  return list.map((a) => {
    const h = reg.hitung?.(a.data) ?? {}
    if (reg.kas) saldo += n(a.data[reg.kas.masuk]) - n(a.data[reg.kas.keluar])
    return { a, d: { ...a.data, ...h } as Record<string, NilaiArsip>, saldo }
  })
}

export function totalKolom(rows: { d: Record<string, NilaiArsip> }[], k: string) {
  return rows.reduce((s, r) => s + n(r.d[k]), 0)
}

/** Ringkasan kelengkapan satu bidang untuk kartu di halaman utama Administrasi. */
export function ringkasBidang(b: Bidang, arsip: Arsip[]) {
  const regs = b.items.filter((i) => i.jenis === 'register').map((i) => (i as { reg: RegisterDef }).reg.id)
  const doks = b.items.filter((i) => i.jenis === 'dokumen') as Extract<ItemDef, { jenis: 'dokumen' }>[]
  const catatan = arsip.filter((a) => regs.includes(a.register)).length
  const dokAda = doks.filter((d) => arsip.find((a) => a.id === dokId(d.id))?.data.status === 'Ada').length
  return { register: regs.length, catatan, dokumen: doks.length, dokAda }
}

/** Dokumen yang masa berlakunya habis dalam `hari` ke depan atau sudah lewat. */
export function dokumenJatuhTempo(arsip: Arsip[], hari = 90, ref = new Date()) {
  const batas = new Date(ref.getTime() + hari * 864e5).toISOString().slice(0, 10)
  const out: { bidang: Bidang; nama: string; berlaku: string; lewat: boolean }[] = []
  for (const b of BIDANG) for (const i of b.items) {
    if (i.jenis !== 'dokumen') continue
    const a = arsip.find((x) => x.id === dokId(i.id))
    const tgl = a?.data.berlaku ? String(a.data.berlaku) : ''
    if (tgl && tgl <= batas) out.push({ bidang: b, nama: i.nama, berlaku: tgl, lewat: tgl < ref.toISOString().slice(0, 10) })
  }
  return out.sort((a, b) => a.berlaku.localeCompare(b.berlaku))
}
