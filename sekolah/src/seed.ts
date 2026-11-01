// Data contoh agar aplikasi bisa langsung dicoba. Dipanggil dari menu Pengaturan atau saat database kosong.
import { kurikulumDefault } from './curricula'
import { defaultTahunAjaran, put, resetAll } from './store'
import type { Absensi, CatatanHadir, LembarNilai, Mapel, Pegawai, Rombel, Siswa, StatusHadir } from './types'
import { isoDate, uid } from './util'

let s = 42
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]

const DEPAN_L = ['Ahmad', 'Budi', 'Rizky', 'Dimas', 'Fajar', 'Galih', 'Hendra', 'Ilham', 'Joko', 'Kevin', 'Made', 'Nanda', 'Putu', 'Raka', 'Satria', 'Yusuf']
const DEPAN_P = ['Ayu', 'Bunga', 'Citra', 'Dewi', 'Eka', 'Fitri', 'Gita', 'Intan', 'Kartika', 'Lestari', 'Maya', 'Nabila', 'Putri', 'Rina', 'Sari', 'Zahra']
const BELAKANG = ['Pratama', 'Saputra', 'Wijaya', 'Hidayat', 'Nugroho', 'Kusuma', 'Santoso', 'Siregar', 'Lubis', 'Wibowo', 'Ramadhan', 'Purnama', 'Setiawan', 'Halim']
const KOTA = ['Bandung', 'Jakarta', 'Surabaya', 'Yogyakarta', 'Semarang', 'Medan', 'Makassar', 'Denpasar']

function nama(jk: 'L' | 'P') {
  return `${pick(jk === 'L' ? DEPAN_L : DEPAN_P)} ${pick(BELAKANG)}`
}

const MAPEL_SD: [string, string, string][] = [
  ['PAI', 'Pendidikan Agama dan Budi Pekerti', 'Umum'],
  ['PP', 'Pendidikan Pancasila', 'Umum'],
  ['BIN', 'Bahasa Indonesia', 'Umum'],
  ['MTK', 'Matematika', 'Umum'],
  ['IPAS', 'Ilmu Pengetahuan Alam dan Sosial', 'Umum'],
  ['SBdP', 'Seni Budaya', 'Umum'],
  ['PJOK', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'Umum'],
  ['BING', 'Bahasa Inggris', 'Umum'],
  ['MULOK', 'Bahasa Daerah', 'Muatan Lokal'],
]
const MAPEL_SMP: [string, string, string][] = [
  ['PAI', 'Pendidikan Agama dan Budi Pekerti', 'Umum'],
  ['PP', 'Pendidikan Pancasila', 'Umum'],
  ['BIN', 'Bahasa Indonesia', 'Umum'],
  ['MTK', 'Matematika', 'Umum'],
  ['IPA', 'Ilmu Pengetahuan Alam', 'Umum'],
  ['IPS', 'Ilmu Pengetahuan Sosial', 'Umum'],
  ['BING', 'Bahasa Inggris', 'Umum'],
  ['PJOK', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'Umum'],
  ['INF', 'Informatika', 'Umum'],
  ['SB', 'Seni Budaya', 'Umum'],
]
const ELEMEN_PAUD: [string, string][] = [
  ['NAB', 'Nilai Agama dan Budi Pekerti'],
  ['JD', 'Jati Diri'],
  ['STEAM', 'Dasar-dasar Literasi, Matematika, Sains, Teknologi, Rekayasa, dan Seni'],
]

const TP_CONTOH: Record<string, string[]> = {
  MTK: ['Menyelesaikan operasi hitung pecahan', 'Mengukur keliling dan luas bangun datar', 'Menyajikan data dalam diagram batang'],
  BIN: ['Menemukan gagasan pokok teks', 'Menulis teks narasi sederhana', 'Menyampaikan pendapat secara lisan'],
  IPAS: ['Menjelaskan siklus air', 'Mengidentifikasi keragaman budaya daerah', 'Menjelaskan gaya dan gerak'],
}

