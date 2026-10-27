import { useEffect, useRef, useState, useSyncExternalStore, Component, type ReactNode } from 'react'
import { generatePassword, passwordIssues, strength, type PwContext } from './auth'
import { useApp } from './store'
import { applyFont } from './fonts'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div>
        <div className="top">
          <h2>{title}</h2>
          <button className="sec sm" onClick={onClose}>Tutup</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function StatusBadge({ code }: { code: string }) {
  const { state } = useApp()
  const d = state.settings.statuses.find((s) => s.code === code)
  return (
    <span className="badge" style={{ background: d?.color || '#64748b' }} title={d?.label}>
      {code}
    </span>
  )
}

// ---------- Router internal (tahan terhadap lingkungan iframe/sandbox) ----------
let route = (() => { try { return location.hash.slice(1) || '/' } catch { return '/' } })()
const routeListeners = new Set<() => void>()
const setRoute = (p: string) => { route = p || '/'; routeListeners.forEach((l) => l()); window.scrollTo?.(0, 0) }
try { window.addEventListener('hashchange', () => setRoute(location.hash.slice(1) || '/')) } catch { /* ignore */ }
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest?.('a[href^="#/"]') as HTMLAnchorElement | null
  if (a) { e.preventDefault(); go(a.getAttribute('href')!.slice(1)) }
})

export function useHash() {
  return useSyncExternalStore((l) => (routeListeners.add(l), () => routeListeners.delete(l)), () => route)
}

export const go = (p: string) => {
  setRoute(p)
  try { history.replaceState(null, '', '#' + p) } catch { /* sandbox */ }
}

// ---------- Dialog pengganti alert/confirm (alert/confirm diblokir di banyak pratinjau) ----------
interface Dlg { msg: string; confirm: boolean; resolve: (v: boolean) => void }
let dlg: Dlg | null = null
const dlgListeners = new Set<() => void>()
const showDlg = (d: Dlg | null) => { dlg = d; dlgListeners.forEach((l) => l()) }
export const ask = (msg: string) => new Promise<boolean>((resolve) => showDlg({ msg, confirm: true, resolve }))
export const notify = (msg: string) => new Promise<boolean>((resolve) => showDlg({ msg, confirm: false, resolve }))

export function DialogHost() {
  const d = useSyncExternalStore((l) => (dlgListeners.add(l), () => dlgListeners.delete(l)), () => dlg)
  if (!d) return null
  const close = (v: boolean) => { showDlg(null); d.resolve(v) }
  return (
    <div className="modal" style={{ zIndex: 50 }}>
      <div style={{ width: 'min(420px,100%)' }}>
        <p style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>{d.msg}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {d.confirm && <button className="auto sec" onClick={() => close(false)}>Batal</button>}
          <button className="auto" autoFocus onClick={() => close(true)}>{d.confirm ? 'Ya, lanjutkan' : 'OK'}</button>
        </div>
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state: { err?: Error } = {}
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="card" style={{ margin: 20 }}>
        <h2>Terjadi kesalahan</h2>
        <p className="err">{this.state.err.message}</p>
        <button onClick={() => { this.setState({ err: undefined }); go('/') }}>Kembali ke Dashboard</button>
      </div>
    )
  }
}

export function Logo({ src, label, h = 36 }: { src?: string; label?: string; h?: number }) {
  if (!src) return null
  return <img src={src} alt={label} title={label} style={{ height: h, maxWidth: h * 3, objectFit: 'contain' }} />
}

const knockCache = new Map<string, string>()
// Hilangkan warna putih/hampir putih pada gambar logo (menjadi transparan).
export function useClearWhite(src: string | undefined, on: boolean | undefined) {
  const [out, setOut] = useState<string | undefined>(src && on ? knockCache.get(src) : src)
  useEffect(() => {
    if (!src || !on) { setOut(src); return }
    const hit = knockCache.get(src)
    if (hit) { setOut(hit); return }
    let dead = false
    const im = new Image()
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = im.naturalWidth || 1; c.height = im.naturalHeight || 1
        const x = c.getContext('2d')!; x.drawImage(im, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height), p = d.data
        for (let i = 0; i < p.length; i += 4) {
          const m = Math.min(p[i], p[i + 1], p[i + 2])
          if (m >= 245) p[i + 3] = 0
          else if (m > 215) p[i + 3] = Math.round(p[i + 3] * (245 - m) / 30)
        }
        x.putImageData(d, 0, 0)
        const r = c.toDataURL('image/png'); knockCache.set(src, r); if (!dead) setOut(r)
      } catch { if (!dead) setOut(src) }
    }
    im.onerror = () => { if (!dead) setOut(src) }
    im.src = src
    return () => { dead = true }
  }, [src, on])
  return out
}

