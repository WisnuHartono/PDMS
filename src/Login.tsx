import { useState } from 'react'
import { actions, useApp } from './store'
import { PasswordInput, PwField, Brand, Modal } from './ui'
import { channelReady, recoveryOf, type RecoveryChannel } from './recovery'
import { passwordIssues } from './auth'

function ForgotDialog({ onClose }: { onClose: () => void }) {
  const { state } = useApp()
  const rc = recoveryOf(state.settings.recovery)
  const chans = (['email', 'whatsapp'] as RecoveryChannel[]).filter((c) => channelReady(rc, c))
  const [id, setId] = useState('')
  const [ch, setCh] = useState<RecoveryChannel>(chans[0] || 'email')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const send = async () => {
    if (busy || !id.trim()) return
    setBusy(true); setErr(''); setMsg('')
    const r = await actions.requestPasswordReset(id, ch)
    setBusy(false)
    if (r.ok) setMsg(`Jika akun terdaftar dan memiliki ${ch === 'email' ? 'alamat email' : 'nomor WhatsApp'}, sandi sementara telah dikirim. Berlaku ${rc.validMinutes} menit; Anda akan diminta membuat sandi baru setelah masuk.`)
    else setErr(r.error || 'Gagal mengirim.')
  }
  return (
    <Modal title="Lupa Sandi" onClose={onClose}>
      {chans.length === 0 ? (
        <p>Pengiriman sandi lewat email atau WhatsApp belum diatur. Hubungi administrator untuk mereset kata sandi Anda.</p>
      ) : (
        <div onKeyDown={(e) => e.key === 'Enter' && send()}>
          <p className="muted">Masukkan username atau email akun Anda. Sandi sementara akan dikirim ke kontak yang tercatat pada profil Anda.</p>
          <label>Username atau email<input value={id} onChange={(e) => setId(e.target.value)} autoFocus /></label>
          <label>Kirim lewat
            <select value={ch} onChange={(e) => setCh(e.target.value as RecoveryChannel)}>
              {chans.map((c) => <option key={c} value={c}>{c === 'email' ? 'Email' : 'WhatsApp'}</option>)}
            </select>
          </label>
          {msg && <p style={{ color: 'var(--ok, #16a34a)' }}>{msg}</p>}
          {err && <p className="err">{err}</p>}
          <button disabled={busy || !id.trim()} style={{ width: '100%' }} onClick={send}>{busy ? 'Mengirim...' : 'Kirim sandi sementara'}</button>
        </div>
      )}
    </Modal>
  )
}

export default function Login({ setup }: { setup: boolean }) {
  const { state } = useApp()
  const [f, setF] = useState({ name: '', username: '', email: '', password: '', confirm: '', otp: '' })
  const [need, setNeed] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  const gOn = !!state.settings.googleClientId && (setup || !!state.settings.googleLogin)
  const googleLogin = async () => {
    if (busy) return
    setErr(''); setBusy(true)
    try {
      if (setup) { await actions.connect(); return } // perangkat baru: muat data (pengguna) dari Google Drive
      const r = await actions.loginWithGoogle(need ? f.otp : undefined)
      if (r.needOtp) { setNeed(true); setErr('Akun ini memakai verifikasi 2 langkah. Masukkan kode lalu klik "Masuk dengan Google" lagi.') }
      else if (!r.ok) setErr(r.error || 'Gagal masuk dengan Google.')
    } finally { setBusy(false) }
  }
  const min = state.settings.minPasswordLength

  const submit = async () => {
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      if (!f.username.trim() || !f.password || (setup && (!f.name.trim() || !f.email.trim()))) throw new Error('Lengkapi semua isian yang wajib.')
      if (setup) {
        const ctx = { username: f.username, email: f.email, name: f.name }
        const issues = passwordIssues(f.password, ctx, min)
        if (issues.length) throw new Error('Kata sandi belum memenuhi syarat: ' + issues.join('; '))
        if (f.password !== f.confirm) throw new Error('Konfirmasi kata sandi tidak sama.')
        await actions.setupAdmin({ name: f.name.trim(), username: f.username.trim(), email: f.email.trim() }, f.password)
      } else {
        const r = await actions.login(f.username, f.password, need ? f.otp : undefined)
        if (r.needOtp) setNeed(true)
        else if (!r.ok) setErr(r.error || 'Gagal masuk.')
      }
    } catch (x: any) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {forgot && <ForgotDialog onClose={() => setForgot(false)} />}
      <div className="card" style={{ width: 'min(440px,100%)', marginBottom: 0 }} onKeyDown={(e) => e.key === 'Enter' && submit()}>
        <Brand size={22} />
        {state.settings.loginMessage && <p className="muted">{state.settings.loginMessage}</p>}
        <h2>{setup ? 'Pengaturan Awal: Buat Administrator' : 'Masuk'}</h2>
        {setup && <p className="muted">Belum ada pengguna. Buat akun administrator pertama. Akun ini mengelola proyek, pengguna, dan seluruh pengaturan.</p>}
        {setup && <label>Nama lengkap<input value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" /></label>}
        <label>{setup ? 'Username' : 'Username atau email'}<input value={f.username} onChange={(e) => set('username', e.target.value)} autoComplete="username" autoFocus /></label>
        {setup && <label>Email<input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></label>}
        {setup ? (
          <>
            <PasswordInput value={f.password} onChange={(v) => set('password', v)} ctx={{ username: f.username, email: f.email, name: f.name }} minLen={min} generate />
            <PwField label="Ulangi kata sandi" value={f.confirm} onChange={(e) => set('confirm', e.target.value)} autoComplete="new-password" />
          </>
        ) : (
          <PwField label="Kata sandi" value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="current-password" />
        )}
        {need && <label>Kode verifikasi 2 langkah (6 digit)<input value={f.otp} onChange={(e) => set('otp', e.target.value)} inputMode="numeric" maxLength={7} autoFocus /></label>}
        {err && <p className="err">{err}</p>}
        <button disabled={busy} style={{ width: '100%' }} onClick={submit}>{busy ? 'Memproses...' : setup ? 'Buat Administrator & Masuk' : 'Masuk'}</button>
        {gOn && (
          <>
            <div className="g-or"><span>atau</span></div>
            <button type="button" className="sec g-btn" disabled={busy} onClick={googleLogin}>
              <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
              {setup ? 'Sudah punya data? Muat dari Google Drive' : 'Masuk dengan Google'}
            </button>
          </>
        )}
        {!setup && recoveryOf(state.settings.recovery).enabled && <p style={{ textAlign: 'center', margin: '8px 0' }}><a href="#" onClick={(e) => { e.preventDefault(); setForgot(true) }}>Lupa sandi?</a></p>}
        {state.settings.footerText && <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{state.settings.footerText}</p>}
        <div className="muted" style={{ fontSize: 12, textAlign: 'center', borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 10 }}>
          <div><b>{state.settings.appName}</b> · {state.settings.appInfo?.trim() || 'Aplikasi kontrol dokumen proyek: pencatatan, penelusuran, dan status review dokumen (IFR / IFA / IFC / IFP / IFI) untuk banyak proyek.'}</div>
          <div style={{ marginTop: 4 }}>{state.settings.copyright?.trim() || `© ${new Date().getFullYear()} ${state.settings.organization?.trim() || state.settings.appName}. Seluruh hak cipta dilindungi.`}</div>
        </div>
      </div>
    </div>
  )
}
