// Akun pengguna, peran (jenis akun), kebijakan keamanan, dan log aktivitas.
// Disimpan di database IndexedDB terpisah ("simas-akun"); rahasia (kunci data, rahasia TOTP) selalu terenkripsi.
import type { PageId } from '../ui'
import { ambilKunciPerangkat, buatKunciPerangkat, hapusKunciPerangkat } from './perangkat'
import type { ProfilGoogle } from './google'
import {
  b64, bukaDek, bungkusDek, cekTotp, dekBaru, dekripsiJson, enkripsiJson, kdfBaru, kodePemulihanBaru, normalisasiKode, randomBytes,
  samaAman, turunkan, type Bungkus, type KdfParams,
} from './crypto'

// ---------- Tipe ----------
export interface Peran {
  id: string
  nama: string
  ket: string
  halaman: PageId[]
  bawaan?: boolean
  /** Peran ini wajib memakai verifikasi 2 langkah. */
  wajib2fa?: boolean
  /** Bidang administrasi yang boleh dibuka (kosong/undefined = semua bidang). */
  bidang?: string[]
}

export interface Akun {
  id: string
  username: string
  nama: string
  email?: string
  peranId: string
  pegawaiId?: string
  aktif: boolean
  kdf: KdfParams
  verifier: string
  dekWrap: Bungkus
  totpEnc?: Bungkus
  totpLangkahTerakhir?: number
  wajibGantiSandi: boolean
  gagal: number
  kunciSampai?: number
  dibuat: string
  sandiDiubah: string
  loginTerakhir?: string
  /** Data profil lengkap */
  jabatan?: string
  nip?: string
  telepon?: string
  alamat?: string
  tempatLahir?: string
  tanggalLahir?: string
  jk?: 'L' | 'P' | ''
  keterangan?: string
  foto?: string
  /** Akun Google yang terhubung. `wrap` = kunci data yang dikunci dengan kunci perangkat (aktif bila masuk Google diizinkan). */
  google?: { sub: string; email: string; nama?: string; dihubungkan: string; wrap?: Bungkus }
}

/** Kolom profil yang boleh diubah pemilik akun sendiri. */
export const KOLOM_PROFIL = ['nama', 'email', 'jabatan', 'nip', 'telepon', 'alamat', 'tempatLahir', 'tanggalLahir', 'jk', 'keterangan', 'foto'] as const
export type PatchProfil = Partial<Pick<Akun, (typeof KOLOM_PROFIL)[number]>>

export interface ConfigGoogle { aktif: boolean; clientId: string; domain?: string }

export interface Kebijakan {
  panjangMin: number
  maksGagal: number
  kunciMenit: number
  idleMenit: number
  masaBerlakuHari: number // 0 = tidak kedaluwarsa
}

export interface Audit {
  id: string
  waktu: string
  username: string
  aksi: string
  detail?: string
  ok: boolean
}

interface Pemulihan { kdf: KdfParams; verifier: string; dekWrap: Bungkus }

export const SEMUA_HALAMAN: PageId[] = ['dashboard', 'siswa', 'pegawai', 'induk', 'rombel', 'mapel', 'ekskul', 'absensiSiswa', 'absensiPegawai', 'nilai', 'asesmen', 'rapor', 'prasarana', 'administrasi', 'validasi', 'pengaturan', 'akun']