export type LogoFx = { shadow?: number; sharp?: number; halo?: boolean }
// Efek agar logo lebih jelas: ketajaman (kontras), garis tepi putih, dan bayangan (drop-shadow mengikuti bentuk logo transparan).
export const logoFilter = (fx: LogoFx) => {
  const f: string[] = []
  const sharp = (fx.sharp ?? 0) / 100
  if (sharp > 0) f.push(`contrast(${(1 + sharp * 0.5).toFixed(2)}) saturate(${(1 + sharp * 0.6).toFixed(2)})`)
  if (fx.halo) f.push('drop-shadow(0 0 1px #fff)', 'drop-shadow(0 0 1px #fff)')
  const sh = (fx.shadow ?? 0) / 100
  if (sh > 0) f.push(`drop-shadow(0 ${(1 + sh * 3).toFixed(1)}px ${(2 + sh * 9).toFixed(1)}px rgba(0,0,0,${(0.25 + sh * 0.6).toFixed(2)}))`)
  return f.length ? f.join(' ') : undefined
}

export function BannerImg({ src, label, h, clearWhite, fx }: { src?: string; label?: string; h: number; clearWhite?: boolean; fx?: LogoFx }) {
  const s = useClearWhite(src, clearWhite)
  if (!s) return null
  return <img src={s} alt={label} title={label} style={{ height: h, maxWidth: h * 3, objectFit: 'contain', filter: fx ? logoFilter(fx) : undefined }} />
}

// Isian PIC: saran dari daftar PIC proyek (sesuai disiplin dokumen), lalu pengguna dan PIC yang pernah dipakai.
export function PicInput({ label, value, onChange, projectId, discipline, placeholder }: { label: string; value: string; onChange: (v: string) => void; projectId?: string; discipline?: string; placeholder?: string }) {
  const { state } = useApp()
  const proj = state.projects.find((p) => p.id === projectId)
  const list = (proj?.picList || []).filter((x) => x.active && (!discipline || x.disciplines.length === 0 || x.disciplines.includes(discipline)))
  const opts: { v: string; l?: string }[] = list.map((x) => ({ v: x.name, l: [x.position, x.func].filter(Boolean).join(' · ') }))
  if (!(proj?.picList || []).length) {
    const names = [...new Set([
      ...state.users.filter((u) => u.active).map((u) => u.name),
      ...state.documents.filter((d) => !projectId || d.projectId === projectId).flatMap((d) => d.revisions.map((r) => r.pic || '')),
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b))
    names.forEach((n) => opts.push({ v: n }))
  }
  const id = 'pic-' + label.replace(/\W/g, '')
  const cur = list.find((x) => x.name === value)
  return (
    <label>{label}
      <input list={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <datalist id={id}>{opts.map((o) => <option key={o.v} value={o.v} label={o.l} />)}</datalist>
      {cur ? <span className="muted" style={{ fontSize: 12 }}>{[cur.position, cur.func, cur.company].filter(Boolean).join(' · ')}</span>
        : (proj?.picList || []).length > 0 && <span className="muted" style={{ fontSize: 12 }}>{list.length} PIC tersedia{discipline ? ` untuk disiplin ${discipline}` : ''} (daftar PIC proyek)</span>}
    </label>
  )
}

// Kotak pilih file: kotak kosong bertulisan (mis. "Pilih logo"). Bisa diklik di mana pun (di dalam label maupun tidak),
// dioperasikan dengan keyboard (Enter/Spasi), dan menerima file yang diseret ke dalamnya.
export function PickBox({ text, accept, onFile, name, width, preview }: { text: string; accept?: string; onFile: (f: File) => void; name?: string; width?: number | string; preview?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const okType = (f: File) => !accept || accept.split(',').some((a) => { a = a.trim(); return a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : a.startsWith('.') ? f.name.toLowerCase().endsWith(a.toLowerCase()) : f.type === a })
  const open = () => ref.current?.click()
  return (
    <span
      className={'pickbox' + (over ? ' over' : '')} style={{ width }} role="button" tabIndex={0}
      onClick={(e) => { if (e.target === ref.current) return; e.preventDefault(); e.stopPropagation(); open() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (!f) return
        if (!okType(f)) return notify('Jenis file tidak sesuai' + (accept ? ` (diharapkan: ${accept})` : '') + '.')
        onFile(f)
      }}
    >
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      {preview && <img className="pb-img" src={preview} alt="" />}
      <span className={preview ? 'pb-cap' : undefined}>{name ? '📎 ' + name : preview ? '↻ ' + text : text}</span>
    </span>
  )
}

export function Avatar({ name, photo, size = 36 }: { name: string; photo?: string; size?: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || '?'
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const st = { width: size, height: size, borderRadius: '50%', flex: '0 0 auto' } as const
  return photo ? (
    <img className="auto" src={photo} alt={name} style={{ ...st, objectFit: 'cover' }} />
  ) : (
    <span className="auto" style={{ ...st, background: `hsl(${hue} 55% 45%)`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.4 }}>
      {ini}
    </span>
  )
}

export function PwField({ label, ...rest }: { label: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false)
  return (
    <label>{label}
      <span className="pwf">
        <input {...rest} type={show ? 'text' : 'password'} />
        <button type="button" className="pwf-eye" title={show ? 'Sembunyikan sandi' : 'Lihat sandi'} aria-label={show ? 'Sembunyikan sandi' : 'Lihat sandi'} onClick={() => setShow(!show)}>{show ? '🙈' : '👁'}</button>
      </span>
    </label>
  )
}

export function PasswordInput({ value, onChange, ctx, minLen = 12, generate, label = 'Kata sandi', autoComplete = 'new-password' }: {
  value: string; onChange: (v: string) => void; ctx?: PwContext; minLen?: number; generate?: boolean; label?: string; autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  const st = strength(value)
  const issues = passwordIssues(value, ctx, minLen)
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ marginBottom: 4 }}>{label}
        <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
          <input type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="auto sec sm" onClick={() => setShow(!show)}>{show ? 'Sembunyi' : 'Lihat'}</button>
          {generate && <button type="button" className="auto sec sm" onClick={() => { onChange(generatePassword()); setShow(true) }}>Buat acak</button>}
        </div>
      </label>
      <div className="bar" style={{ height: 6 }}>{[1, 2, 3, 4].map((i) => <i key={i} style={{ width: '25%', background: i <= st.score ? st.color : 'transparent', borderRight: '2px solid var(--card)' }} />)}</div>
      <div style={{ fontSize: 12, color: st.color === '#e2e8f0' ? 'var(--muted)' : st.color, marginTop: 2 }}>{value ? `Kekuatan: ${st.label}` : `Minimal ${minLen} karakter: huruf besar, huruf kecil, angka, dan simbol`}</div>
      {value && issues.length > 0 && <ul className="err" style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12 }}>{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
    </div>
  )
}

export function Brand({ size = 22 }: { size?: number }) {
  const { state } = useApp()
  const s = state.settings
  return (
    <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: size }}>
      {s.appLogo ? <img src={s.appLogo} alt="" style={{ height: size * 1.6, maxWidth: size * 4, objectFit: 'contain' }} /> : <span>📁</span>}
      <span style={{ lineHeight: 1.1 }}>
        {s.appName || 'DocControl'}
        {s.appTagline && <div className="muted" style={{ fontSize: Math.max(10, size * 0.5), fontWeight: 400 }}>{s.appTagline}</div>}
      </span>
    </div>
  )
}

