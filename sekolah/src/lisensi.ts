// Lisensi SIMAS: serial bertanda tangan digital (ECDSA P-256) yang diperiksa tanpa internet.
// Aplikasi hanya menyimpan KUNCI PUBLIK; kunci privat hanya ada pada aplikasi Generator Serial.
// Tanpa lisensi, aplikasi berjalan dalam masa percobaan 7 hari sejak pertama dipakai.

export const KUNCI_PUBLIK_HEX = '04db7fcbd1c1f5504b2daa88e172e92493e3f68e9e6792ad306fa3ba713afa073bc21bf577eca5f5972e71779764f84cdb8c418430ecabd6a0640702c682fb4256'
export const HARI_TRIAL = 7
const HARI_MS = 86_400_000
const EPOCH_HARI = Date.UTC(2024, 0, 1) / HARI_MS
const ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const GARAM = 'simas-lic-v1'

export interface IsiLisensi { nama: string; terbit: number; kedaluwarsa: number | null; bind: Uint8Array | null; noSeri: string }
export type StatusLisensi =
  | { mode: 'lisensi'; kodeInstalasi: string; pemegang: string; noSeri: string; kedaluwarsa: number | null; sisaHari: number | null }
  | { mode: 'trial'; kodeInstalasi: string; sisaHari: number; sisaMs: number }
  | { mode: 'habis'; kodeInstalasi: string; alasan: 'trial' | 'jam' | 'lisensi-berakhir' | 'rusak'; pesan: string; pemegang?: string }

// ---- pengkodean ----
export function base32(b: Uint8Array): string {
  let bits = 0, val = 0, out = ''
  for (const x of b) { val = (val << 8) | x; bits += 8; while (bits >= 5) { out += ALFABET[(val >>> (bits - 5)) & 31]; bits -= 5 } }
  if (bits > 0) out += ALFABET[(val << (5 - bits)) & 31]
  return out
}
export function dariBase32(s: string): Uint8Array {
  let bits = 0, val = 0
  const out: number[] = []
  for (const ch of s) {
    const i = ALFABET.indexOf(ch)
    if (i < 0) throw new Error('Serial memuat karakter yang tidak valid.')
    val = (val << 5) | i; bits += 5
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Uint8Array.from(out)
}
const kelompok = (s: string, n: number) => s.match(new RegExp(`.{1,${n}}`, 'g'))?.join('-') ?? s
export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
export const dariHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16))
const sha = async (t: string | Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof t === 'string' ? new TextEncoder().encode(t) : (t as BufferSource)))

export const formatSerial = (raw: Uint8Array) => `SIMAS-${kelompok(base32(raw), 5)}`
export const normalSerial = (s: string) => s.toUpperCase().replace(/^\s*SIMAS/, '').replace(/[^A-Z0-9]/g, '')

/** Nomor seri pendek (untuk catatan/pencarian): turunan hash isi serial. */
export async function nomorSeri(raw: Uint8Array) { const h = await sha(raw); return kelompok(base32(h.subarray(0, 5)), 4) }
export async function ikatanInstalasi(kode: string) { return (await sha(kode.toUpperCase().replace(/[^A-Z0-9]/g, ''))).subarray(0, 4) }

export function kodeInstalasiBaru() { const b = new Uint8Array(10); crypto.getRandomValues(b); return kelompok(base32(b), 4) }

// ---- verifikasi ----
export function hariKe(ms: number) { return Math.floor(ms / HARI_MS) - EPOCH_HARI }
export function bacaPayload(raw: Uint8Array) {
  if (raw.length < 11 + 64 || raw[0] !== 1) throw new Error('Format serial tidak dikenal.')
  const n = raw[10]
  if (raw.length !== 11 + n + 64) throw new Error('Serial tidak lengkap atau rusak.')
  const nama = new TextDecoder().decode(raw.subarray(11, 11 + n))
  const terbit = (raw[2] << 8) | raw[3], exp = (raw[4] << 8) | raw[5]
  const terikat = (raw[1] & 1) === 1
  return { nama, terbit, exp, bind: terikat ? raw.slice(6, 10) : null, payload: raw.subarray(0, 11 + n), sig: raw.subarray(11 + n) }
}

