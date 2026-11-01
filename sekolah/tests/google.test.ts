import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { _setDbName, buatAkun, configGoogle, hubungkanGoogle, masuk, masukGoogle, pasangAwal, putusGoogle, resetAkun, simpanConfigGoogle, sinkronProfilGoogle, ubahProfil, type Sesi } from '../src/security/akun'
import { b64 } from '../src/security/crypto'
import { verifikasiIdToken } from '../src/security/google'

const te = new TextEncoder()
const u = (x: Uint8Array | ArrayBuffer) => b64(x).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const uj = (o: object) => u(te.encode(JSON.stringify(o)))
const CID = 'abc123.apps.googleusercontent.com'

async function buatToken(over: Record<string, unknown> = {}, kunci?: CryptoKeyPair) {
  const pair = kunci ?? (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']))
  const now = Math.floor(Date.now() / 1000)
  const head = uj({ alg: 'RS256', kid: 'k1', typ: 'JWT' })
  const body = uj({ iss: 'https://accounts.google.com', aud: CID, sub: 'g-123', email: 'Budi@Sekolah.sch.id', email_verified: true, name: 'Budi Santoso', picture: 'https://x/y=s96-c', nonce: 'N1', iat: now, exp: now + 3600, ...over })
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, te.encode(`${head}.${body}`))
  return { token: `${head}.${body}.${u(sig)}`, jwk: await crypto.subtle.exportKey('jwk', pair.publicKey), pair }
}
const opsi = (jwk: JsonWebKey, o = {}) => ({ clientId: CID, nonce: 'N1', ambilKunci: async () => jwk, ...o })

describe('verifikasi ID token Google', () => {
  it('menerima token sah dan menolak yang dimanipulasi', async () => {
    const { token, jwk, pair } = await buatToken()
    const g = await verifikasiIdToken(token, opsi(jwk))
    expect(g).toMatchObject({ sub: 'g-123', email: 'budi@sekolah.sch.id', nama: 'Budi Santoso' })
    await expect(verifikasiIdToken(token, opsi(jwk, { clientId: 'lain.apps.googleusercontent.com' }))).rejects.toThrow(/Client ID/)
    await expect(verifikasiIdToken(token, opsi(jwk, { nonce: 'X' }))).rejects.toThrow(/nonce/)
    await expect(verifikasiIdToken(token, opsi(jwk, { sekarang: Date.now() + 3 * 3600_000 }))).rejects.toThrow(/kedaluwarsa/)
    const [h, b, s] = token.split('.')
    const palsu = `${h}.${uj({ ...JSON.parse(atob(b.replace(/-/g, '+').replace(/_/g, '/') + '==')), sub: 'penyerang' })}.${s}`
    await expect(verifikasiIdToken(palsu, opsi(jwk))).rejects.toThrow(/tanda tangan/i)
    const lain = await buatToken({}, undefined)
    await expect(verifikasiIdToken(lain.token, opsi(jwk))).rejects.toThrow(/tanda tangan/i)
    await expect(verifikasiIdToken((await buatToken({ email_verified: false }, pair)).token, opsi(jwk))).rejects.toThrow(/terverifikasi/)
    await expect(verifikasiIdToken((await buatToken({ iss: 'https://evil.example' }, pair)).token, opsi(jwk))).rejects.toThrow(/penerbit/i)
    await expect(verifikasiIdToken('bukan.token', opsi(jwk))).rejects.toThrow()
  })
})

