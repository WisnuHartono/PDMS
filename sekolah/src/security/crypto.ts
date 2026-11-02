// Primitif kriptografi SIMAS.
// - Kata sandi: Argon2id (pemenang Password Hashing Competition, rekomendasi OWASP 2024+),
//   parameter m=64 MiB, t=3, p=1. Cadangan otomatis PBKDF2-SHA-256 600.000 iterasi bila WASM tidak tersedia.
// - Data: AES-256-GCM (WebCrypto) dengan kunci data (DEK) acak 256-bit; DEK dibungkus (wrap) per akun
//   memakai kunci turunan kata sandi (KEK). Tanpa kata sandi / kode pemulihan, data tidak dapat dibaca.
// - Verifikasi 2 langkah: TOTP RFC 6238 (HMAC-SHA-1, 6 digit, 30 detik) — kompatibel Google/Microsoft Authenticator.
import { argon2id } from 'hash-wasm'

const subtle = () => {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('Fitur kriptografi browser tidak tersedia. Buka aplikasi melalui HTTPS atau aplikasi Windows.')
  return s
}

export const randomBytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n))

export function b64(u: Uint8Array | ArrayBuffer): string {
  const a = u instanceof Uint8Array ? u : new Uint8Array(u)
  let s = ''
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000))
  return btoa(s)
}
export function unb64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const enc = new TextEncoder()
const dec = new TextDecoder()

export interface KdfParams {
  alg: 'argon2id' | 'pbkdf2-sha256'
  salt: string // base64
  m?: number // KiB (argon2)
  t?: number // iterasi
  p?: number
}

export const ARGON2_DEFAULT = { m: 65536, t: 3, p: 1 }
export const PBKDF2_ITER = 600_000

/** Pilih KDF terkuat yang tersedia di lingkungan ini. */
export async function kdfBaru(): Promise<KdfParams> {
  const salt = b64(randomBytes(16))
  try {
    await argon2id({ password: 'uji', salt: randomBytes(16), parallelism: 1, iterations: 1, memorySize: 64, hashLength: 32, outputType: 'binary' })
    return { alg: 'argon2id', salt, ...ARGON2_DEFAULT }
  } catch {
    return { alg: 'pbkdf2-sha256', salt, t: PBKDF2_ITER }
  }
}

/** Turunkan 64 byte dari kata sandi: 32 byte pertama = verifier, 32 byte berikutnya = kunci pembungkus (KEK). */
export async function turunkan(password: string, k: KdfParams): Promise<{ verifier: string; kek: CryptoKey }> {
  const salt = unb64(k.salt)
  let raw: Uint8Array
  if (k.alg === 'argon2id') {
    raw = await argon2id({ password: password.normalize('NFKC'), salt, parallelism: k.p ?? 1, iterations: k.t ?? 3, memorySize: k.m ?? 65536, hashLength: 64, outputType: 'binary' })
  } else {
    const base = await subtle().importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits'])
    raw = new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: k.t ?? PBKDF2_ITER }, base, 512))
  }
  const verifier = b64(new Uint8Array(await subtle().digest('SHA-256', raw.slice(0, 32))))
  const kek = await subtle().importKey('raw', raw.slice(32, 64), 'AES-GCM', false, ['encrypt', 'decrypt'])
  raw.fill(0)
  return { verifier, kek }
}

/** Perbandingan waktu-konstan untuk string verifier. */
export function samaAman(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function dekBaru(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export interface Bungkus { iv: string; ct: string }

export async function bungkusDek(dek: CryptoKey, kek: CryptoKey): Promise<Bungkus> {
  const raw = new Uint8Array(await subtle().exportKey('raw', dek))
  const iv = randomBytes(12)
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode('simas-dek') }, kek, raw)
  raw.fill(0)
  return { iv: b64(iv), ct: b64(ct) }
}

export async function bukaDek(w: Bungkus, kek: CryptoKey): Promise<CryptoKey> {
  const raw = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(w.iv), additionalData: enc.encode('simas-dek') }, kek, unb64(w.ct)))
  const key = await subtle().importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
  raw.fill(0)
  return key
}

/** Enkripsi objek JSON. `aad` mengikat sandi ke konteksnya (mis. koleksi|id) sehingga tidak bisa ditukar. */
export async function enkripsiJson(obj: unknown, key: CryptoKey, aad: string): Promise<Bungkus> {
  const iv = randomBytes(12)
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(obj)))
  return { iv: b64(iv), ct: b64(ct) }
}

export async function dekripsiJson<T>(w: Bungkus, key: CryptoKey, aad: string): Promise<T> {
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(w.iv), additionalData: enc.encode(aad) }, key, unb64(w.ct))
  return JSON.parse(dec.decode(pt)) as T
}

// ---------- Kode pemulihan ----------
const ALFABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // tanpa 0/O/1/I/L agar tidak tertukar
export function kodePemulihanBaru(): string {
  const b = randomBytes(25)
  let s = ''
  for (const x of b) s += ALFABET[x % ALFABET.length]
  return s.match(/.{1,5}/g)!.join('-') // 25 karakter ≈ 124 bit
}
export const normalisasiKode = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]/g, '')

// ---------- TOTP (RFC 6238) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function base32(u: Uint8Array): string {
  let bits = 0, val = 0, out = ''
  for (const x of u) {
    val = (val << 8) | x
    bits += 8
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31]
  return out
}
export function unbase32(s: string): Uint8Array {
  const c = s.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0, val = 0
  const out: number[] = []
  for (const ch of c) {
    val = (val << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8 }
  }
  return new Uint8Array(out)
}
export const totpSecretBaru = () => base32(randomBytes(20))

export async function totp(secret: string, waktu = Date.now(), langkah = 30, digit = 6): Promise<string> {
  const counter = Math.floor(waktu / 1000 / langkah)
  const msg = new Uint8Array(8)
  new DataView(msg.buffer).setUint32(4, counter >>> 0)
  new DataView(msg.buffer).setUint32(0, Math.floor(counter / 2 ** 32))
  const key = await subtle().importKey('raw', unbase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const h = new Uint8Array(await subtle().sign('HMAC', key, msg))
  const o = h[h.length - 1] & 15
  const bin = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(bin % 10 ** digit).padStart(digit, '0')
}

/** Cocokkan kode dengan toleransi ±1 langkah (jam perangkat sedikit bergeser). Mengembalikan langkah yang cocok. */
export async function cekTotp(secret: string, kode: string, waktu = Date.now()): Promise<number | null> {
  const k = kode.replace(/\s/g, '')
  if (!/^\d{6}$/.test(k)) return null
  for (const d of [0, -1, 1]) {
    const t = waktu + d * 30_000
    if (samaAman(await totp(secret, t), k)) return Math.floor(t / 30_000)
  }
  return null
}

export function otpauthUri(secret: string, akun: string, penerbit = 'SIMAS Sekolah') {
  return `otpauth://totp/${encodeURIComponent(`${penerbit}:${akun}`)}?secret=${secret}&issuer=${encodeURIComponent(penerbit)}&algorithm=SHA1&digits=6&period=30`
}
