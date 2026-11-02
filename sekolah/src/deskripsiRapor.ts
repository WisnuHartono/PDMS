// Bank deskripsi rapor otomatis. Kalimat disusun dari data nilai: tingkat capaian relatif terhadap KKM/KKTP
// (dibobot), TP terkuat dan terlemah, hubungan nilai harian dengan asesmen akhir (SAS/PAS), tren antar TP,
// kegiatan literasi, dan saran tindak lanjut. Pilihan variasi kalimat bersifat tetap (deterministik):
// data yang sama selalu menghasilkan deskripsi yang sama. Guru tetap dapat menyunting atau mengisi manual.

export type GayaDeskripsi = 'ringkas' | 'standar' | 'lengkap'
export type Tingkat = 1 | 2 | 3 | 4 | 5

export const NAMA_TINGKAT: Record<Tingkat, string> = { 5: 'Sangat Baik', 4: 'Baik', 3: 'Cukup (Tuntas)', 2: 'Perlu Bimbingan', 1: 'Perlu Bimbingan Intensif' }

let gayaAktif: GayaDeskripsi = 'lengkap'
export const setGayaDeskripsi = (g?: GayaDeskripsi) => { gayaAktif = g === 'ringkas' || g === 'standar' || g === 'lengkap' ? g : 'lengkap' }
export const getGayaDeskripsi = () => gayaAktif

/** Tingkat capaian relatif terhadap KKM: pita atas dibagi dua sama besar di antara KKM dan 100. */
export function tingkatDari(n: number, kkm: number): Tingkat {
  const rentang = Math.max(1, 100 - kkm)
  if (n >= kkm + rentang * (2 / 3)) return 5
  if (n >= kkm + rentang * (1 / 3)) return 4
  if (n >= kkm) return 3
  if (n >= kkm - 10) return 2
  return 1
}

type Bank = Record<Tingkat, string[]>

/** Kalimat pembuka sesuai nilai akhir. */
const UMUM: Bank = {
  5: [
    'Peserta didik menunjukkan capaian yang sangat baik dan konsisten pada hampir seluruh tujuan pembelajaran semester ini.',
    'Penguasaan materi sangat memuaskan; peserta didik mampu memahami konsep secara mendalam dan menerapkannya dengan tepat.',
    'Capaian belajar berada pada tingkat sangat baik, ditunjukkan oleh ketepatan, ketelitian, dan kemandirian dalam mengerjakan tugas.',
    'Peserta didik menunjukkan penguasaan kompetensi yang menonjol serta mampu mengaitkan materi dengan situasi nyata.',
  ],
  4: [
    'Peserta didik menunjukkan capaian yang baik dan telah mencapai kriteria ketuntasan pada seluruh tujuan pembelajaran.',
    'Penguasaan materi tergolong baik; peserta didik mampu menjelaskan konsep dan menerapkannya dengan benar pada sebagian besar tugas.',
    'Capaian belajar berada pada tingkat baik dengan kemampuan mengikuti pembelajaran secara aktif dan bertanggung jawab.',
    'Peserta didik memahami materi dengan baik dan menunjukkan perkembangan yang stabil sepanjang semester.',
  ],
  3: [
    'Peserta didik telah mencapai kriteria ketuntasan minimal dengan penguasaan konsep dasar yang cukup.',
    'Capaian belajar tergolong cukup; konsep pokok sudah dipahami, tetapi ketepatan penerapan masih perlu diperkuat.',
    'Peserta didik mengikuti pembelajaran dengan cukup baik dan mulai mampu menerapkan konsep pada tugas yang sederhana.',
    'Penguasaan materi berada di sekitar batas ketuntasan sehingga masih terbuka ruang untuk ditingkatkan.',
  ],
  2: [
    'Capaian belajar belum mencapai kriteria ketuntasan; peserta didik masih memerlukan bimbingan pada beberapa konsep penting.',
    'Peserta didik sudah menunjukkan usaha, tetapi pemahaman konsep masih belum utuh dan penerapannya masih memerlukan arahan guru.',
    'Penguasaan materi masih di bawah kriteria ketuntasan sehingga diperlukan bimbingan tambahan secara berkala.',
    'Peserta didik mulai memahami sebagian konsep dasar, namun belum konsisten dalam menyelesaikan tugas secara mandiri.',
  ],
  1: [
    'Capaian belajar masih jauh di bawah kriteria ketuntasan; peserta didik memerlukan pendampingan intensif pada konsep dasar.',
    'Peserta didik masih mengalami kesulitan yang cukup besar dalam memahami materi dan memerlukan bantuan langsung dalam setiap tahap belajar.',
    'Penguasaan konsep dasar belum terbentuk dengan baik sehingga dibutuhkan penguatan bertahap dengan dukungan guru dan orang tua.',
    'Peserta didik belum mampu mengerjakan tugas secara mandiri dan perlu dituntun melalui langkah-langkah yang sederhana.',
  ],
}

