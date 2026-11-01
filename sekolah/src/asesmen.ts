// Asesmen siswa berbasis rubrik: panduan (deskriptor per level) + isian guru, dengan jejak penilai dan kunci data.
import type { Arsip } from './types'

export interface Aspek { key: string; label: string; perilaku: string; level?: [string, string, string, string] }
export interface Instrumen { id: string; nama: string; ket: string; untuk: string; aspek: Aspek[]; kustom?: boolean }
export interface Riwayat { t: string; oleh: string; aspek: string; dari?: number; ke?: number }
export interface Rekam { skor: Record<string, number>; bukti: Record<string, string>; umum: string; penilai?: string; tanggal?: string; final: boolean; riwayat: Riwayat[] }

export const SKALA: { n: 1 | 2 | 3 | 4; label: string }[] = [
  { n: 1, label: 'Perlu Bimbingan' }, { n: 2, label: 'Cukup' }, { n: 3, label: 'Baik' }, { n: 4, label: 'Sangat Baik' },
]
export const labelSkor = (n?: number) => SKALA.find((s) => s.n === n)?.label ?? '-'

/** Deskriptor level untuk satu aspek: eksplisit bila diisi, jika tidak disusun dari perilaku yang diamati. */
export function deskriptor(a: Aspek, n: 1 | 2 | 3 | 4): string {
  const l = a.level?.[n - 1]?.trim()
  if (l) return l
  const p = a.perilaku.trim().replace(/\.$/, '')
  return [
    `Belum tampak ${p}; perlu bimbingan intensif.`,
    `Mulai ${p}, tetapi masih perlu pembiasaan dan pengingat.`,
    `Sering ${p}, sesekali masih perlu diingatkan.`,
    `Konsisten ${p} atas kemauan sendiri dan menjadi teladan bagi teman.`,
  ][n - 1]
}

const A = (key: string, label: string, perilaku: string): Aspek => ({ key, label, perilaku })

export const INSTRUMEN_BAWAAN: Instrumen[] = [
  { id: 'sikap', nama: 'Sikap & Karakter', ket: 'Observasi perilaku harian selama semester', untuk: 'SD · SMP · SMA · SMK', aspek: [
    A('religius', 'Religius', 'menjalankan ibadah dan berdoa sesuai agamanya serta menghormati pemeluk agama lain'),
    A('jujur', 'Jujur', 'berkata dan bertindak apa adanya, tidak menyontek atau mengambil milik orang lain'),
    A('disiplin', 'Disiplin', 'datang tepat waktu dan menaati tata tertib kelas dan sekolah'),
    A('tanggungjawab', 'Tanggung jawab', 'menyelesaikan tugas tepat waktu dan mengakui kesalahan yang dibuat'),
    A('santun', 'Santun', 'bertutur kata dan bersikap sopan kepada guru, teman, dan warga sekolah'),
    A('peduli', 'Peduli', 'peduli terhadap teman yang membutuhkan dan menjaga kebersihan lingkungan'),
    A('gotong', 'Gotong royong', 'bekerja sama dan berbagi tugas dalam kegiatan kelompok'),
    A('percaya', 'Percaya diri', 'berani menyampaikan pendapat dan mencoba hal baru'),
  ] },
  { id: 'p3', nama: 'Profil Pelajar Pancasila', ket: 'Enam dimensi profil lulusan; diamati melalui kegiatan dan projek', untuk: 'Kurikulum Merdeka', aspek: [
    A('iman', 'Beriman, bertakwa kepada Tuhan YME, dan berakhlak mulia', 'menerapkan nilai keimanan dan akhlak mulia dalam kegiatan sehari-hari'),
    A('bhineka', 'Berkebinekaan global', 'menghargai perbedaan budaya dan berinteraksi dengan terbuka'),
    A('gotongroyong', 'Bergotong royong', 'berkolaborasi, peduli, dan berbagi dalam mencapai tujuan bersama'),
    A('mandiri', 'Mandiri', 'bertanggung jawab atas proses belajarnya dan mengatur diri sendiri'),
    A('bernalar', 'Bernalar kritis', 'mengajukan pertanyaan, menganalisis informasi, dan mengambil keputusan berdasar alasan'),
    A('kreatif', 'Kreatif', 'menghasilkan gagasan dan karya yang orisinal serta bermakna'),
  ] },
  { id: 'proyek', nama: 'Keterampilan / Proyek', ket: 'Rubrik penilaian kinerja, praktik, atau projek', untuk: 'Semua jenjang', aspek: [
    A('rencana', 'Perencanaan', 'menyusun rencana kerja dan menyiapkan alat serta bahan dengan runtut'),
    A('laksana', 'Pelaksanaan', 'melaksanakan langkah kerja dengan benar, aman, dan mandiri'),
    A('hasil', 'Hasil karya', 'menghasilkan karya yang sesuai kriteria dan rapi'),
    A('komunikasi', 'Presentasi', 'mempresentasikan karya dengan jelas dan percaya diri'),
    A('kolaborasi', 'Kolaborasi', 'berkontribusi dan menghargai pendapat anggota kelompok'),
  ] },
  { id: 'paud', nama: 'Observasi Perkembangan Anak', ket: 'Pengamatan enam aspek perkembangan anak usia dini', untuk: 'PAUD · TK', aspek: [
    A('agama', 'Nilai agama dan moral', 'berdoa, menirukan ibadah sederhana, dan berperilaku baik'),
    A('motorik', 'Fisik motorik', 'mengendalikan gerak tubuh dan menggunakan tangan untuk berkarya'),
    A('kognitif', 'Kognitif', 'mengenal warna, bentuk, bilangan, dan memecahkan masalah sederhana'),
    A('bahasa', 'Bahasa', 'memahami pesan dan mengungkapkan keinginan dengan kata-kata'),
    A('sosem', 'Sosial emosional', 'mengelola emosi, bermain bersama, dan menaati aturan'),
    A('seni', 'Seni', 'mengekspresikan diri melalui gambar, musik, dan gerak'),
  ] },
  { id: 'diagnostik', nama: 'Asesmen Diagnostik Awal', ket: 'Pemetaan kesiapan belajar di awal semester', untuk: 'Semua jenjang', aspek: [
    A('literasi', 'Literasi', 'membaca dan memahami teks sesuai tingkat kelasnya'),
    A('numerasi', 'Numerasi', 'memahami bilangan dan memecahkan soal berhitung sesuai tingkat kelasnya'),
    A('kesiapan', 'Kesiapan belajar', 'fokus, membawa perlengkapan, dan mengikuti instruksi guru'),
  ] },
]

