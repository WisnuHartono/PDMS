// Model data inti SIMAS. Semua entitas memakai `id` string (UUID).

export type Jenjang = 'PAUD' | 'TK' | 'SD' | 'SMP' | 'SMA' | 'SMK' | 'PKBM'
export const JENJANG: Jenjang[] = ['PAUD', 'TK', 'SD', 'SMP', 'SMA', 'SMK', 'PKBM']

/** Tingkat kelas yang lazim per jenjang (dipakai untuk pilihan di form Rombel). */
export const TINGKAT_PER_JENJANG: Record<Jenjang, string[]> = {
  PAUD: ['KB', 'TPA'],
  TK: ['A', 'B'],
  SD: ['1', '2', '3', '4', '5', '6'],
  SMP: ['7', '8', '9'],
  SMA: ['10', '11', '12'],
  SMK: ['10', '11', '12'],
  PKBM: ['Keaksaraan Dasar', 'Keaksaraan Lanjutan', 'Paket A', 'Paket B', 'Paket C'],
}

export type JenisKelamin = 'L' | 'P'
export const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya']

export interface Sekolah {
  id: 'profil'
  nama: string
  npsn: string
  nss?: string
  jenjang: Jenjang[]
  alamat: string
  kelurahan?: string
  kecamatan?: string
  kabupaten?: string
  provinsi?: string
  kodePos?: string
  telepon?: string
  email?: string
  website?: string
  kepalaSekolahId?: string
  yayasan?: string
  logo?: string // data URL
  tahunAjaranAktif: string // contoh "2025/2026"
  semesterAktif: 1 | 2
  kotaTtdRapor?: string
  tanggalRapor?: string // yyyy-mm-dd
  // Data satuan pendidikan: identitas, status operasional, akreditasi
  statusSekolah?: 'Negeri' | 'Swasta'
  statusOperasional?: 'Aktif' | 'Tutup sementara' | 'Tutup'
  akreditasi?: 'A' | 'B' | 'C' | 'Belum terakreditasi'
  /** Penetapan dari Dinas/Ditjen (flag) yang membuka jenis rombel khusus. */
  flag?: { kelasRangkap?: string; pjj?: string; kln?: string } // isi = nomor SK penetapan
  validasiTerakhir?: string

  // ---- Identitas & legalitas ----
  statusKepemilikan?: 'Pemerintah Pusat' | 'Pemerintah Daerah' | 'Yayasan' | 'Lainnya'
  skPendirian?: string; tglSkPendirian?: string
  skIzinOperasional?: string; tglSkIzinOperasional?: string
  skAkreditasi?: string; tglAkreditasi?: string; akreditasiBerlaku?: string
  // ---- Lokasi & kontak ----
  rt?: string; rw?: string; dusun?: string; lintang?: string; bujur?: string; fax?: string; mediaSosial?: string
  // ---- Data pelengkap ----
  npwp?: string; namaWajibPajak?: string
  bank?: string; cabangBank?: string; noRekening?: string; atasNamaRekening?: string
  luasTanahMilik?: number; sumberListrik?: string; dayaListrik?: number; aksesInternet?: string
  waktuPenyelenggaraan?: string; mbs?: 'Ya' | 'Tidak'; ketuaKomite?: string
  // ---- Pejabat penandatangan ----
  wakaKurikulumId?: string; bendaharaId?: string; kaTuId?: string; operatorId?: string
  /** Tanda tangan kepala sekolah & stempel (gambar PNG transparan) untuk dicetak pada dokumen. */
  ttdKepsek?: string; stempel?: string; pakaiTtdDigital?: boolean
  // ---- Kop surat & cetak ----
  kop?: KopSetting
  /** Singkatan sekolah untuk nomor surat, mis. "SHB". Default: NPSN. */
  kodeSurat?: string
  ukuranKertas?: 'A4' | 'F4'
  /** Integrasi AI untuk menyusun narasi rapor. Kunci API disimpan di perangkat ini (ikut cadangan terenkripsi). */
  ai?: AiSetting
  /** Tampilan header: kustomisasi logo & nama sekolah. */
  tampilan?: TampilanSetting
}

export interface TampilanSetting {
  logoUkuran?: number // px, 32-96
  logoBentuk?: 'kotak' | 'sudut' | 'lingkaran' | 'tanpa'
  logoLatar?: 'putih' | 'kaca' | 'transparan'
  logoBingkai?: boolean
  logoBayangan?: boolean
  logoIsi?: 'contain' | 'cover'
  logoZoom?: number // persen, 50-250
  logoGeserX?: number // persen, -50..50
  logoGeserY?: number
  namaUkuran?: number // px, 13-26
  tampilLegalitas?: boolean
  tampilNama?: boolean
}

