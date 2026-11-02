// Validasi data lokal:
// hasil Valid / Peringatan / Invalid; data Invalid harus diperbaiki sebelum dikirim/dipakai.
// Termasuk ketentuan jenis rombel baru: Kelas Rangkap, PJJ, Keaksaraan, Kebekerjaan Luar Negeri.
import { dokumenJatuhTempo } from './administrasi'
import { validasiBangunan, validasiRuang, validasiTanah } from './prasarana'
import type { Arsip, Jenjang, JenisRombel, Mapel, Pegawai, Rombel, Sekolah, Siswa, Tanah, Bangunan, Ruang } from './types'
import type { PageId } from './ui'

export type Level = 'invalid' | 'peringatan'
export interface Temuan { level: Level; kategori: string; objek: string; pesan: string; page: PageId }

export const KLN_TOTAL_JP = 46
export const KLN_MAKS_ROMBEL = 36

const digit = (s: string | undefined, n: number) => !!s && new RegExp(`^\\d{${n}}$`).test(s)
const jenisDari = (r: Rombel): JenisRombel => r.jenis ?? 'Reguler'

/** Jenis rombel yang boleh dibuat, sesuai jenjang dan penetapan (flag) sekolah. */
export function jenisRombelTersedia(s: Sekolah, jenjang: Jenjang): JenisRombel[] {
  const out: JenisRombel[] = jenjang === 'PKBM' ? ['Keaksaraan', 'Reguler'] : ['Reguler']
  if (jenjang === 'SMK') out.push('Praktik')
  if (jenjang === 'SD' && s.statusSekolah === 'Negeri' && s.flag?.kelasRangkap) out.push('Kelas Rangkap')
  if (jenjang === 'SMA' && s.flag?.pjj) out.push('PJJ')
  if (jenjang === 'SMK' && s.flag?.kln) out.push('Kebekerjaan LN')
  return out
}

/** Rombel yang menjadi "rumah" peserta didik (satu siswa hanya boleh di satu rombel seperti ini per TA). */
export const rombelUtama = (r: Rombel) => ['Reguler', 'Kelas Rangkap', 'PJJ', 'Keaksaraan'].includes(jenisDari(r))