export const PERAN_BAWAAN: Peran[] = [
  { id: 'admin', nama: 'Administrator', ket: 'Akses penuh, termasuk akun, keamanan, cadangan data', halaman: SEMUA_HALAMAN, bawaan: true, wajib2fa: false },
  { id: 'kepsek', nama: 'Kepala Sekolah', ket: 'Melihat dan mengelola seluruh data sekolah', halaman: SEMUA_HALAMAN.filter((h) => h !== 'akun'), bawaan: true },
  { id: 'operator', nama: 'Operator / Tata Usaha', ket: 'Data induk, rombel, absensi, rapor, prasarana', halaman: ['dashboard', 'siswa', 'pegawai', 'induk', 'rombel', 'mapel', 'ekskul', 'absensiSiswa', 'absensiPegawai', 'rapor', 'prasarana', 'administrasi', 'validasi'], bidang: ['anak', 'sdm', 'umum', 'sarpras', 'tu'], bawaan: true },
  { id: 'wali', nama: 'Wali Kelas', ket: 'Absensi siswa, penilaian, dan rapor kelasnya', halaman: ['dashboard', 'siswa', 'induk', 'absensiSiswa', 'nilai', 'asesmen', 'rapor', 'administrasi'], bidang: ['anak', 'guru'], bawaan: true },
  { id: 'guru', nama: 'Guru Mata Pelajaran', ket: 'Absensi siswa dan penilaian', halaman: ['dashboard', 'absensiSiswa', 'nilai', 'asesmen', 'administrasi'], bidang: ['guru'], bawaan: true },
  { id: 'sarpras', nama: 'Petugas Sarpras', ket: 'Data dan pengajuan prasarana', halaman: ['dashboard', 'prasarana', 'administrasi'], bidang: ['sarpras'], bawaan: true },
  { id: 'bendahara', nama: 'Bendahara', ket: 'Administrasi keuangan: BKU, pajak, RKAS, pembayaran siswa, honor', halaman: ['dashboard', 'administrasi'], bidang: ['keuangan'], bawaan: true },
]

export const KEBIJAKAN_DEFAULT: Kebijakan = { panjangMin: 12, maksGagal: 5, kunciMenit: 15, idleMenit: 15, masaBerlakuHari: 0 }

// ---------- Penyimpanan ----------
const DB = 'simas-akun'
function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
}
let dbp: Promise<IDBDatabase> | null = null
let dbName = DB
export const _simpanAkun = (a: Akun) => putS('akun', a) // untuk pengujian
export function _setDbName(n: string) { dbName = n; dbp = null } // untuk pengujian
function db() {
  return (dbp ??= new Promise((res, rej) => {
    const o = indexedDB.open(dbName, 1)
    o.onupgradeneeded = () => {
      const d = o.result
      d.createObjectStore('akun', { keyPath: 'id' })
      d.createObjectStore('audit', { keyPath: 'id' })
      d.createObjectStore('meta', { keyPath: 'key' })
    }
    o.onsuccess = () => res(o.result)
    o.onerror = () => rej(o.error)
  }))
}
async function all<T>(s: string): Promise<T[]> { return req((await db()).transaction(s).objectStore(s).getAll()) as Promise<T[]> }
async function putS(s: string, v: unknown) { await req((await db()).transaction(s, 'readwrite').objectStore(s).put(v)) }
async function delS(s: string, k: string) { await req((await db()).transaction(s, 'readwrite').objectStore(s).delete(k)) }
async function meta<T>(key: string): Promise<T | undefined> {
  const r = await req((await db()).transaction('meta').objectStore('meta').get(key)) as { key: string; v: T } | undefined
  return r?.v
}
const setMeta = (key: string, v: unknown) => putS('meta', { key, v })

const id = () => b64(randomBytes(12)).replace(/[+/=]/g, '')
const now = () => new Date().toISOString()

