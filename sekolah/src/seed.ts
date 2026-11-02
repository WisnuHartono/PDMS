// Data contoh agar aplikasi bisa langsung dicoba. Dipanggil dari menu Pengaturan atau saat database kosong.
import { kurikulumDefault } from './curricula'
import { defaultTahunAjaran, getState, put, resetAll } from './store'
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
    statusSekolah: 'Swasta', statusOperasional: 'Aktif', akreditasi: 'A',
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
    const umurMasuk = { TK: 5, SD: 9, SMP: 12, SMA: 15, SMK: 15, PAUD: 3, PKBM: 15 }[j]
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
        nik: `3273${String(Math.floor(rnd() * 1e12)).padStart(12, '0')}`,
        // Satu contoh data belum lengkap (status hidup kosong) agar menu Validasi Data menampilkan temuan.
        ayah: { nama: ayahNama, pekerjaan: pick(['Wiraswasta', 'Karyawan Swasta', 'PNS', 'Petani', 'Pedagang']), telepon: `08${Math.floor(rnd() * 1e10)}`, statusHidup: nm === '4A' && i === 11 ? undefined : rnd() < 0.04 ? 'Wafat' : 'Hidup' },
        ibu: { nama: nama('P'), pekerjaan: pick(['Ibu Rumah Tangga', 'Guru', 'Wiraswasta', 'Karyawan Swasta']), statusHidup: nm === '4A' && i === 11 ? undefined : 'Hidup' },
        wali: {}, jenjang: j, tanggalMasuk: `${thn - (Number(t) ? (Number(t) - (j === 'SMP' ? 7 : 1)) : 0)}-07-15`,
        diterimaDiKelas: j === 'SD' ? '1' : j === 'SMP' ? '7' : t, asalSekolah: j === 'SMP' ? 'SD Harapan Bangsa' : j === 'SD' ? 'TK Harapan Bangsa' : undefined,
        status: 'Aktif',
      }
      await put('siswa', sw)
      ids.push(sw.id)
    }
    const pembelajaran = mapel.filter((m) => m.jenjang.includes(j)).map((m) => ({ mapelId: m.id, guruId: wali.id, jp: j === 'TK' ? 2 : m.kelompok?.startsWith('Muatan') ? 2 : 4 }))
    const r: Rombel = { id: uid(), nama: nm, jenjang: j, tingkat: t, tahunAjaran: ta, waliKelasId: wali.id, kurikulumId: kur, siswaIds: ids, jenis: 'Reguler', ruang: `Ruang ${nm}`, pembelajaran }
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
  await seedAdministrasi()
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