export interface AiSetting {
  aktif: boolean
  penyedia: 'anthropic' | 'openai' | 'gemini' | 'kompatibel'
  endpoint: string
  model: string
  apiKey: string
  gaya: 'ringkas' | 'standar' | 'rinci'
  /** Pesan tambahan guru, mis. "gunakan sapaan Ananda". */
  instruksi?: string
  /** Gaya tulisan alami seperti guru menulis sendiri (default aktif). */
  humanize?: boolean
}

export interface KopSetting {
  /** Logo kiri (mis. logo Pemda/yayasan). Kosong = logo sekolah. */
  logoKiri?: string
  /** Logo kanan: data URL, 'sekolah' = logo sekolah, kosong = tanpa logo. */
  logoKanan?: string
  baris1?: string // mis. PEMERINTAH KABUPATEN BANDUNG / YAYASAN ...
  baris2?: string // mis. DINAS PENDIDIKAN
  namaTampil?: string // default: nama sekolah
  alamatTampil?: string // default: alamat lengkap otomatis
  kontakTampil?: string // default: telepon, email, website otomatis
  tampilNpsn?: boolean; tampilNss?: boolean; tampilAkreditasi?: boolean
  garis?: 'ganda' | 'tebal-tipis' | 'tunggal' | 'tanpa'
  huruf?: 'Times' | 'Arial' | 'Bookman' | 'Cambria'
  ukuranNama?: number // pt
  warnaNama?: string
  ukuranLogo?: number // px — administrasi umum
  ukuranLogoRapor?: number // px, kosong = ukuranLogo
  ukuranLogoSurat?: number // px, kosong = ukuranLogo
  /** Skala logo kanan terhadap logo kiri, persen (50-150). */
  skalaLogoKanan?: number
}

export type StatusSiswa = 'Aktif' | 'Lulus' | 'Mutasi Keluar' | 'Keluar' | 'Meninggal'

export interface OrangTua {
  nama?: string
  nik?: string
  /** Status hidup ayah/ibu kandung */
  statusHidup?: 'Hidup' | 'Wafat'
  pekerjaan?: string
  pendidikan?: string
  telepon?: string
  alamat?: string
}

/** Identitas peserta didik sekaligus isi Buku Induk. */
export interface Siswa {
  id: string
  noInduk: string // NIS / nomor induk sekolah
  nisn?: string
  nik?: string
  nama: string
  namaPanggilan?: string
  jk: JenisKelamin
  tempatLahir?: string
  tanggalLahir?: string
  agama?: string
  kewarganegaraan?: string
  anakKe?: number
  jumlahSaudara?: number
  bahasaRumah?: string
  golDarah?: string
  tinggiBadan?: number
  beratBadan?: number
  riwayatPenyakit?: string
  alamat?: string
  telepon?: string
  tinggalDengan?: string
  ayah: OrangTua
  ibu: OrangTua
  wali: OrangTua
  // Riwayat pendidikan (Buku Induk)
  jenjang: Jenjang
  jenisPendaftaran?: 'Siswa baru' | 'Pindahan' | 'Kembali bersekolah'
  /** Kebekerjaan Luar Negeri (SMK): ditetapkan Ditjen */
  pesertaKln?: boolean
  kompetensiKeahlian?: string
  negaraTujuan?: string
  tanggalMasuk?: string
  diterimaDiKelas?: string
  asalSekolah?: string
  noIjazahAsal?: string
  pindahanDari?: string
  alasanPindah?: string
  // Meninggalkan sekolah
  status: StatusSiswa
  tanggalKeluar?: string
  alasanKeluar?: string
  noIjazah?: string
  melanjutkanKe?: string
  foto?: string // data URL
  catatan?: string
}

export type JenisPegawai = 'Guru' | 'Tenaga Kependidikan' | 'Yayasan'
export type StatusKepegawaian = 'PNS' | 'PPPK' | 'GTY/PTY' | 'GTT/PTT' | 'Honorer' | 'Kontrak' | 'Lainnya'

export interface Pegawai {
  id: string
  nama: string
  gelarDepan?: string
  gelarBelakang?: string
  jenis: JenisPegawai
  jabatan?: string // Kepala Sekolah, Guru Kelas, TU, Bendahara...
  nip?: string
  nuptk?: string
  nik?: string
  jk: JenisKelamin
  tempatLahir?: string
  tanggalLahir?: string
  agama?: string
  alamat?: string
  telepon?: string
  email?: string
  statusKepegawaian?: StatusKepegawaian
  pendidikanTerakhir?: string
  jurusan?: string
  tmt?: string // terhitung mulai tanggal
  mapelIds?: string[]
  // Sertifikasi & tugas
  noSertifikatPendidik?: string
  tahunSertifikasi?: number
  bidangSertifikasi?: string
  tugasTambahan?: string
  aktif: boolean
  foto?: string
}