export const daftarAkun = () => all<Akun>('akun')
export const adaAkun = async () => (await daftarAkun()).length > 0
export async function daftarPeran(): Promise<Peran[]> {
  const custom = (await meta<Peran[]>('peran')) ?? []
  const ubahan = new Map(custom.map((p) => [p.id, p]))
  return [...PERAN_BAWAAN.map((p) => (p.id === 'admin' ? p : { ...p, ...ubahan.get(p.id), bawaan: true })), ...custom.filter((p) => !PERAN_BAWAAN.some((b) => b.id === p.id))]
}
export async function simpanPeran(p: Peran) {
  if (p.id === 'admin') throw new Error('Peran Administrator tidak dapat diubah.')
  const custom = (await meta<Peran[]>('peran')) ?? []
  await setMeta('peran', [...custom.filter((x) => x.id !== p.id), p])
}
export async function hapusPeran(pid: string) {
  if (PERAN_BAWAAN.some((p) => p.id === pid)) throw new Error('Peran bawaan tidak dapat dihapus.')
  if ((await daftarAkun()).some((a) => a.peranId === pid)) throw new Error('Masih ada akun dengan peran ini.')
  await setMeta('peran', ((await meta<Peran[]>('peran')) ?? []).filter((x) => x.id !== pid))
}
export const configGoogle = async (): Promise<ConfigGoogle> => ({ aktif: false, clientId: '', ...(await meta<ConfigGoogle>('google')) })
export async function simpanConfigGoogle(s: Sesi, c: ConfigGoogle) {
  wajibAdmin(s)
  const clientId = c.clientId.trim()
  if (c.aktif && !/^[\w-]+\.apps\.googleusercontent\.com$/i.test(clientId)) throw new Error('Client ID Google tidak valid (format: xxxx.apps.googleusercontent.com).')
  await setMeta('google', { aktif: c.aktif, clientId, domain: c.domain?.trim().toLowerCase() || undefined } satisfies ConfigGoogle)
  await logAudit(s.akun.username, c.aktif ? 'Aktifkan masuk dengan Google' : 'Nonaktifkan masuk dengan Google', true)
}
export const kebijakan = async () => ({ ...KEBIJAKAN_DEFAULT, ...(await meta<Kebijakan>('kebijakan')) })
export const simpanKebijakan = (k: Kebijakan) => setMeta('kebijakan', k)
export const logAudit = async (username: string, aksi: string, ok: boolean, detail?: string) =>
  putS('audit', { id: `${Date.now().toString(36)}${id()}`, waktu: now(), username, aksi, ok, detail } satisfies Audit)
export const daftarAudit = async () => (await all<Audit>('audit')).sort((a, b) => b.waktu.localeCompare(a.waktu))