/** Kalimat penguatan untuk TP unggulan; {tp} = tujuan pembelajaran. */
const KUAT: Record<3 | 4 | 5, string[]> = {
  5: [
    'Sangat menonjol dalam {tp}, mampu menjelaskan, menerapkan, dan mengaitkannya dengan konteks kehidupan sehari-hari.',
    'Menunjukkan penguasaan yang sangat baik dalam {tp} disertai kemampuan bernalar dan menyampaikan alasan dengan runtut.',
    'Unggul dalam {tp} serta mampu membantu teman memahami materi tersebut.',
    'Sangat mantap dalam {tp}; hasil pekerjaan teliti, tepat, dan dikerjakan secara mandiri.',
  ],
  4: [
    'Menunjukkan penguasaan yang baik dalam {tp} dan mampu menerapkannya dengan tepat.',
    'Memahami dengan baik {tp} serta dapat menjelaskan kembali dengan bahasa sendiri.',
    'Berkembang baik dalam {tp}, terlihat dari ketepatan menyelesaikan tugas-tugas yang diberikan.',
    'Mampu mengerjakan tugas yang berkaitan dengan {tp} dengan baik dan cukup mandiri.',
  ],
  3: [
    'Telah memenuhi ketuntasan dalam {tp} dengan pemahaman konsep dasar yang memadai.',
    'Mampu mengikuti pembelajaran {tp} dengan cukup baik pada tugas yang bersifat rutin.',
    'Sudah cukup memahami {tp} meskipun ketelitian dalam penerapannya masih dapat ditingkatkan.',
    'Menunjukkan pemahaman yang memadai dalam {tp}.',
  ],
}

/** Kalimat untuk TP yang perlu penguatan. Tingkat 3 = sudah tuntas tetapi paling rendah dibanding TP lain. */
const LEMAH: Record<1 | 2 | 3, string[]> = {
  3: [
    'Perlu peningkatan agar lebih mantap dalam {tp}.',
    'Masih dapat ditingkatkan dalam {tp} melalui latihan yang lebih bervariasi.',
    'Ketepatan dan kemandirian dalam {tp} masih perlu diperkuat.',
    'Perlu memperdalam pemahaman dalam {tp} agar capaian lebih merata.',
  ],
  2: [
    'Perlu bimbingan dalam {tp}, terutama pada pemahaman konsep dan langkah penyelesaiannya.',
    'Belum tuntas dalam {tp} sehingga membutuhkan pengulangan materi dengan arahan guru.',
    'Memerlukan penguatan dalam {tp} melalui latihan bertahap dari soal yang mudah ke yang lebih kompleks.',
    'Masih ragu dalam menerapkan {tp} dan perlu dibiasakan mengerjakan tugas dengan contoh yang jelas.',
  ],
  1: [
    'Memerlukan pendampingan intensif dalam {tp} mulai dari konsep paling dasar.',
    'Belum menguasai {tp}; diperlukan remedial terjadwal dengan penjelasan yang konkret dan bertahap.',
    'Mengalami kesulitan yang cukup besar dalam {tp} sehingga perlu dibantu pada setiap langkah.',
    'Perlu dukungan khusus dalam {tp} dengan media belajar yang sederhana dan latihan yang berulang.',
  ],
}

const SAS_NAIK = [
  'Hasil asesmen akhir semester lebih tinggi daripada capaian harian, menunjukkan pemahaman yang semakin matang.',
  'Pada asesmen akhir semester peserta didik tampil lebih baik dibanding capaian sebelumnya, tanda kesiapan belajar yang meningkat.',
  'Asesmen akhir semester menunjukkan peningkatan dibanding hasil sumatif harian.',
]
const SAS_TURUN = [
  'Hasil asesmen akhir semester lebih rendah daripada capaian harian, sehingga perlu penguatan pengulangan materi dan kesiapan menghadapi penilaian.',
  'Capaian pada asesmen akhir semester belum sebaik capaian harian; perlu dilatih membaca soal dengan cermat dan mengelola waktu mengerjakan.',
  'Terdapat penurunan pada asesmen akhir semester dibanding hasil harian, sehingga latihan soal ulangan perlu diperbanyak.',
]
const SAS_SEJALAN = [
  'Hasil asesmen akhir semester sejalan dengan capaian harian, menunjukkan konsistensi belajar.',
  'Capaian asesmen akhir semester selaras dengan hasil sumatif harian sehingga gambaran kemampuan peserta didik cukup stabil.',
  'Peserta didik menunjukkan kestabilan hasil antara penilaian harian dan asesmen akhir semester.',
]
const TREN_NAIK = [
  'Capaian cenderung meningkat dari awal hingga akhir semester.',
  'Tampak perkembangan positif; tujuan pembelajaran terakhir dikuasai lebih baik daripada yang awal.',
]
const TREN_TURUN = [
  'Capaian cenderung menurun pada tujuan pembelajaran terakhir sehingga konsistensi belajar perlu dijaga.',
  'Pada tujuan pembelajaran akhir semester terlihat penurunan capaian; semangat dan ritme belajar perlu dijaga.',
]