export type JenisRombel = 'Reguler' | 'Kelas Rangkap' | 'PJJ' | 'Keaksaraan' | 'Kebekerjaan LN' | 'Praktik'
export const JENIS_ROMBEL: JenisRombel[] = ['Reguler', 'Kelas Rangkap', 'PJJ', 'Keaksaraan', 'Kebekerjaan LN', 'Praktik']

/** Pembelajaran: mapel yang diajarkan di rombel, guru pengampu, dan jam per minggu. */
export interface Pembelajaran { mapelId: string; guruId?: string; jp: number; skMengajar?: string }

export interface Rombel {
  id: string
  nama: string // contoh "7A"
  jenjang: Jenjang
  tingkat: string
  tahunAjaran: string
  waliKelasId?: string
  kurikulumId: string
  siswaIds: string[]
  jenis?: JenisRombel // default Reguler
  /** Kelas rangkap: true = rombel induk; rombel turunan menunjuk indukId */
  rombelInduk?: boolean
  indukId?: string
  ruang?: string
  /** Keaksaraan: program/layanan dan tutor */
  program?: string
  /** Kebekerjaan Luar Negeri */
  negaraTujuan?: string
  kompetensi?: string
  kategoriMapel?: 'Bahasa Asing' | 'Produktif' | 'PJOK'
  pembelajaran?: Pembelajaran[]
}

export interface Mapel {
  id: string
  kode: string
  nama: string
  kelompok?: string // A/B/C, Umum/Muatan Lokal, dll.
  jenjang: Jenjang[]
  urutan: number
  kkm?: number // K13: KKM. Merdeka: KKTP
}

export type StatusHadir = 'H' | 'S' | 'I' | 'A' | 'T' | 'C' | 'DL'
export const STATUS_HADIR_LABEL: Record<StatusHadir, string> = {
  H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa', T: 'Terlambat', C: 'Cuti', DL: 'Dinas Luar',
}
export const STATUS_HADIR_SISWA: StatusHadir[] = ['H', 'S', 'I', 'A', 'T']
export const STATUS_HADIR_PEGAWAI: StatusHadir[] = ['H', 'S', 'I', 'A', 'T', 'C', 'DL']

export interface CatatanHadir {
  status: StatusHadir
  masuk?: string // HH:MM
  pulang?: string
  ket?: string
}

/** Satu lembar absensi: satu tanggal untuk satu rombel (siswa) atau seluruh pegawai. */
export interface Absensi {
  id: string // `${jenis}|${tanggal}|${rombelId ?? 'pegawai'}`
  jenis: 'siswa' | 'pegawai'
  tanggal: string // yyyy-mm-dd
  rombelId?: string
  data: Record<string, CatatanHadir> // key: siswaId / pegawaiId
}

/**
 * Nilai satu mapel untuk satu rombel di satu semester.
 * `data[siswaId]` berisi komponen bebas sesuai definisi kurikulum (lihat curricula.ts).
 */
export interface LembarNilai {
  id: string // `${tahunAjaran}|${semester}|${rombelId}|${mapelId}`
  tahunAjaran: string
  semester: 1 | 2
  rombelId: string
  mapelId: string
  /** Daftar tujuan pembelajaran (Merdeka) / KD (K13) / learning objective, dipakai untuk deskripsi. */
  tujuan: string[]
  data: Record<string, Record<string, number | string | undefined>>
}

/** Data rapor non-mapel per siswa per semester: sikap, ekskul, catatan wali kelas, kenaikan, dll. */
export interface CatatanRapor {
  id: string // `${tahunAjaran}|${semester}|${siswaId}`
  tahunAjaran: string
  semester: 1 | 2
  siswaId: string
  rombelId: string
  /** Isian naratif bebas sesuai kurikulum, mis. sikap spiritual, P5, elemen PAUD. */
  isian: Record<string, string>
  ekskul: { nama: string; predikat: string; ket?: string }[]
  catatanWali?: string
  keputusan?: string // Naik ke kelas ... / Lulus
  sakitManual?: number
  izinManual?: number
  alpaManual?: number
}

export interface Ekskul {
  id: string
  nama: string
  pembinaId?: string
}

