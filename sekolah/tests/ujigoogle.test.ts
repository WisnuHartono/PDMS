import { describe, expect, it } from 'vitest'
import { bacaKonfigBerkas, skripPengaturan, tafsirAlasanGis, ujiKonfigurasi, ujiSinkronAkun } from '../src/security/ujiGoogle'

const CID = '1090946658709-abc.apps.googleusercontent.com'
const resp = (j: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(j) } as Response)
const dep = (reason?: string) => ({
  online: () => true, origin: 'https://simas.sekolah.sch.id', tunggu: 200,
  ambil: (u: string) => (u.includes('certs') ? resp({ keys: [{ kid: 'a' }] }) : resp({})),
  muat: () => Promise.resolve({
    initialize: () => undefined,
    prompt: (cb: (n: { isNotDisplayed: () => boolean; getNotDisplayedReason: () => string }) => void) => cb({ isNotDisplayed: () => !!reason, getNotDisplayedReason: () => reason ?? '' }),
  }),
})

describe('uji koneksi Google', () => {
  it('Client ID kosong atau salah format berhenti di langkah pertama', async () => {
    expect((await ujiKonfigurasi({ clientId: '' }))[0].status).toBe('gagal')
    const r = await ujiKonfigurasi({ clientId: 'abc' })
    expect(r).toHaveLength(1); expect(r[0].status).toBe('gagal')
  })
  it('offline berhenti dengan saran', async () => {
    const r = await ujiKonfigurasi({ clientId: CID }, { ...dep(), online: () => false })
    expect(r.at(-1)).toMatchObject({ id: 'internet', status: 'gagal' })
  })
  it('semua lolos bila Google menerima Client ID dan origin', async () => {
    const r = await ujiKonfigurasi({ clientId: CID, domain: 'sekolah.sch.id' }, dep())
    expect(r.every((l) => l.status === 'ok')).toBe(true)
    expect(r.map((l) => l.id)).toEqual(['client', 'domain', 'internet', 'layanan', 'kunci', 'origin', 'gis', 'prompt'])
  })
  it('origin tidak terdaftar & client tidak dikenal dilaporkan gagal dengan saran', async () => {
    expect((await ujiKonfigurasi({ clientId: CID }, dep('unregistered_origin'))).at(-1)).toMatchObject({ status: 'gagal' })
    expect((await ujiKonfigurasi({ clientId: CID }, dep('invalid_client'))).at(-1)?.saran).toMatch(/Client ID/)
  })
  it('sesi Google tidak aktif dianggap normal', () => { expect(tafsirAlasanGis('opt_out_or_no_session').status).toBe('ok') })
  it('origin app:// diberi peringatan, bukan gagal', async () => {
    const r = await ujiKonfigurasi({ clientId: CID }, { ...dep(), origin: 'app://simas' })
    expect(r.find((l) => l.id === 'origin')?.status).toBe('peringatan')
  })
  it('jaringan memblokir Google', async () => {
    const r = await ujiKonfigurasi({ clientId: CID }, { ...dep(), ambil: () => Promise.reject(new Error('blocked')) })
    expect(r.at(-1)).toMatchObject({ id: 'layanan', status: 'gagal' })
  })
  it('batas waktu tanpa jawaban Google menjadi peringatan', async () => {
    const r = await ujiKonfigurasi({ clientId: CID }, { ...dep(), muat: () => Promise.resolve({ initialize: () => undefined, prompt: () => undefined }) })
    expect(r.at(-1)).toMatchObject({ id: 'prompt', status: 'peringatan' })
  })
})

describe('uji sinkron akun (tanpa mengubah data)', () => {
  const g = { sub: '1', email: 'budi@sekolah.sch.id', nama: 'Budi Baru', foto: 'x', domain: 'sekolah.sch.id' }
  it('melaporkan perubahan yang akan terjadi', () => {
    const r = ujiSinkronAkun({ nama: 'Budi', email: 'lama@x.id', google: { sub: '1', email: 'budi@sekolah.sch.id' } }, g, { domain: 'sekolah.sch.id' })
    expect(r.find((l) => l.id === 'sinkron')?.detail).toMatch(/nama.*Budi Baru.*email.*budi@sekolah\.sch\.id.*foto/)
    expect(r.find((l) => l.id === 'tautan')?.status).toBe('ok')
  })
  it('profil sudah sama', () => {
    const r = ujiSinkronAkun({ nama: 'Budi Baru', email: 'budi@sekolah.sch.id', foto: 'y', google: { sub: '1', email: 'budi@sekolah.sch.id' } }, g, {})
    expect(r.find((l) => l.id === 'sinkron')?.status).toBe('ok')
  })
  it('akun Google berbeda dan domain tidak sesuai ditolak', () => {
    const r = ujiSinkronAkun({ nama: 'B', google: { sub: '2', email: 'lain@gmail.com' } }, g, { domain: 'lain.id' })
    expect(r.find((l) => l.id === 'tautan')?.status).toBe('gagal')
    expect(r.find((l) => l.id === 'domain')?.status).toBe('gagal')
  })
  it('akun belum terhubung memberi peringatan', () => {
    expect(ujiSinkronAkun({ nama: 'B' }, g, {}).find((l) => l.id === 'tautan')?.status).toBe('peringatan')
  })
})

describe('berkas konfigurasi & skrip', () => {
  it('impor memvalidasi isi', () => {
    expect(bacaKonfigBerkas(JSON.stringify({ clientId: CID, domain: 'Sekolah.sch.id' }))).toEqual({ aktif: true, clientId: CID, domain: 'sekolah.sch.id' })
    expect(() => bacaKonfigBerkas('bukan json')).toThrow()
    expect(() => bacaKonfigBerkas(JSON.stringify({ clientId: 'x' }))).toThrow(/Client ID/)
    expect(() => bacaKonfigBerkas(JSON.stringify({ clientId: CID, domain: 'a b' }))).toThrow(/Domain/)
  })
  it('skrip memuat origin, domain, dan pemeriksaan Client ID', () => {
    const sh = skripPengaturan('bash', { origin: 'https://simas.sch.id', domain: 'sekolah.sch.id' })
    expect(sh).toContain("ORIGIN='https://simas.sch.id'"); expect(sh).toContain("DOMAIN='sekolah.sch.id'")
    expect(sh).toContain('gcloud services enable drive.googleapis.com'); expect(sh).toContain('apps\\.googleusercontent\\.com')
    const ps = skripPengaturan('powershell', { origin: 'https://simas.sch.id' })
    expect(ps).toContain("$Origin = 'https://simas.sch.id'"); expect(ps).toContain('ConvertTo-Json')
  })
  it('origin non-HTTP tidak disuntikkan ke skrip', () => {
    expect(skripPengaturan('bash', { origin: "app://x'; rm -rf /" })).not.toContain('rm -rf')
  })
})
