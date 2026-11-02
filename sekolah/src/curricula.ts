// Definisi kurikulum sebagai data + aturan hitung. Untuk menambah kurikulum baru
// (mis. kurikulum luar negeri), cukup tambahkan objek `Kurikulum` ke daftar KURIKULUM.
import type { Jenjang } from './types'
import { getGayaDeskripsi, susunDeskripsi } from './deskripsiRapor'

export type Baris = Record<string, number | string | undefined>

export interface KomponenNilai {
  key: string
  label: string
  type: 'number' | 'text' | 'select'
  options?: string[]
  /** Tampilkan satu kolom per tujuan pembelajaran (key menjadi `tp0`, `tp1`, ...). */
  perTujuan?: boolean
  width?: number
}

export interface HasilAkhir {
  nilai?: number
  predikat?: string
  deskripsi?: string
  /** kolom tambahan khusus kurikulum (mis. keterampilan K13) */
  extra?: Record<string, string | number | undefined>
}

export interface KolomRapor {
  label: string
  width?: string
  align?: 'left' | 'center'
  get: (h: HasilAkhir) => string | number | undefined
}

export interface Kurikulum {
  id: string
  nama: string
  singkat: string
  asal: 'Indonesia' | 'Internasional'
  jenjang: Jenjang[]
  /** Istilah untuk tujuan pembelajaran (TP / KD / Learning Objective / Elemen). */
  istilahTujuan: string
  komponen: KomponenNilai[]
  hitung: (baris: Baris | undefined, tujuan: string[], kkm: number) => HasilAkhir
  kolomRapor: KolomRapor[]
  /** Isian naratif non-mapel di rapor (sikap, kokurikuler, dsb). */
  isianRapor: { key: string; label: string; options?: string[]; angka?: boolean }[]
  judulRapor: string
  /** true = rapor berupa narasi per elemen (PAUD), bukan tabel angka */
  naratif?: boolean
}