const REG_INSTRUMEN = 'asesmen-instrumen'
export const REG_ASESMEN = 'asesmen'

export function instrumenKustom(arsip: Arsip[]): Instrumen[] {
  return arsip.filter((a) => a.register === REG_INSTRUMEN).map((a) => {
    let aspek: Aspek[] = []
    try { aspek = JSON.parse(String(a.data.aspek ?? '[]')) } catch { /* abaikan */ }
    return { id: a.id, nama: String(a.data.nama ?? 'Instrumen'), ket: String(a.data.ket ?? ''), untuk: 'Kustom', aspek, kustom: true }
  })
}
export const semuaInstrumen = (arsip: Arsip[]) => [...INSTRUMEN_BAWAAN, ...instrumenKustom(arsip)]
export function simpanInstrumen(i: Instrumen, lama?: Arsip, oleh?: string): Arsip {
  const now = new Date().toISOString()
  return { id: i.id, register: REG_INSTRUMEN, data: { nama: i.nama, ket: i.ket, aspek: JSON.stringify(i.aspek) }, dibuat: lama?.dibuat ?? now, diubah: now, oleh }
}

export const idRekam = (ta: string, sem: number, instrumenId: string, siswaId: string) => `asm|${ta}|${sem}|${instrumenId}|${siswaId}`
export const REKAM_KOSONG = (): Rekam => ({ skor: {}, bukti: {}, umum: '', final: false, riwayat: [] })

const json = <T,>(v: unknown, d: T): T => { try { return v ? (JSON.parse(String(v)) as T) : d } catch { return d } }

export function bacaRekam(a?: Arsip): Rekam {
  if (!a) return REKAM_KOSONG()
  return {
    skor: json(a.data.skor, {}), bukti: json(a.data.bukti, {}), umum: String(a.data.umum ?? ''),
    penilai: a.data.penilai ? String(a.data.penilai) : undefined, tanggal: a.data.tanggal ? String(a.data.tanggal) : undefined,
    final: a.data.final === 1, riwayat: json(a.data.riwayat, []),
  }
}

