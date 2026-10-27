import { useRef, useState } from 'react'
import { actions, useAuth } from './store'
import { Avatar, Modal, PasswordInput, PwField, notify } from './ui'
import { fileToPhoto, fmtDate } from './util'
import { newTotpSecret, passwordIssues, totpUri } from './auth'
import { useApp } from './store'

export function IdentityFields({ f, set }: { f: Record<string, any>; set: (k: string, v: string) => void }) {
  const t = (k: string, label: string, type = 'text') => (
    <label>{label}<input type={type} value={f[k] || ''} onChange={(e) => set(k, e.target.value)} /></label>
  )
  return (
    <>
      <div className="row">{t('name', 'Nama lengkap *')}{t('username', 'Username *')}</div>
      <div className="row">{t('email', 'Email *', 'email')}{t('phone', 'No. telepon / WhatsApp', 'tel')}</div>
      <div className="row">{t('position', 'Jabatan')}{t('department', 'Departemen / Divisi')}</div>
      <div className="row">{t('company', 'Perusahaan / Instansi')}{t('employeeId', 'ID Pegawai / NIK')}</div>
      <label>Catatan<textarea rows={2} value={f.note || ''} onChange={(e) => set('note', e.target.value)} /></label>
    </>
  )
}

export function PhotoPicker({ name, photo, onChange }: { name: string; photo?: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="row" style={{ marginBottom: 10 }}>
      <Avatar name={name || '?'} photo={photo} size={72} />
      <div className="auto">
        <button type="button" className="sec sm" onClick={() => ref.current?.click()}>Unggah foto</button>{' '}
        {photo && <button type="button" className="sec sm" onClick={() => onChange('')}>Hapus foto</button>}
        <div className="muted" style={{ fontSize: 12 }}>PNG / JPG, otomatis dipotong persegi.</div>
        <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return
          try { onChange(await fileToPhoto(f)) } catch (x: any) { notify(x.message) }
        }} />
      </div>
    </div>
  )
}

