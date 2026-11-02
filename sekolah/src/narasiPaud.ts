// Penyusun narasi rapor PAUD/TK (Kurikulum Merdeka, fase Fondasi).
// Narasi disusun dari: elemen CP, capaian (BB/MB/BSH/BSB), kelompok usia, tujuan pembelajaran yang diisi guru,
// dan bank narasi buatan sekolah (Administrasi Guru → Bank Narasi). Guru tetap menyunting hasilnya.
import type { Arsip } from './types'

export type ElemenPaud = 'nab' | 'jd' | 'steam' | 'p5'
export type Capaian = 'BB' | 'MB' | 'BSH' | 'BSB'

export const BINTANG: Record<Capaian, number> = { BB: 1, MB: 2, BSH: 3, BSB: 4 }
export const bintang = (c?: string) => (c && c in BINTANG ? '★'.repeat(BINTANG[c as Capaian]) + '☆'.repeat(4 - BINTANG[c as Capaian]) : '')

export function elemenDari(namaMapel: string): ElemenPaud {
  const s = namaMapel.toLowerCase()
  if (s.includes('agama') || s.includes('budi')) return 'nab'
  if (s.includes('jati')) return 'jd'
  if (s.includes('pancasila') || s.includes('p5') || s.includes('kokurikuler')) return 'p5'
  return 'steam'
}

const LABEL_BANK: Record<ElemenPaud, string> = {
  nab: 'Nilai Agama dan Budi Pekerti', jd: 'Jati Diri', steam: 'Dasar Literasi, Matematika, Sains, Teknologi, Rekayasa, dan Seni', p5: 'Kokurikuler / P5',
}

/** Kelompok usia (tahun) pada tanggal tertentu, mengikuti pengelompokan PAUD. */
export function kelompokUsia(tglLahir?: string, ref = new Date()): string | undefined {
  if (!tglLahir) return undefined
  const b = new Date(tglLahir)
  const bulan = (ref.getFullYear() - b.getFullYear()) * 12 + ref.getMonth() - b.getMonth() - (ref.getDate() < b.getDate() ? 1 : 0)
  const t = Math.floor(bulan / 12)
  if (t < 3) return '2-3 tahun'
  if (t < 4) return '3-4 tahun'
  if (t < 5) return '4-5 tahun'
  return '5-6 tahun'
}

/** Usia "x tahun y bulan" pada tanggal rapor. */
export function usiaTahunBulan(tglLahir?: string, ref = new Date()) {
  if (!tglLahir) return ''
  const b = new Date(tglLahir)
  let bulan = (ref.getFullYear() - b.getFullYear()) * 12 + ref.getMonth() - b.getMonth()
  if (ref.getDate() < b.getDate()) bulan--
  return bulan < 0 ? '' : `${Math.floor(bulan / 12)} tahun ${bulan % 12} bulan`
}

const PEMBUKA: Record<Capaian, string[]> = {
  BB: ['{nama} sedang memulai proses mengenal', '{nama} masih membutuhkan pendampingan dalam', '{nama} mulai menunjukkan ketertarikan pada'],
  MB: ['{nama} mulai mampu', '{nama} sudah mulai menunjukkan kemampuan', '{nama} perlahan berkembang dalam'],
  BSH: ['{nama} sudah mampu', '{nama} berkembang sesuai harapan dalam', '{nama} menunjukkan kemampuan yang baik dalam'],
  BSB: ['{nama} sangat baik dalam', '{nama} menunjukkan kemampuan menonjol dalam', '{nama} sudah mandiri dan konsisten dalam'],
}

