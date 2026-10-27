// Kriptografi pengguna: hash kata sandi (PBKDF2-HMAC-SHA256, 600.000 iterasi sesuai rekomendasi OWASP),
// kebijakan sandi, dan TOTP (RFC 6238) untuk verifikasi 2 langkah. Semua memakai WebCrypto bawaan browser.
import { pbkdf2Sha256, hmacSha1 } from './purecrypto'

const enc = new TextEncoder()
export const PBKDF2_ITER = 600_000

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  a.forEach((c) => (s += String.fromCharCode(c)))
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export interface PwRecord {
  hash: string
  salt: string
  iter: number
}

const hasSubtle = () => !!globalThis.crypto?.subtle

async function derive(pw: string, salt: Uint8Array, iter: number): Promise<ArrayBuffer> {
  const bytes = enc.encode(pw.normalize('NFKC'))
  if (hasSubtle()) {
    const key = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits'])
    return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, key, 256)
  }
  // Konteks tidak aman (tanpa HTTPS): pakai implementasi murni-JS dengan hasil identik
  return (await pbkdf2Sha256(bytes, salt, iter)).buffer as ArrayBuffer
}

export async function hashPassword(pw: string): Promise<PwRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { hash: b64(await derive(pw, salt, PBKDF2_ITER)), salt: b64(salt), iter: PBKDF2_ITER }
}

export async function verifyPassword(pw: string, rec: PwRecord): Promise<boolean> {
  const a = new Uint8Array(await derive(pw, unb64(rec.salt), rec.iter))
  const b = unb64(rec.hash)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i] // perbandingan waktu-konstan
  return diff === 0
}

const COMMON = ['password', 'passw0rd', 'qwerty', '123456', '12345678', 'admin', 'letmein', 'welcome', 'iloveyou', 'abc123', 'docontrol', 'proyek', 'indonesia', 'rahasia']

export interface PwContext {
  username?: string
  email?: string
  name?: string
}

export function passwordIssues(pw: string, ctx: PwContext = {}, minLen = 12): string[] {
  const out: string[] = []
  if (pw.length < minLen) out.push(`Minimal ${minLen} karakter`)
  if (!/[a-z]/.test(pw)) out.push('Harus ada huruf kecil')
  if (!/[A-Z]/.test(pw)) out.push('Harus ada huruf besar')
  if (!/\d/.test(pw)) out.push('Harus ada angka')
  if (!/[^A-Za-z0-9]/.test(pw)) out.push('Harus ada simbol (mis. ! @ # $ %)')
  const low = pw.toLowerCase()
  if (/(.)\1{3,}/.test(pw)) out.push('Jangan ulangi satu karakter 4 kali berturut-turut')
  if (COMMON.some((c) => low.includes(c))) out.push('Mengandung kata umum yang mudah ditebak')
  const parts = [ctx.username, ctx.email?.split('@')[0], ...(ctx.name?.split(/\s+/) || [])].filter((x): x is string => !!x && x.length >= 3)
  if (parts.some((p) => low.includes(p.toLowerCase()))) out.push('Jangan memuat nama / username / email Anda')
  return out
}

/** Skor 0-4 berdasarkan perkiraan entropi. */
export function strength(pw: string): { score: number; label: string; color: string } {
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/\d/.test(pw)) pool += 10
  if (/[^A-Za-z0-9]/.test(pw)) pool += 32
  const bits = pw.length * Math.log2(Math.max(pool, 1)) - (/(.)\1{2,}/.test(pw) ? 10 : 0)
  const score = !pw ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4
  return { score, label: ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'][score], color: ['#e2e8f0', '#dc2626', '#d97706', '#16a34a', '#047857'][score] }
}

export function generatePassword(len = 16): string {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*-_=+?']
  const all = sets.join('')
  const rnd = (n: number) => {
    const m = 256 - (256 % n)
    for (;;) {
      const x = crypto.getRandomValues(new Uint8Array(1))[0]
      if (x < m) return x % n
    }
  }
  const chars = sets.map((s) => s[rnd(s.length)])
  while (chars.length < len) chars.push(all[rnd(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

// ---------- TOTP ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function newTotpSecret(): string {
  const b = crypto.getRandomValues(new Uint8Array(20))
  let bits = ''
  b.forEach((x) => (bits += x.toString(2).padStart(8, '0')))
  let out = ''
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]
  return out
}
function b32decode(s: string) {
  let bits = ''
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0')
  const out = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  return out
}
async function hotp(secret: string, counter: number) {
  const msg = new ArrayBuffer(8)
  const dv = new DataView(msg)
  dv.setUint32(0, Math.floor(counter / 2 ** 32))
  dv.setUint32(4, counter >>> 0)
  const k = b32decode(secret)
  let h: Uint8Array
  if (hasSubtle()) {
    const key = await crypto.subtle.importKey('raw', k as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
    h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
  } else {
    h = hmacSha1(k, new Uint8Array(msg))
  }
  const o = h[19] & 15
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1_000_000).padStart(6, '0')
}
export async function verifyTotp(secret: string, code: string, now = Date.now()) {
  const c = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return false
  const step = Math.floor(now / 30000)
  for (const d of [-1, 0, 1]) if ((await hotp(secret, step + d)) === c) return true
  return false
}
export const totpUri = (secret: string, account: string) =>
  `otpauth://totp/DocControl:${encodeURIComponent(account)}?secret=${secret}&issuer=DocControl&digits=6&period=30`