export default function Profile() {
  const { user, role } = useAuth()
  const { state } = useApp()
  const [f, setF] = useState<Record<string, any>>(() => ({ ...user }))
  const [saved, setSaved] = useState(false)
  const [pw, setPw] = useState({ cur: '', next: '', conf: '' })
  const [pwErr, setPwErr] = useState('')
  const [totp, setTotp] = useState<{ secret: string; code: string } | null>(null)
  const [totpErr, setTotpErr] = useState('')
  if (!user) return null
  const set = (k: string, v: string) => { setF({ ...f, [k]: v }); setSaved(false) }

  const save = () => {
    try {
      actions.updateUser(user.id, { name: f.name, email: f.email, phone: f.phone, position: f.position, department: f.department, company: f.company, employeeId: f.employeeId, note: f.note, photo: f.photo })
      setSaved(true)
    } catch (e: any) { notify(e.message) }
  }
  const changePw = async () => {
    setPwErr('')
    const issues = passwordIssues(pw.next, user, state.settings.minPasswordLength)
    if (issues.length) return setPwErr(issues.join('; '))
    if (pw.next !== pw.conf) return setPwErr('Konfirmasi kata sandi tidak sama.')
    try { await actions.changeOwnPassword(pw.cur, pw.next); setPw({ cur: '', next: '', conf: '' }); notify('Kata sandi berhasil diganti.') } catch (e: any) { setPwErr(e.message) }
  }

  return (
    <>
      <div className="top"><h1>Profil Saya</h1></div>
      <div className="card">
        <h2>Identitas</h2>
        <PhotoPicker name={f.name} photo={f.photo} onChange={(v) => set('photo', v)} />
        <IdentityFields f={{ ...f, username: user.username }} set={(k, v) => k !== 'username' && set(k, v)} />
        <p className="muted">Username <b>{user.username}</b> · Peran <b>{role?.name}</b> · Terdaftar {fmtDate(user.createdAt)} · Login terakhir {user.lastLogin ? new Date(user.lastLogin).toLocaleString('id-ID') : '-'}</p>
        <button disabled={!f.name?.trim() || !f.email?.trim()} onClick={save}>Simpan profil</button> {saved && <span className="ok">Tersimpan ✓</span>}
      </div>

      <div className="card">
        <h2>Ganti Kata Sandi</h2>
        <PwField label="Kata sandi saat ini" value={pw.cur} autoComplete="current-password" onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
        <PasswordInput label="Kata sandi baru" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} ctx={user} minLen={state.settings.minPasswordLength} generate />
        <PwField label="Ulangi kata sandi baru" value={pw.conf} autoComplete="new-password" onChange={(e) => setPw({ ...pw, conf: e.target.value })} />
        {pwErr && <p className="err">{pwErr}</p>}
        <button disabled={!pw.cur || !pw.next} onClick={changePw}>Ganti kata sandi</button>
      </div>

      <div className="card">
        <h2>Verifikasi 2 Langkah (TOTP)</h2>
        <p className="muted">Lapisan keamanan tambahan memakai aplikasi autentikator (Google Authenticator, Microsoft Authenticator, Authy, dll).</p>
        {user.totpEnabled ? (
          <>
            <p className="ok">Aktif ✓</p>
            <button className="dng" onClick={() => actions.disableTotp(user.id)}>Nonaktifkan</button>
          </>
        ) : totp ? (
          <>
            <p>Tambahkan akun di aplikasi autentikator dengan memasukkan kunci ini secara manual:</p>
            <p><code style={{ fontSize: 16, letterSpacing: 2, userSelect: 'all' }}>{totp.secret}</code></p>
            <p className="muted" style={{ wordBreak: 'break-all' }}>Atau buka tautan: <a href={totpUri(totp.secret, user.username)}>{totpUri(totp.secret, user.username)}</a></p>
            <label>Masukkan kode 6 digit untuk memastikan<input value={totp.code} inputMode="numeric" maxLength={7} onChange={(e) => setTotp({ ...totp, code: e.target.value })} /></label>
            {totpErr && <p className="err">{totpErr}</p>}
            <div className="row">
              <button className="auto" onClick={async () => { try { await actions.enableTotp(totp.secret, totp.code); setTotp(null); setTotpErr('') } catch (e: any) { setTotpErr(e.message) } }}>Aktifkan</button>
              <button className="auto sec" onClick={() => setTotp(null)}>Batal</button>
            </div>
          </>
        ) : (
          <button onClick={() => setTotp({ secret: newTotpSecret(), code: '' })}>Aktifkan verifikasi 2 langkah</button>
        )}
      </div>
    </>
  )
}

export function ForcePasswordChange() {
  const { user } = useAuth()
  const { state } = useApp()
  const [pw, setPw] = useState({ cur: '', next: '', conf: '' })
  const [err, setErr] = useState('')
  if (!user) return null
  return (
    <Modal title="Ganti Kata Sandi Diperlukan" onClose={() => actions.logout()}>
      <p className="muted">Administrator mewajibkan Anda mengganti kata sandi sebelum melanjutkan.</p>
      <PwField label="Kata sandi saat ini" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
      <PasswordInput label="Kata sandi baru" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} ctx={user} minLen={state.settings.minPasswordLength} generate />
      <PwField label="Ulangi kata sandi baru" value={pw.conf} onChange={(e) => setPw({ ...pw, conf: e.target.value })} />
      {err && <p className="err">{err}</p>}
      <button onClick={async () => {
        const issues = passwordIssues(pw.next, user, state.settings.minPasswordLength)
        if (issues.length) return setErr(issues.join('; '))
        if (pw.next !== pw.conf) return setErr('Konfirmasi tidak sama.')
        try { await actions.changeOwnPassword(pw.cur, pw.next) } catch (e: any) { setErr(e.message) }
      }}>Simpan kata sandi baru</button>
    </Modal>
  )
}