export interface Collections {
  sekolah: Sekolah
  siswa: Siswa
  pegawai: Pegawai
  rombel: Rombel
  mapel: Mapel
  absensi: Absensi
  nilai: LembarNilai
  rapor: CatatanRapor
  ekskul: Ekskul
  tanah: Tanah
  bangunan: Bangunan
  ruang: Ruang
  pengajuan: PengajuanPrasarana
  arsip: Arsip
}
export type CollectionName = keyof Collections
export const COLLECTIONS: CollectionName[] = ['sekolah', 'siswa', 'pegawai', 'rombel', 'mapel', 'absensi', 'nilai', 'rapor', 'ekskul', 'tanah', 'bangunan', 'ruang', 'pengajuan', 'arsip']

// ---------- Prasarana ----------

export type StatusKepemilikan = 'Milik' | 'Sewa' | 'Pinjam' | 'Pinjam Pakai' | 'Bukan Milik'
export type AlasanPenghapusan = 'Bencana' | 'Dibongkar' | 'Dipindahtangankan' | 'Disita' | 'Koreksi Data'

/** Penanda objek yang sudah dihapus dari pencatatan (setelah pengajuan penghapusan disetujui). */
export interface Penghapusan {
  tanggal: string
  alasan: AlasanPenghapusan
}

export interface Tanah {
  id: string
  nama: string
  noSertifikat?: string
  panjang?: number
  lebar?: number
  luas?: number
  luasTersedia?: number
  nilaiPerolehan?: number
  statusKepemilikan?: StatusKepemilikan
  keterangan?: string
  samaDenganSekolah: boolean
  provinsi?: string
  kabupaten?: string
  kecamatan?: string
  desa?: string
  alamatJalan?: string
  rt?: string
  rw?: string
  dusun?: string
  kodePos?: string
  lintang?: number
  bujur?: number
  dihapus?: Penghapusan
}

export interface Bangunan {
  id: string
  tanahId?: string
  jenisPrasarana: string
  nama: string
  panjang?: number
  lebar?: number
  luasTapak?: number
  statusKepemilikan?: StatusKepemilikan
  nilaiPerolehan?: number
  jumlahLantai?: number
  tahunPembangunan?: number
  tanggalSk?: string
  keterangan?: string
  bobotKerusakan?: number
  dihapus?: Penghapusan
}

export interface Ruang {
  id: string
  bangunanId?: string
  jenisPrasarana: string
  kode: string
  nama: string
  registrasi?: string
  lantaiKe?: number
  panjang?: number
  lebar?: number
  luas?: number
  kapasitas?: number
  bobotKerusakan?: number
  dihapus?: Penghapusan
}

export type ObjekPrasarana = 'Tanah' | 'Bangunan' | 'Ruang'
export type JenisPengajuan = 'Penambahan' | 'Perbaikan' | 'Penghapusan'
export type StatusPengajuan = 'Draf' | 'Diajukan' | 'Proses Verifikasi' | 'Disetujui' | 'Ditolak' | 'Dibatalkan'
export type JenisDokumen = 'Sertifikat tanah' | 'Foto lahan' | 'Foto bangunan' | 'Denah sekolah' | 'Surat BPKAD/yayasan' | 'Surat keterangan kepala sekolah' | 'Dokumen lain'

export interface DokumenPengajuan {
  id: string
  jenis: JenisDokumen
  namaBerkas: string
  ukuran: number
  data?: string // data URL PDF
}

export interface PengajuanPrasarana {
  id: string
  nama: string // Nama Ajuan
  objek: ObjekPrasarana
  jenis: JenisPengajuan
  objekId: string // tanah/bangunan/ruang yang diajukan (untuk penambahan: data baru yang sudah diisi)
  alasan: string
  tanggalPenghapusan?: string
  alasanPenghapusan?: AlasanPenghapusan
  dokumen: DokumenPengajuan[]
  periksa: boolean[] // daftar periksa mandiri sebelum pengiriman
  status: StatusPengajuan
  dibuat: string
  diajukan?: string
  catatanVerifikasi?: string
  tarikData?: boolean // perubahan sudah direalisasikan & data diperiksa
}

// ---------- Administrasi sekolah (8 bidang) ----------

export interface Lampiran { nama: string; ukuran: number; tipe: string; data: string }
export type NilaiArsip = string | number | undefined

/** Satu baris buku/register administrasi (BKU, surat masuk, inventaris, notulen, dll.) atau status dokumen wajib. */
export interface Arsip {
  id: string
  register: string // id register, atau '_dok' untuk daftar dokumen kelembagaan
  data: Record<string, NilaiArsip>
  lampiran?: Lampiran[]
  dibuat: string
  diubah?: string
  oleh?: string
}
