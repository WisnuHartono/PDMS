import { NUM_PRESETS, NUM_TOKENS, buildNumber, numberingOf } from './numbering'
import { Fragment, useRef, useState } from 'react'
import { actions, useApp, useAuth } from './store'
import { downloadBlob, fmtDate, fileToLogo } from './util'
import { ask, notify, Brand, PickBox, Collapse, CollapseAll } from './ui'
import { StorageSettings } from './StorageUI'
import { SideArt } from './SideArt'
import { sideStyleOf, sideBackground, sideTone, PATTERNS, ARTS, QUICK_STYLES } from './sidestyle'
import { THEME_PRESETS } from './banner'
import { DEFAULT_SIDESTYLE, type SideStyle } from './types'
import { DEFAULT_SIDELOGO, DEFAULT_SIDETEXT, type SideLogo, type StatusDef, type TextStyleCfg } from './types'

const SSlide = ({ label, v, min, max, unit, on, step }: { label: string; v: number; min: number; max: number; unit: string; on: (v: number) => void; step?: number }) => (
  <label className="sx-s"><span>{label}</span><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)} /><em>{v}{unit}</em></label>
)
const Slide = ({ label, v, min, max, unit, on, step }: { label: string; v: number; min: number; max: number; unit: string; on: (v: number) => void; step?: number }) => (
  <label>{label} <span className="muted">{v}{unit}</span><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)} /></label>
)
import { recoveryOf } from './recovery'
import { PRESETS, COLOR_FIELDS, resolveColors, type Preset } from './themes'
import { FONT_OPTIONS, WEIGHTS, defaultFont, fontOf } from './fonts'
import { DEFAULT_EMAIL_TEMPLATE } from './transmittalDoc'

function ListTable({ title, items, onChange, codeKey, hint }: { title: string; items: string[]; onChange: (v: string[]) => void; codeKey: 'disciplineCodes' | 'categoryCodes'; hint: string }) {
  const { state } = useApp()
  const st = state.settings
  const n = numberingOf(st)
  const codes = n[codeKey]
  const [v, setV] = useState('')
  const [c, setC] = useState('')
  const setCode = (name: string, code: string) => actions.updateSettings({ numbering: { ...n, [codeKey]: { ...codes, [name]: code.trim().toUpperCase() } } })
  const add = () => {
    const name = v.trim()
    if (!name || items.includes(name)) return
    actions.updateSettings({ [title.startsWith('Disiplin') ? 'disciplines' : 'categories']: [...items, name], numbering: { ...n, [codeKey]: { ...codes, ...(c.trim() ? { [name]: c.trim().toUpperCase() } : {}) } } } as any)
    setV(''); setC('')
  }
  return (
    <Collapse id={title} title={title} cls="ltab">
      <div className="lc-head"><span className="muted">{items.length} item · kode untuk penomoran (kosong = auto)</span></div>
      <div className="lc-grid">
        {items.map((it, i) => (
          <div key={it} className={'lc' + (codes[it] ? ' has' : '')}>
            <span className="lc-n">{i + 1}</span>
            <span className="lc-name" title={it}>{it}</span>
            <label className="lc-code" title={hint}><input value={codes[it] ?? ''} placeholder="auto" onChange={(e) => setCode(it, e.target.value)} /></label>
            <button type="button" className="lc-x" title={`Hapus ${it}`} aria-label={`Hapus ${it}`} onClick={() => onChange(items.filter((x) => x !== it))}>✕</button>
          </div>
        ))}
        <div className="lc lc-add">
          <span className="lc-n">＋</span>
          <input className="lc-new" value={v} onChange={(e) => setV(e.target.value)} placeholder="Tambah baru…" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <label className="lc-code"><input value={c} onChange={(e) => setC(e.target.value.toUpperCase())} placeholder="kode" onKeyDown={(e) => e.key === 'Enter' && add()} /></label>
          <button type="button" className="lc-ok" disabled={!v.trim() || items.includes(v.trim())} title="Tambah" onClick={add}>Tambah</button>
        </div>
      </div>
    </Collapse>
  )
}

