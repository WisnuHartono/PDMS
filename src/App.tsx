import { useEffect, useState, type CSSProperties } from 'react'
import { DEFAULT_SIDELOGO, DEFAULT_SIDETEXT, type TextStyleCfg } from './types'
import { stackOf } from './fonts'
import { actions, useApp, useAuth } from './store'
import { useHash, Avatar, Brand } from './ui'
import Login from './Login'
import Profile, { ForcePasswordChange } from './Profile'
import Users from './Users'
import Files from './Files'
import Dashboard from './Dashboard'
import Projects from './Projects'
import Documents from './Documents'
import DocDetail from './DocDetail'
import Transmittals from './Transmittals'
import Logs from './Logs'
import Settings from './Settings'
import { sideStyleOf, sideBackground, sideTone } from './sidestyle'
import { SideArt } from './SideArt'

const NAV: [string, string, string, string?][] = [
  ['/projects', 'Proyek', 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  ['/', 'Dashboard', 'M4 13h6V4H4zm10 7h6V4h-6zM4 20h6v-5H4z'],
  ['/documents', 'Register Dokumen', 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6'],
  ['/files', 'Berkas', 'M4 4h16v6H4zm0 10h16v6H4zM8 7h.01M8 17h.01'],
  ['/transmittals', 'Transmittal', 'M4 12l16-8-6 16-3-7z'],
  ['/logs', 'Log Aktivitas', 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4', 'logs.view'],
]
const Ico = ({ d }: { d: string }) => <svg className="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
const rd = () => { try { return localStorage.getItem('dc.side') === '1' } catch { return false } }

// Menu administrasi (ikon gear di samping kartu akun)
const ADMIN: [string, string, string][] = [
  ['/users', '👥 Pengguna', 'users.manage'],
  ['/settings', '⚙ Pengaturan', 'settings.manage'],
]
export default function App() {
  const { state, session } = useApp()
  const { user, role, can, projects, needsSetup } = useAuth()
  const hash = useHash()
  const [open, setOpen] = useState(false)
  const [min, setMin] = useState(rd)
  const isAdmin = user?.roleId === 'admin'
  const stx = { name: { ...DEFAULT_SIDETEXT.name, ...state.settings.sideText?.name }, tagline: { ...DEFAULT_SIDETEXT.tagline, ...state.settings.sideText?.tagline } }
  const txt = (c: TextStyleCfg): CSSProperties => ({
    fontFamily: stackOf(c.font, c.custom), fontSize: c.size, fontWeight: c.weight, fontStyle: c.italic ? 'italic' : 'normal',
    textTransform: c.upper ? 'uppercase' : 'none', letterSpacing: c.spacing + 'px', ...(c.color ? { color: c.color } : {}),
  })
  const sl = { ...DEFAULT_SIDELOGO, ...state.settings.sideLogo }
  const slBg = sl.bg === 'none' ? 'transparent'
    : sl.bg === 'color' ? `color-mix(in srgb, ${sl.bgColor || '#ffffff'} ${sl.bgOpacity}%, transparent)`
    : `rgba(255,255,255,${((sl.bg === 'glass' ? Math.min(sl.bgOpacity, 25) : sl.bgOpacity) / 100).toFixed(2)})`
  const slStyle = {
    '--sl': sl.size + 'px', background: slBg, borderRadius: sl.radius + '%',
    boxShadow: sl.shadow ? `0 ${Math.round(sl.shadow / 12)}px ${Math.round(4 + sl.shadow / 5)}px rgba(0,0,0,${(sl.shadow / 140).toFixed(2)})` : 'none',
    border: sl.border && sl.bg !== 'none' ? '2px solid rgba(255,255,255,.55)' : '0',
    backdropFilter: sl.bg === 'glass' ? 'blur(6px)' : undefined,
  } as CSSProperties
  const sx = sideStyleOf(state.settings)
  const sbg = sideBackground(sx)
  const tone = sideTone(sx)
  const openBranding = () => {
    try { localStorage.setItem('dc.set.identitas-aplikasi-branding', '1') } catch { /* abaikan */ }
    window.dispatchEvent(new CustomEvent('dc-open-card', { detail: 'identitas-aplikasi-branding' }))
    setOpen(false)
    setTimeout(() => document.getElementById('card-identitas-aplikasi-branding')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
  }
  const toggleMin = () => { setMin(!min); try { localStorage.setItem('dc.side', min ? '0' : '1') } catch { /* abaikan */ } }
  const [gear, setGear] = useState(false)

  // Logout otomatis bila tidak ada aktivitas melebihi batas waktu sesi
  useEffect(() => {
    if (!user) return
    const mins = state.settings.sessionTimeoutMin
    let last = Date.now()
    const bump = () => { last = Date.now() }
    const ev = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    ev.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const iv = setInterval(() => {
      if (mins > 0 && Date.now() - last > mins * 60000) actions.logout()
      else actions.touch()
    }, 15000)
    return () => { ev.forEach((e) => window.removeEventListener(e, bump)); clearInterval(iv) }
  }, [user?.id, state.settings.sessionTimeoutMin])

  useEffect(() => { setOpen(false); setGear(false) }, [hash])
  useEffect(() => {
    if (!gear) return
    const off = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.gear-wrap')) setGear(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setGear(false) }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [gear])

  if (!user) return <Login setup={needsSetup} />

  let page
  if (hash.startsWith('/doc/')) page = <DocDetail id={hash.slice(5)} />
  else if (hash === '/documents') page = <Documents />
  else if (hash === '/transmittals') page = <Transmittals />
  else if (hash === '/files') page = <Files />
  else if (hash === '/projects') page = <Projects />
  else if (hash === '/logs') page = can('logs.view') ? <Logs /> : <div className="card">Anda tidak memiliki izin untuk melihat log.</div>
  else if (hash === '/settings') page = can('settings.manage') ? <Settings /> : <div className="card">Anda tidak memiliki izin untuk membuka Pengaturan.</div>
  else if (hash === '/users') page = <Users />
  else if (hash === '/profile') page = <Profile />
  else page = <Dashboard />

  const adminItems = ADMIN.filter(([, , perm]) => can(perm as any))
  return (
    <div className="app">
      {open && <div className="side-bd" onClick={() => setOpen(false)} />}
      <aside className={'side' + (open ? ' open' : '') + (min ? ' min' : '') + (sbg ? ' sx' : '') + (tone ? ' t-' + tone[0] : '')} style={sbg ? { background: sbg } : undefined}>
        <SideArt sx={sx} />
        <div className="side-top">
          <a href={isAdmin ? '#/settings' : '#/'} className={'sbrand' + (sl.size > 64 || stx.name.size >= 26 ? ' stack' : '')} title={isAdmin ? 'Ubah logo & identitas aplikasi' : state.settings.appName || 'DocControl'} onClick={isAdmin ? openBranding : undefined}>
            <span className="sb-logo" style={slStyle}>{state.settings.appLogo ? <img src={state.settings.appLogo} alt="" style={{ opacity: sl.opacity / 100, filter: `brightness(${sl.bright}%) contrast(${sl.contrast}%)${sl.glow ? ` drop-shadow(0 0 ${Math.round(sl.glow / 8)}px rgba(255,255,255,${(0.35 + sl.glow / 160).toFixed(2)}))` : ''}` }} /> : '📁'}</span>
            <span className="sb-txt"><b style={txt(stx.name)}>{state.settings.appName || 'DocControl'}</b>{state.settings.appTagline && <small style={txt(stx.tagline)}>{state.settings.appTagline}</small>}</span>
          </a>
          <button type="button" className="side-tg" title={min ? 'Perluas menu' : 'Ciutkan menu'} aria-label={min ? 'Perluas menu' : 'Ciutkan menu'} onClick={toggleMin}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: min ? 'rotate(180deg)' : 'none' }}><path d="M15 6l-6 6 6 6" /></svg>
          </button>
        </div>
        <nav className="nav">
          {NAV.filter(([, , , perm]) => !perm || can(perm as any)).map(([p, l, d]) => <a key={p} href={'#' + p} title={min ? l : undefined} className={hash === p ? 'on' : ''} onClick={() => setOpen(false)}><Ico d={d} /><span className="nl">{l}</span></a>)}
        </nav>
        <div className="side-bottom">
        <div className="acct-row">
          <a href="#/profile" title="Profil saya" className="row acct" style={{ flexWrap: 'nowrap', gap: 8, flex: 1, minWidth: 0 }}>
            <Avatar name={user.name} photo={user.photo} size={38} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{role?.name}</div>
            </div>
          </a>
          {adminItems.length > 0 && (
            <div className="gear-wrap">
              <button type="button" className={'gear-btn' + (gear || adminItems.some(([p]) => p === hash) ? ' on' : '')} title="Pengguna & Pengaturan" aria-label="Pengguna & Pengaturan" aria-expanded={gear} onClick={() => setGear(!gear)}>⚙</button>
              {gear && (
                <div className="gear-menu" role="menu">
                  {adminItems.map(([p, l]) => <a key={p} role="menuitem" href={'#' + p} className={hash === p ? 'on' : ''}>{l}</a>)}
                </div>
              )}
            </div>
          )}
        </div>
          <button className="sec sm out" title="Keluar" onClick={() => actions.logout()}><svg className="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" /></svg><span className="nl">Keluar</span></button>
        </div>
        <div className="muted side-foot" style={{ marginTop: 14, fontSize: 12 }}>
          {session.user ? <>☁ {session.user.email}{session.syncing && ' · menyinkronkan...'}</> : <>Mode lokal · <a href="#/settings">hubungkan Google Drive</a></>}
          {session.error && <div className="err">{session.error}</div>}
          {state.settings.footerText && <div style={{ marginTop: 8 }}>{state.settings.footerText}</div>}
        </div>
      </aside>
      <main className="main">
        <button className="menu-btn sec" style={{ marginBottom: 10 }} onClick={() => setOpen(!open)}>☰ Menu</button>
        {page}
        {user.mustChange && <ForcePasswordChange />}
      </main>
    </div>
  )
}