/** Ketentuan per rombel. `semua` = seluruh rombel TA yang sama. */
export function validasiRombel(r: Rombel, semua: Rombel[], siswa: Siswa[], s: Sekolah): { level: Level; pesan: string }[] {
  const e: { level: Level; pesan: string }[] = []
  const inv = (pesan: string) => e.push({ level: 'invalid', pesan })
  const warn = (pesan: string) => e.push({ level: 'peringatan', pesan })
  const j = jenisDari(r)
  const anggota = r.siswaIds.map((id) => siswa.find((x) => x.id === id)).filter((x): x is Siswa => !!x)
  if (!r.nama.trim()) inv('Nama rombel wajib diisi.')
  if (!r.kurikulumId) inv('Kurikulum rombel wajib dipilih.')
  if (j !== 'Reguler' && !jenisRombelTersedia(s, r.jenjang).includes(j)) inv(`Jenis rombel ${j} belum tersedia: sekolah belum ditetapkan (flag) atau jenjang tidak sesuai.`)
  if (!r.waliKelasId && j !== 'Kebekerjaan LN' && !(j === 'Kelas Rangkap' && !r.rombelInduk)) warn(j === 'Keaksaraan' ? 'Tutor/pembimbing belum dipilih.' : 'Wali kelas belum ditentukan.')
  if (!anggota.length) warn('Belum ada anggota rombel.')
  if (anggota.some((x) => x.status !== 'Aktif')) warn('Ada anggota yang statusnya tidak aktif (lulus/mutasi/keluar).')

  if (j === 'Kelas Rangkap') {
    if (!r.rombelInduk) {
      const induk = semua.find((x) => x.id === r.indukId)
      if (!induk) inv('Rombel anggota kelas rangkap harus memilih Rombel Induk.')
      else if (!induk.rombelInduk) inv(`Rombel ${induk.nama} bukan rombel induk.`)
      if (r.pembelajaran?.length) inv('Pembelajaran kelas rangkap hanya diinput pada Rombel Induk.')
    } else {
      if (!r.pembelajaran?.length) warn('Rombel induk kelas rangkap belum memiliki pembelajaran.')
      const turunan = semua.filter((x) => x.indukId === r.id)
      if (!turunan.length) warn('Rombel induk belum memiliki rombel anggota (tingkat lain).')
    }
  }
  if (j === 'Keaksaraan' && !r.program) inv('Program/layanan keaksaraan wajib diisi.')
  if (j === 'PJJ' && r.jenjang !== 'SMA') inv('Rombel PJJ hanya untuk jenjang SMA.')
  if (j === 'Kebekerjaan LN') {
    if (!r.negaraTujuan) inv('Negara tujuan wajib diisi.')
    if (!r.kategoriMapel) inv('Kategori mata pelajaran (Bahasa Asing / Produktif / PJOK) wajib dipilih.')
    if ((r.pembelajaran?.length ?? 0) !== 1) inv('Setiap mata pelajaran Kebekerjaan LN dibuat sebagai satu rombel tersendiri (tepat satu pembelajaran).')
    const bukan = anggota.filter((x) => !x.pesertaKln)
    if (bukan.length) inv(`${bukan.length} anggota belum ditetapkan sebagai peserta Kebekerjaan LN.`)
    const beda = anggota.filter((x) => x.pesertaKln && x.negaraTujuan && r.negaraTujuan && x.negaraTujuan.toLowerCase() !== r.negaraTujuan.toLowerCase())
    if (beda.length) inv(`${beda.length} anggota memiliki negara tujuan berbeda; tidak boleh digabung.`)
    const komp = [...new Set(anggota.map((x) => x.kompetensiKeahlian || '-'))]
    if (r.kategoriMapel === 'Produktif') {
      if (!r.kompetensi) inv('Rombel Produktif wajib memilih kompetensi keahlian.')
      if (komp.length > 1 || (r.kompetensi && komp[0] && komp[0] !== '-' && komp[0] !== r.kompetensi)) inv('Rombel Produktif tidak boleh menggabungkan peserta dari kompetensi keahlian berbeda.')
    } else if (r.kategoriMapel) {
      if (anggota.length > KLN_MAKS_ROMBEL) inv(`Anggota ${anggota.length} melebihi rasio maksimal ${KLN_MAKS_ROMBEL} peserta didik.`)
      if (komp.length > 1) {
        const total = (k: string) => siswa.filter((x) => x.pesertaKln && x.kompetensiKeahlian === k && x.negaraTujuan?.toLowerCase() === r.negaraTujuan?.toLowerCase()).length
        const penuh = komp.filter((k) => k !== '-' && total(k) >= KLN_MAKS_ROMBEL)
        if (penuh.length) warn(`Kompetensi ${penuh.join(', ')} sudah mencapai ${KLN_MAKS_ROMBEL} peserta; sebaiknya dibuat rombel ${r.kategoriMapel} tersendiri.`)
      }
    }
  }
  if (j !== 'Kebekerjaan LN' && j !== 'Kelas Rangkap') {
    const kosong = (r.pembelajaran ?? []).filter((p) => !p.guruId)
    if (kosong.length) warn(`${kosong.length} pembelajaran belum memiliki guru pengampu.`)
  }
  return e
}

/** Beban belajar Program Kebekerjaan LN per negara tujuan: 46 JP, Bahasa Asing ≥ 60%, Produktif + PJOK ≤ 40%. */
export function bebanKln(semua: Rombel[]) {
  const per = new Map<string, { ba: number; prod: number; pjok: number }>()
  for (const r of semua) {
    if (jenisDari(r) !== 'Kebekerjaan LN' || !r.negaraTujuan) continue
    const k = r.negaraTujuan.trim()
    const v = per.get(k) ?? { ba: 0, prod: 0, pjok: 0 }
    const jp = (r.pembelajaran ?? []).reduce((a, p) => a + (p.jp || 0), 0)
    if (r.kategoriMapel === 'Bahasa Asing') v.ba += jp
    if (r.kategoriMapel === 'Produktif') v.prod = Math.max(v.prod, jp) // per kompetensi paralel: ambil beban terbesar
    if (r.kategoriMapel === 'PJOK') v.pjok += jp
    per.set(k, v)
  }
  return [...per.entries()].map(([negara, v]) => {
    const total = v.ba + v.prod + v.pjok
    const msg: string[] = []
    if (total !== KLN_TOTAL_JP) msg.push(`Total beban belajar ${total} JP, seharusnya ${KLN_TOTAL_JP} JP per minggu.`)
    if (v.ba < 0.6 * KLN_TOTAL_JP) msg.push(`Bahasa Asing ${v.ba} JP, minimal 60% (${Math.ceil(0.6 * KLN_TOTAL_JP)} JP).`)
    if (v.prod + v.pjok > 0.4 * KLN_TOTAL_JP) msg.push(`Produktif + PJOK ${v.prod + v.pjok} JP, maksimal 40% (${Math.floor(0.4 * KLN_TOTAL_JP)} JP).`)
    return { negara, ...v, total, msg }
  })
}