export default function Settings() {
  const { state, session } = useApp()
  const { user } = useAuth()
  const isAdmin = user?.roleId === 'admin'
  const s = state.settings
  const sl = { ...DEFAULT_SIDELOGO, ...s.sideLogo }
  const setSl = (p: Partial<SideLogo>) => actions.updateSettings({ sideLogo: { ...sl, ...p } })
  const ss = sideStyleOf(s)
  const setSs = (p: Partial<SideStyle>) => actions.updateSettings({ sideStyle: { ...s.sideStyle, ...p } })
  const pickSideImg = async (file?: File) => { if (!file) return; try { setSs({ image: await fileToLogo(file, 700) }) } catch (e: any) { notify(e.message) } }
  const SidePrev = ({ st, h = 92 }: { st: SideStyle; h?: number }) => {
    const f = sideStyleOf({ sideStyle: st }); const bg = sideBackground(f); const tn = sideTone(f)
    return <span className={'sx-prev' + (tn === 'dark' ? ' pt-d' : '')} style={{ ...(bg ? { background: bg } : {}), height: h }}><SideArt sx={f} scale={0.55} /><i style={{ top: 12, width: '55%', background: 'currentColor', color: tn === 'dark' ? '#fff' : 'var(--pri)' }} /><i style={{ top: 26, color: tn === 'dark' ? '#fff' : 'var(--text)', opacity: .35 }} /><i style={{ top: 38, color: tn === 'dark' ? '#fff' : 'var(--text)', opacity: .35 }} /></span>
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const setStatus = (i: number, p: Partial<StatusDef>) => actions.updateSettings({ statuses: s.statuses.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const pal = s.palette || { preset: 'default' }
  const preset = PRESETS.find((p) => p.id === pal.preset)
  const eff = resolveColors(s)
  const setPal = (p: Partial<NonNullable<typeof s.palette>>) => actions.updateSettings({ palette: { ...pal, ...p } })

  return (
    <>
      <div className="top"><h1>Pengaturan</h1><CollapseAll /></div>

      <Collapse id="akun-google-penyimpanan-cloud" title="Akun Google & Penyimpanan Cloud" cls="gcard">
        <p className="muted" style={{ margin: '0 0 8px' }}>Satu akun Google untuk semua proyek. Data disimpan di folder <b>DocControl</b> pada Google Drive (hanya file buatan aplikasi ini yang dapat diakses).</p>
        <div className="g-row">
          <label>Google OAuth Client ID (Web application)
            <input value={s.googleClientId} onChange={(e) => actions.updateSettings({ googleClientId: e.target.value.trim() })} placeholder="xxxx.apps.googleusercontent.com" />
          </label>
          {session.user ? (
            <>
              <button className="auto" disabled={session.syncing} onClick={() => actions.syncNow()}>{session.syncing ? 'Menyinkronkan...' : 'Sinkronkan'}</button>
              <button className="auto sec" onClick={() => actions.disconnect()}>Putuskan</button>
            </>
          ) : (
            <button className="auto" disabled={!s.googleClientId || session.syncing} onClick={() => actions.connect()}>Hubungkan Drive</button>
          )}
        </div>
        {session.user && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Terhubung sebagai <b>{session.user.email}</b>{session.lastSync && <> · sinkron terakhir {new Date(session.lastSync).toLocaleTimeString('id-ID')}</>}</div>}
        {session.error && <p className="err" style={{ margin: '6px 0 0' }}>{session.error}</p>}
        <label style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }} title="Pengguna masuk dengan akun Google yang emailnya sama dengan email di data Pengguna. Verifikasi 2 langkah aplikasi tetap berlaku bila diaktifkan pengguna.">
          <input type="checkbox" style={{ width: 'auto', margin: 0 }} disabled={!isAdmin || !s.googleClientId} checked={!!s.googleLogin} onChange={(e) => actions.updateSettings({ googleLogin: e.target.checked })} />
          Izinkan <b>masuk dengan akun Google</b> di halaman login <span className="muted">(email Google harus sama dengan email pengguna{!s.googleClientId ? '; isi Client ID dulu' : ''})</span>
        </label>
        <label style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={s.autoSync} onChange={(e) => actions.updateSettings({ autoSync: e.target.checked })} />
          Sinkron otomatis ke Drive setiap ada perubahan
        </label>
        <CloudGuide />
      </Collapse>

      <StorageSettings />

      <FontSettingsCard />

      <RecoverySettingsCard />

      <EmailTemplateCard />

      <Collapse id="identitas-aplikasi-branding" title="Identitas Aplikasi (Branding)">
        {!isAdmin && <div className="muted" style={{ marginBottom: 8 }}>🔒 Hanya administrator yang dapat mengubah identitas aplikasi.</div>}
        <fieldset disabled={!isAdmin} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="brand-grid">
          <div className="brand-fields">
            <div className="row">
              <label>Nama aplikasi<input value={s.appName} onChange={(e) => actions.updateSettings({ appName: e.target.value })} /></label>
              <label>Subjudul / slogan<input value={s.appTagline} onChange={(e) => actions.updateSettings({ appTagline: e.target.value })} /></label>
            </div>
            <label>Informasi aplikasi (halaman login)<input value={s.appInfo ?? ''} onChange={(e) => actions.updateSettings({ appInfo: e.target.value })} placeholder="kosong = deskripsi bawaan" /></label>
            <label>Teks hak cipta (copyright)<input value={s.copyright ?? ''} onChange={(e) => actions.updateSettings({ copyright: e.target.value })} placeholder="mis. © 2026 PT Contoh. Seluruh hak cipta dilindungi." /></label>
            <label>Pesan di halaman login<input value={s.loginMessage} onChange={(e) => actions.updateSettings({ loginMessage: e.target.value })} placeholder="mis. Selamat datang di sistem dokumen PT ..." /></label>
            <label>Teks footer (sidebar & halaman login)<input value={s.footerText} onChange={(e) => actions.updateSettings({ footerText: e.target.value })} placeholder="mis. © 2026 PT Contoh Engineering" /></label>
          </div>
          <div className="brand-logo">
            <div className="muted" style={{ fontSize: 12 }}>Logo aplikasi</div>
            <div className="brand-prev"><Brand size={20} /></div>
            <PickBox text={s.appLogo ? 'Klik / seret untuk ganti logo' : 'Pilih logo'} preview={s.appLogo || undefined} accept="image/*" onFile={async (f) => {
              try { actions.updateSettings({ appLogo: await fileToLogo(f, 320) }) } catch (x: any) { notify(x.message) }
            }} />
            <label>Warna utama<input type="color" value={s.accentColor} onChange={(e) => actions.updateSettings({ accentColor: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {s.appLogo && <button className="sec sm" onClick={() => actions.updateSettings({ appLogo: '' })}>Hapus logo</button>}
              <button className="sec sm" onClick={() => actions.updateSettings({ appName: 'DocControl', appTagline: 'Kontrol Dokumen Proyek', appLogo: '', accentColor: '#1d4ed8' })}>Kembalikan default</button>
            </div>
          </div>
        </div>
        <div className="sl-box">
          <b>Huruf nama & kepanjangan aplikasi (sidebar)</b>
          {(['name', 'tagline'] as const).map((k) => {
            const c = { ...DEFAULT_SIDETEXT[k], ...s.sideText?.[k] }
            const set = (p: Partial<TextStyleCfg>) => actions.updateSettings({ sideText: { ...s.sideText, [k]: { ...c, ...p } } })
            return (
              <div key={k} className="sl-grid st-row">
                <div className="st-t">{k === 'name' ? 'Nama aplikasi' : 'Kepanjangan / slogan'}</div>
                <label>Jenis huruf<select value={c.font} onChange={(e) => set({ font: e.target.value })}>{FONT_OPTIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                {c.font === 'custom' && <label>Nama huruf<input value={c.custom || ''} onChange={(e) => set({ custom: e.target.value })} placeholder="mis. Poppins" /></label>}
                <Slide label="Ukuran" v={c.size} min={9} max={k === 'name' ? 40 : 24} unit="px" on={(v) => set({ size: v })} />
                <label>Ketebalan<select value={c.weight} onChange={(e) => set({ weight: +e.target.value })}>{WEIGHTS.map(([w, n]) => <option key={w} value={w}>{n}</option>)}</select></label>
                <Slide label="Jarak huruf" v={c.spacing} min={-1} max={6} step={0.1} unit="px" on={(v) => set({ spacing: v })} />
                <label>Warna<span className="st-col"><input type="color" value={c.color || '#ffffff'} onChange={(e) => set({ color: e.target.value })} />{c.color && <button type="button" className="sec sm" onClick={() => set({ color: '' })}>Otomatis</button>}</span></label>
                <label className="sl-chk"><input type="checkbox" checked={c.italic} onChange={(e) => set({ italic: e.target.checked })} /> Miring</label>
                <label className="sl-chk"><input type="checkbox" checked={c.upper} onChange={(e) => set({ upper: e.target.checked })} /> HURUF BESAR</label>
              </div>
            )
          })}
          <button className="sec sm" onClick={() => actions.updateSettings({ sideText: undefined })}>Reset huruf</button>
        </div>
        <div className="sl-box">
          <b>Tampilan logo di sidebar</b>
          <div className="sl-grid">
            <label>Latar kotak
              <select value={sl.bg} onChange={(e) => setSl({ bg: e.target.value as SideLogo['bg'] })}>
                <option value="white">Putih</option><option value="glass">Kaca (transparan)</option><option value="color">Warna sendiri</option><option value="none">Tanpa latar (transparan)</option>
              </select>
            </label>
            {sl.bg === 'color' && <label>Warna latar<input type="color" value={sl.bgColor || '#ffffff'} onChange={(e) => setSl({ bgColor: e.target.value })} /></label>}
            {(sl.bg === 'white' || sl.bg === 'color' || sl.bg === 'glass') && <Slide label="Kepekatan latar" v={sl.bgOpacity} min={0} max={100} unit="%" on={(v) => setSl({ bgOpacity: v })} />}
            <Slide label="Ukuran" v={sl.size} min={32} max={96} unit="px" on={(v) => setSl({ size: v })} />
            <Slide label="Transparansi logo" v={sl.opacity} min={20} max={100} unit="%" on={(v) => setSl({ opacity: v })} />
            <Slide label="Sudut membulat" v={sl.radius} min={0} max={50} unit="%" on={(v) => setSl({ radius: v })} />
            <Slide label="Bayangan" v={sl.shadow} min={0} max={100} unit="" on={(v) => setSl({ shadow: v })} />
            <Slide label="Cahaya (glow)" v={sl.glow} min={0} max={100} unit="" on={(v) => setSl({ glow: v })} />
            <Slide label="Kecerahan" v={sl.bright} min={50} max={160} unit="%" on={(v) => setSl({ bright: v })} />
            <Slide label="Kontras" v={sl.contrast} min={50} max={160} unit="%" on={(v) => setSl({ contrast: v })} />
            <label className="sl-chk"><input type="checkbox" checked={sl.border} onChange={(e) => setSl({ border: e.target.checked })} /> Bingkai putih tipis</label>
          </div>
          <button className="sec sm" onClick={() => actions.updateSettings({ sideLogo: undefined })}>Reset tampilan logo</button>
        </div>
        </fieldset>
      </Collapse>

      <Collapse id="informasi-organisasi" title="Informasi Organisasi">
        <div className="frows">
          <label className="frow"><span>Nama organisasi <small className="muted">(muncul di transmittal)</small></span><input value={s.organization} onChange={(e) => actions.updateSettings({ organization: e.target.value })} /></label>
          <label className="frow"><span>Alamat</span><input value={s.orgAddress} onChange={(e) => actions.updateSettings({ orgAddress: e.target.value })} /></label>
          <label className="frow"><span>Telepon</span><input value={s.orgPhone} onChange={(e) => actions.updateSettings({ orgPhone: e.target.value })} /></label>
          <label className="frow"><span>Email</span><input type="email" value={s.orgEmail} onChange={(e) => actions.updateSettings({ orgEmail: e.target.value })} /></label>
          <label className="frow"><span>Website</span><input value={s.orgWebsite} onChange={(e) => actions.updateSettings({ orgWebsite: e.target.value })} /></label>
        </div>
      </Collapse>

      <Collapse id="tema-warna" title="Tema & Warna Aplikasi">
        <div className="sx-box sx-full">
          <div className="tm-head">
            <b>Tema</b>
            <label className="tm-mode">Mode
              <select value={s.theme} disabled={!!preset} onChange={(e) => actions.updateSettings({ theme: e.target.value as any })}><option value="auto">Otomatis (ikut perangkat)</option><option value="light">Terang</option><option value="dark">Gelap</option></select>
            </label>
            {preset && <span className="muted tm-note">Mode ditentukan oleh tema "{preset.name}". Pilih "Bawaan" untuk mengatur sendiri.</span>}
          </div>
          <div className="th-grid th-compact">
            {[{ id: 'default', name: 'Bawaan', mode: s.theme === 'dark' ? 'dark' : 'light', c: { bg: '#f1f5f9', card: '#ffffff', text: '#0f172a', muted: '#64748b', line: '#e2e8f0', pri: s.accentColor || '#1d4ed8' } } as Preset, ...PRESETS].map((p) => (
              <button key={p.id} type="button" className={'th-card' + ((pal.preset || 'default') === p.id ? ' on' : '')} onClick={() => setPal({ preset: p.id, custom: undefined })} title={p.name}>
                <span className="th-prev" style={{ background: p.c.bg, borderColor: p.c.line }}>
                  <i style={{ background: p.c.card, borderColor: p.c.line }}><u style={{ background: p.c.pri }} /><u style={{ background: p.c.muted, opacity: .5 }} /></i>
                  <b style={{ background: p.c.pri }} />
                </span>
                <span className="th-n">{p.name}</span>
                <span className="th-m">{p.id === 'default' ? 'Ikut mode' : p.mode === 'dark' ? 'Gelap' : 'Terang'}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="sx-box">
          <b>Kustomisasi warna</b>
          <div className="tm-cols">
            {COLOR_FIELDS.map(({ k, label }) => (
              <label key={k} className="tm-c">
                <span>{label}</span>
                <input type="color" value={(pal.custom?.[k] || eff[k] || '#000000') as string} onChange={(e) => setPal({ custom: { ...pal.custom, [k]: e.target.value } })} />
                {pal.custom?.[k] ? <button type="button" className="sec sm" title="Kembalikan warna ini" onClick={() => { const c = { ...pal.custom }; delete c[k]; setPal({ custom: c }) }}>↺</button> : <i />}
              </label>
            ))}
          </div>
          <div className="tm-foot">
            <span className="muted">Langsung diterapkan ke seluruh aplikasi. Warna utama bawaan juga ada di kartu Identitas Aplikasi.</span>
            <button className="sec sm" onClick={() => actions.updateSettings({ palette: undefined })}>Kembalikan tema bawaan</button>
          </div>
        </div>
      </Collapse>

      <Collapse id="tampilan-sidebar" title="Tampilan Sidebar (latar, pola & siluet)">
        <fieldset disabled={!isAdmin} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {!isAdmin && <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>🔒 Hanya administrator yang dapat mengubah tampilan sidebar.</div>}
        <div className="sx-box sx-full">
          <b>Gaya siap pakai</b>
          <div className="sx-quick">
            {QUICK_STYLES.map((q) => (
              <button key={q.id} type="button" className="sx-q" title={q.name} onClick={() => actions.updateSettings({ sideStyle: q.id === 'bawaan' ? undefined : { ...DEFAULT_SIDESTYLE, ...q.st } })}>
                <SidePrev st={q.st} h={44} /><span>{q.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="sx-grid">
          <div className="sx-box">
            <b>Warna latar</b>
            <div className="sx-sw">
              <button type="button" title="Ikuti tema" className={ss.bg === 'theme' ? 'on' : ''} style={{ background: 'linear-gradient(135deg,var(--card),var(--bg))', border: '2px solid var(--line)' }} onClick={() => setSs({ bg: 'theme' })} />
              {THEME_PRESETS.filter((p) => !p.dark).map((p) => <button key={p.id} type="button" title={p.name} className={ss.bg === p.id ? 'on' : ''} style={{ background: `linear-gradient(180deg,${p.c2},${p.c1})` }} onClick={() => setSs({ bg: p.id })} />)}
              <button type="button" title="Warna sendiri" className={ss.bg === 'custom' ? 'on' : ''} style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} onClick={() => setSs({ bg: 'custom', c1: ss.c1 || '#0b1f4d', c2: ss.c2 || '#1d4ed8' })} />
            </div>
            {ss.bg !== 'theme' && (
              <>
                {ss.bg === 'custom' && (
                  <div className="sx-in">
                    <label className="sx-c">Atas<input type="color" value={ss.c1 || '#0b1f4d'} onChange={(e) => setSs({ c1: e.target.value })} /></label>
                    <label className="sx-c">Bawah<input type="color" value={ss.c2 || '#1d4ed8'} onChange={(e) => setSs({ c2: e.target.value })} /></label>
                  </div>
                )}
                <SSlide label="Arah" v={ss.angle} min={0} max={360} step={5} unit="°" on={(v) => setSs({ angle: v })} />
              </>
            )}
          </div>
          <div className="sx-box">
            <b>Pola</b>
            <select value={ss.pattern} onChange={(e) => setSs({ pattern: e.target.value })}><option value="none">Polos</option>{PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {ss.pattern !== 'none' && <SSlide label="Kekuatan" v={ss.patternOpacity} min={3} max={40} unit="%" on={(v) => setSs({ patternOpacity: v })} />}
            {ss.pattern !== 'none' && <SSlide label="Ukuran" v={ss.patternScale} min={50} max={250} step={10} unit="%" on={(v) => setSs({ patternScale: v })} />}
          </div>
          <div className="sx-box">
            <b>Siluet vektor</b>
            <select value={ss.art} onChange={(e) => setSs({ art: e.target.value })}><option value="none">Tanpa siluet</option>{ARTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            {ss.art !== 'none' && <SSlide label="Kekuatan" v={ss.artOpacity} min={4} max={60} unit="%" on={(v) => setSs({ artOpacity: v })} />}
            {ss.art !== 'none' && <SSlide label="Tinggi" v={ss.artSize} min={60} max={220} step={10} unit="%" on={(v) => setSs({ artSize: v })} />}
          </div>
          <div className="sx-box">
            <b>Gambar sendiri</b>
            <div className="sx-in">
              <PickBox text={ss.image ? 'Ganti gambar' : 'Pilih gambar (PNG transparan / SVG)'} accept="image/*" onFile={(f) => pickSideImg(f)} />
              {ss.image && <img className="sx-thumb" src={ss.image} alt="" />}
            </div>
            {ss.image && (
              <>
                <div className="sx-in">
                  <select value={ss.imgPos} onChange={(e) => setSs({ imgPos: e.target.value as SideStyle['imgPos'] })}><option value="bottom">Dasar sidebar</option><option value="top">Atas sidebar</option><option value="center">Tengah</option><option value="cover">Penuh</option></select>
                  <button type="button" className="sec sm" onClick={() => setSs({ image: undefined })}>Hapus gambar</button>
                </div>
                <SSlide label="Kekuatan" v={ss.imgOpacity} min={5} max={100} unit="%" on={(v) => setSs({ imgOpacity: v })} />
              </>
            )}
          </div>
        </div>
        <button className="sec sm" style={{ marginTop: 8 }} onClick={() => actions.updateSettings({ sideStyle: undefined })}>Kembalikan sidebar bawaan</button>
        </fieldset>
      </Collapse>

      <Collapse id="umum" title="Umum">
        <div className="row">
          <label>Skema revisi<select value={s.revisionScheme} onChange={(e) => actions.updateSettings({ revisionScheme: e.target.value as any })}><option value="alpha">Huruf (A, B, C...)</option><option value="numeric">Angka (0, 1, 2...)</option></select></label>
          <label>Batas waktu review default (hari)<input type="number" min={1} value={s.defaultReviewDays} onChange={(e) => actions.updateSettings({ defaultReviewDays: +e.target.value })} /></label>
        </div>
      </Collapse>

      <Collapse id="keamanan-akun" title="Keamanan Akun">
        <div className="row">
          <label>Logout otomatis jika tidak aktif (menit, 0 = nonaktif)<input type="number" min={0} value={s.sessionTimeoutMin} onChange={(e) => actions.updateSettings({ sessionTimeoutMin: Math.max(0, +e.target.value) })} /></label>
          <label>Batas percobaan login gagal<input type="number" min={3} max={20} value={s.maxAttempts} onChange={(e) => actions.updateSettings({ maxAttempts: Math.max(3, +e.target.value) })} /></label>
        </div>
        <div className="row">
          <label>Lama akun terkunci (menit)<input type="number" min={1} value={s.lockMinutes} onChange={(e) => actions.updateSettings({ lockMinutes: Math.max(1, +e.target.value) })} /></label>
          <label>Panjang minimal kata sandi<input type="number" min={8} max={64} value={s.minPasswordLength} onChange={(e) => actions.updateSettings({ minPasswordLength: Math.min(64, Math.max(8, +e.target.value)) })} /></label>
        </div>
        <p className="muted">Kata sandi di-hash dengan PBKDF2-SHA256 (600.000 iterasi, salt acak). Pengguna dapat mengaktifkan verifikasi 2 langkah (TOTP) di Profil. Kelola pengguna dan peran di menu <a href="#/users">Pengguna</a>.</p>
      </Collapse>

      <Collapse id="status-dokumen" title="Status Dokumen">
        {s.statuses.map((x, i) => (
          <div className="row" key={i} style={{ marginBottom: 6 }}>
            <input style={{ maxWidth: 90 }} value={x.code} onChange={(e) => setStatus(i, { code: e.target.value.toUpperCase() })} />
            <input value={x.label} onChange={(e) => setStatus(i, { label: e.target.value })} />
            <input type="color" className="auto" style={{ width: 50 }} value={x.color} onChange={(e) => setStatus(i, { color: e.target.value })} />
            <button className="auto dng sm" onClick={() => actions.updateSettings({ statuses: s.statuses.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button className="sec" onClick={() => actions.updateSettings({ statuses: [...s.statuses, { code: 'NEW', label: 'Status baru', color: '#475569' }] })}>+ Status</button>
      </Collapse>

      <NumberingCard />

      <CategoryStatusCard />

      <div className="grid g2">
        <ListTable title="Disiplin" items={s.disciplines} codeKey="disciplineCodes" hint="Kode disiplin pada nomor dokumen" onChange={(v) => actions.updateSettings({ disciplines: v })} />
        <ListTable title="Jenis Dokumen (Kategori)" items={s.categories} codeKey="categoryCodes" hint="Kode jenis dokumen pada nomor dokumen" onChange={(v) => actions.updateSettings({ categories: v })} />
      </div>

      <Collapse id="cadangan-data-lokal" title="Cadangan & Data Lokal">
        <p className="muted">Data juga tersimpan di perangkat ini (offline). Unduh cadangan untuk menyimpannya di komputer atau smartphone.</p>
        <div className="row">
          <button className="auto" onClick={() => downloadBlob(new Blob([actions.exportJson()], { type: 'application/json' }), `docontrol-backup-${new Date().toISOString().slice(0, 10)}.json`)}>Unduh cadangan (JSON)</button>
          <button className="auto sec" onClick={() => fileRef.current?.click()}>Pulihkan dari cadangan</button>
          <button className="auto sec" onClick={async () => (await ask('Ganti seluruh data dengan data contoh?')) && actions.loadDemo()}>Muat data contoh</button>
          <button className="auto dng" onClick={async () => (await ask('Hapus SEMUA data lokal (proyek, dokumen, transmittal)? Tindakan ini tidak dapat dibatalkan.')) && actions.resetAll()}>Reset data</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return
          try { actions.importJson(await f.text()); notify('Data berhasil dipulihkan') } catch (err: any) { notify(err.message) }
        }} />
        <p className="muted">Pembaruan data terakhir: {fmtDate(state.updatedAt)} · {state.projects.length} proyek, {state.documents.length} dokumen.</p>
      </Collapse>
    </>
  )
}

function RecoverySettingsCard() {
  const { state } = useApp()
  const rc = recoveryOf(state.settings.recovery)
  const set = (p: Partial<typeof rc>) => actions.updateSettings({ recovery: { ...rc, ...p } })
  return (
    <Collapse id="lupa-sandi-email-whatsapp" title="Lupa Sandi (Email / WhatsApp)" cls="rcard">
      <table className="rc-t">
        <thead><tr><th style={{ width: 116, whiteSpace: "nowrap" }}>Saluran</th><th>URL pengirim (webhook)</th><th style={{ width: '34%' }}>Header Authorization (opsional)</th></tr></thead>
        <tbody>
          <tr><td><b>✉ Email</b></td><td><input value={rc.emailUrl} onChange={(e) => set({ emailUrl: e.target.value })} placeholder="https://..." /></td><td><input value={rc.emailAuth} onChange={(e) => set({ emailAuth: e.target.value })} /></td></tr>
          <tr><td><b>💬 WhatsApp</b></td><td><input value={rc.whatsappUrl} onChange={(e) => set({ whatsappUrl: e.target.value })} placeholder="https://..." /></td><td><input value={rc.whatsappAuth} onChange={(e) => set({ whatsappAuth: e.target.value })} /></td></tr>
        </tbody>
      </table>
      <div className="rc-foot">
        <label>Masa berlaku sandi sementara <input type="number" min={5} max={1440} value={rc.validMinutes} onChange={(e) => set({ validMinutes: Math.max(5, +e.target.value || 30) })} /> menit</label>
        <label className="rc-on"><input type="checkbox" checked={rc.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Tampilkan &quot;Lupa sandi?&quot; di halaman login</label>
        <span className="muted">Email dikirim ke email pengguna, WhatsApp ke nomor telepon di profilnya (isi di menu Pengguna).</span>
      </div>
      <details className="guide">
        <summary>Cara kerja pengiriman</summary>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Aplikasi ini berjalan tanpa server, sehingga email dan WhatsApp dikirim lewat layanan pengirim (webhook) milik Anda, misalnya Make/Zapier/n8n, Google Apps Script, atau gateway WhatsApp.
          Aplikasi mengirim POST JSON <code>{'{ channel, to, subject, message, app }'}</code> ke URL di atas. Sandi sementara tidak pernah ditampilkan di layar; sandi lama tetap berlaku sampai sandi sementara dipakai.
        </p>
      </details>
    </Collapse>
  )
}

function CategoryStatusCard() {
  const { state } = useApp()
  const s = state.settings
  const rules = s.categoryStatuses || {}
  const set = (cat: string, codes: string[]) => {
    const next = { ...rules }
    if (codes.length === 0 || codes.length === s.statuses.length) delete next[cat]
    else next[cat] = codes
    actions.updateSettings({ categoryStatuses: next })
  }
  return (
    <Collapse id="status-yang-diizinkan-per-jenis-dokumen" title="Status yang Diizinkan per Jenis Dokumen">
      <p className="muted sc-hint">Klik status untuk mengaktifkan atau menonaktifkan per jenis dokumen. Status yang dicoret dinonaktifkan untuk jenis tersebut. Revisi yang sudah ada tidak berubah.</p>
      <div className="sc-grid">
        {s.categories.map((cat) => {
          const cur = rules[cat] && rules[cat].length ? rules[cat] : s.statuses.map((x) => x.code)
          const limited = !!rules[cat]
          return (
            <div key={cat} className={'sc' + (limited ? ' ltd' : '')}>
              <b className="sc-name" title={cat}>{cat}</b>
              <div className="sc-chips">
                {s.statuses.map((x) => {
                  const on = cur.includes(x.code)
                  return (
                    <button type="button" key={x.code} className={'sc-chip' + (on ? ' on' : '')} title={`${x.label}${on ? '' : ' (nonaktif)'}`} aria-pressed={on}
                      style={on ? { background: x.color, borderColor: x.color } : undefined}
                      onClick={() => { const n = on ? cur.filter((c) => c !== x.code) : [...cur, x.code]; if (n.length) set(cat, n) }}>{x.code}</button>
                  )
                })}
              </div>
              <span className="sc-cnt" title={limited ? 'Dibatasi' : 'Semua status aktif'}>{cur.length}/{s.statuses.length}</span>
              <button type="button" className="sc-rs" title="Kembalikan: semua status aktif" aria-label={`Reset ${cat}`} style={{ visibility: limited ? 'visible' : 'hidden' }} onClick={() => set(cat, [])}>↺</button>
            </div>
          )
        })}
      </div>
    </Collapse>
  )
}

function EmailTemplateCard() {
  const { state } = useApp()
  const tpl = state.settings.emailTemplate || DEFAULT_EMAIL_TEMPLATE
  const set = (p: Partial<typeof tpl>) => actions.updateSettings({ emailTemplate: { ...tpl, ...p } })
  return (
    <Collapse id="template-email-transmittal" title="Template Email Transmittal">
      <p className="muted">Isi email yang dipakai saat mengirim transmittal beserta lampiran PDF-nya. Variabel yang tersedia:{' '}
        {['nomor', 'kode', 'proyek', 'tanggal', 'kepada', 'dari', 'perihal', 'jumlah', 'daftar', 'pengirim', 'organisasi'].map((v) => <code key={v} style={{ marginRight: 6 }}>{`{{${v}}}`}</code>)}</p>
      <label>Subjek<input value={tpl.subject} onChange={(e) => set({ subject: e.target.value })} /></label>
      <label>Isi email<textarea rows={12} value={tpl.body} onChange={(e) => set({ body: e.target.value })} /></label>
      <button className="auto sec sm" onClick={() => actions.updateSettings({ emailTemplate: DEFAULT_EMAIL_TEMPLATE })}>Kembalikan template bawaan</button>
    </Collapse>
  )
}

function FontSettingsCard() {
  const { state } = useApp()
  const f = fontOf(state.settings.font)
  const set = (p: Partial<typeof f>) => actions.updateSettings({ font: { ...f, ...p } })
  const fontSel = (val: string, key: 'body' | 'head', custom: 'bodyCustom' | 'headCustom') => (
    <>
      <select value={val} onChange={(e) => set({ [key]: e.target.value })}>{FONT_OPTIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      {val === 'custom' && <input style={{ marginTop: 4 }} value={f[custom] || ''} onChange={(e) => set({ [custom]: e.target.value })} placeholder="mis. Calibri, Open Sans" />}
    </>
  )
  return (
    <Collapse id="huruf-tipografi" title="Huruf & Tipografi">
      <p className="muted" style={{ marginTop: 0 }}>Atur jenis huruf, ukuran, dan ketebalan untuk teks isi serta untuk judul / header tabel. Jenis huruf harus terpasang di perangkat pengguna; bila tidak ada, dipakai huruf bawaan sistem.</p>
      <div className="row">
        <label>Jenis huruf teks isi{fontSel(f.body, 'body', 'bodyCustom')}</label>
        <label>Ketebalan teks isi<select value={f.bodyWeight} onChange={(e) => set({ bodyWeight: +e.target.value })}>{WEIGHTS.map(([w, n]) => <option key={w} value={w}>{n}</option>)}</select></label>
        <label>Ukuran teks isi ({f.size}px)<input type="range" min={12} max={18} step={1} value={f.size} onChange={(e) => set({ size: +e.target.value })} /></label>
      </div>
      <div className="row">
        <label>Jenis huruf judul / header{fontSel(f.head, 'head', 'headCustom')}</label>
        <label>Ketebalan judul / header<select value={f.headWeight} onChange={(e) => set({ headWeight: +e.target.value })}>{WEIGHTS.map(([w, n]) => <option key={w} value={w}>{n}</option>)}</select></label>
        <label>Ukuran judul ({f.headScale}%)<input type="range" min={80} max={140} step={5} value={f.headScale} onChange={(e) => set({ headScale: +e.target.value })} /></label>
      </div>
      <div className="card" style={{ background: 'var(--bg)', marginBottom: 8 }}>
        <h2 style={{ marginBottom: 4 }}>Contoh judul: Register Dokumen</h2>
        <div>Contoh teks isi: Spesifikasi Kabel Tegangan Menengah PRJ-001-0007 Rev A, status IFA, batas review 21 Okt 2026.</div>
      </div>
      <button className="auto sec sm" onClick={() => actions.updateSettings({ font: defaultFont() })}>Kembalikan huruf default</button>
    </Collapse>
  )
}

function CloudGuide() {
  return (
    <details className="guide">
      <summary>📘 Panduan integrasi Google Drive & cloud lain</summary>
      <h4>A. Google Drive (OAuth Client ID)</h4>
      <ol>
        <li>Buka <b>console.cloud.google.com</b> → buat/pilih project → <b>APIs & Services → Library</b> → aktifkan <b>Google Drive API</b>.</li>
        <li><b>OAuth consent screen</b>: tipe External, isi nama aplikasi & email. Tambahkan akun Anda sebagai <i>Test user</i> (selama status Testing).</li>
        <li>Tambahkan scope <code>.../auth/drive.file</code> (hanya file buatan aplikasi, bukan seluruh Drive).</li>
        <li><b>Credentials → Create Credentials → OAuth client ID</b> → tipe <b>Web application</b>.</li>
        <li>Pada <b>Authorized JavaScript origins</b> isi alamat aplikasi, mis. <code>https://dokumen.perusahaan.com</code> (atau <code>http://localhost:5173</code> untuk uji coba). Redirect URI tidak diperlukan.</li>
        <li>Salin Client ID (<code>xxxx.apps.googleusercontent.com</code>) ke kolom di atas → <b>Hubungkan Drive</b> → pilih akun Google.</li>
      </ol>
      <p className="muted">Client ID bukan rahasia, boleh tertanam di aplikasi. Jangan pernah memakai Client Secret di aplikasi web ini. Aplikasi harus dibuka lewat HTTPS (kecuali localhost).</p>
      <h4>B. WebDAV (Nextcloud, ownCloud, NAS Synology, dll.)</h4>
      <p>Atur di kartu <b>Penyimpanan</b> di bawah: isi URL WebDAV dan username. Server harus mengizinkan CORS dari alamat aplikasi, contoh untuk Nginx:</p>
      <pre>{`add_header Access-Control-Allow-Origin  "https://dokumen.perusahaan.com" always;
add_header Access-Control-Allow-Methods "GET, PUT, PROPFIND, MKCOL, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type, Depth" always;`}</pre>
      <h4>C. Cloud lain (OneDrive, Dropbox, S3, dll.)</h4>
      <p>Aplikasi ini murni di browser, jadi cloud tanpa CORS/OAuth browser perlu perantara kecil (gateway). Pola yang disarankan: gateway menerima <code>PUT/GET</code> sederhana lalu meneruskannya ke cloud tujuan.</p>
      <pre>{`// Contoh gateway (Node.js + Express) → Dropbox
import express from 'express'
const app = express()
app.use(express.raw({ type: '*/*', limit: '50mb' }))
app.use((q, r, n) => { r.set({
  'Access-Control-Allow-Origin': 'https://dokumen.perusahaan.com',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS' })
  q.method === 'OPTIONS' ? r.sendStatus(204) : n() })
const TOKEN = process.env.DROPBOX_TOKEN   // simpan di server, bukan di browser
app.put('/f/:path', async (q, r) => {
  const x = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path: '/DocControl/' + q.params.path, mode: 'overwrite' }) },
    body: q.body })
  r.sendStatus(x.status)
})
app.listen(8080)`}</pre>
      <p className="muted">Panduan ini adalah contoh acuan; gateway cloud lain (OneDrive via Microsoft Graph, S3 via presigned URL) belum terhubung otomatis ke aplikasi dan belum diuji di sini. Untuk menyambungkannya perlu satu adapter di <code>storage.ts</code> yang mengikuti pola WebDAV.</p>
    </details>
  )
}

function NumberingCard() {
  const { state } = useApp()
  const s = state.settings
  const n = numberingOf(s)
  const set = (p: Partial<typeof n>) => actions.updateSettings({ numbering: { ...n, ...p } })
  const [paper, setPaper] = useState('')
  const proj = state.projects[0]
  const ex = buildNumber(s, proj || ({ numberPrefix: 'GSP', code: 'GSP', numberPadding: 3 } as any), { discipline: s.disciplines[0] || '', category: s.categories[0] || '' }, 1)
  return (
    <Collapse id="penomoran-dokumen" title="Penomoran Dokumen" cls="ncard">
      <p className="muted" style={{ margin: '0 0 8px' }}>Nomor dokumen dibuat otomatis dari pola di bawah saat dokumen dicatat (tetap bisa diubah manual). Inisial proyek diatur di setiap proyek; kode disiplin dan jenis dokumen diisi di tabel Disiplin & Jenis Dokumen di bawah.</p>
      <div className="pat">
        <div className="pat-h">Pola nomor</div>
        <div className="pat-r">
          <select value={NUM_PRESETS.some(([t]) => t === n.template) ? n.template : '__custom'} onChange={(e) => e.target.value !== '__custom' && set({ template: e.target.value })}>
            {NUM_PRESETS.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
            <option value="__custom">Kustom...</option>
          </select>
          <input value={n.template} onChange={(e) => set({ template: e.target.value })} />
        </div>
        <div className="chips"><span className="muted">Tambah:</span>{NUM_TOKENS.map(([t, l]) => <button key={t} type="button" className="chip" onClick={() => set({ template: n.template + (n.template ? '-' : '') + t })}>+ {l}</button>)}</div>
        <div style={{ fontSize: 12, marginTop: 6 }}><span className="muted">Contoh:</span> <code>{ex}</code> <span className="muted">· digit urut diatur per proyek · urutan dihitung per kombinasi proyek/jenis/disiplin</span></div>
      </div>
      <div className="pat-h" style={{ marginTop: 8 }}>Ukuran kertas</div>
      <div className="prow">
        {n.papers.map((x) => <span key={x} className="pill auto">{x} <a href="#" onClick={(e) => { e.preventDefault(); set({ papers: n.papers.filter((y) => y !== x) }) }}>✕</a></span>)}
        <input style={{ width: 90 }} value={paper} onChange={(e) => setPaper(e.target.value.toUpperCase())} placeholder="mis. A1" />
        <button className="auto sm" disabled={!paper.trim() || n.papers.includes(paper.trim())} onClick={() => { set({ papers: [...n.papers, paper.trim()] }); setPaper('') }}>Tambah</button>
        <label style={{ margin: 0, flexDirection: 'row', display: 'flex', gap: 6, alignItems: 'center' }}>Bawaan
          <select value={n.defaultPaper} onChange={(e) => set({ defaultPaper: e.target.value })} style={{ width: 'auto' }}>{n.papers.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
    </Collapse>
  )
}