/** Contoh isi buku administrasi: BKU, surat, inventaris, supervisi, notulen, dokumen wajib. */
async function seedAdministrasi() {
  const st = getState()
  const peg = (jab: string) => st.pegawai.find((p) => p.jabatan?.includes(jab))?.id
  const now = new Date()
  const tgl = (hariLalu: number) => isoDate(new Date(now.getTime() - hariLalu * 864e5))
  const y = now.getFullYear()
  let i = 0
  const add = (register: string, data: Record<string, string | number | undefined>) =>
    put('arsip', { id: uid(), register, data, dibuat: new Date(now.getTime() + i++).toISOString() })
  const tk = st.rombel.find((r) => r.jenjang === 'TK')
  const anakTK = tk ? tk.siswaIds : []
  const siswaSD = st.siswa.filter((x) => x.jenjang === 'SD').map((x) => x.id)

  // 06 Keuangan
  await add('bku', { tanggal: tgl(60), bukti: 'BKU-001', kode: '1.1', uraian: 'Penerimaan BOSP tahap II', sumber: 'BOSP Reguler', masuk: 96000000 })
  await add('bku', { tanggal: tgl(55), bukti: 'BKU-002', kode: '5.1.02', uraian: 'Belanja ATK semester ganjil', sumber: 'BOSP Reguler', keluar: 4350000 })
  await add('bku', { tanggal: tgl(40), bukti: 'BKU-003', kode: '5.1.03', uraian: 'Honor guru honorer bulan lalu', sumber: 'BOSP Reguler', keluar: 12000000 })
  await add('bku', { tanggal: tgl(30), bukti: 'BKU-004', kode: '1.3', uraian: 'Iuran komite bulan berjalan', sumber: 'Komite/Orang Tua', masuk: 18500000 })
  await add('bku', { tanggal: tgl(12), bukti: 'BKU-005', kode: '5.2.01', uraian: 'Pemeliharaan atap ruang kelas 4A', sumber: 'BOSP Reguler', keluar: 7800000 })
  await add('pajak', { tanggal: tgl(55), bukti: 'BKU-002', uraian: 'PPN belanja ATK', jenis: 'PPN', pungut: 431000, setor: 431000 })
  await add('rkas', { kode: '5.1.02', kegiatan: 'Pengadaan ATK dan bahan habis pakai', sumber: 'BOSP Reguler', volume: 2, satuan: 'semester', harga: 4500000, tw: 'I' })
  await add('rkas', { kode: '5.2.01', kegiatan: 'Pemeliharaan sarana prasarana', sumber: 'BOSP Reguler', volume: 1, satuan: 'paket', harga: 15000000, tw: 'II' })
  for (const [k, sid] of siswaSD.slice(0, 4).entries()) await add('bayar', { noKw: `KW/${y}/${String(k + 1).padStart(3, '0')}`, tanggal: tgl(20 - k), siswa: sid, jenis: 'SPP', periode: 'Oktober', jumlah: 250000, metode: k % 2 ? 'Transfer' : 'Tunai' })

  // 08 TU / Persuratan
  await add('surat-masuk', { agenda: '1', tglTerima: tgl(25), nomor: '421/1873/Disdik', tglSurat: tgl(27), pengirim: 'Dinas Pendidikan Kabupaten', perihal: 'Undangan sosialisasi Rapor Pendidikan', sifat: 'Penting', kepada: peg('Kepala Sekolah'), disposisi: 'Hadir bersama operator. Siapkan data PBD.' })
  await add('surat-masuk', { agenda: '2', tglTerima: tgl(8), nomor: '005/77/KKG', tglSurat: tgl(9), pengirim: 'KKG Gugus 3', perihal: 'Jadwal pertemuan KKG', sifat: 'Biasa', kepada: peg('Guru Kelas SD') })
  await add('surat-keluar', { tanggal: tgl(20), klas: '421', nomor: `001/421/20212345/${['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][new Date(tgl(20)).getMonth()]}/${y}`, tujuan: 'Orang tua/wali peserta didik', perihal: 'Undangan rapat orang tua' })
  if (siswaSD[0]) await add('suket', { tanggal: tgl(5), nomor: `001/421.2/20212345/${['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][new Date(tgl(5)).getMonth()]}/${y}`, jenis: 'Keterangan Aktif Belajar', siswa: siswaSD[0], keperluan: 'pengajuan beasiswa' })

  // 07 Sarpras
  await add('inventaris', { kode: '02.06.01', nama: 'Meja siswa', merk: 'Kayu jati', ruang: 'Ruang Kelas 4A', tahun: y - 3, sumber: 'BOSP Reguler', jumlah: 28, satuan: 'buah', harga: 450000, kondisi: 'Baik' })
  await add('inventaris', { kode: '02.06.02', nama: 'Kursi siswa', merk: 'Kayu jati', ruang: 'Ruang Kelas 4A', tahun: y - 3, sumber: 'BOSP Reguler', jumlah: 28, satuan: 'buah', harga: 250000, kondisi: 'Baik' })
  await add('inventaris', { kode: '02.10.01', nama: 'Proyektor', merk: 'Epson EB-X51', ruang: 'Ruang Kelas 4A', tahun: y - 1, sumber: 'Komite/Orang Tua', jumlah: 1, satuan: 'unit', harga: 6500000, kondisi: 'Baik' })
  await add('inventaris', { kode: '02.06.05', nama: 'Rak buku', ruang: 'Perpustakaan', tahun: y - 6, sumber: 'Yayasan', jumlah: 6, satuan: 'buah', harga: 1200000, kondisi: 'Rusak Ringan' })
  await add('inventaris', { kode: '02.08.01', nama: 'Alat permainan edukatif (APE) balok', ruang: 'Ruang TK B', tahun: y - 2, sumber: 'BOP PAUD', jumlah: 4, satuan: 'set', harga: 850000, kondisi: 'Baik' })
  await add('pinjam', { tanggal: tgl(3), peminjam: 'Agus Salim', barang: 'Proyektor', jumlah: 1, rencana: tgl(1) })
  await add('pelihara', { tanggal: tgl(12), objek: 'Atap Ruang Kelas 4A', kerusakan: 'Genteng bocor', pelaksana: 'CV Karya Mandiri', biaya: 7800000 })

  // 05 Kepala Sekolah
  await add('supervisi', { tanggal: tgl(18), guru: peg('Guru Kelas SD'), rombel: st.rombel.find((r) => r.jenjang === 'SD')?.id, status: 'Selesai', perencanaan: 88, pelaksanaan: 84, penilaian: 80, temuan: 'Modul ajar lengkap; diferensiasi konten sudah tampak.', tindak: 'Perkuat asesmen formatif di akhir pembelajaran.' })
  await add('supervisi', { tanggal: tgl(-7), guru: peg('Guru Matematika'), status: 'Terjadwal' })
  await add('prokerks', { bidang: 'Kurikulum', program: 'Penguatan literasi dan numerasi', sasaran: 'Skor literasi rapor pendidikan naik', waktu: 'Juli–Desember', anggaran: 5000000, pj: peg('Kepala Sekolah'), status: 'Berjalan' })

  // 04 Umum / Kelembagaan
  await add('notulen', { tanggal: tgl(35), jam: '13:00', tempat: 'Ruang guru', jenis: 'Rapat dewan guru', pimpinan: peg('Kepala Sekolah'), notulis: peg('Tata Usaha'), peserta: '14 orang', agenda: '1. Persiapan asesmen sumatif\n2. Jadwal pembagian rapor', hasil: '1. Asesmen sumatif dilaksanakan minggu ke-2 Desember.\n2. Rapor dibagikan bersama orang tua.' })
  await add('agenda', { tanggal: tgl(-14), kegiatan: 'Pembagian rapor semester ganjil', tempat: 'Ruang kelas', pj: peg('Kepala Sekolah'), status: 'Rencana' })

  // 01 Anak didik & 02 Guru
  for (const sid of anakTK.slice(0, 3)) await add('tumbuh', { tanggal: tgl(10), siswa: sid, bb: 17 + Math.round(rnd() * 40) / 10, tb: 108 + Math.round(rnd() * 80) / 10, lk: 50, ket: 'Sehat' })
  if (anakTK[0]) await add('anekdot', { tanggal: tgl(6), siswa: anakTK[0], tempat: 'Sentra balok', peristiwa: 'Menyusun menara 10 balok lalu menghitung jumlahnya sambil menunjuk satu per satu.', analisis: 'Dasar matematika: membilang dan korespondensi satu-satu.', tindak: 'Beri tantangan pola warna.' })
  await add('kaldik', { mulai: `${y}-07-14`, selesai: `${y}-07-16`, kegiatan: 'Masa Pengenalan Lingkungan Sekolah (MPLS)', jenis: 'MPLS' })
  await add('kaldik', { mulai: `${y}-12-15`, selesai: `${y}-12-19`, kegiatan: 'Asesmen sumatif akhir semester', jenis: 'Asesmen' })
  await add('jurnal', { tanggal: tgl(1), guru: peg('Guru Kelas SD'), rombel: st.rombel.find((r) => r.jenjang === 'SD')?.id, jamKe: '1-2', materi: 'Pecahan senilai dengan media kertas lipat', absen: '1 sakit' })

  // 03 SDM & Humas
  await add('tamu', { tanggal: tgl(4), jam: '09:30', nama: 'Bpk. Hendra', instansi: 'Pengawas Sekolah', keperluan: 'Monitoring program sekolah penggerak', bertemu: 'Kepala Sekolah' })
  await add('diklat', { tanggal: tgl(45), pegawai: peg('Guru Kelas TK'), kegiatan: 'Pelatihan Asesmen PAUD Kurikulum Merdeka', penyelenggara: 'BGP Provinsi', jp: 32 })

  // Dokumen wajib
  const dok = (id: string, data: Record<string, string>) => put('arsip', { id: `dok|${id}`, register: '_dok', data, dibuat: now.toISOString() })
  await dok('izin-op', { status: 'Ada', nomor: '421/123/Disdik/2015', tanggal: '2015-06-01', berlaku: `${y + 3}-06-01` })
  await dok('npsn', { status: 'Ada' })
  await dok('akreditasi', { status: 'Ada', nomor: '1234/BAN-PDM/SK/2021', tanggal: '2021-11-20', berlaku: tgl(-45) })
  await dok('kosp', { status: 'Perlu diperbarui', tanggal: `${y - 1}-07-10`, berlaku: tgl(-20) })
  await dok('visi-misi', { status: 'Ada' })
  await dok('sk-bendahara', { status: 'Ada', nomor: '800/12/SK/' + y, tanggal: `${y}-01-05`, berlaku: `${y}-12-31` })
}