export async function seedDemo() {
  s = 42
  await resetAll()
  const ta = defaultTahunAjaran()
  const thn = Number(ta.split('/')[0])

  // Pegawai
  const pegawai: Pegawai[] = []
  const addPeg = (p: Partial<Pegawai> & { nama: string; jenis: Pegawai['jenis']; jk: 'L' | 'P' }) => {
    const d: Pegawai = { id: uid(), aktif: true, agama: 'Islam', statusKepegawaian: 'GTY/PTY', tempatLahir: pick(KOTA), tanggalLahir: `${1970 + Math.floor(rnd() * 25)}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`, nuptk: String(1000000000000000 + Math.floor(rnd() * 8999999999999999)).slice(0, 16), ...p }
    pegawai.push(d)
    return d
  }
  const kepsek = addPeg({ nama: 'Siti Rahmawati', gelarDepan: 'Dra.', gelarBelakang: 'M.Pd.', jenis: 'Guru', jabatan: 'Kepala Sekolah', jk: 'P', statusKepegawaian: 'PNS', nip: '197203151998032004', pendidikanTerakhir: 'S2' })
  const guruTK = addPeg({ nama: 'Rina Marlina', gelarBelakang: 'S.Pd.', jenis: 'Guru', jabatan: 'Guru Kelas TK', jk: 'P', pendidikanTerakhir: 'S1 PG-PAUD' })
  const guruSD = addPeg({ nama: 'Bambang Hermawan', gelarBelakang: 'S.Pd.', jenis: 'Guru', jabatan: 'Guru Kelas SD', jk: 'L', pendidikanTerakhir: 'S1 PGSD' })
  const guruSMP = addPeg({ nama: 'Dewi Anggraini', gelarBelakang: 'S.Pd.', jenis: 'Guru', jabatan: 'Guru Matematika', jk: 'P', pendidikanTerakhir: 'S1 Pend. Matematika' })
  const guruSMP2 = addPeg({ nama: 'Agus Salim', gelarBelakang: 'S.Pd.', jenis: 'Guru', jabatan: 'Guru Bahasa Indonesia', jk: 'L', pendidikanTerakhir: 'S1 PBSI' })
  addPeg({ nama: 'Yohanes Situmorang', gelarBelakang: 'S.Kom.', jenis: 'Guru', jabatan: 'Guru Informatika', jk: 'L', statusKepegawaian: 'Honorer' })
  addPeg({ nama: 'Nurhayati', gelarBelakang: 'A.Md.', jenis: 'Tenaga Kependidikan', jabatan: 'Kepala Tata Usaha', jk: 'P', nuptk: undefined })
  addPeg({ nama: 'Slamet Riyadi', jenis: 'Tenaga Kependidikan', jabatan: 'Penjaga Sekolah', jk: 'L', nuptk: undefined, statusKepegawaian: 'Kontrak' })
  addPeg({ nama: 'Hj. Mariam Lubis', gelarBelakang: 'S.E.', jenis: 'Yayasan', jabatan: 'Bendahara Yayasan', jk: 'P', nuptk: undefined })
  for (const p of pegawai) await put('pegawai', p)

  await put('sekolah', {
    id: 'profil', nama: 'Sekolah Harapan Bangsa', npsn: '20212345', jenjang: ['TK', 'SD', 'SMP'],
    alamat: 'Jl. Pendidikan No. 10', kelurahan: 'Sukamaju', kecamatan: 'Coblong', kabupaten: 'Kota Bandung', provinsi: 'Jawa Barat', kodePos: '40132',
    telepon: '(022) 123456', email: 'info@harapanbangsa.sch.id', yayasan: 'Yayasan Pendidikan Harapan Bangsa',
    kepalaSekolahId: kepsek.id, tahunAjaranAktif: ta, semesterAktif: new Date().getMonth() >= 6 ? 1 : 2, kotaTtdRapor: 'Bandung',
  })

  // Mapel
  const mapel: Mapel[] = []
  let u = 1
  for (const [kode, n] of ELEMEN_PAUD) mapel.push({ id: uid(), kode, nama: n, kelompok: 'Elemen CP PAUD', jenjang: ['PAUD', 'TK'], urutan: u++ })
  for (const [kode, n, k] of MAPEL_SD) mapel.push({ id: uid(), kode: `SD-${kode}`, nama: n, kelompok: k, jenjang: ['SD'], urutan: u++, kkm: 70 })
  for (const [kode, n, k] of MAPEL_SMP) mapel.push({ id: uid(), kode: `SMP-${kode}`, nama: n, kelompok: k, jenjang: ['SMP'], urutan: u++, kkm: 75 })
  for (const m of mapel) await put('mapel', m)

  // Siswa + Rombel
  const rombelDef: [string, Rombel['jenjang'], string, Pegawai, string][] = [
    ['TK B', 'TK', 'B', guruTK, kurikulumDefault('TK')],
    ['4A', 'SD', '4', guruSD, 'merdeka'],
    ['7A', 'SMP', '7', guruSMP, 'merdeka'],
    ['9A', 'SMP', '9', guruSMP2, 'k13'],
  ]
  const rombel: Rombel[] = []
  let induk = 1
  for (const [nm, j, t, wali, kur] of rombelDef) {
    const umurMasuk = { TK: 5, SD: 9, SMP: 12, SMA: 15, SMK: 15, PAUD: 3 }[j]
    const ids: string[] = []
    for (let i = 0; i < 12; i++) {
      const jk = rnd() < 0.5 ? 'L' : 'P'
      const ayahNama = `${pick(DEPAN_L)} ${pick(BELAKANG)}`
      const sw: Siswa = {
        id: uid(),
        noInduk: `${String(thn).slice(2)}${String(induk++).padStart(4, '0')}`,
        nisn: j === 'TK' ? undefined : String(Math.floor(rnd() * 9e9) + 1e9).padStart(10, '0'),
        nama: nama(jk), jk, tempatLahir: pick(KOTA),
        tanggalLahir: isoDate(new Date(thn - umurMasuk, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))),
        agama: pick(['Islam', 'Islam', 'Islam', 'Kristen', 'Katolik', 'Hindu']), kewarganegaraan: 'WNI', anakKe: 1 + Math.floor(rnd() * 3),
        alamat: `Jl. ${pick(['Merdeka', 'Melati', 'Kenanga', 'Diponegoro', 'Sudirman'])} No. ${1 + Math.floor(rnd() * 99)}`,
        ayah: { nama: ayahNama, pekerjaan: pick(['Wiraswasta', 'Karyawan Swasta', 'PNS', 'Petani', 'Pedagang']), telepon: `08${Math.floor(rnd() * 1e10)}` },
        ibu: { nama: nama('P'), pekerjaan: pick(['Ibu Rumah Tangga', 'Guru', 'Wiraswasta', 'Karyawan Swasta']) },
        wali: {}, jenjang: j, tanggalMasuk: `${thn - (Number(t) ? (Number(t) - (j === 'SMP' ? 7 : 1)) : 0)}-07-15`,
        diterimaDiKelas: j === 'SD' ? '1' : j === 'SMP' ? '7' : t, asalSekolah: j === 'SMP' ? 'SD Harapan Bangsa' : j === 'SD' ? 'TK Harapan Bangsa' : undefined,
        status: 'Aktif',
      }
      await put('siswa', sw)
      ids.push(sw.id)
    }
    const r: Rombel = { id: uid(), nama: nm, jenjang: j, tingkat: t, tahunAjaran: ta, waliKelasId: wali.id, kurikulumId: kur, siswaIds: ids }
    rombel.push(r)
    await put('rombel', r)
  }

  // Ekskul
  for (const e of ['Pramuka', 'Futsal', 'Tari Tradisional', 'Robotik']) await put('ekskul', { id: uid(), nama: e })

  // Absensi 20 hari sekolah terakhir
  const statusAcak = (): StatusHadir => {
    const x = rnd()
    return x < 0.9 ? 'H' : x < 0.94 ? 'S' : x < 0.97 ? 'I' : x < 0.985 ? 'T' : 'A'
  }
  const d = new Date()
  let hari = 0
  while (hari < 20) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      const tgl = isoDate(d)
      for (const r of rombel) {
        const data: Record<string, CatatanHadir> = {}
        for (const id of r.siswaIds) data[id] = { status: statusAcak() }
        const a: Absensi = { id: `siswa|${tgl}|${r.id}`, jenis: 'siswa', tanggal: tgl, rombelId: r.id, data }
        await put('absensi', a)
      }
      const dp: Record<string, CatatanHadir> = {}
      for (const p of pegawai) {
        const st = statusAcak()
        dp[p.id] = st === 'H' || st === 'T' ? { status: st, masuk: st === 'T' ? '07:3' + Math.floor(rnd() * 9) : '06:4' + Math.floor(rnd() * 9), pulang: '14:0' + Math.floor(rnd() * 9) } : { status: st }
      }
      await put('absensi', { id: `pegawai|${tgl}|pegawai`, jenis: 'pegawai', tanggal: tgl, data: dp })
      hari++
    }
    d.setDate(d.getDate() - 1)
  }

  // Nilai contoh untuk kelas 4A
  const sem = new Date().getMonth() >= 6 ? 1 : 2
  const r4 = rombel[1]
  for (const m of mapel.filter((m) => m.jenjang.includes('SD'))) {
    const short = m.kode.replace('SD-', '')
    const tujuan = TP_CONTOH[short] ?? ['Memahami konsep dasar materi', 'Menerapkan konsep dalam kehidupan sehari-hari']
    const data: LembarNilai['data'] = {}
    for (const id of r4.siswaIds) {
      const base = 60 + rnd() * 35
      const row: Record<string, number> = { sas: Math.round(base + (rnd() - 0.5) * 10) }
      tujuan.forEach((_, i) => (row[`tp${i}`] = Math.min(100, Math.round(base + (rnd() - 0.5) * 24))))
      data[id] = row
    }
    await put('nilai', { id: `${ta}|${sem}|${r4.id}|${m.id}`, tahunAjaran: ta, semester: sem as 1 | 2, rombelId: r4.id, mapelId: m.id, tujuan, data })
  }
  // Nilai PAUD untuk TK B
  const rtk = rombel[0]
  for (const m of mapel.filter((m) => m.jenjang.includes('TK'))) {
    const data: LembarNilai['data'] = {}
    for (const id of rtk.siswaIds) {
      const c = pick(['MB', 'BSH', 'BSH', 'BSB'])
      data[id] = { capaian: c, deskripsi: `Ananda ${c === 'BSB' ? 'sangat antusias dan mampu' : c === 'BSH' ? 'sudah mampu' : 'mulai mampu'} mengikuti kegiatan ${m.nama.toLowerCase()} dengan baik bersama teman-temannya.` }
    }
    await put('nilai', { id: `${ta}|${sem}|${rtk.id}|${m.id}`, tahunAjaran: ta, semester: sem as 1 | 2, rombelId: rtk.id, mapelId: m.id, tujuan: [], data })
  }
  await seedPrasarana()
}