describe('akun: profil, email, dan masuk Google', () => {
  let admin: Sesi
  const G = { sub: 'g-123', email: 'budi@sekolah.sch.id', nama: 'Budi Santoso' }
  beforeAll(async () => {
    _setDbName('google-' + Math.random())
    admin = (await pasangAwal({ username: 'admin', nama: 'Admin', password: 'Kuat#Sekali2026' })).sesi
  })

  it('profil lengkap dapat diubah sendiri dan email unik', async () => {
    await ubahProfil(admin, { jabatan: 'Operator', telepon: '0812', email: 'Admin@Sekolah.sch.id', foto: 'data:image/png;base64,AA' })
    expect(admin.akun).toMatchObject({ jabatan: 'Operator', telepon: '0812', email: 'admin@sekolah.sch.id' })
    await expect(buatAkun(admin, { username: 'budi', nama: 'Budi', email: 'ADMIN@sekolah.sch.id', peranId: 'guru', sandiSementara: 'Sementara#2026x' })).rejects.toThrow(/sudah dipakai/)
    await expect(ubahProfil(admin, { email: 'salah' })).rejects.toThrow(/tidak valid/)
    await expect(ubahProfil(admin, { nama: ' ' })).rejects.toThrow()
  })

  it('masuk dengan email atau nama pengguna', async () => {
    expect((await masuk('admin@sekolah.sch.id', 'Kuat#Sekali2026')).ok).toBe(true)
    expect((await masuk('admin', 'Kuat#Sekali2026')).ok).toBe(true)
    expect((await masuk('admin@sekolah.sch.id', 'salah')).ok).toBe(false)
  })

  it('masuk Google hanya setelah diaktifkan, dihubungkan, dan diizinkan di perangkat', async () => {
    const budi = await buatAkun(admin, { username: 'budi', nama: 'Budi', peranId: 'guru', sandiSementara: 'Sementara#2026x' })
    const sesiBudi = (await masuk('budi', 'Sementara#2026x')) as { sesi: Sesi }
    expect((await masukGoogle(G)).ok).toBe(false) // belum aktif
    await expect(hubungkanGoogle(sesiBudi.sesi, G, { izinMasuk: true, impor: false })).rejects.toThrow(/belum mengaktifkan/)
    await simpanConfigGoogle(admin, { aktif: true, clientId: CID })
    expect((await configGoogle()).aktif).toBe(true)
    await expect(simpanConfigGoogle(sesiBudi.sesi, { aktif: false, clientId: '' })).rejects.toThrow(/Administrator/)
    await hubungkanGoogle(sesiBudi.sesi, G, { izinMasuk: true, impor: true })
    expect(sesiBudi.sesi.akun.google?.wrap).toBeTruthy()
    // sandi sementara masih wajib diganti: Google tidak boleh melewati kewajiban itu
    expect((await masukGoogle(G)).ok).toBe(false)
    sesiBudi.sesi.akun.wajibGantiSandi = false
    const { putAkunUji } = await import('./helper-akun')
    await putAkunUji(sesiBudi.sesi.akun)
    const h = await masukGoogle(G)
    expect(h.ok).toBe(true)
    if (h.ok === true) expect(h.sesi.akun.username).toBe('budi')
    expect((await masukGoogle({ ...G, sub: 'g-lain' })).ok).toBe(false)
    // akun Google yang sama tidak boleh dipakai pengguna lain
    await expect(hubungkanGoogle(admin, G, { izinMasuk: false, impor: false })).rejects.toThrow(/pengguna lain/)
    // sinkron profil: nama berubah
    await sinkronProfilGoogle(sesiBudi.sesi, { ...G, nama: 'Budi S.' })
    expect(sesiBudi.sesi.akun.nama).toBe('Budi S.')
    // reset admin mencabut izin masuk Google
    await resetAkun(admin, sesiBudi.sesi.akun, 'Sementara#2027y', false)
    expect((await masukGoogle(G)).ok).toBe(false)
    await putusGoogle(sesiBudi.sesi)
    expect(sesiBudi.sesi.akun.google).toBeUndefined()
    expect(budi.username).toBe('budi')
  })

  it('pembatasan domain', async () => {
    await simpanConfigGoogle(admin, { aktif: true, clientId: CID, domain: 'sekolah.sch.id' })
    expect((await masukGoogle({ sub: 'x', email: 'a@gmail.com' })).ok).toBe(false)
  })
})