/** Kalimat literasi (membaca, memahami, dan menyampaikan gagasan) sesuai tingkat. */
const LITERASI: Bank = {
  5: [
    'Dalam kegiatan literasi, peserta didik membaca dan memahami teks materi dengan cermat serta menyampaikan kembali gagasan secara runtut dengan bahasa sendiri.',
    'Kemampuan literasi yang kuat tampak pada ketepatan memahami soal, menarik kesimpulan, dan menuliskan jawaban dengan alasan yang jelas.',
  ],
  4: [
    'Dalam kegiatan literasi, peserta didik mampu memahami isi bacaan dan menyampaikan gagasan pokok dengan baik.',
    'Peserta didik cukup terampil membaca soal dan informasi, lalu menuliskan jawaban dengan kalimat yang dapat dipahami.',
  ],
  3: [
    'Dalam kegiatan literasi, peserta didik dapat memahami bacaan sederhana, namun perlu dibiasakan menelaah informasi dengan lebih teliti.',
    'Kebiasaan membaca dan menuliskan kembali isi materi dengan kalimat sendiri perlu dilatih agar pemahaman lebih mendalam.',
  ],
  2: [
    'Pada kegiatan literasi, peserta didik masih perlu dibimbing memahami maksud soal dan bacaan sebelum menjawab.',
    'Kebiasaan membaca perlu ditumbuhkan melalui bacaan pendek yang dibahas bersama, agar pemahaman terhadap materi meningkat.',
  ],
  1: [
    'Kemampuan literasi dasar, yaitu membaca, memahami instruksi, dan menuliskan jawaban, perlu diperkuat melalui latihan harian yang singkat dan terarah.',
    'Peserta didik memerlukan bacaan sederhana yang dibahas bersama guru atau orang tua untuk membangun pemahaman dasar terhadap materi.',
  ],
}

/** Saran tindak lanjut sesuai tingkat. */
const SARAN: Bank = {
  5: [
    'Pertahankan semangat belajar dan tantang diri dengan soal pengayaan atau proyek yang lebih kompleks.',
    'Disarankan mengikuti kegiatan pengayaan dan mulai berperan sebagai tutor sebaya bagi teman.',
    'Kembangkan kemampuan dengan membaca sumber tambahan dan mengerjakan soal bernalar tingkat lanjut.',
  ],
  4: [
    'Terus lanjutkan kebiasaan belajar yang baik dan tingkatkan ketelitian agar capaian dapat naik ke tingkat sangat baik.',
    'Latihan soal yang lebih bervariasi dan membaca materi tambahan akan membantu meningkatkan capaian.',
    'Dorong keberanian bertanya dan menyampaikan pendapat agar pemahaman semakin mendalam.',
  ],
  3: [
    'Latihan rutin dan mengulang materi sebelum pembelajaran berikutnya akan membantu memperkuat pemahaman.',
    'Disarankan membuat catatan ringkas dan membahas bagian yang belum jelas bersama guru.',
    'Perlu jadwal belajar yang teratur di rumah serta pembiasaan memeriksa kembali hasil pekerjaan.',
  ],
  2: [
    'Disarankan mengulang materi dengan bimbingan guru dan orang tua di rumah serta memanfaatkan jam belajar tambahan.',
    'Perlu program penguatan terjadwal dan latihan bertahap, serta komunikasi rutin antara guru dan orang tua.',
    'Orang tua diharapkan mendampingi belajar di rumah dengan latihan singkat dan teratur setiap hari.',
  ],
  1: [
    'Diperlukan pendampingan intensif, remedial terjadwal, dan kerja sama erat dengan orang tua untuk memperkuat dasar pemahaman.',
    'Disarankan mengikuti program remedial dengan media konkret serta latihan dasar yang diulang setiap hari di rumah.',
    'Perlu asesmen lanjutan untuk mengenali hambatan belajar, disertai dukungan guru, orang tua, dan lingkungan belajar.',
  ],
}