async function seedPrasarana() {
  const tanahId = uid()
  await put('tanah', {
    id: tanahId, nama: 'Tanah Utama Sekolah Harapan Bangsa', noSertifikat: '10.13.05.02.1.00412', panjang: 100, lebar: 80, luas: 8000, luasTersedia: 3200,
    nilaiPerolehan: 2500000000, statusKepemilikan: 'Milik', keterangan: 'Lokasi utama TK, SD, dan SMP.', samaDenganSekolah: true,
    provinsi: 'Jawa Barat', kabupaten: 'Kota Bandung', kecamatan: 'Coblong', desa: 'Sukamaju', alamatJalan: 'Jl. Pendidikan No. 10', rt: '3', rw: '5', kodePos: '40132', lintang: -6.8915, bujur: 107.6107,
  })
  const gA = uid(), gB = uid(), lap = uid()
  await put('bangunan', { id: gA, tanahId, jenisPrasarana: 'Bangunan', nama: 'Gedung A (SD)', panjang: 40, lebar: 12, luasTapak: 480, statusKepemilikan: 'Milik', nilaiPerolehan: 1800000000, jumlahLantai: 2, tahunPembangunan: 2012, tanggalSk: '2012-07-01', bobotKerusakan: 12, keterangan: 'Ruang kelas SD, ruang guru, dan perpustakaan.' })
  await put('bangunan', { id: gB, tanahId, jenisPrasarana: 'Bangunan', nama: 'Gedung B (SMP)', panjang: 36, lebar: 12, luasTapak: 432, statusKepemilikan: 'Milik', nilaiPerolehan: 2100000000, jumlahLantai: 3, tahunPembangunan: 2018, tanggalSk: '2018-07-02', bobotKerusakan: 0, keterangan: 'Ruang kelas SMP dan laboratorium.' })
  await put('bangunan', { id: lap, tanahId, jenisPrasarana: 'Lapangan', nama: 'Lapangan Upacara', panjang: 40, lebar: 25, luasTapak: 1000, statusKepemilikan: 'Milik', jumlahLantai: 1, tahunPembangunan: 2010, bobotKerusakan: 35 })
  const ruang: [string, string, string, number, number, number, number, number][] = [
    [gA, 'RK-01', 'Ruang Kelas 4A', 1, 8, 7, 28, 10],
    [gA, 'RK-02', 'Ruang Kelas 4B', 1, 8, 7, 28, 25],
    [gA, 'RG-01', 'Ruang Guru', 1, 10, 8, 20, 0],
    [gA, 'PRP-01', 'Perpustakaan', 2, 12, 8, 40, 5],
    [gB, 'RK-07', 'Ruang Kelas 7A', 1, 8, 7, 32, 0],
    [gB, 'RK-09', 'Ruang Kelas 9A', 2, 8, 7, 32, 0],
    [gB, 'LAB-01', 'Laboratorium IPA', 3, 12, 9, 32, 50],
    [gB, 'KS-01', 'Ruang Kepala Sekolah', 1, 6, 5, 6, 0],
  ]
  const jenis: Record<string, string> = { RK: 'Ruang Teori/Kelas', RG: 'Ruang Guru', PRP: 'Perpustakaan', LAB: 'Laboratorium IPA', KS: 'Ruang Kepala Sekolah' }
  for (const [b, kode, nama, lantai, p, l, kap, bobot] of ruang) {
    await put('ruang', { id: uid(), bangunanId: b, jenisPrasarana: jenis[kode.split('-')[0]], kode, nama, lantaiKe: lantai, panjang: p, lebar: l, luas: p * l, kapasitas: kap, bobotKerusakan: bobot, registrasi: `03.11.01.${kode.replace(/\D/g, '')}` })
  }
  const d = new Date(); d.setDate(d.getDate() - 20)
  await put('pengajuan', {
    id: uid(), nama: 'Perbaikan Data Bangunan Gedung B (SMP)', objek: 'Bangunan', jenis: 'Perbaikan', objekId: gB,
    alasan: 'Jumlah lantai tercatat 2, kondisi sebenarnya 3 lantai setelah penambahan lantai tahun 2018.',
    dokumen: [{ id: uid(), jenis: 'Surat keterangan kepala sekolah', namaBerkas: 'sk-kepsek-gedung-b.pdf', ukuran: 412000 }],
    periksa: [true, true, true, true, true, true, true], status: 'Disetujui', dibuat: isoDate(d), diajukan: isoDate(d), tarikData: false,
  })
}
