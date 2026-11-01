import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_DEFAULT, humanisasi, variasiHint, ambilTeks, bersihkan, isiNama, jalankanBatch, kategori, panggilAi, pesanGalat, promptCatatan, promptMapel, systemPrompt } from '../src/ai'

const a = { ...AI_DEFAULT, apiKey: 'kunci', aktif: true }
afterEach(() => vi.unstubAllGlobals())

describe('AI narasi rapor', () => {
  it('kategori selaras KKM', () => {
    expect(kategori(95, 75)).toBe('sangat baik')
    expect(kategori(85, 75)).toBe('baik')
    expect(kategori(76, 75)).toContain('cukup')
    expect(kategori(60, 75)).toContain('belum tuntas')
  })
  it('prompt memuat skor & kategori tetapi tanpa nama', () => {
    const p = promptMapel({ mapel: 'IPA', kelas: '5A', jenjang: 'SD', kurikulum: 'Kurikulum Merdeka', kkm: 75, tujuan: [{ tp: 'Memahami daur air', nilai: 95 }, { tp: 'Mengukur suhu', nilai: 60 }], nilaiAkhir: 78 })
    expect(p).toContain('nilai 95, kategori sangat baik')
    expect(p).toContain('nilai 60, kategori belum tuntas')
    expect(p).toContain('{NAMA}')
  })
  it('catatan memuat kehadiran dan ekskul', () => {
    const p = promptCatatan({ kelas: '5A', semester: 1, rataRata: 82, mapel: [{ nama: 'IPA', nilai: 80, kkm: 75 }], hadir: { sakit: 1, izin: 0, alpa: 2 }, ekskul: [{ nama: 'Pramuka', predikat: 'Baik' }] })
    expect(p).toContain('sakit 1 hari')
    expect(p).toContain('Pramuka (Baik)')
  })
  it('system prompt memuat gaya dan instruksi guru', () => {
    expect(systemPrompt({ ...a, gaya: 'rinci', instruksi: 'pakai sapaan Ananda' }, 'mapel')).toContain('5-6 kalimat')
    expect(systemPrompt(a, 'mapel')).not.toContain('Instruksi tambahan')
  })
  it('membersihkan markdown dan mengisi nama', () => {
    expect(bersihkan('"**{NAMA}** baik.\n\n- Bagus"')).toBe('{NAMA} baik. Bagus')
    expect(isiNama('{NAMA} rajin. {NAMA} aktif.', 'Budi')).toBe('Budi rajin. Budi aktif.')
  })
  it('mengurai jawaban Anthropic dan OpenAI', () => {
    expect(ambilTeks('anthropic', { content: [{ type: 'text', text: 'Halo' }] })).toBe('Halo')
    expect(ambilTeks('openai', { choices: [{ message: { content: 'Hai' } }] })).toBe('Hai')
  })
  it('panggilAi Anthropic: header & isi permintaan benar', async () => {
    const f = vi.fn().mockResolvedValue({ status: 200, text: async () => JSON.stringify({ content: [{ type: 'text', text: '{NAMA} baik.' }] }) })
    vi.stubGlobal('fetch', f)
    expect(await panggilAi(a, 'sys', 'usr')).toBe('{NAMA} baik.')
    const [url, init] = f.mock.calls[0]
    expect(url).toBe(a.endpoint)
    expect(init.headers['x-api-key']).toBe('kunci')
    const body = JSON.parse(init.body)
    expect(body.system).toBe('sys')
    expect(body.messages[0].content).toBe('usr')
  })
  it('panggilAi OpenAI memakai Bearer', async () => {
    const f = vi.fn().mockResolvedValue({ status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) })
    vi.stubGlobal('fetch', f)
    await panggilAi({ ...a, penyedia: 'openai', endpoint: 'https://x/v1/chat/completions' }, 's', 'u')
    expect(f.mock.calls[0][1].headers.authorization).toBe('Bearer kunci')
  })
  it('galat 401/429 berbahasa Indonesia', async () => {
    expect(pesanGalat(401, '')).toContain('Kunci API ditolak')
    expect(pesanGalat(429, '')).toContain('Batas pemakaian')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, text: async () => '{}' }))
    await expect(panggilAi(a, 's', 'u')).rejects.toThrow('Kunci API ditolak')
  })
  it('batch: satu kegagalan tidak menghentikan lainnya', async () => {
    const hasil: number[] = []
    const r = await jalankanBatch([1, 2, 3, 4], async (x) => { if (x === 2) throw new Error('gagal'); hasil.push(x) }, 2)
    expect(r.gagal).toBe(1)
    expect(hasil.sort()).toEqual([1, 3, 4])
  })
  it('Gemini: URL berisi model, header kunci, jawaban dibaca', async () => {
    const f = vi.fn().mockResolvedValue({ status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Anak rajin.' }] } }] }) })
    vi.stubGlobal('fetch', f)
    const g = { ...a, penyedia: 'gemini' as const, model: 'gemini-2.5-flash', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent' }
    expect(await panggilAi(g, 's', 'u')).toBe('Anak rajin.')
    expect(f.mock.calls[0][0]).toContain('/models/gemini-2.5-flash:generateContent')
    expect(f.mock.calls[0][1].headers['x-goog-api-key']).toBe('kunci')
    expect(JSON.parse(f.mock.calls[0][1].body).systemInstruction.parts[0].text).toBe('s')
  })
  it('humanize: bersihkan tanda pisah & klise, prompt memuat gaya manusia', () => {
    expect(humanisasi('Ia senantiasa rajin — dan luar biasa.')).toBe('Ia selalu rajin, dan sangat baik.')
    expect(systemPrompt(a, 'mapel')).toContain('GAYA MANUSIA')
    expect(systemPrompt({ ...a, humanize: false }, 'mapel')).not.toContain('GAYA MANUSIA')
    expect(variasiHint('a')).not.toBe(variasiHint('b') + 'x')
  })
})
