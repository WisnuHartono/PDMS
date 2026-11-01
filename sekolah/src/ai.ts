// Integrasi AI untuk narasi rapor. Prinsip: nilai & kategori dihitung LOKAL, AI hanya merangkai kalimat.
// Nama murid tidak dikirim (diganti penanda {NAMA} lalu diisi kembali di perangkat); NIS/NIK tidak pernah dikirim.
import type { AiSetting } from './types'

export const AI_DEFAULT: AiSetting = {
  aktif: false, penyedia: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-5-5', apiKey: '', gaya: 'standar',
}
export const PENYEDIA: Record<AiSetting['penyedia'], { nama: string; endpoint: string; model: string }> = {
  anthropic: { nama: 'Anthropic (Claude)', endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-5-5' },
  openai: { nama: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  kompatibel: { nama: 'Kompatibel OpenAI (OpenRouter, Ollama, dll.)', endpoint: 'http://localhost:11434/v1/chat/completions', model: '' },
}

export const aiSiap = (a?: AiSetting): a is AiSetting => !!a?.aktif && !!a.endpoint && !!a.model && (!!a.apiKey || a.penyedia === 'kompatibel')

type Desktop = { aiFetch?: (r: { url: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; text: string }> }
const desktop = () => (globalThis as unknown as { simas?: Desktop }).simas

async function kirim(url: string, headers: Record<string, string>, body: string, ms = 60000): Promise<{ status: number; text: string }> {
  const d = desktop()
  if (d?.aiFetch) return d.aiFetch({ url, headers, body })
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: ctl.signal })
    return { status: res.status, text: await res.text() }
  } catch (e) {
    const abort = (e as Error)?.name === 'AbortError'
    throw new Error(abort ? 'Waktu habis menunggu AI.' : 'Tidak dapat terhubung ke layanan AI. Periksa koneksi internet dan alamat API. (Di versi web, sebagian layanan memblokir akses langsung dari browser; gunakan aplikasi Windows.)')
  } finally { clearTimeout(t) }
}

export function pesanGalat(status: number, text: string) {
  if (status === 0) return text
  if (status === 401 || status === 403) return 'Kunci API ditolak. Periksa kembali kunci API Anda.'
  if (status === 404) return 'Model atau alamat API tidak ditemukan. Periksa nama model dan alamat API.'
  if (status === 429) return 'Batas pemakaian layanan AI tercapai. Coba lagi sebentar lagi atau periksa kuota akun.'
  if (status >= 500) return 'Layanan AI sedang bermasalah. Coba lagi nanti.'
  let detail = ''
  try { const j = JSON.parse(text); detail = j?.error?.message ?? j?.message ?? '' } catch { /* abaikan */ }
  return `Permintaan ditolak (${status}).${detail ? ` ${String(detail).slice(0, 200)}` : ''}`
}

