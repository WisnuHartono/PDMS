// Tema aplikasi (Modern / Classic / Simple) + latar header yang dapat dikustomisasi.
// Semua gaya dialirkan lewat variabel CSS pada elemen <html>, sehingga satu fungsi cukup untuk menerapkan dan mempratinjau.
import type { TampilanSetting } from './types'

export type NamaTema = 'modern' | 'classic' | 'simple'
type T = Required<TampilanSetting>

interface Preset {
  nama: string; ket: string
  aksen: string; bg: string; panel: string; line: string; line2: string; text: string; muted: string
  radius: number; bayangan: string; fontJudul: string
  side: [string, string]; sideMode: 'gelap' | 'terang'; tabOn: string
  header: { css: string; fg: string; garis: string }
}

export const PRESET: Record<NamaTema, Preset> = {
  modern: {
    nama: 'Modern', ket: 'Gradien lembut, sudut membulat, bayangan halus',
    aksen: '#0f7a8c', bg: '#eef2f6', panel: '#ffffff', line: '#d9e1ea', line2: '#e9eef4', text: '#1c2b39', muted: '#6b7a8a',
    radius: 8, bayangan: '0 1px 2px rgba(16,40,60,.06), 0 4px 12px rgba(16,40,60,.04)', fontJudul: 'inherit',
    side: ['#12324a', '#0c2537'], sideMode: 'gelap', tabOn: '#f59e0b',
    header: { css: 'radial-gradient(circle at 78% -40%, rgba(251,191,36,.35), transparent 45%), radial-gradient(circle at 40% 160%, rgba(45,212,191,.35), transparent 40%), linear-gradient(100deg,#0c2537 0%,#0f5c7a 45%,#155e75 70%,#1e3a8a 100%)', fg: '#ffffff', garis: 'none' },
  },
  classic: {
    nama: 'Classic', ket: 'Resmi dan formal: warna navy, aksen emas, huruf serif pada judul',
    aksen: '#1f4e79', bg: '#f4f1ea', panel: '#fffdf8', line: '#cdc5b4', line2: '#e3dccb', text: '#241f18', muted: '#6f6658',
    radius: 2, bayangan: 'none', fontJudul: "Georgia, 'Times New Roman', serif",
    side: ['#1f2d3d', '#17222f'], sideMode: 'gelap', tabOn: '#b8860b',
    header: { css: '#1f3a5f', fg: '#ffffff', garis: '3px solid #b8860b' },
  },
  simple: {
    nama: 'Simple', ket: 'Minimalis: latar putih, tanpa gradien dan bayangan',
    aksen: '#2563eb', bg: '#f8fafc', panel: '#ffffff', line: '#e2e8f0', line2: '#eef2f7', text: '#0f172a', muted: '#64748b',
    radius: 4, bayangan: 'none', fontJudul: 'inherit',
    side: ['#ffffff', '#ffffff'], sideMode: 'terang', tabOn: '#2563eb',
    header: { css: '#ffffff', fg: '#0f172a', garis: '1px solid #e2e8f0' },
  },
}
export const DAFTAR_TEMA = Object.keys(PRESET) as NamaTema[]