export async function periksaSerial(teks: string, kodeInstalasi: string, sekarang = Date.now(), pub = KUNCI_PUBLIK_HEX): Promise<IsiLisensi & { berakhir: boolean }> {
  const norm = normalSerial(teks)
  if (norm.length < 100) throw new Error('Serial terlalu pendek. Salin seluruh serial.')
  const raw = dariBase32(norm)
  const p = bacaPayload(raw)
  const key = await crypto.subtle.importKey('raw', dariHex(pub) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, p.sig as BufferSource, p.payload as BufferSource)
  if (!ok) throw new Error('Serial tidak valid (tanda tangan tidak cocok).')
  if (p.bind) {
    const ini = await ikatanInstalasi(kodeInstalasi)
    if (hex(ini) !== hex(p.bind)) throw new Error('Serial ini dibuat untuk komputer/instalasi lain. Minta serial baru dengan Kode Instalasi Anda.')
  }
  const kedaluwarsa = p.exp ? (p.exp + EPOCH_HARI + 1) * HARI_MS : null // berlaku sampai akhir hari kedaluwarsa (UTC)
  return { nama: p.nama, terbit: (p.terbit + EPOCH_HARI) * HARI_MS, kedaluwarsa, bind: p.bind, noSeri: await nomorSeri(raw), berakhir: kedaluwarsa !== null && sekarang >= kedaluwarsa }
}

// ---- penyimpanan masa percobaan ----
interface Rekam { id: string; mulai: number; terakhir: number; kunci?: string; tt: string }
const tandai = async (r: Omit<Rekam, 'tt'>) => hex(await sha(`${GARAM}|${r.id}|${r.mulai}|${r.terakhir}|${r.kunci ?? ''}`))
const KUNCI_LS = 'simas.lic'

interface Desktop { lisensiBaca?: () => Promise<string[]>; lisensiTulis?: (s: string) => Promise<boolean> }
const desktop = () => (globalThis as unknown as { simas?: Desktop }).simas

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const q = indexedDB.open('simas-lic', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
}
async function bacaSemua(): Promise<string[]> {
  const out: string[] = []
  try { const v = localStorage.getItem(KUNCI_LS); if (v) out.push(v) } catch { /* diblokir */ }
  try { const db = await idb(); const v = await new Promise<string | undefined>((res) => { const r = db.transaction('kv').objectStore('kv').get('rec'); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined) }); if (v) out.push(v) } catch { /* tidak ada */ }
  try { const d = desktop(); if (d?.lisensiBaca) out.push(...(await d.lisensiBaca())) } catch { /* tidak ada */ }
  return out
}
async function tulisSemua(r: Rekam) {
  const s = JSON.stringify(r)
  try { localStorage.setItem(KUNCI_LS, s) } catch { /* diblokir */ }
  try { const db = await idb(); await new Promise<void>((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(s, 'rec'); t.oncomplete = () => res(); t.onerror = () => res() }) } catch { /* tidak ada */ }
  try { await desktop()?.lisensiTulis?.(s) } catch { /* tidak ada */ }
}