export function tulisRekam(id: string, meta: { ta: string; sem: number; rombelId: string; instrumenId: string; siswaId: string }, r: Rekam, lama?: Arsip): Arsip {
  const now = new Date().toISOString()
  return {
    id, register: REG_ASESMEN, dibuat: lama?.dibuat ?? now, diubah: now, oleh: r.penilai,
    data: {
      ta: meta.ta, sem: meta.sem, rombel: meta.rombelId, instrumen: meta.instrumenId, siswa: meta.siswaId,
      skor: JSON.stringify(r.skor), bukti: JSON.stringify(r.bukti), umum: r.umum, penilai: r.penilai, tanggal: r.tanggal,
      final: r.final ? 1 : 0, riwayat: JSON.stringify(r.riwayat.slice(-60)),
    },
  }
}

/** Catat perubahan skor ke riwayat (siapa, kapan, dari-ke) sebagai jejak pertanggungjawaban. */
export function catatRiwayat(lama: Rekam, baru: Rekam, oleh: string, aspek: Aspek[]): Riwayat[] {
  const t = new Date().toISOString()
  const out = [...baru.riwayat]
  for (const a of aspek) if (lama.skor[a.key] !== baru.skor[a.key]) out.push({ t, oleh, aspek: a.label, dari: lama.skor[a.key], ke: baru.skor[a.key] })
  return out
}

export const predikat = (rata: number) => (rata >= 3.5 ? 'Sangat Baik' : rata >= 2.75 ? 'Baik' : rata >= 1.75 ? 'Cukup' : 'Perlu Bimbingan')

export function kelengkapan(inst: Instrumen, r: Rekam) {
  const terisi = inst.aspek.filter((a) => r.skor[a.key] >= 1).length
  // Skor ekstrem (1 atau 4) wajib disertai bukti/catatan observasi agar dapat dipertanggungjawabkan.
  const butuhBukti = inst.aspek.filter((a) => (r.skor[a.key] === 1 || r.skor[a.key] === 4) && !(r.bukti[a.key] ?? '').trim()).map((a) => a.label)
  return { terisi, total: inst.aspek.length, butuhBukti, bisaFinal: terisi === inst.aspek.length && inst.aspek.length > 0 && butuhBukti.length === 0 }
}

export function ringkasan(inst: Instrumen, r: Rekam) {
  const baris = inst.aspek.filter((a) => r.skor[a.key] >= 1).map((a) => {
    const n = r.skor[a.key] as 1 | 2 | 3 | 4
    return { aspek: a.label, skor: n, label: labelSkor(n), deskripsi: deskriptor(a, n), bukti: (r.bukti[a.key] ?? '').trim() }
  })
  const rata = baris.length ? baris.reduce((x, b) => x + b.skor, 0) / baris.length : undefined
  const maks = Math.max(...baris.map((b) => b.skor)), min = Math.min(...baris.map((b) => b.skor))
  const kuat = baris.filter((b) => b.skor === maks).slice(0, 2).map((b) => b.aspek.toLowerCase())
  const lemah = baris.filter((b) => b.skor === min && min < 3).slice(0, 2).map((b) => b.aspek.toLowerCase())
  const narasi = baris.length ? [
    rata !== undefined && `Secara keseluruhan berkategori ${predikat(rata).toLowerCase()}.`,
    maks >= 3 && kuat.length && `Menonjol pada ${kuat.join(' dan ')}.`,
    lemah.length && `Perlu pembinaan pada ${lemah.join(' dan ')}.`,
  ].filter(Boolean).join(' ') : ''
  return { baris, rata, predikat: rata !== undefined ? predikat(rata) : undefined, narasi }
}

/** Asesmen yang sudah dikunci (final) untuk satu siswa; hanya ini yang masuk rapor. */
export function asesmenSiswa(arsip: Arsip[], ta: string, sem: number, siswaId: string) {
  const insts = semuaInstrumen(arsip)
  return arsip.filter((a) => a.register === REG_ASESMEN && a.data.ta === ta && a.data.sem === sem && a.data.siswa === siswaId).map((a) => {
    const inst = insts.find((i) => i.id === a.data.instrumen)
    return inst ? { inst, rekam: bacaRekam(a) } : null
  }).filter((x): x is { inst: Instrumen; rekam: Rekam } => !!x).map((x) => ({ ...x, ringkas: ringkasan(x.inst, x.rekam) }))
}
export const asesmenFinal = (arsip: Arsip[], ta: string, sem: number, siswaId: string) => asesmenSiswa(arsip, ta, sem, siswaId).filter((x) => x.rekam.final)