// ---------- Kebijakan kata sandi ----------
const UMUM = ['password', 'katasandi', 'sekolah', 'admin', '12345678', 'qwerty', 'indonesia', 'bismillah', 'rahasia', 'letmein']
export function cekSandi(pw: string, username: string, k: Kebijakan = KEBIJAKAN_DEFAULT): string[] {
  const e: string[] = []
  if (pw.length < k.panjangMin) e.push(`Minimal ${k.panjangMin} karakter.`)
  const kelas = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  if (kelas < 3) e.push('Gunakan minimal 3 dari: huruf kecil, huruf besar, angka, simbol.')
  if (username && pw.toLowerCase().includes(username.toLowerCase())) e.push('Tidak boleh memuat nama pengguna.')
  if (UMUM.some((w) => pw.toLowerCase().includes(w))) e.push('Terlalu mudah ditebak (memuat kata umum).')
  if (/(.)\1{3,}/.test(pw)) e.push('Hindari karakter berulang.')
  return e
}
export function kekuatan(pw: string): number {
  let s = Math.min(4, Math.floor(pw.length / 4))
  s += [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  return Math.min(4, Math.floor(s / 2))
}
export function sandiAcak(n = 16): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?'
  let s = ''
  for (const x of randomBytes(n)) s += c[x % c.length]
  return /[0-9]/.test(s) && /[!@#$%&*?]/.test(s) ? s : sandiAcak(n)
}
const normUser = (u: string) => u.trim().toLowerCase()
const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
/** Cari akun menurut nama pengguna, atau menurut email bila input berbentuk email. */
export const cariAkun = (semua: Akun[], masukan: string) => semua.find((a) => a.username === masukan) ?? (masukan.includes('@') ? semua.find((a) => a.email?.toLowerCase() === masukan) : undefined)
export const usernameValid = (u: string) => /^[a-z0-9._-]{3,32}$/.test(normUser(u))

// ---------- Sesi ----------
export interface Sesi { akun: Akun; peran: Peran; dek: CryptoKey }

async function buatKredensial(password: string, dek: CryptoKey) {
  const kdf = await kdfBaru()
  const { verifier, kek } = await turunkan(password, kdf)
  return { kdf, verifier, dekWrap: await bungkusDek(dek, kek) }
}

/** Instalasi pertama: buat kunci data, akun Administrator, dan kode pemulihan. */
export async function pasangAwal(p: { username: string; nama: string; password: string }): Promise<{ sesi: Sesi; kodePemulihan: string }> {
  if (await adaAkun()) throw new Error('Akun sudah pernah dibuat.')
  const username = normUser(p.username)
  if (!usernameValid(username)) throw new Error('Nama pengguna 3-32 karakter: huruf kecil, angka, titik, garis bawah, atau minus.')
  const err = cekSandi(p.password, username)
  if (err.length) throw new Error(err.join(' '))
  const dek = await dekBaru()
  const kodePemulihan = kodePemulihanBaru()
  const rec = await buatKredensial(normalisasiKode(kodePemulihan), dek)
  await setMeta('pemulihan', rec satisfies Pemulihan)
  const akun: Akun = { id: id(), username, nama: p.nama.trim() || username, peranId: 'admin', aktif: true, ...(await buatKredensial(p.password, dek)), wajibGantiSandi: false, gagal: 0, dibuat: now(), sandiDiubah: now() }
  await putS('akun', akun)
  await logAudit(username, 'Pemasangan awal & pembuatan Administrator', true)
  return { sesi: { akun, peran: PERAN_BAWAAN[0], dek }, kodePemulihan }
}

export type HasilLogin = { ok: true; sesi: Sesi } | { ok: false; pesan: string } | { ok: 'totp'; lanjut: (kode: string) => Promise<HasilLogin> }

const GAGAL_UMUM = 'Nama pengguna atau kata sandi salah.'

export async function masuk(usernameIn: string, password: string): Promise<HasilLogin> {
  const username = normUser(usernameIn)
  const k = await kebijakan()
  const akun = cariAkun(await daftarAkun(), username)
  if (!akun) {
    // tetap hitung KDF agar waktu respons tidak membocorkan keberadaan akun
    await turunkan(password, { alg: 'argon2id', salt: b64(randomBytes(16)), m: 65536, t: 3, p: 1 }).catch(() => undefined)
    await logAudit(username, 'Login gagal', false, 'akun tidak dikenal')
    return { ok: false, pesan: GAGAL_UMUM }
  }
  if (akun.kunciSampai && akun.kunciSampai > Date.now()) {
    const m = Math.ceil((akun.kunciSampai - Date.now()) / 60000)
    await logAudit(username, 'Login ditolak', false, 'akun terkunci')
    return { ok: false, pesan: `Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${m} menit atau hubungi Administrator.` }
  }
  const { verifier, kek } = await turunkan(password, akun.kdf)
  if (!samaAman(verifier, akun.verifier)) {
    akun.gagal = (akun.gagal ?? 0) + 1
    if (akun.gagal >= k.maksGagal) { akun.kunciSampai = Date.now() + k.kunciMenit * 60000; akun.gagal = 0 }
    await putS('akun', akun)
    await logAudit(username, 'Login gagal', false, akun.kunciSampai && akun.kunciSampai > Date.now() ? `akun dikunci ${k.kunciMenit} menit` : 'kata sandi salah')
    return { ok: false, pesan: akun.kunciSampai && akun.kunciSampai > Date.now() ? `Kata sandi salah ${k.maksGagal} kali. Akun dikunci ${k.kunciMenit} menit.` : GAGAL_UMUM }
  }
  if (!akun.aktif) {
    await logAudit(username, 'Login ditolak', false, 'akun nonaktif')
    return { ok: false, pesan: 'Akun ini dinonaktifkan. Hubungi Administrator.' }
  }
  const dek = await bukaDek(akun.dekWrap, kek)
  return lanjutkan(akun, dek, k, akun.username, password)
}

/** Tahap akhir login (setelah kunci data terbuka): verifikasi 2 langkah bila aktif, lalu catat dan buat sesi. */
async function lanjutkan(akun: Akun, dek: CryptoKey, k: Kebijakan, username: string, password?: string): Promise<HasilLogin> {
  const selesai = async (): Promise<HasilLogin> => {
    akun.gagal = 0
    akun.kunciSampai = undefined
    akun.loginTerakhir = now()
    // Tingkatkan hash lama ke parameter terbaru secara otomatis.
    if (password && (akun.kdf.alg !== 'argon2id' || (akun.kdf.m ?? 0) < 65536)) {
      const baru = await buatKredensial(password, dek)
      if (baru.kdf.alg === 'argon2id') Object.assign(akun, baru)
    }
    await putS('akun', akun)
    await logAudit(username, password ? 'Login berhasil' : 'Login berhasil (Google)', true)
    const peran = (await daftarPeran()).find((p) => p.id === akun.peranId) ?? PERAN_BAWAAN[4]
    return { ok: true, sesi: { akun, peran, dek } }
  }
  if (akun.totpEnc) {
    return {
      ok: 'totp',
      lanjut: async (kode) => {
        const secret = await dekripsiJson<string>(akun.totpEnc!, dek, `totp|${akun.id}`)
        const langkah = await cekTotp(secret, kode)
        if (langkah === null || (akun.totpLangkahTerakhir !== undefined && langkah <= akun.totpLangkahTerakhir)) {
          akun.gagal = (akun.gagal ?? 0) + 1
          if (akun.gagal >= k.maksGagal) { akun.kunciSampai = Date.now() + k.kunciMenit * 60000; akun.gagal = 0 }
          await putS('akun', akun)
          await logAudit(username, 'Verifikasi 2 langkah gagal', false)
          return { ok: false, pesan: 'Kode verifikasi salah atau sudah dipakai.' }
        }
        akun.totpLangkahTerakhir = langkah
        return selesai()
      },
    }
  }
  return selesai()
}

/** Masuk dengan akun Google yang sudah dihubungkan (dan diizinkan) di perangkat ini. `g` harus hasil verifikasi ID token. */
export async function masukGoogle(g: ProfilGoogle): Promise<HasilLogin> {
  const cfg = await configGoogle()
  const GAGAL = 'Akun Google ini belum dihubungkan untuk masuk di perangkat ini. Masuk dengan kata sandi, lalu hubungkan di Profil & Keamanan.'
  if (!cfg.aktif) return { ok: false, pesan: 'Masuk dengan Google belum diaktifkan Administrator.' }
  if (cfg.domain && g.domain !== cfg.domain && !g.email.endsWith(`@${cfg.domain}`)) return { ok: false, pesan: `Hanya akun Google berdomain ${cfg.domain} yang diizinkan.` }
  const k = await kebijakan()
  const akun = (await daftarAkun()).find((a) => a.google?.sub === g.sub && a.google.wrap)
  if (!akun || !akun.google?.wrap) { await logAudit(g.email, 'Login Google gagal', false, 'akun tidak terhubung'); return { ok: false, pesan: GAGAL } }
  if (akun.kunciSampai && akun.kunciSampai > Date.now()) return { ok: false, pesan: 'Akun terkunci sementara. Coba lagi nanti atau hubungi Administrator.' }
  if (!akun.aktif) { await logAudit(akun.username, 'Login Google ditolak', false, 'akun nonaktif'); return { ok: false, pesan: 'Akun ini dinonaktifkan. Hubungi Administrator.' } }
  if (akun.wajibGantiSandi || sandiKedaluwarsa(akun, k)) return { ok: false, pesan: 'Kata sandi akun ini perlu diganti. Masuk dengan kata sandi terlebih dahulu.' }
  const kunci = await ambilKunciPerangkat(akun.id)
  if (!kunci) return { ok: false, pesan: GAGAL }
  let dek: CryptoKey
  try { dek = await bukaDek(akun.google.wrap, kunci) } catch { await logAudit(akun.username, 'Login Google gagal', false, 'kunci perangkat tidak cocok'); return { ok: false, pesan: GAGAL } }
  return lanjutkan(akun, dek, k, akun.username)
}

/** Pulihkan akses Administrator dengan kode pemulihan, lalu tetapkan kata sandi baru. */
export async function pulihkan(usernameIn: string, kode: string, sandiBaru: string): Promise<HasilLogin> {
  const username = normUser(usernameIn)
  const akun = (await daftarAkun()).find((a) => a.username === username)
  const rec = await meta<Pemulihan>('pemulihan')
  if (!akun || !rec || akun.peranId !== 'admin') return { ok: false, pesan: 'Pemulihan hanya untuk akun Administrator.' }
  const { verifier, kek } = await turunkan(normalisasiKode(kode), rec.kdf)
  if (!samaAman(verifier, rec.verifier)) { await logAudit(username, 'Pemulihan gagal', false); return { ok: false, pesan: 'Kode pemulihan salah.' } }
  const err = cekSandi(sandiBaru, username, await kebijakan())
  if (err.length) return { ok: false, pesan: err.join(' ') }
  const dek = await bukaDek(rec.dekWrap, kek)
  Object.assign(akun, await buatKredensial(sandiBaru, dek), { gagal: 0, kunciSampai: undefined, wajibGantiSandi: false, sandiDiubah: now(), aktif: true })
  await putS('akun', akun)
  await logAudit(username, 'Pemulihan akun dengan kode pemulihan', true)
  return { ok: true, sesi: { akun, peran: PERAN_BAWAAN[0], dek } }
}

export async function gantiSandi(s: Sesi, lama: string, baru: string) {
  const { verifier } = await turunkan(lama, s.akun.kdf)
  if (!samaAman(verifier, s.akun.verifier)) throw new Error('Kata sandi lama salah.')
  const err = cekSandi(baru, s.akun.username, await kebijakan())
  if (err.length) throw new Error(err.join(' '))
  if (lama === baru) throw new Error('Kata sandi baru harus berbeda.')
  Object.assign(s.akun, await buatKredensial(baru, s.dek), { wajibGantiSandi: false, sandiDiubah: now() })
  await putS('akun', s.akun)
  await logAudit(s.akun.username, 'Ganti kata sandi', true)
}

export async function aktifkan2fa(s: Sesi, secret: string, kode: string) {
  const langkah = await cekTotp(secret, kode)
  if (langkah === null) throw new Error('Kode tidak cocok. Pastikan jam perangkat benar lalu coba lagi.')
  s.akun.totpEnc = await enkripsiJson(secret, s.dek, `totp|${s.akun.id}`)
  s.akun.totpLangkahTerakhir = langkah
  await putS('akun', s.akun)
  await logAudit(s.akun.username, 'Aktifkan verifikasi 2 langkah', true)
}
export async function nonaktifkan2fa(s: Sesi, sandi: string) {
  const { verifier } = await turunkan(sandi, s.akun.kdf)
  if (!samaAman(verifier, s.akun.verifier)) throw new Error('Kata sandi salah.')
  s.akun.totpEnc = undefined
  s.akun.totpLangkahTerakhir = undefined
  await putS('akun', s.akun)
  await logAudit(s.akun.username, 'Nonaktifkan verifikasi 2 langkah', true)
}

// ---------- Administrasi akun (butuh sesi Administrator) ----------
function wajibAdmin(s: Sesi) {
  if (s.akun.peranId !== 'admin') throw new Error('Hanya Administrator yang dapat mengelola akun.')
}

export async function buatAkun(s: Sesi, p: { username: string; nama: string; email?: string; peranId: string; pegawaiId?: string; sandiSementara: string } & PatchProfil) {
  wajibAdmin(s)
  await cekEmail(p.email)
  const username = normUser(p.username)
  if (!usernameValid(username)) throw new Error('Nama pengguna 3-32 karakter: huruf kecil, angka, titik, garis bawah, atau minus.')
  if ((await daftarAkun()).some((a) => a.username === username)) throw new Error(`Nama pengguna "${username}" sudah dipakai.`)
  const err = cekSandi(p.sandiSementara, username, await kebijakan())
  if (err.length) throw new Error(`Kata sandi sementara: ${err.join(' ')}`)
  const akun: Akun = {
    id: id(), username, nama: p.nama.trim() || username, email: p.email?.trim().toLowerCase() || undefined, peranId: p.peranId, pegawaiId: p.pegawaiId, aktif: true,
    jabatan: p.jabatan, nip: p.nip, telepon: p.telepon, alamat: p.alamat, tempatLahir: p.tempatLahir, tanggalLahir: p.tanggalLahir, jk: p.jk, keterangan: p.keterangan, foto: p.foto,
    ...(await buatKredensial(p.sandiSementara, s.dek)), wajibGantiSandi: true, gagal: 0, dibuat: now(), sandiDiubah: now(),
  }
  await putS('akun', akun)
  await logAudit(s.akun.username, 'Buat akun', true, `${username} (${p.peranId})`)
  return akun
}

export async function ubahAkun(s: Sesi, a: Akun, patch: Partial<Pick<Akun, 'peranId' | 'pegawaiId' | 'aktif' | 'username'>> & PatchProfil) {
  wajibAdmin(s)
  if (patch.username !== undefined) {
    const u = normUser(patch.username)
    if (!usernameValid(u)) throw new Error('Nama pengguna 3-32 karakter: huruf kecil, angka, titik, garis bawah, atau minus.')
    if ((await daftarAkun()).some((x) => x.id !== a.id && x.username === u)) throw new Error('Nama pengguna sudah dipakai.')
    patch = { ...patch, username: u }
  }
  if ('email' in patch) { patch = { ...patch, email: patch.email?.trim().toLowerCase() || undefined }; await cekEmail(patch.email, a.id) }
  const semua = await daftarAkun()
  const next = { ...a, ...patch }
  const adminAktif = semua.filter((x) => (x.id === a.id ? next : x)).filter((x) => x.peranId === 'admin' && x.aktif)
  if (!adminAktif.length) throw new Error('Harus tersisa minimal satu Administrator aktif.')
  await putS('akun', next)
  if (a.id === s.akun.id) Object.assign(s.akun, next)
  await logAudit(s.akun.username, 'Ubah akun', true, `${a.username}: ${Object.keys(patch).join(', ')}`)
}

async function cekEmail(email: string | undefined, kecuali?: string) {
  const e = email?.trim().toLowerCase()
  if (!e) return
  if (!emailValid(e)) throw new Error('Format email tidak valid.')
  if ((await daftarAkun()).some((a) => a.id !== kecuali && a.email?.toLowerCase() === e)) throw new Error('Email ini sudah dipakai akun lain.')
}

/** Pengguna mengubah data profilnya sendiri (tidak termasuk jenis akun atau status). */
export async function ubahProfil(s: Sesi, patch: PatchProfil) {
  const bersih: PatchProfil = {}
  for (const k of KOLOM_PROFIL) if (k in patch) (bersih as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k]
  if ('nama' in bersih && !bersih.nama?.trim()) throw new Error('Nama tidak boleh kosong.')
  if ('email' in bersih) { bersih.email = bersih.email?.trim().toLowerCase() || undefined; await cekEmail(bersih.email, s.akun.id) }
  if (bersih.foto && bersih.foto.length > 600_000) throw new Error('Foto terlalu besar.')
  Object.assign(s.akun, bersih)
  await putS('akun', s.akun)
  await logAudit(s.akun.username, 'Ubah profil', true, Object.keys(bersih).join(', '))
}

// ---------- Akun Google ----------
export async function hubungkanGoogle(s: Sesi, g: ProfilGoogle, opsi: { izinMasuk: boolean; impor: boolean }) {
  const cfg = await configGoogle()
  if (!cfg.aktif) throw new Error('Administrator belum mengaktifkan integrasi Google.')
  if (cfg.domain && g.domain !== cfg.domain && !g.email.endsWith(`@${cfg.domain}`)) throw new Error(`Hanya akun Google berdomain ${cfg.domain} yang diizinkan.`)
  const lain = (await daftarAkun()).find((a) => a.id !== s.akun.id && a.google?.sub === g.sub)
  if (lain) throw new Error('Akun Google ini sudah dihubungkan ke pengguna lain.')
  let wrap = s.akun.google?.wrap
  if (opsi.izinMasuk) wrap = await bungkusDek(s.dek, await buatKunciPerangkat(s.akun.id))
  else if (!opsi.izinMasuk && s.akun.google?.wrap) { await hapusKunciPerangkat(s.akun.id); wrap = undefined }
  s.akun.google = { sub: g.sub, email: g.email, nama: g.nama, dihubungkan: s.akun.google?.dihubungkan ?? now(), wrap }
  if (opsi.impor) await impor(s, g)
  else await putS('akun', s.akun)
  await logAudit(s.akun.username, 'Hubungkan akun Google', true, `${g.email}${wrap ? ' (masuk dengan Google diizinkan di perangkat ini)' : ''}`)
}
async function impor(s: Sesi, g: ProfilGoogle) {
  const patch: PatchProfil = {}
  if (g.nama) patch.nama = g.nama
  if (g.email) { try { await cekEmail(g.email, s.akun.id); patch.email = g.email } catch { /* email dipakai akun lain: lewati */ } }
  if (g.foto) patch.foto = await fotoGoogle(g.foto)
  Object.assign(s.akun, patch)
  await putS('akun', s.akun)
}
/** Salin foto profil Google menjadi gambar kecil lokal (agar tampil tanpa internet). Gagal = pakai tautan asli. */
async function fotoGoogle(url: string): Promise<string> {
  try {
    const res = await fetch(url.replace(/=s\d+(-c)?$/, '=s192-c'))
    const blob = await res.blob()
    if (blob.size > 400_000) return url
    return await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(blob) })
  } catch { return url }
}
/** Perbarui nama, email, dan foto dari akun Google yang sama. */
export async function sinkronProfilGoogle(s: Sesi, g: ProfilGoogle) {
  if (s.akun.google?.sub !== g.sub) throw new Error('Akun Google ini berbeda dengan yang terhubung.')
  await impor(s, g)
  s.akun.google = { ...s.akun.google, email: g.email, nama: g.nama }
  await putS('akun', s.akun)
  await logAudit(s.akun.username, 'Sinkron profil dari Google', true)
}
export async function putusGoogle(s: Sesi, a: Akun = s.akun) {
  if (a.id !== s.akun.id) wajibAdmin(s)
  await hapusKunciPerangkat(a.id).catch(() => undefined)
  a.google = undefined
  await putS('akun', a)
  await logAudit(s.akun.username, 'Putuskan akun Google', true, a.username)
}