/** Baca semua salinan, ambil yang paling awal dimulai (menghapus satu salinan tidak mengulang trial). */
export async function muatRekam(sekarang = Date.now()): Promise<{ rekam: Rekam; rusak: boolean }> {
  const valid: Rekam[] = []
  let rusak = false
  for (const s of await bacaSemua()) {
    try { const r = JSON.parse(s) as Rekam; if (r && r.tt === (await tandai(r))) valid.push(r); else rusak = true } catch { rusak = true }
  }
  if (!valid.length) {
    const baru = { id: kodeInstalasiBaru(), mulai: sekarang, terakhir: sekarang } as Omit<Rekam, 'tt'>
    // ada salinan tetapi semuanya rusak: dianggap diutak-atik, trial dinyatakan habis
    if (rusak) baru.mulai = sekarang - (HARI_TRIAL + 1) * HARI_MS
    return { rekam: { ...baru, tt: await tandai(baru) }, rusak }
  }
  valid.sort((a, b) => a.mulai - b.mulai)
  const dasar = valid[0]
  const terakhir = Math.max(...valid.map((v) => v.terakhir))
  const kunci = valid.find((v) => v.kunci)?.kunci
  const r = { id: dasar.id, mulai: dasar.mulai, terakhir, kunci } as Omit<Rekam, 'tt'>
  return { rekam: { ...r, tt: await tandai(r) }, rusak }
}

export async function hitungStatus(sekarang = Date.now(), tulis = true): Promise<StatusLisensi> {
  const { rekam: r0, rusak } = await muatRekam(sekarang)
  let r = r0
  const mundur = sekarang < r.terakhir - 10 * 60_000
  const terakhir = Math.max(r.terakhir, sekarang)
  if (terakhir !== r.terakhir) { const b = { id: r.id, mulai: r.mulai, terakhir, kunci: r.kunci }; r = { ...b, tt: await tandai(b) } }
  if (tulis) await tulisSemua(r)
  const acuan = mundur ? r.terakhir : sekarang
  if (r.kunci) {
    try {
      const l = await periksaSerial(r.kunci, r.id, acuan)
      if (!l.berakhir && !mundur) return { mode: 'lisensi', kodeInstalasi: r.id, pemegang: l.nama, noSeri: l.noSeri, kedaluwarsa: l.kedaluwarsa, sisaHari: l.kedaluwarsa ? Math.ceil((l.kedaluwarsa - acuan) / HARI_MS) : null }
      if (l.berakhir) return { mode: 'habis', kodeInstalasi: r.id, alasan: 'lisensi-berakhir', pemegang: l.nama, pesan: `Lisensi atas nama ${l.nama} telah berakhir. Masukkan serial yang baru.` }
    } catch { /* serial tersimpan rusak: jatuh ke trial */ }
  }
  if (mundur) return { mode: 'habis', kodeInstalasi: r.id, alasan: 'jam', pesan: 'Jam komputer terdeteksi dimundurkan. Perbaiki tanggal/jam komputer atau masukkan serial lisensi.' }
  const sisaMs = r.mulai + HARI_TRIAL * HARI_MS - sekarang
  if (sisaMs <= 0) return { mode: 'habis', kodeInstalasi: r.id, alasan: rusak ? 'rusak' : 'trial', pesan: rusak ? 'Data masa percobaan rusak. Masukkan serial lisensi untuk melanjutkan.' : `Masa percobaan ${HARI_TRIAL} hari telah berakhir. Masukkan serial lisensi untuk melanjutkan.` }
  return { mode: 'trial', kodeInstalasi: r.id, sisaMs, sisaHari: Math.ceil(sisaMs / HARI_MS) }
}

/** Simpan serial setelah diverifikasi. Melempar galat berisi alasan bila ditolak. */
export async function aktifkanSerial(teks: string, sekarang = Date.now()): Promise<StatusLisensi> {
  const { rekam: r } = await muatRekam(sekarang)
  const l = await periksaSerial(teks, r.id, sekarang)
  if (l.berakhir) throw new Error('Serial ini sudah melewati masa berlakunya.')
  const b = { id: r.id, mulai: r.mulai, terakhir: Math.max(r.terakhir, sekarang), kunci: formatSerial(dariBase32(normalSerial(teks))) }
  await tulisSemua({ ...b, tt: await tandai(b) })
  return hitungStatus(sekarang)
}