const PERILAKU: Record<ElemenPaud, Record<Capaian, string[]>> = {
  nab: {
    BB: ['Saat berdoa bersama, {nama} lebih banyak mengamati teman dan sesekali menirukan gerakannya.', 'Kebiasaan mencuci tangan dan membuang sampah pada tempatnya masih perlu diingatkan.', 'Ucapan terima kasih dan maaf muncul ketika guru memberi contoh terlebih dahulu.'],
    MB: ['{nama} mulai ikut melafalkan doa pendek sebelum makan walaupun belum lengkap.', 'Dengan pengingat, {nama} mau merapikan mainan dan membuang sampah ke tempatnya.', '{nama} mulai mengucapkan terima kasih saat menerima sesuatu dari teman.'],
    BSH: ['{nama} berdoa sebelum dan sesudah kegiatan dengan sikap tenang.', '{nama} terbiasa mencuci tangan sebelum makan tanpa diminta.', '{nama} mau berbagi bekal dan mainan dengan teman.', '{nama} dapat menyebutkan contoh ciptaan Tuhan di sekitarnya, seperti tumbuhan dan hewan.'],
    BSB: ['{nama} sering mengajak teman berdoa dan mengingatkan teman untuk menjaga kebersihan.', '{nama} menunjukkan empati, misalnya menghibur teman yang sedih.', '{nama} dapat menceritakan kembali kisah keteladanan dengan runtut dan antusias.', '{nama} merawat tanaman kelas dengan inisiatif sendiri.'],
  },
  jd: {
    BB: ['{nama} masih memerlukan waktu untuk beradaptasi dengan kegiatan baru.', 'Saat merasa kesal, {nama} membutuhkan bantuan guru untuk menenangkan diri.', 'Kegiatan motorik seperti melompat dan menggunting masih dilakukan dengan bantuan.'],
    MB: ['{nama} mulai menyebutkan perasaannya, misalnya senang atau sedih.', '{nama} mulai mau bermain bersama satu atau dua teman.', 'Keterampilan motorik halus seperti meronce dan menempel mulai berkembang.'],
    BSH: ['{nama} dapat mengungkapkan keinginan dan perasaannya dengan kalimat sederhana.', '{nama} mau menunggu giliran dan mengikuti aturan permainan.', '{nama} dapat memakai sepatu dan merapikan tas sendiri.', 'Gerak motorik kasar seperti berlari, melompat, dan menjaga keseimbangan dilakukan dengan baik.'],
    BSB: ['{nama} percaya diri tampil di depan kelas dan mampu memimpin kegiatan kecil.', '{nama} dapat mengelola emosi dan membantu teman menyelesaikan perselisihan kecil.', '{nama} mandiri dalam merawat diri dan bertanggung jawab atas barang miliknya.', 'Koordinasi motorik halus {nama} sangat baik, terlihat dari hasil menggunting dan menggambar yang rapi.'],
  },
  steam: {
    BB: ['{nama} mulai tertarik melihat gambar di buku cerita bersama guru.', 'Mengenal warna dan bentuk dasar masih dilakukan dengan bimbingan.', 'Coretan {nama} mulai muncul ketika diberi alat gambar.'],
    MB: ['{nama} mulai menyebutkan beberapa huruf dan angka yang sering dilihat.', '{nama} dapat mengelompokkan benda berdasarkan warna dengan sedikit bantuan.', '{nama} senang bereksperimen dengan air, pasir, dan balok meski belum menjelaskan hasilnya.'],
    BSH: ['{nama} dapat menceritakan kembali isi cerita pendek dengan kata-katanya sendiri.', '{nama} dapat membilang dan mencocokkan jumlah benda sampai sepuluh.', '{nama} mampu membangun bentuk dari balok sesuai rencananya.', '{nama} mulai menulis namanya sendiri dan mengenal bunyi huruf awal.'],
    BSB: ['{nama} gemar bertanya "mengapa" dan mencoba mencari jawabannya lewat percobaan sederhana.', '{nama} dapat membaca beberapa kata sederhana dan menulis kalimat pendek.', '{nama} mampu memecahkan masalah sederhana, misalnya menyusun pola dan puzzle yang lebih rumit.', 'Karya seni {nama} kreatif, penuh detail, dan dapat dijelaskan dengan percaya diri.'],
  },
  p5: {
    BB: ['Dalam kegiatan projek, {nama} lebih banyak mengamati dan perlu diajak untuk terlibat.'],
    MB: ['Dalam kegiatan projek, {nama} mulai ikut bekerja sama dengan teman dalam kelompok kecil.'],
    BSH: ['Dalam kegiatan projek, {nama} aktif bekerja sama, berbagi alat, dan menyelesaikan bagiannya.'],
    BSB: ['Dalam kegiatan projek, {nama} berinisiatif mengajukan ide dan membantu teman menyelesaikan karya bersama.'],
  },
}

const PENUTUP: Record<Capaian, string[]> = {
  BB: ['Ayah dan Bunda dapat mendampingi {nama} melalui kegiatan bermain sederhana di rumah agar kemampuan ini semakin tumbuh.', 'Dukungan dan pembiasaan yang konsisten di sekolah dan di rumah akan membantu {nama} berkembang.'],
  MB: ['Dengan pembiasaan di rumah, {nama} diharapkan semakin percaya diri dan konsisten.', 'Mari terus beri kesempatan dan pujian agar {nama} semakin berkembang.'],
  BSH: ['Pertahankan kebiasaan baik ini dengan memberi kesempatan {nama} mencoba hal baru.', 'Ayah dan Bunda dapat terus mendukung dengan mengajak {nama} bercerita tentang kegiatannya.'],
  BSB: ['{nama} dapat diberi tantangan yang lebih kaya agar potensinya terus berkembang.', 'Kemampuan ini dapat terus diasah dengan memberi {nama} peran membantu teman.'],
}

function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 }
}
const pilih = <T,>(xs: T[], r: () => number) => xs[Math.floor(r() * xs.length) % xs.length]
const lc = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)

export interface OpsiNarasi {
  nama: string
  namaMapel: string
  capaian: Capaian
  tujuan?: string[]
  usia?: string
  bank?: Arsip[]
  /** angka variasi: berbeda menghasilkan susunan kalimat lain */
  variasi?: number
  seed?: string
}

export function buatNarasi(o: OpsiNarasi): string {
  const el = elemenDari(o.namaMapel)
  const r = rng(`${o.seed ?? o.nama}|${el}|${o.capaian}|${o.variasi ?? 0}`)
  const isi = (s: string) => s.replace(/\{nama\}/g, o.nama)
  // 1. Bank narasi sekolah didahulukan bila ada yang cocok
  const cocok = (o.bank ?? []).filter((b) => b.register === 'bank-narasi' && b.data.capaian === o.capaian && b.data.elemen === LABEL_BANK[el] && (!b.data.usia || b.data.usia === 'Semua' || b.data.usia === o.usia))
  if (cocok.length) return isi(String(pilih(cocok, r).data.teks ?? ''))
  // 2. Susun dari templat bawaan + tujuan pembelajaran yang diisi guru
  const tp = (o.tujuan ?? []).filter((t) => t.trim())
  const kal: string[] = []
  kal.push(tp.length ? `${pilih(PEMBUKA[o.capaian], r)} ${lc(tp.slice(0, 2).join(' serta ').replace(/\.$/, ''))}.` : '')
  const pool = [...PERILAKU[el][o.capaian]]
  const ambil = Math.min(pool.length, tp.length ? 2 : 3)
  for (let i = 0; i < ambil; i++) kal.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  kal.push(pilih(PENUTUP[o.capaian], r))
  return isi(kal.filter(Boolean).join(' '))
}
