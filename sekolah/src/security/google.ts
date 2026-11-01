// Masuk dengan Google (Google Identity Services). ID token diverifikasi di perangkat: tanda tangan RS256 terhadap kunci
// publik Google, penerbit, audiens (Client ID), masa berlaku, nonce, dan email terverifikasi.
import { unb64 } from './crypto'

export interface ProfilGoogle { sub: string; email: string; nama?: string; foto?: string; domain?: string }
export interface OpsiVerifikasi {
  clientId: string; nonce: string; sekarang?: number
  /** Ambil kunci publik Google (JWK) menurut `kid`. Dapat diganti untuk pengujian. */
  ambilKunci?: (kid: string) => Promise<JsonWebKey>
}

const bacaB64Url = (s: string) => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
const teks = (u: Uint8Array) => new TextDecoder().decode(u)

let cacheKunci: { t: number; keys: (JsonWebKey & { kid?: string })[] } | null = null
async function kunciGoogle(kid: string): Promise<JsonWebKey> {
  if (!cacheKunci || Date.now() - cacheKunci.t > 3600_000 || !cacheKunci.keys.some((k) => k.kid === kid)) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs')
    if (!res.ok) throw new Error('Tidak dapat mengambil kunci verifikasi Google. Periksa koneksi internet.')
    cacheKunci = { t: Date.now(), keys: ((await res.json()) as { keys: (JsonWebKey & { kid?: string })[] }).keys }
  }
  const k = cacheKunci.keys.find((x) => x.kid === kid)
  if (!k) throw new Error('Kunci tanda tangan Google tidak dikenal.')
  return k
}

export async function verifikasiIdToken(credential: string, o: OpsiVerifikasi): Promise<ProfilGoogle> {
  const bagian = credential.split('.')
  if (bagian.length !== 3) throw new Error('Token Google tidak valid.')
  let head: { alg?: string; kid?: string }, p: Record<string, unknown>
  try { head = JSON.parse(teks(bacaB64Url(bagian[0]))); p = JSON.parse(teks(bacaB64Url(bagian[1]))) } catch { throw new Error('Token Google tidak valid.') }
  if (head.alg !== 'RS256' || !head.kid) throw new Error('Algoritma token Google tidak didukung.')
  const jwk = await (o.ambilKunci ?? kunciGoogle)(head.kid)
  const kunci = await globalThis.crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const sah = await globalThis.crypto.subtle.verify('RSASSA-PKCS1-v1_5', kunci, bacaB64Url(bagian[2]), new TextEncoder().encode(`${bagian[0]}.${bagian[1]}`))
  if (!sah) throw new Error('Tanda tangan token Google tidak sah.')
  const now = Math.floor((o.sekarang ?? Date.now()) / 1000)
  if (p.iss !== 'https://accounts.google.com' && p.iss !== 'accounts.google.com') throw new Error('Penerbit token bukan Google.')
  if (p.aud !== o.clientId) throw new Error('Token ini bukan untuk aplikasi ini (Client ID berbeda).')
  if (typeof p.exp !== 'number' || p.exp + 60 < now) throw new Error('Token Google sudah kedaluwarsa. Coba lagi.')
  if (typeof p.iat === 'number' && p.iat - 300 > now) throw new Error('Jam perangkat tidak sesuai. Perbaiki tanggal dan jam lalu coba lagi.')
  if (p.nonce !== o.nonce) throw new Error('Token tidak cocok dengan permintaan (nonce). Coba lagi.')
  if (typeof p.sub !== 'string' || !p.sub) throw new Error('Token Google tidak memuat identitas.')
  if (p.email_verified !== true && p.email_verified !== 'true') throw new Error('Email akun Google ini belum terverifikasi.')
  if (typeof p.email !== 'string') throw new Error('Token Google tidak memuat email.')
  return { sub: p.sub, email: p.email.toLowerCase(), nama: typeof p.name === 'string' ? p.name : undefined, foto: typeof p.picture === 'string' ? p.picture : undefined, domain: typeof p.hd === 'string' ? p.hd : undefined }
}

// ---------- Google Identity Services (tombol resmi Google) ----------
type GId = { initialize: (c: { client_id: string; callback: (r: { credential?: string }) => void; nonce?: string; auto_select?: boolean; ux_mode?: string }) => void; renderButton: (el: HTMLElement, o: Record<string, unknown>) => void; cancel?: () => void }
const gid = () => (globalThis as unknown as { google?: { accounts?: { id?: GId } } }).google?.accounts?.id

export function muatGis(): Promise<GId> {
  const g = gid()
  if (g) return Promise.resolve(g)
  return new Promise((ok, no) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true
    s.onload = () => { const x = gid(); x ? ok(x) : no(new Error('Pustaka Google gagal dimuat.')) }
    s.onerror = () => no(new Error('Tidak dapat memuat layanan masuk Google. Periksa koneksi internet.'))
    document.head.appendChild(s)
  })
}
export const nonceBaru = () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')

export async function pasangTombolGoogle(el: HTMLElement, clientId: string, nonce: string, onCredential: (c: string) => void, teksTombol: 'signin_with' | 'continue_with' | 'signup_with' = 'continue_with') {
  const g = await muatGis()
  g.initialize({ client_id: clientId, nonce, auto_select: false, callback: (r) => { if (r.credential) onCredential(r.credential) } })
  el.innerHTML = ''
  g.renderButton(el, { theme: 'outline', size: 'large', text: teksTombol, shape: 'pill', locale: 'id', width: 280, logo_alignment: 'left' })
}