export async function resetAkun(s: Sesi, a: Akun, sandiSementara: string, reset2fa: boolean) {
  wajibAdmin(s)
  const err = cekSandi(sandiSementara, a.username, await kebijakan())
  if (err.length) throw new Error(err.join(' '))
  const next: Akun = { ...a, ...(await buatKredensial(sandiSementara, s.dek)), wajibGantiSandi: true, gagal: 0, kunciSampai: undefined, sandiDiubah: now() }
  if (next.google?.wrap) { next.google = { ...next.google, wrap: undefined }; await hapusKunciPerangkat(a.id).catch(() => undefined) }
  if (reset2fa) { next.totpEnc = undefined; next.totpLangkahTerakhir = undefined }
  await putS('akun', next)
  await logAudit(s.akun.username, 'Reset kata sandi akun', true, `${a.username}${reset2fa ? ' + reset 2FA' : ''}`)
}

export async function hapusAkun(s: Sesi, a: Akun) {
  wajibAdmin(s)
  if (a.id === s.akun.id) throw new Error('Tidak dapat menghapus akun sendiri.')
  const adminLain = (await daftarAkun()).filter((x) => x.id !== a.id && x.peranId === 'admin' && x.aktif)
  if (a.peranId === 'admin' && !adminLain.length) throw new Error('Harus tersisa minimal satu Administrator aktif.')
  await delS('akun', a.id)
  await logAudit(s.akun.username, 'Hapus akun', true, a.username)
}

export async function buatKodePemulihanBaru(s: Sesi) {
  wajibAdmin(s)
  const kode = kodePemulihanBaru()
  await setMeta('pemulihan', await buatKredensial(normalisasiKode(kode), s.dek))
  await logAudit(s.akun.username, 'Buat ulang kode pemulihan', true)
  return kode
}

export function sandiKedaluwarsa(a: Akun, k: Kebijakan) {
  return k.masaBerlakuHari > 0 && Date.now() - new Date(a.sandiDiubah).getTime() > k.masaBerlakuHari * 86400000
}

export { randomBytes }