export function bersihkan(t: string) {
  return t.replace(/^```[a-z]*\n?|```$/gim, '').replace(/\*\*|__/g, '').replace(/^\s*[-*]\s+/gm, '').replace(/^["“']+|["”']+$/g, '').replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

export function ambilTeks(penyedia: AiSetting['penyedia'], json: unknown): string {
  const j = json as { content?: { type: string; text?: string }[]; choices?: { message?: { content?: string } }[] }
  const t = penyedia === 'anthropic'
    ? (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
    : j.choices?.[0]?.message?.content ?? ''
  return bersihkan(t)
}

export async function panggilAi(a: AiSetting, system: string, user: string, maxToken = 600): Promise<string> {
  const anth = a.penyedia === 'anthropic'
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  let body: unknown
  if (anth) {
    headers['x-api-key'] = a.apiKey; headers['anthropic-version'] = '2023-06-01'; headers['anthropic-dangerous-direct-browser-access'] = 'true'
    body = { model: a.model, max_tokens: maxToken, temperature: 0.4, system, messages: [{ role: 'user', content: user }] }
  } else {
    if (a.apiKey) headers.authorization = `Bearer ${a.apiKey}`
    body = { model: a.model, max_tokens: maxToken, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }
  }
  const res = await kirim(a.endpoint.trim(), headers, JSON.stringify(body))
  if (res.status < 200 || res.status >= 300) throw new Error(pesanGalat(res.status, res.text))
  let json: unknown
  try { json = JSON.parse(res.text) } catch { throw new Error('Jawaban AI tidak dapat dibaca.') }
  const t = ambilTeks(a.penyedia, json)
  if (!t) throw new Error('AI tidak menghasilkan teks. Coba lagi.')
  return t
}

export const isiNama = (t: string, nama: string) => t.replace(/\{NAMA\}/g, nama)

// ---------- Kategori ketuntasan (dihitung lokal agar narasi selaras dengan angka) ----------
export function kategori(v: number, kkm: number) {
  const r = (100 - kkm) / 3
  if (v >= kkm + 2 * r) return 'sangat baik'
  if (v >= kkm + r) return 'baik'
  if (v >= kkm) return 'cukup (tuntas)'
  return 'belum tuntas (di bawah KKM)'
}

const PANJANG = { ringkas: '2 kalimat (sekitar 35-50 kata)', standar: '3-4 kalimat (sekitar 60-90 kata)', rinci: '5-6 kalimat (sekitar 100-140 kata)' }

export function systemPrompt(a: AiSetting, jenis: 'mapel' | 'paud' | 'catatan', inggris = false) {
  const dasar = [
    'Anda adalah guru berpengalaman yang menulis narasi pada rapor sekolah.',
    inggris ? 'Tulis dalam bahasa Inggris yang formal dan hangat.' : 'Tulis dalam bahasa Indonesia baku yang hangat, positif, dan mudah dipahami orang tua.',
    'Gunakan HANYA data yang diberikan. Jangan mengarang fakta, kejadian, atau kemampuan yang tidak ada dalam data.',
    'Narasi harus SELARAS dengan angka: nilai tinggi dipuji secukupnya tanpa berlebihan; nilai di bawah KKM disampaikan sebagai area yang perlu bimbingan secara konstruktif, bukan menyalahkan; jangan menyebut angka nilai.',
    'Gunakan penanda {NAMA} persis seperti itu untuk menyebut murid (sistem akan menggantinya). Jangan menulis nama lain.',
    'Keluarkan hanya teks narasi dalam satu paragraf, tanpa judul, tanpa daftar, tanpa tanda kutip, tanpa markdown.',
    `Panjang: ${PANJANG[a.gaya]}.`,
  ]
  if (jenis === 'catatan') dasar.push('Ini catatan wali kelas: rangkum gambaran keseluruhan (kekuatan, hal yang perlu ditingkatkan, kehadiran, ekstrakurikuler bila ada) dan tutup dengan saran tindak lanjut singkat.')
  if (jenis === 'paud') dasar.push('Ini rapor PAUD: gunakan bahasa yang menggambarkan perkembangan anak berdasarkan capaian (BB=Belum Berkembang, MB=Mulai Berkembang, BSH=Berkembang Sesuai Harapan, BSB=Berkembang Sangat Baik) tanpa membandingkan dengan anak lain.')
  if (a.instruksi?.trim()) dasar.push(`Instruksi tambahan dari guru: ${a.instruksi.trim().slice(0, 400)}`)
  return dasar.join('\n')
}

export interface DataMapel {
  mapel: string; kelas: string; jenjang: string; kurikulum: string; kkm: number
  tujuan: { tp: string; nilai: number }[]; komponenLain?: { label: string; nilai: number }[]
  nilaiAkhir?: number; predikat?: string; teksGuru?: string
}
export function promptMapel(d: DataMapel) {
  const L = [`Mata pelajaran: ${d.mapel}`, `Kelas: ${d.kelas} (${d.jenjang}), ${d.kurikulum}`, `Batas ketuntasan (KKM/KKTP): ${d.kkm}`]
  if (d.nilaiAkhir !== undefined) L.push(`Nilai akhir: ${d.nilaiAkhir}${d.predikat ? `, predikat ${d.predikat}` : ''} — kategori ${kategori(d.nilaiAkhir, d.kkm)}`)
  if (d.tujuan.length) { L.push('Capaian per tujuan pembelajaran:'); d.tujuan.forEach((t, i) => L.push(`${i + 1}. ${t.tp} → nilai ${t.nilai}, kategori ${kategori(t.nilai, d.kkm)}`)) }
  d.komponenLain?.forEach((k) => L.push(`${k.label}: ${k.nilai} (${kategori(k.nilai, d.kkm)})`))
  if (d.teksGuru?.trim()) L.push(`Catatan awal guru (kembangkan, pertahankan maksud): ${d.teksGuru.trim().slice(0, 500)}`)
  L.push('', 'Tulis narasi capaian kompetensi untuk {NAMA} pada mata pelajaran ini.')
  return L.join('\n')
}

export interface DataPaud { mapel: string; capaian: string; tujuan: string[]; usia?: string; teksGuru?: string }
export function promptPaud(d: DataPaud) {
  const L = [`Elemen/aspek perkembangan: ${d.mapel}`, `Capaian anak: ${d.capaian}`]
  if (d.usia) L.push(`Kelompok usia: ${d.usia}`)
  if (d.tujuan.filter(Boolean).length) L.push(`Tujuan pembelajaran semester ini: ${d.tujuan.filter(Boolean).join('; ')}`)
  if (d.teksGuru?.trim()) L.push(`Catatan awal guru (kembangkan, pertahankan maksud): ${d.teksGuru.trim().slice(0, 500)}`)
  L.push('', 'Tulis narasi perkembangan untuk {NAMA} pada aspek ini.')
  return L.join('\n')
}

export interface DataCatatan {
  kelas: string; semester: number; rataRata?: number
  mapel: { nama: string; nilai?: number; kkm: number }[]
  hadir: { sakit: number; izin: number; alpa: number }
  ekskul: { nama: string; predikat: string }[]
  /** Rapor PAUD: capaian per elemen (BB/MB/BSH/BSB). */
  capaian?: { nama: string; capaian: string }[]
  teksGuru?: string
}
export function promptCatatan(d: DataCatatan) {
  const L = [`Kelas ${d.kelas}, semester ${d.semester}`]
  if (d.rataRata !== undefined) L.push(`Rata-rata nilai: ${d.rataRata.toFixed(1)}`)
  const ada = d.mapel.filter((m) => m.nilai !== undefined)
  if (ada.length) { L.push('Nilai per mata pelajaran:'); ada.forEach((m) => L.push(`- ${m.nama}: ${m.nilai} (${kategori(m.nilai!, m.kkm)})`)) }
  if (d.capaian?.length) { L.push('Capaian perkembangan per elemen:'); d.capaian.forEach((c) => L.push(`- ${c.nama}: ${c.capaian}`)) }
  L.push(`Ketidakhadiran: sakit ${d.hadir.sakit} hari, izin ${d.hadir.izin} hari, tanpa keterangan ${d.hadir.alpa} hari`)
  if (d.ekskul.length) L.push(`Ekstrakurikuler: ${d.ekskul.map((e) => `${e.nama} (${e.predikat})`).join(', ')}`)
  if (d.teksGuru?.trim()) L.push(`Catatan awal wali kelas (kembangkan, pertahankan maksud): ${d.teksGuru.trim().slice(0, 500)}`)
  L.push('', 'Tulis catatan wali kelas untuk {NAMA}.')
  return L.join('\n')
}

/** Jalankan tugas dengan batas paralel; kegagalan satu tugas tidak menghentikan yang lain. */
export async function jalankanBatch<T>(items: T[], kerja: (x: T) => Promise<void>, paralel = 3, onProgress?: (selesai: number) => void) {
  let i = 0, selesai = 0, gagal = 0
  let galat = ''
  const pekerja = Array.from({ length: Math.min(paralel, items.length) }, async () => {
    while (i < items.length) {
      const x = items[i++]
      try { await kerja(x) } catch (e) { gagal++; galat = (e as Error).message }
      onProgress?.(++selesai)
    }
  })
  await Promise.all(pekerja)
  return { gagal, galat }
}