const num = (v: unknown): number | undefined => {
  if (v === '' || v === undefined || v === null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export const avg = (xs: (number | undefined)[]): number | undefined => {
  const v = xs.filter((x): x is number => x !== undefined)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
}

const round = (n: number | undefined) => (n === undefined ? undefined : Math.round(n))

export function tpScores(baris: Baris | undefined, tujuan: string[]) {
  return tujuan.map((t, i) => ({ t, v: num(baris?.[`tp${i}`]) })).filter((x) => x.v !== undefined) as { t: string; v: number }[]
}

const lcFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)

/** Deskripsi capaian kompetensi gaya Kurikulum Merdeka: TP tertinggi & terendah relatif terhadap KKTP. */
export function deskripsiMerdeka(baris: Baris | undefined, tujuan: string[], kkm: number) {
  const s = tpScores(baris, tujuan)
  if (!s.length) return ''
  const sorted = [...s].sort((a, b) => b.v - a.v)
  const rendah = sorted.filter((x) => x.v < kkm).reverse()
  const parts: string[] = []
  // Semua TP tuntas: sorot TP terkuat, dan TP terlemah sebagai ruang peningkatan.
  // Ada TP belum tuntas: sorot TP tuntas terkuat, dan TP belum tuntas sebagai perlu bimbingan.
  const tinggi = rendah.length ? sorted.filter((x) => x.v >= kkm) : sorted.slice(0, Math.max(1, Math.min(2, sorted.length - 1)))
  if (tinggi.length) parts.push(`Menunjukkan penguasaan yang baik dalam ${tinggi.slice(0, 2).map((x) => lcFirst(x.t)).join(' dan ')}.`)
  if (rendah.length) parts.push(`Perlu bimbingan dalam ${rendah.slice(0, 2).map((x) => lcFirst(x.t)).join(' dan ')}.`)
  else if (sorted.length > 1) parts.push(`Perlu peningkatan dalam ${lcFirst(sorted[sorted.length - 1].t)}.`)
  return parts.join(' ')
}

/** Predikat K13 berdasarkan KKM: interval = (100 - KKM) / 3. */
export function predikatK13(n: number | undefined, kkm: number) {
  if (n === undefined) return undefined
  const i = (100 - kkm) / 3
  if (n >= kkm + 2 * i) return 'A'
  if (n >= kkm + i) return 'B'
  if (n >= kkm) return 'C'
  return 'D'
}

const MERDEKA: Kurikulum = {
  id: 'merdeka',
  nama: 'Kurikulum Merdeka',
  singkat: 'Merdeka',
  asal: 'Indonesia',
  jenjang: ['SD', 'SMP', 'SMA', 'SMK', 'PKBM'],
  istilahTujuan: 'Tujuan Pembelajaran (TP)',
  komponen: [
    { key: 'tp', label: 'Sumatif TP', type: 'number', perTujuan: true, width: 64 },
    { key: 'sas', label: 'SAS', type: 'number', width: 64 },
    { key: 'deskripsi', label: 'Deskripsi manual (opsional)', type: 'text', width: 260 },
  ],
  hitung(b, tujuan, kkm) {
    const lm = avg(tpScores(b, tujuan).map((x) => x.v))
    const sas = num(b?.sas)
    const nilai = round(avg([lm, sas]))
    const manual = b?.modeDesk === 'otomatis' ? '' : typeof b?.deskripsi === 'string' && b.deskripsi.trim() ? b.deskripsi.trim() : ''
    const otomatis = getGayaDeskripsi() === 'ringkas' ? deskripsiMerdeka(b, tujuan, kkm) : susunDeskripsi({ tp: tpScores(b, tujuan), akhir: sas, nilai, kkm, variasi: num(b?.variasiDesk) })
    return { nilai, deskripsi: manual || otomatis }
  },
  kolomRapor: [
    { label: 'Nilai Akhir', width: '70px', align: 'center', get: (h) => h.nilai },
    { label: 'Capaian Kompetensi', get: (h) => h.deskripsi },
  ],
  isianRapor: [{ key: 'kokurikuler', label: 'Kokurikuler / Projek Penguatan Profil Pelajar Pancasila' }],
  judulRapor: 'LAPORAN HASIL BELAJAR',
}

const K13: Kurikulum = {
  id: 'k13',
  nama: 'Kurikulum 2013',
  singkat: 'K13',
  asal: 'Indonesia',
  jenjang: ['SD', 'SMP', 'SMA', 'SMK'],
  istilahTujuan: 'Kompetensi Dasar (KD)',
  komponen: [
    { key: 'tp', label: 'NH KD', type: 'number', perTujuan: true, width: 60 },
    { key: 'pas', label: 'PAS', type: 'number', width: 60 },
    { key: 'ket', label: 'Keterampilan', type: 'number', width: 90 },
  ],
  hitung(b, tujuan, kkm) {
    const s = tpScores(b, tujuan)
    const nh = avg(s.map((x) => x.v))
    const pas = num(b?.pas)
    // bobot NH : PAS = 2 : 1
    const nilai = nh !== undefined && pas !== undefined ? Math.round((2 * nh + pas) / 3) : round(nh ?? pas)
    const ket = round(num(b?.ket))
    const sorted = [...s].sort((a, c) => c.v - a.v)
    const pred = predikatK13(nilai, kkm)
    const kata = { A: 'Sangat baik', B: 'Baik', C: 'Cukup', D: 'Perlu bimbingan' }
    let deskripsi = ''
    if (getGayaDeskripsi() !== 'ringkas') deskripsi = susunDeskripsi({ tp: s, akhir: pas, nilai, kkm, variasi: num(b?.variasiDesk) })
    else if (sorted.length && pred) {
      deskripsi = `${kata[pred as keyof typeof kata]} dalam ${lcFirst(sorted[0].t)}`
      if (sorted.length > 1) deskripsi += `, perlu peningkatan dalam ${lcFirst(sorted[sorted.length - 1].t)}`
      deskripsi += '.'
    }
    return {
      nilai, predikat: pred, deskripsi,
      extra: { ket, predKet: predikatK13(ket, kkm) },
    }
  },
  kolomRapor: [
    { label: 'Pengetahuan', width: '60px', align: 'center', get: (h) => h.nilai },
    { label: 'Pred.', width: '40px', align: 'center', get: (h) => h.predikat },
    { label: 'Keterampilan', width: '60px', align: 'center', get: (h) => h.extra?.ket },
    { label: 'Pred.', width: '40px', align: 'center', get: (h) => h.extra?.predKet },
    { label: 'Deskripsi', get: (h) => h.deskripsi },
  ],
  isianRapor: [
    { key: 'sikapSpiritualPredikat', label: 'Sikap Spiritual - Predikat', options: ['Sangat Baik', 'Baik', 'Cukup', 'Kurang'] },
    { key: 'sikapSpiritual', label: 'Sikap Spiritual - Deskripsi' },
    { key: 'sikapSosialPredikat', label: 'Sikap Sosial - Predikat', options: ['Sangat Baik', 'Baik', 'Cukup', 'Kurang'] },
    { key: 'sikapSosial', label: 'Sikap Sosial - Deskripsi' },
  ],
  judulRapor: 'LAPORAN HASIL BELAJAR PESERTA DIDIK',
}

export const CAPAIAN_PAUD = ['BB', 'MB', 'BSH', 'BSB']
const CAPAIAN_PAUD_LABEL: Record<string, string> = {
  BB: 'Belum Berkembang', MB: 'Mulai Berkembang', BSH: 'Berkembang Sesuai Harapan', BSB: 'Berkembang Sangat Baik',
}

const PAUD: Kurikulum = {
  id: 'paud-merdeka',
  nama: 'Kurikulum Merdeka PAUD',
  singkat: 'Merdeka PAUD',
  asal: 'Indonesia',
  jenjang: ['PAUD', 'TK'],
  istilahTujuan: 'Tujuan Pembelajaran',
  komponen: [
    { key: 'capaian', label: 'Capaian', type: 'select', options: CAPAIAN_PAUD, width: 90 },
    { key: 'deskripsi', label: 'Narasi perkembangan', type: 'text', width: 420 },
  ],
  hitung(b) {
    const c = typeof b?.capaian === 'string' ? b.capaian : undefined
    return { predikat: c ? CAPAIAN_PAUD_LABEL[c] ?? c : undefined, deskripsi: typeof b?.deskripsi === 'string' ? b.deskripsi : '', extra: { capaian: c, foto: typeof b?.foto === 'string' ? b.foto : undefined } }
  },
  kolomRapor: [
    { label: 'Capaian', width: '150px', align: 'center', get: (h) => h.predikat },
    { label: 'Narasi Perkembangan', get: (h) => h.deskripsi },
  ],
  isianRapor: [
    { key: 'bb', label: 'Berat badan (kg)', angka: true },
    { key: 'tb', label: 'Tinggi badan (cm)', angka: true },
    { key: 'lk', label: 'Lingkar kepala (cm)', angka: true },
    { key: 'kokurikuler', label: 'Kokurikuler / Projek Penguatan Profil Pelajar Pancasila' },
    { key: 'pertumbuhan', label: 'Catatan Pertumbuhan dan Kesehatan' },
    { key: 'refleksiGuru', label: 'Refleksi Guru' },
    { key: 'refleksiOrtu', label: 'Refleksi Orang Tua' },
  ],
  judulRapor: 'LAPORAN PERKEMBANGAN ANAK DIDIK',
  naratif: true,
}

/** Contoh kurikulum internasional: skala huruf A*-U (gaya IGCSE). */
export function gradeHuruf(n: number | undefined) {
  if (n === undefined) return undefined
  if (n >= 90) return 'A*'
  if (n >= 80) return 'A'
  if (n >= 70) return 'B'
  if (n >= 60) return 'C'
  if (n >= 50) return 'D'
  if (n >= 40) return 'E'
  return 'U'
}

const INTERNASIONAL: Kurikulum = {
  id: 'intl-letter',
  nama: 'International (Letter Grade A*-U)',
  singkat: 'International',
  asal: 'Internasional',
  jenjang: ['SD', 'SMP', 'SMA', 'SMK'],
  istilahTujuan: 'Learning Objective',
  komponen: [
    { key: 'tp', label: 'Assessment', type: 'number', perTujuan: true, width: 64 },
    { key: 'exam', label: 'Exam', type: 'number', width: 64 },
    { key: 'comment', label: 'Teacher comment', type: 'text', width: 300 },
  ],
  hitung(b, tujuan) {
    const cw = avg(tpScores(b, tujuan).map((x) => x.v))
    const exam = num(b?.exam)
    // coursework 40%, exam 60%
    const nilai = cw !== undefined && exam !== undefined ? Math.round(cw * 0.4 + exam * 0.6) : round(cw ?? exam)
    return { nilai, predikat: gradeHuruf(nilai), deskripsi: typeof b?.comment === 'string' ? b.comment : '' }
  },
  kolomRapor: [
    { label: 'Score', width: '60px', align: 'center', get: (h) => h.nilai },
    { label: 'Grade', width: '60px', align: 'center', get: (h) => h.predikat },
    { label: 'Comment', get: (h) => h.deskripsi },
  ],
  isianRapor: [{ key: 'attitude', label: 'Attitude & Learning Habits' }],
  judulRapor: 'STUDENT PROGRESS REPORT',
}

export const KURIKULUM: Kurikulum[] = [MERDEKA, K13, PAUD, INTERNASIONAL]

export function getKurikulum(id: string | undefined): Kurikulum {
  return KURIKULUM.find((k) => k.id === id) ?? MERDEKA
}

export function kurikulumDefault(j: string): string {
  return j === 'PAUD' || j === 'TK' ? 'paud-merdeka' : 'merdeka'
}
