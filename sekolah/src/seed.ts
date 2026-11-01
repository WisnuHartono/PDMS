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
}