export interface DataValidasi {
  sekolah: Sekolah; siswa: Siswa[]; pegawai: Pegawai[]; rombel: Rombel[]; mapel: Mapel[]
  tanah: Tanah[]; bangunan: Bangunan[]; ruang: Ruang[]; arsip: Arsip[]
}

export function jalankanValidasi(d: DataValidasi): Temuan[] {
  const t: Temuan[] = []
  const add = (level: Level, kategori: string, objek: string, pesan: string, page: PageId) => t.push({ level, kategori, objek, pesan, page })
  const s = d.sekolah
  const ta = s.tahunAjaranAktif

  // Satuan pendidikan
  if (!digit(s.npsn, 8)) add('invalid', 'Satuan Pendidikan', s.nama, 'NPSN harus 8 digit angka.', 'pengaturan')
  if (!s.alamat) add('invalid', 'Satuan Pendidikan', s.nama, 'Alamat sekolah belum diisi.', 'pengaturan')
  if (!s.kepalaSekolahId) add('invalid', 'Satuan Pendidikan', s.nama, 'Kepala sekolah belum ditentukan.', 'pengaturan')
  if (!s.statusSekolah) add('peringatan', 'Satuan Pendidikan', s.nama, 'Status sekolah (negeri/swasta) belum diisi.', 'pengaturan')
  if (!s.akreditasi) add('peringatan', 'Satuan Pendidikan', s.nama, 'Akreditasi belum diisi.', 'pengaturan')
  if (!s.telepon && !s.email) add('peringatan', 'Satuan Pendidikan', s.nama, 'Kontak (telepon/email) belum diisi.', 'pengaturan')

  // Peserta didik
  const aktif = d.siswa.filter((x) => x.status === 'Aktif')
  const rombelTa = d.rombel.filter((r) => r.tahunAjaran === ta)
  const rumah = new Map<string, string[]>()
  for (const r of rombelTa.filter(rombelUtama)) for (const id of r.siswaIds) rumah.set(id, [...(rumah.get(id) ?? []), r.nama])
  const nisn = new Map<string, number>()
  for (const x of d.siswa) if (x.nisn) nisn.set(x.nisn, (nisn.get(x.nisn) ?? 0) + 1)
  for (const x of aktif) {
    const o = `${x.nama} (${x.noInduk})`
    const dini = x.jenjang === 'PAUD' || x.jenjang === 'TK'
    if (x.nik && !digit(x.nik, 16)) add('invalid', 'Peserta Didik', o, 'NIK harus 16 digit angka.', 'siswa')
    if (!x.nik) add('peringatan', 'Peserta Didik', o, 'NIK belum diisi.', 'siswa')
    if (x.nisn && !digit(x.nisn, 10)) add('invalid', 'Peserta Didik', o, 'NISN harus 10 digit angka.', 'siswa')
    if (x.nisn && (nisn.get(x.nisn) ?? 0) > 1) add('invalid', 'Peserta Didik', o, `NISN ${x.nisn} dipakai lebih dari satu peserta didik.`, 'siswa')
    if (!x.nisn && !dini) add('peringatan', 'Peserta Didik', o, 'NISN belum diisi.', 'siswa')
    if (!x.tanggalLahir || !x.tempatLahir) add('invalid', 'Peserta Didik', o, 'Tempat dan tanggal lahir wajib diisi.', 'siswa')
    if (!x.ibu.nama) add('invalid', 'Peserta Didik', o, 'Nama ibu kandung wajib diisi.', 'siswa')
    if (!x.ayah.statusHidup || !x.ibu.statusHidup) add('invalid', 'Peserta Didik', o, 'Status hidup ayah dan ibu kandung wajib diisi .', 'siswa')
    if (x.ayah.statusHidup === 'Wafat' && x.ibu.statusHidup === 'Wafat' && !x.wali.nama) add('peringatan', 'Peserta Didik', o, 'Kedua orang tua wafat: data wali sebaiknya diisi.', 'siswa')
    if (x.ayah.nik && !digit(x.ayah.nik, 16)) add('invalid', 'Peserta Didik', o, 'NIK ayah harus 16 digit.', 'siswa')
    if (x.ibu.nik && !digit(x.ibu.nik, 16)) add('invalid', 'Peserta Didik', o, 'NIK ibu harus 16 digit.', 'siswa')
    const rb = rumah.get(x.id) ?? []
    if (!rb.length) add('invalid', 'Peserta Didik', o, `Belum menjadi anggota rombel pada TA ${ta}.`, 'rombel')
    if (rb.length > 1) add('invalid', 'Peserta Didik', o, `Terdaftar di lebih dari satu rombel: ${rb.join(', ')}.`, 'rombel')
    if (x.pesertaKln && (!x.negaraTujuan || !x.kompetensiKeahlian)) add('invalid', 'Peserta Didik', o, 'Peserta Kebekerjaan LN wajib memiliki negara tujuan dan kompetensi keahlian.', 'siswa')
  }

  // GTK
  const jp = new Map<string, number>()
  for (const r of rombelTa) for (const p of r.pembelajaran ?? []) if (p.guruId) jp.set(p.guruId, (jp.get(p.guruId) ?? 0) + (p.jp || 0))
  for (const g of d.pegawai.filter((x) => x.aktif)) {
    const o = g.nama
    if (g.nik && !digit(g.nik, 16)) add('invalid', 'GTK', o, 'NIK harus 16 digit angka.', 'pegawai')
    if (!g.nik) add('peringatan', 'GTK', o, 'NIK belum diisi.', 'pegawai')
    if (g.nip && !digit(g.nip, 18)) add('invalid', 'GTK', o, 'NIP harus 18 digit angka.', 'pegawai')
    if ((g.statusKepegawaian === 'PNS' || g.statusKepegawaian === 'PPPK') && !g.nip) add('invalid', 'GTK', o, `${g.statusKepegawaian} wajib memiliki NIP.`, 'pegawai')
    if (g.nuptk && !digit(g.nuptk, 16)) add('invalid', 'GTK', o, 'NUPTK harus 16 digit angka.', 'pegawai')
    if (!g.tanggalLahir) add('peringatan', 'GTK', o, 'Tanggal lahir belum diisi.', 'pegawai')
    if (g.jenis === 'Guru') {
      const beban = jp.get(g.id) ?? 0
      if (!beban && g.jabatan !== 'Kepala Sekolah') add('peringatan', 'GTK', o, 'Belum memiliki pembelajaran (penugasan mengajar) pada TA aktif.', 'rombel')
      if (g.noSertifikatPendidik && beban > 0 && beban < 24 && !g.tugasTambahan) add('peringatan', 'GTK', o, `Beban mengajar ${beban} JP, di bawah 24 JP untuk guru bersertifikat.`, 'rombel')
    }
  }

  // Rombel & pembelajaran
  for (const r of rombelTa) for (const e of validasiRombel(r, rombelTa, d.siswa, s)) add(e.level, 'Rombongan Belajar', r.nama, e.pesan, 'rombel')
  for (const b of bebanKln(rombelTa)) for (const m of b.msg) add('invalid', 'Rombongan Belajar', `Kebekerjaan LN ${b.negara}`, m, 'rombel')

  // Sarana prasarana
  for (const x of d.tanah.filter((x) => !x.dihapus)) for (const m of validasiTanah(x)) add('invalid', 'Sarpras', `Tanah ${x.nama}`, m, 'prasarana')
  for (const x of d.bangunan.filter((x) => !x.dihapus)) for (const m of validasiBangunan(x, d.tanah.find((t) => t.id === x.tanahId))) add('invalid', 'Sarpras', `Bangunan ${x.nama}`, m, 'prasarana')
  for (const x of d.ruang.filter((x) => !x.dihapus)) for (const m of validasiRuang(x, d.ruang, d.bangunan.find((b) => b.id === x.bangunanId))) add('invalid', 'Sarpras', `Ruang ${x.nama}`, m, 'prasarana')

  // Dokumen administrasi yang kedaluwarsa
  for (const x of dokumenJatuhTempo(d.arsip, 0)) add('peringatan', 'Administrasi', x.nama, `Masa berlaku dokumen ${x.lewat ? 'sudah habis' : 'habis hari ini'}.`, 'administrasi')
  return t
}

/** Implementasi kurikulum dihitung dari kurikulum tiap rombel . */
export function implementasiKurikulum(rombel: Rombel[], ta: string) {
  const m = new Map<string, { rombel: number; siswa: number; jenjang: Set<string> }>()
  for (const r of rombel.filter((x) => x.tahunAjaran === ta && rombelUtama(x))) {
    const v = m.get(r.kurikulumId) ?? { rombel: 0, siswa: 0, jenjang: new Set<string>() }
    v.rombel++; v.siswa += r.siswaIds.length; v.jenjang.add(r.jenjang)
    m.set(r.kurikulumId, v)
  }
  return [...m.entries()].map(([kurikulumId, v]) => ({ kurikulumId, rombel: v.rombel, siswa: v.siswa, jenjang: [...v.jenjang] }))
}