/** Menerapkan nama, warna aksen, dan ikon aplikasi dari Pengaturan ke halaman. */
import { applyPalette } from './themes'
export function BrandEffects() {
  const { state } = useApp()
  const { appName, appTagline, appLogo, accentColor, font, theme, palette } = state.settings
  useEffect(() => applyFont(font), [font])
  useEffect(() => applyPalette({ theme, palette, accentColor }), [theme, palette, accentColor])
  useEffect(() => {
    document.title = (appName || 'DocControl') + (appTagline ? ' - ' + appTagline : '')
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
    if (appLogo) link.href = appLogo
  }, [appName, appTagline, appLogo, accentColor])
  return null
}

// Kartu pengaturan yang bisa dibuka/ditutup. Status diingat per kartu di perangkat ini; tutup semua jika belum pernah dibuka.
const FOLD_EVT = 'dc-fold-all'
const foldKey = (id: string) => 'dc.set.' + id
const readFold = (id: string) => { try { return localStorage.getItem(foldKey(id)) === '1' } catch { return false } }
export function Collapse({ id, title, cls, children }: { id: string; title: string; cls?: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => readFold(id))
  useEffect(() => {
    const h = (e: Event) => { const v = (e as CustomEvent<boolean>).detail; setOpen(v); try { localStorage.setItem(foldKey(id), v ? '1' : '0') } catch { /* abaikan */ } }
    const o = (e: Event) => { if ((e as CustomEvent<string>).detail === id) setOpen(true) }
    window.addEventListener(FOLD_EVT, h)
    window.addEventListener('dc-open-card', o)
    return () => { window.removeEventListener(FOLD_EVT, h); window.removeEventListener('dc-open-card', o) }
  }, [id])
  const toggle = () => { const v = !open; setOpen(v); try { localStorage.setItem(foldKey(id), v ? '1' : '0') } catch { /* abaikan */ } }
  return (
    <div id={'card-' + id} className={'card coll ' + (cls || '') + (open ? ' open' : '')}>
      <button type="button" className="coll-h" aria-expanded={open} onClick={toggle}><span className="coll-ch">▸</span><h2>{title}</h2></button>
      {open && <div className="coll-b">{children}</div>}
    </div>
  )
}
export function CollapseAll() {
  const fire = (v: boolean) => window.dispatchEvent(new CustomEvent(FOLD_EVT, { detail: v }))
  return (
    <span className="seg" style={{ marginLeft: 'auto' }}>
      <button type="button" onClick={() => fire(true)}>Buka semua</button>
      <button type="button" onClick={() => fire(false)}>Tutup semua</button>
    </span>
  )
}
