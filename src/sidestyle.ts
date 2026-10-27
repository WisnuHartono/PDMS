import type { SideStyle } from './types'
import { DEFAULT_SIDESTYLE } from './types'
import { THEME_PRESETS } from './banner'
import type { Settings } from './types'

export const sideStyleOf = (s: Pick<Settings, 'sideStyle'>): Required<Omit<SideStyle, 'c1' | 'c2' | 'image'>> & Pick<SideStyle, 'c1' | 'c2' | 'image'> => ({ ...DEFAULT_SIDESTYLE, ...s.sideStyle })

const lum = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255)
}

/** Warna gradasi latar sidebar, atau null bila mengikuti tema. */
export function sideColors(st: SideStyle): { c1: string; c2: string } | null {
  if (!st.bg || st.bg === 'theme') return null
  if (st.bg === 'custom') return { c1: st.c1 || '#0b1f4d', c2: st.c2 || '#1d4ed8' }
  const p = THEME_PRESETS.find((x) => x.id === st.bg)
  return p ? { c1: p.c2, c2: p.c1 } : null // atas gelap, bawah lebih terang
}
export const sideBackground = (st: SideStyle): string | undefined => {
  const c = sideColors(st)
  return c ? `linear-gradient(${st.angle ?? 180}deg, ${c.c1}, ${c.c2})` : undefined
}
/** 'dark' = latar gelap (teks terang); null = ikuti tema. */
export const sideTone = (st: SideStyle): 'dark' | 'light' | null => {
  const c = sideColors(st)
  return c ? ((lum(c.c1) + lum(c.c2)) / 2 < 0.35 ? 'dark' : 'light') : null
}

const svg = (w: number, h: number, body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`
const ln = (d: string, w = 1.2) => `<path d='${d}' fill='none' stroke='#000' stroke-width='${w}' stroke-linecap='round'/>`
export const PATTERNS: { id: string; name: string; tile: [number, number]; css: string }[] = [
  { id: 'dots', name: 'Titik', tile: [16, 16], css: svg(16, 16, `<circle cx='3' cy='3' r='1.4'/>`) },
  { id: 'grid', name: 'Kisi', tile: [28, 28], css: svg(28, 28, ln('M28 0H0v28', 1)) },
  { id: 'diag', name: 'Diagonal', tile: [12, 12], css: svg(12, 12, ln('M0 12L12 0', 1.2)) },
  { id: 'plus', name: 'Tambah', tile: [22, 22], css: svg(22, 22, ln('M11 7v8M7 11h8', 1.4)) },
  { id: 'waves', name: 'Gelombang', tile: [40, 14], css: svg(40, 14, ln('M0 7q10-8 20 0t20 0')) },
  { id: 'rings', name: 'Lingkaran', tile: [48, 48], css: svg(48, 48, `<circle cx='24' cy='24' r='8' fill='none' stroke='#000'/><circle cx='24' cy='24' r='18' fill='none' stroke='#000'/>`) },
]

// Siluet vektor (viewBox 240x140), menempel di dasar sidebar.
export const ARTS: { id: string; name: string; body: string }[] = [
  { id: 'kota', name: 'Gedung kota', body: `<path d='M0 140V92h14V70h18v22h10V50h20v42h12V78h16V40l10-8 10 8v52h14V84h18V62h16v30h12V74h18v66z'/><g fill='#000' opacity='.25'><path d='M20 76h4v4h-4zM28 76h2v4h-2zM48 58h4v4h-4zM58 58h4v4h-4zM48 70h4v4h-4zM58 70h4v4h-4zM128 52h4v4h-4zM128 64h4v4h-4z'/></g>` },
  { id: 'industri', name: 'Kilang & tangki', body: `<path d='M8 140V98a22 9 0 0 1 44 0v42zM62 140V92a26 10 0 0 1 52 0v48zM150 140V46h10v94z'/><path d='M155 44c-7-9 0-15 0-24 9 7 7 17 0 24z'/><rect x='0' y='122' width='240' height='6'/><rect x='122' y='98' width='6' height='28'/><rect x='172' y='88' width='52' height='52'/><rect x='182' y='72' width='10' height='16'/>` },
  { id: 'gunung', name: 'Pegunungan', body: `<path d='M0 140l54-76 34 44 44-64 52 84 28-34 28 46z' opacity='.55'/><path d='M0 140l40-44 30 28 42-52 46 68 30-30 52 30z'/>` },
  { id: 'gelombang', name: 'Gelombang laut', body: `<path d='M0 96c30-16 60 16 90 0s60-16 90 0 40 8 60-4v48H0z' opacity='.45'/><path d='M0 114c30-14 60 14 90 0s60-14 90 0 40 6 60-2v28H0z' opacity='.7'/><path d='M0 128c30-10 60 10 90 0s60-10 90 0 40 4 60-2v14H0z'/>` },
  { id: 'jembatan', name: 'Jembatan', body: `<rect x='0' y='104' width='240' height='6'/><rect x='46' y='30' width='8' height='110'/><rect x='186' y='30' width='8' height='110'/><path d='M0 104Q50 40 50 30M50 30Q120 100 190 30M190 30Q190 40 240 104' fill='none' stroke='#000' stroke-width='3'/><path d='M70 106V74M90 106V82M110 106V86M130 106V86M150 106V82M170 106V74' stroke='#000' stroke-width='1.6'/>` },
]

export interface QuickStyle { id: string; name: string; st: SideStyle }
export const QUICK_STYLES: QuickStyle[] = [
  { id: 'bawaan', name: 'Bawaan', st: { bg: 'theme', pattern: 'none', art: 'none' } },
  { id: 'korporat', name: 'Korporat biru', st: { bg: 'custom', c1: '#0b1f4d', c2: '#1d4ed8', angle: 190, pattern: 'grid', patternOpacity: 9, art: 'none' } },
  { id: 'industri', name: 'Industri', st: { bg: 'custom', c1: '#0b1220', c2: '#1e3a5f', angle: 180, pattern: 'dots', patternOpacity: 10, art: 'industri', artOpacity: 22 } },
  { id: 'kota', name: 'Kota malam', st: { bg: 'custom', c1: '#1e1b4b', c2: '#5b21b6', angle: 180, pattern: 'plus', patternOpacity: 8, art: 'kota', artOpacity: 24 } },
  { id: 'alam', name: 'Alam', st: { bg: 'custom', c1: '#052e2b', c2: '#0f766e', angle: 180, pattern: 'waves', patternOpacity: 9, art: 'gunung', artOpacity: 24 } },
  { id: 'laut', name: 'Laut', st: { bg: 'custom', c1: '#082f49', c2: '#0e7490', angle: 180, pattern: 'rings', patternOpacity: 8, art: 'gelombang', artOpacity: 26 } },
  { id: 'terang', name: 'Terang minimal', st: { bg: 'theme', pattern: 'dots', patternOpacity: 14, art: 'kota', artOpacity: 7 } },
]
