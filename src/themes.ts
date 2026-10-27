import type { Settings } from './types'

export interface Colors { bg: string; card: string; text: string; muted: string; line: string; pri: string }
export interface Preset { id: string; name: string; mode: 'light' | 'dark'; c: Colors }

const P = (id: string, name: string, mode: 'light' | 'dark', bg: string, card: string, text: string, muted: string, line: string, pri: string): Preset => ({ id, name, mode, c: { bg, card, text, muted, line, pri } })

export const PRESETS: Preset[] = [
  P('samudra', 'Samudra', 'light', '#ecfeff', '#ffffff', '#083344', '#52717a', '#cfeaf0', '#0e7490'),
  P('hutan', 'Hutan', 'light', '#f0fdf4', '#ffffff', '#14291c', '#5b7566', '#d1e7d9', '#15803d'),
  P('senja', 'Senja', 'light', '#fff7ed', '#ffffff', '#2b1708', '#7c6553', '#f0dcc8', '#ea580c'),
  P('anggur', 'Anggur', 'light', '#faf5ff', '#ffffff', '#2a1043', '#75608a', '#e6d9f2', '#7e22ce'),
  P('maroon', 'Maroon', 'light', '#fef2f2', '#ffffff', '#2d0a0a', '#7f5a5a', '#f1d4d4', '#b91c1c'),
  P('kertas', 'Kertas (sepia)', 'light', '#f6f1e7', '#fffdf8', '#3b3024', '#8a7a66', '#e4d9c4', '#92400e'),
  P('abu', 'Abu Netral', 'light', '#f4f4f5', '#ffffff', '#18181b', '#71717a', '#e4e4e7', '#3f3f46'),
  P('midnight', 'Midnight', 'dark', '#0b1220', '#131c2e', '#e2e8f0', '#94a3b8', '#243049', '#3b82f6'),
  P('amoled', 'Hitam Pekat (AMOLED)', 'dark', '#000000', '#0c0c0e', '#f4f4f5', '#9ca3af', '#27272a', '#38bdf8'),
  P('rimba', 'Rimba Malam', 'dark', '#07140d', '#0f2218', '#dcfce7', '#86a595', '#1d3a2a', '#22c55e'),
  P('bara', 'Bara', 'dark', '#140c07', '#21140c', '#fde9d8', '#b69a85', '#3a2616', '#f97316'),
  P('ungu', 'Ungu Malam', 'dark', '#100a1c', '#1a1230', '#ede9fe', '#a79bc4', '#2e2250', '#a78bfa'),
  P('grafit', 'Grafit', 'dark', '#18181b', '#232328', '#f4f4f5', '#a1a1aa', '#34343a', '#2dd4bf'),
]

export const COLOR_FIELDS: { k: keyof Colors; label: string }[] = [
  { k: 'bg', label: 'Latar halaman' }, { k: 'card', label: 'Kartu / panel' }, { k: 'text', label: 'Teks' },
  { k: 'muted', label: 'Teks redup' }, { k: 'line', label: 'Garis / batas' }, { k: 'pri', label: 'Warna utama' },
]

const KEYS = ['--bg', '--card', '--text', '--muted', '--line', '--pri', '--pri-t'] as const

/** Mode tampilan yang berlaku: preset non-bawaan menentukan modenya sendiri. */
export function effectiveMode(s: Pick<Settings, 'theme' | 'palette'>): 'light' | 'dark' {
  const pr = PRESETS.find((p) => p.id === s.palette?.preset)
  if (pr) return pr.mode
  return s.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.theme
}

const lum = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255)
}

/** Warna akhir: preset, lalu kustom pengguna; warna utama bawaan mengikuti "Warna utama" di Branding. */
export function resolveColors(s: Pick<Settings, 'palette' | 'accentColor'>): Partial<Colors> {
  const pr = PRESETS.find((p) => p.id === s.palette?.preset)
  const out: Partial<Colors> = { ...(pr?.c || {}), ...(s.palette?.custom || {}) }
  if (!out.pri) out.pri = s.accentColor || '#1d4ed8'
  return out
}

export function applyPalette(s: Pick<Settings, 'theme' | 'palette' | 'accentColor'>) {
  const root = document.documentElement
  root.dataset.theme = effectiveMode(s)
  const c = resolveColors(s)
  for (const k of KEYS) root.style.removeProperty(k)
  for (const [k, v] of Object.entries(c)) if (v) root.style.setProperty('--' + k, v)
  if (c.pri) root.style.setProperty('--pri-t', lum(c.pri) > 0.4 ? '#0b1220' : '#ffffff')
}
