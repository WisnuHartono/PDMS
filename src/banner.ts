import type { CSSProperties } from 'react'
import type { BannerSettings, BannerTheme, Project } from './types'

export const defaultBanner = (): BannerSettings => ({
  client: { show: true, pos: 'left', size: 48 },
  contractor: { show: true, pos: 'left', size: 48 },
  bg: 'white',
})

export const bannerOf = (p: Project): BannerSettings => {
  const d = defaultBanner()
  return { ...d, ...p.banner, client: { ...d.client, ...p.banner?.client }, contractor: { ...d.contractor, ...p.banner?.contractor } }
}

export const THEME_PRESETS: { id: string; name: string; c1: string; c2: string; dark?: boolean }[] = [
  { id: 'ocean', name: 'Samudra', c1: '#1d4ed8', c2: '#0f172a' },
  { id: 'sky', name: 'Langit', c1: '#0ea5e9', c2: '#1e3a8a' },
  { id: 'emerald', name: 'Zamrud', c1: '#059669', c2: '#064e3b' },
  { id: 'forest', name: 'Hutan', c1: '#16a34a', c2: '#14291b' },
  { id: 'sunset', name: 'Senja', c1: '#f97316', c2: '#9f1239' },
  { id: 'flame', name: 'Api', c1: '#ef4444', c2: '#7c2d12' },
  { id: 'rose', name: 'Mawar', c1: '#e11d48', c2: '#4c0519' },
  { id: 'purple', name: 'Ungu', c1: '#7c3aed', c2: '#2e1065' },
  { id: 'grape', name: 'Anggur', c1: '#c026d3', c2: '#3b0764' },
  { id: 'teal', name: 'Toska', c1: '#0d9488', c2: '#134e4a' },
  { id: 'gold', name: 'Emas', c1: '#d97706', c2: '#451a03' },
  { id: 'steel', name: 'Baja', c1: '#475569', c2: '#0f172a' },
  { id: 'graphite', name: 'Grafit', c1: '#27272a', c2: '#000000' },
  { id: 'mint', name: 'Mint', c1: '#a7f3d0', c2: '#67e8f9', dark: true },
  { id: 'sand', name: 'Pasir', c1: '#fde68a', c2: '#fdba74', dark: true },
  { id: 'cloud', name: 'Awan', c1: '#e2e8f0', c2: '#bfdbfe', dark: true },
]

export const PATTERNS: { id: NonNullable<BannerTheme['pattern']>; name: string }[] = [
  { id: 'none', name: 'Polos' }, { id: 'dots', name: 'Titik' }, { id: 'grid', name: 'Kisi' },
  { id: 'diagonal', name: 'Diagonal' }, { id: 'waves', name: 'Gelombang' }, { id: 'circles', name: 'Lingkaran' },
]

const patternCss = (p: string, dark: boolean): string | undefined => {
  const c = dark ? '0,0,0' : '255,255,255'
  switch (p) {
    case 'dots': return `radial-gradient(rgba(${c},.22) 1.5px, transparent 1.6px) 0 0/16px 16px`
    case 'grid': return `linear-gradient(rgba(${c},.12) 1px, transparent 1px) 0 0/22px 22px, linear-gradient(90deg, rgba(${c},.12) 1px, transparent 1px) 0 0/22px 22px`
    case 'diagonal': return `repeating-linear-gradient(45deg, rgba(${c},.10) 0 2px, transparent 2px 14px)`
    case 'waves': return `radial-gradient(circle at 50% 120%, transparent 38%, rgba(${c},.14) 39% 41%, transparent 42%) 0 0/60px 30px`
    case 'circles': return `radial-gradient(circle at 85% 20%, rgba(${c},.14) 0 90px, transparent 91px), radial-gradient(circle at 95% 90%, rgba(${c},.10) 0 140px, transparent 141px)`
  }
}

// Gaya latar banner (dipakai Dashboard dan kartu proyek).
export function bannerStyle(p: Project): { style: CSSProperties; dark: boolean } {
  const th: BannerTheme = p.banner?.theme ?? { preset: 'auto' }
  const auto = p.color || '#1d4ed8'
  let c1 = auto, c2 = '#0f172a', dark = false
  const pr = THEME_PRESETS.find((x) => x.id === th.preset)
  if (pr) { c1 = pr.c1; c2 = pr.c2; dark = !!pr.dark }
  else if (th.preset === 'custom') { c1 = th.c1 || auto; c2 = th.c2 || c1 }
  if (th.text) dark = th.text === 'dark'
  const layers: string[] = []
  const pat = patternCss(th.pattern || 'none', dark)
  if (pat) layers.push(pat)
  const a = th.angle ?? 135
  const base = th.preset === 'auto' ? `linear-gradient(${a}deg, ${c1}, ${c1}cc 55%, #0f172a)` : `linear-gradient(${a}deg, ${c1}, ${c2})`
  if (th.image) {
    const dim = (th.dim ?? 35) / 100
    const op = Math.min(100, Math.max(10, th.imgOpacity ?? 100))
    const scrim = (th.scrim ?? 0) / 100
    if (scrim > 0) layers.push(`linear-gradient(100deg, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,${(scrim * 0.55).toFixed(2)}) 55%, rgba(0,0,0,${(scrim * 0.2).toFixed(2)}) 100%)`, `linear-gradient(0deg, rgba(0,0,0,${(scrim * 0.7).toFixed(2)}) 0%, transparent 60%)`)
    layers.push(`linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim}))`)
    if (op < 100) { const t = 100 - op; layers.push(`linear-gradient(${a}deg, color-mix(in srgb, ${c1} ${t}%, transparent), color-mix(in srgb, ${th.preset === 'auto' ? '#0f172a' : c2} ${t}%, transparent))`) }
    layers.push(`url("${th.image}") center/cover no-repeat`)
  } else {
    layers.push(base)
  }
  return { style: { background: layers.join(', '), color: dark && !th.image ? '#0f172a' : '#fff', ...(th.image ? { textShadow: '0 1px 3px rgba(0,0,0,.6), 0 0 12px rgba(0,0,0,.35)' } : {}) }, dark: dark && !th.image }
}