export const BANK_DESKRIPSI = { UMUM, KUAT, LEMAH, SAS_NAIK, SAS_TURUN, SAS_SEJALAN, TREN_NAIK, TREN_TURUN, LITERASI, SARAN }

const lc = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const sebut = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} dan ${xs[xs.length - 1]}` : xs[0] ?? '')
const rata = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const pilih = <T,>(daftar: T[], benih: number, geser = 0) => daftar[Math.abs(benih + geser * 7) % daftar.length]
const isi = (t: string, tp: string) => t.replace('{tp}', tp)
const akhiri = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)

export interface MasukanDeskripsi {
  /** nilai tiap TP yang sudah diisi */
  tp: { t: string; v: number }[]
  /** nilai asesmen akhir (SAS/PAS) bila ada */
  akhir?: number
  /** nilai akhir mapel (berbobot) */
  nilai?: number
  kkm: number
  gaya?: GayaDeskripsi
  /** geser pilihan kalimat bank (tombol Variasi); 0 = bawaan */
  variasi?: number
}

/** Susun deskripsi rapor dari nilai. Mengembalikan teks kosong bila belum ada nilai TP. */
export function susunDeskripsi(m: MasukanDeskripsi): string {
  const gaya = m.gaya ?? gayaAktif
  const { tp, kkm } = m
  if (!tp.length) return ''
  const ratarata = rata(tp.map((x) => x.v))
  const nilai = m.nilai ?? (m.akhir !== undefined ? rata([ratarata, m.akhir]) : ratarata)
  const tk = tingkatDari(nilai, kkm)
  // benih tetap dari data nilai, bukan acak
  const benih = Math.round(tp.reduce((a, x, i) => a + x.v * (i + 3), 0) + (m.akhir ?? 0) * 5 + (m.variasi ?? 0) * 13)
  const urut = [...tp].sort((a, b) => b.v - a.v)
  const bawahKkm = urut.filter((x) => x.v < kkm).reverse()
  const kalimat: string[] = []

  // 1. gambaran umum
  kalimat.push(pilih(UMUM[tk], benih))

  // 2. TP terkuat (hanya yang tuntas)
  const tuntas = urut.filter((x) => x.v >= kkm)
  const kuat = tuntas.slice(0, tuntas.length > 1 || bawahKkm.length ? Math.min(2, tuntas.length) : 1)
  if (kuat.length) {
    const tkKuat = Math.max(3, tingkatDari(rata(kuat.map((x) => x.v)), kkm)) as 3 | 4 | 5
    kalimat.push(isi(pilih(KUAT[tkKuat], benih, 1), sebut(kuat.map((x) => lc(x.t)))))
  }

  // 3. TP yang perlu penguatan: yang di bawah KKM; bila semua tuntas, yang terendah (jika ada lebih dari satu TP)
  if (bawahKkm.length) {
    const lemah = bawahKkm.slice(0, 2)
    const tkLemah = Math.min(2, tingkatDari(rata(lemah.map((x) => x.v)), kkm)) as 1 | 2
    kalimat.push(isi(pilih(LEMAH[tkLemah], benih, 2), sebut(lemah.map((x) => lc(x.t)))))
  } else if (urut.length > 1 && urut[0].v - urut[urut.length - 1].v >= 3) {
    kalimat.push(isi(pilih(LEMAH[3], benih, 2), lc(urut[urut.length - 1].t)))
  }

  if (gaya === 'standar') {
    kalimat.push(pilih(SARAN[tk], benih, 3))
    return kalimat.map(akhiri).join(' ')
  }

  // 4. hubungan dengan asesmen akhir semester
  if (m.akhir !== undefined) {
    const selisih = m.akhir - ratarata
    kalimat.push(pilih(selisih >= 7 ? SAS_NAIK : selisih <= -7 ? SAS_TURUN : SAS_SEJALAN, benih, 4))
  }
  // 5. tren antar TP
  if (tp.length >= 3) {
    const sep = Math.max(1, Math.floor(tp.length / 2))
    const awal = rata(tp.slice(0, sep).map((x) => x.v)), akhirTp = rata(tp.slice(-sep).map((x) => x.v))
    if (akhirTp - awal >= 8) kalimat.push(pilih(TREN_NAIK, benih, 5))
    else if (awal - akhirTp >= 8) kalimat.push(pilih(TREN_TURUN, benih, 5))
  }
  // 6. literasi dan saran
  kalimat.push(pilih(LITERASI[tk], benih, 6))
  kalimat.push(pilih(SARAN[tk], benih, 3))
  return kalimat.map(akhiri).join(' ')
}