// ---------- Warna ----------
const rgb = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()) ?? /^#?([0-9a-f]{3})$/i.exec(h.trim())
  if (!m) return [15, 122, 140]
  const x = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]
}
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
export const campur = (a: string, b: string, p: number) => { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * p, x[1] + (y[1] - x[1]) * p, x[2] + (y[2] - x[2]) * p) }
export const luminansi = (h: string) => { const [r, g, b] = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
/** Warna teks (putih/gelap) yang terbaca di atas latar tertentu. */
export const teksDiAtas = (latar: string) => (luminansi(latar) > 0.45 ? '#0f172a' : '#ffffff')

/** Variabel CSS untuk satu konfigurasi tampilan. */
export function varsTema(t: T): Record<string, string> {
  const p = PRESET[t.tema] ?? PRESET.modern
  const aksen = /^#[0-9a-f]{6}$/i.test(t.temaAksen) ? t.temaAksen : p.aksen
  const radius = t.temaSudut >= 0 ? t.temaSudut : p.radius
  const bayangan = t.temaBayangan === 'tema' ? p.bayangan : t.temaBayangan === 'ada' ? PRESET.modern.bayangan : 'none'
  const bg = /^#[0-9a-f]{6}$/i.test(t.temaLatar) ? t.temaLatar : p.bg

  // Header
  let hCss = p.header.css, hFg = p.header.fg, hGaris = p.header.garis
  if (t.headerMode === 'warna') { hCss = t.headerWarna1; hFg = t.headerTeks === 'auto' ? teksDiAtas(t.headerWarna1) : t.headerTeks === 'terang' ? '#ffffff' : '#0f172a' }
  else if (t.headerMode === 'gradien') { hCss = `linear-gradient(${t.headerSudut}deg, ${t.headerWarna1}, ${t.headerWarna2})`; const tengah = campur(t.headerWarna1, t.headerWarna2, 0.5); hFg = t.headerTeks === 'auto' ? teksDiAtas(tengah) : t.headerTeks === 'terang' ? '#ffffff' : '#0f172a' }
  else if (t.headerMode === 'gambar' && t.headerGambar) {
    const a = Math.max(0, Math.min(90, t.headerRedam)) / 100
    const gelap = t.headerTeks === 'gelap'
    hCss = `linear-gradient(rgba(${gelap ? '255,255,255' : '0,0,0'},${a}), rgba(${gelap ? '255,255,255' : '0,0,0'},${a})), url("${t.headerGambar}") center / cover no-repeat`
    hFg = gelap ? '#0f172a' : '#ffffff'
  }
  if (t.headerGaris === 'ada' && hGaris === 'none') hGaris = `1px solid ${hFg === '#ffffff' ? 'rgba(255,255,255,.35)' : 'rgba(15,23,42,.18)'}`
  if (t.headerGaris === 'tidak') hGaris = 'none'
  const terang = hFg !== '#ffffff'

  // Sidebar
  const mode = t.temaSidebar === 'tema' ? p.sideMode : t.temaSidebar
  const gelapSide = mode === 'gelap'
  const sidePal = gelapSide
    ? { bg: p.sideMode === 'gelap' ? `linear-gradient(180deg, ${p.side[0]}, ${p.side[1]})` : 'linear-gradient(180deg, #1e293b, #0f172a)', fg: '#c7d6e3', fgOn: '#ffffff', hover: 'rgba(255,255,255,.07)', on: 'rgba(251,191,36,.14)', line: '#fbbf24', grp: '#7f9bb3', border: 'none' }
    : { bg: '#ffffff', fg: '#475569', fgOn: '#0f172a', hover: '#f1f5f9', on: campur(aksen, '#ffffff', 0.9), line: aksen, grp: '#94a3b8', border: `1px solid ${p.line}` }

  return {
    '--bg': bg, '--panel': p.panel, '--line': p.line, '--line-2': p.line2, '--text': p.text, '--muted': p.muted,
    '--accent': aksen, '--accent-2': campur(aksen, '#000000', 0.22), '--accent-soft': campur(aksen, '#ffffff', 0.88),
    '--radius': `${radius}px`, '--shadow': bayangan, '--head-font': p.fontJudul, '--tab-on': p.tabOn,
    '--hdr-bg': hCss, '--hdr-fg': hFg, '--hdr-border': hGaris,
    '--hdr-chip': terang ? 'rgba(15,23,42,.06)' : 'rgba(255,255,255,.14)', '--hdr-chip-line': terang ? 'rgba(15,23,42,.18)' : 'rgba(255,255,255,.25)', '--hdr-sep': terang ? 'rgba(15,23,42,.15)' : 'rgba(255,255,255,.2)',
    '--hdr-hover': terang ? 'rgba(15,23,42,.08)' : 'rgba(255,255,255,.15)',
    '--side-bg': sidePal.bg, '--side-fg': sidePal.fg, '--side-fg-on': sidePal.fgOn, '--side-hover': sidePal.hover, '--side-on': sidePal.on, '--side-on-line': sidePal.line, '--side-group': sidePal.grp, '--side-border': sidePal.border,
    '--side-grp-t': gelapSide ? '#ffffff' : '#0f172a', '--side-grp-line': gelapSide ? 'rgba(255,255,255,.12)' : p.line2, '--side-label': gelapSide ? '#d3e0ea' : '#475569',
  }
}

export function terapkanTema(t: T, el: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(varsTema(t))) el.style.setProperty(k, v)
  el.dataset.tema = t.tema
  el.dataset.sidebar = (t.temaSidebar === 'tema' ? (PRESET[t.tema] ?? PRESET.modern).sideMode : t.temaSidebar) === 'gelap' ? 'gelap' : 'terang'
}
