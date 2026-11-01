import type { Absensi, Pegawai, StatusHadir } from './types'

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => isoDate(new Date())

export function parseIso(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function fmtTanggal(s?: string) {
  if (!s) return '-'
  const d = parseIso(s)
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtTanggalHari(s: string) {
  const d = parseIso(s)
  return `${HARI[d.getDay()]}, ${fmtTanggal(s)}`
}

export function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate()
}

export function umur(tgl?: string, ref = new Date()) {
  if (!tgl) return undefined
  const d = parseIso(tgl)
  let u = ref.getFullYear() - d.getFullYear()
  if (ref.getMonth() < d.getMonth() || (ref.getMonth() === d.getMonth() && ref.getDate() < d.getDate())) u--
  return u
}

export function namaPegawai(p?: Pegawai) {
  if (!p) return ''
  return [p.gelarDepan, p.nama].filter(Boolean).join(' ') + (p.gelarBelakang ? `, ${p.gelarBelakang}` : '')
}

export type Rekap = Record<StatusHadir, number>
export const rekapKosong = (): Rekap => ({ H: 0, S: 0, I: 0, A: 0, T: 0, C: 0, DL: 0 })

/** Rekap kehadiran per orang dari daftar lembar absensi dalam rentang tanggal [dari, sampai]. */
export function rekapAbsensi(lembar: Absensi[], dari: string, sampai: string, filter?: (a: Absensi) => boolean) {
  const out: Record<string, Rekap> = {}
  for (const a of lembar) {
    if (a.tanggal < dari || a.tanggal > sampai) continue
    if (filter && !filter(a)) continue
    for (const [id, c] of Object.entries(a.data)) {
      const r = (out[id] ??= rekapKosong())
      r[c.status] = (r[c.status] ?? 0) + 1
    }
  }
  return out
}

/** Rentang tanggal semester: semester 1 = Juli-Desember, semester 2 = Januari-Juni. */
export function rentangSemester(tahunAjaran: string, semester: 1 | 2): [string, string] {
  const [y1, y2] = tahunAjaran.split('/').map(Number)
  return semester === 1 ? [`${y1}-07-01`, `${y1}-12-31`] : [`${y2 || y1 + 1}-01-01`, `${y2 || y1 + 1}-06-30`]
}

export function download(name: string, content: string | Blob, type = 'application/json') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function toCsv(rows: (string | number | undefined)[][]) {
  return '﻿' + rows.map((r) => r.map((c) => {
    const s = c === undefined ? '' : String(c)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\r\n')
}

export function readFileAsDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(f)
  })
}

export function readFileAsText(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsText(f)
  })
}

/** Perkecil foto agar database tetap ringan. */
export async function fotoKecil(f: File, max = 320): Promise<string> {
  const url = await readFileAsDataUrl(f)
  if (typeof document === 'undefined') return url
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  const s = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * s)
  c.height = Math.round(img.height * s)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  // Gambar yang bisa transparan (logo PNG/WebP/GIF) tetap PNG agar latar tidak menjadi hitam.
  return /^image\/(png|webp|gif|svg)/.test(f.type) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85)
}
