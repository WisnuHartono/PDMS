import { useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from '../icons'
import { TombolGoogle } from './ProfilForm'
import { cekSandi, gantiSandi, kebijakan, kekuatan, masuk, masukGoogle, pasangAwal, pulihkan, sandiKedaluwarsa, type HasilLogin, type Sesi } from '../security/akun'

export function SandiInput({ id, value, onChange, label, autoComplete = 'current-password', meter, username }: {
  id: string; value: string; onChange: (v: string) => void; label: string; autoComplete?: string; meter?: boolean; username?: string
}) {
  const [lihat, setLihat] = useState(false)
  const k = kekuatan(value)
  const err = meter && value ? cekSandi(value, username ?? '') : []
  return (
    <label className="field" htmlFor={id}>
      <span className="field-l">{label}</span>
      <div className="pw">
        <input id={id} type={lihat ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} spellCheck={false} />
        <button type="button" className="icon-btn" onClick={() => setLihat((x) => !x)} aria-label={lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{lihat ? '🙈' : '👁'}</button>
      </div>
      {meter && value && (
        <>
          <div className="pw-meter" data-k={k}><i /><i /><i /><i /></div>
          {err.length > 0 && <ul className="errs small">{err.map((e) => <li key={e}>{e}</li>)}</ul>}
        </>
      )}
    </label>
  )
}

function Layar({ judul, sub, children }: { judul: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="welcome">
      <div className="welcome-card auth">
        <div className="brand auth-brand"><span className="brand-mark"><Icon name="school" size={22} /></span><div><b>SIMAS</b><span className="brand-sub">Administrasi Sekolah</span></div></div>
        <h1>{judul}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
        <p className="muted tiny">🔒 Kata sandi di-hash dengan Argon2id. Data sekolah dienkripsi AES-256-GCM di perangkat ini.</p>
      </div>
    </div>
  )
}

/** Pemasangan pertama: membuat akun Administrator dan kode pemulihan. */
export function Pasang({ onSelesai }: { onSelesai: (s: Sesi, demo: boolean) => void }) {
  const [nama, setNama] = useState('')
  const [username, setUsername] = useState('admin')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [demo, setDemo] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [hasil, setHasil] = useState<{ sesi: Sesi; kodePemulihan: string } | null>(null)
  const [simpan, setSimpan] = useState(false)

  const kirim = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (pw !== pw2) return setErr('Konfirmasi kata sandi tidak sama.')
    setBusy(true)
    try { setHasil(await pasangAwal({ username, nama, password: pw })) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  if (hasil) return (
    <Layar judul="Simpan kode pemulihan" sub="Kode ini satu-satunya cara memulihkan akses bila kata sandi Administrator hilang. Data terenkripsi tidak dapat dibuka tanpa kata sandi atau kode ini.">
      <div className="kode-pemulihan" aria-label="Kode pemulihan">{hasil.kodePemulihan}</div>
      <div className="btn-row">
        <button type="button" className="btn btn-default" onClick={() => navigator.clipboard?.writeText(hasil.kodePemulihan).catch(() => undefined)}>Salin kode</button>
      </div>
      <p className="small">Tulis di kertas atau simpan di pengelola kata sandi, lalu simpan di tempat aman yang terpisah dari komputer ini.</p>
      <label className="chk"><input type="checkbox" checked={simpan} onChange={(e) => setSimpan(e.target.checked)} /> Saya sudah menyimpan kode pemulihan ini</label>
      <button className="btn btn-primary wide" disabled={!simpan} onClick={() => onSelesai(hasil.sesi, demo)}>Lanjut ke aplikasi</button>
    </Layar>
  )

  return (
    <Layar judul="Pemasangan pertama" sub="Buat akun Administrator. Akun lain (kepala sekolah, operator, wali kelas, guru) dapat ditambahkan setelah masuk.">
      <form onSubmit={kirim} className="auth-form">
        <label className="field"><span className="field-l">Nama lengkap</span><input value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="name" /></label>
        <label className="field"><span className="field-l">Nama pengguna</span><input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="username" /></label>
        <SandiInput id="pw1" label="Kata sandi" value={pw} onChange={setPw} autoComplete="new-password" meter username={username} />
        <SandiInput id="pw2" label="Ulangi kata sandi" value={pw2} onChange={setPw2} autoComplete="new-password" />
        <label className="chk"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Isi dengan data contoh untuk mencoba aplikasi</label>
        {err && <div className="errs">{err}</div>}
        <button className="btn btn-primary wide" disabled={busy}>{busy ? 'Mengamankan…' : 'Buat akun Administrator'}</button>
      </form>
    </Layar>
  )
}

/** Login + verifikasi 2 langkah + ganti sandi wajib + pemulihan. */
export function Masuk({ onMasuk }: { onMasuk: (s: Sesi) => void }) {
  const [mode, setMode] = useState<'login' | 'totp' | 'ganti' | 'pulih'>('login')
  const [username, setUsername] = useState('')
  const [pw, setPw] = useState('')
  const [kode, setKode] = useState('')
  const [baru, setBaru] = useState('')
  const [baru2, setBaru2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [lanjut, setLanjut] = useState<((k: string) => Promise<HasilLogin>) | null>(null)
  const [sesi, setSesi] = useState<Sesi | null>(null)

  const proses = async (h: HasilLogin) => {
    if (h.ok === true) {
      if (h.sesi.akun.wajibGantiSandi || sandiKedaluwarsa(h.sesi.akun, await kebijakan())) { setSesi(h.sesi); setMode('ganti'); return }
      onMasuk(h.sesi)
    } else if (h.ok === 'totp') { setLanjut(() => h.lanjut); setMode('totp') }
    else setErr(h.pesan)
  }
  const jalankan = (f: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await f() } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  if (mode === 'totp') return (
    <Layar judul="Verifikasi 2 langkah" sub="Masukkan 6 digit kode dari aplikasi autentikator (Google Authenticator, Microsoft Authenticator, dll.).">
      <form className="auth-form" onSubmit={jalankan(async () => { await proses(await lanjut!(kode)); setKode('') })}>
        <input className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={kode} onChange={(e) => setKode(e.target.value.replace(/\D/g, ''))} autoFocus aria-label="Kode verifikasi" />
        {err && <div className="errs">{err}</div>}
        <button className="btn btn-primary wide" disabled={busy || kode.length !== 6}>Verifikasi</button>
        <button type="button" className="btn btn-ghost" onClick={() => location.reload()}>Batal</button>
      </form>
    </Layar>
  )

  if (mode === 'ganti') return (
    <Layar judul="Buat kata sandi baru" sub="Akun Anda menggunakan kata sandi sementara atau kata sandi sudah kedaluwarsa. Buat kata sandi baru untuk melanjutkan.">
      <form className="auth-form" onSubmit={jalankan(async () => {
        if (baru !== baru2) throw new Error('Konfirmasi kata sandi tidak sama.')
        await gantiSandi(sesi!, pw, baru)
        onMasuk(sesi!)
      })}>
        <SandiInput id="nb1" label="Kata sandi baru" value={baru} onChange={setBaru} autoComplete="new-password" meter username={sesi?.akun.username} />
        <SandiInput id="nb2" label="Ulangi kata sandi baru" value={baru2} onChange={setBaru2} autoComplete="new-password" />
        {err && <div className="errs">{err}</div>}
        <button className="btn btn-primary wide" disabled={busy}>Simpan & masuk</button>
      </form>
    </Layar>
  )

  if (mode === 'pulih') return (
    <Layar judul="Pulihkan akun Administrator" sub="Gunakan kode pemulihan yang dibuat saat pemasangan.">
      <form className="auth-form" onSubmit={jalankan(async () => {
        if (baru !== baru2) throw new Error('Konfirmasi kata sandi tidak sama.')
        await proses(await pulihkan(username, kode, baru))
      })}>
        <label className="field"><span className="field-l">Nama pengguna Administrator</span><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></label>
        <label className="field"><span className="field-l">Kode pemulihan</span><input value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" spellCheck={false} /></label>
        <SandiInput id="pb1" label="Kata sandi baru" value={baru} onChange={setBaru} autoComplete="new-password" meter username={username} />
        <SandiInput id="pb2" label="Ulangi kata sandi baru" value={baru2} onChange={setBaru2} autoComplete="new-password" />
        {err && <div className="errs">{err}</div>}
        <button className="btn btn-primary wide" disabled={busy}>Pulihkan & masuk</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setErr(''); setMode('login') }}>Kembali</button>
      </form>
    </Layar>
  )

  return (
    <Layar judul="Masuk">
      <form className="auth-form" onSubmit={jalankan(async () => proses(await masuk(username, pw)))}>
        <label className="field"><span className="field-l">Nama pengguna atau email</span><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus /></label>
        <SandiInput id="pw" label="Kata sandi" value={pw} onChange={setPw} />
        {err && <div className="errs">{err}</div>}
        <button className="btn btn-primary wide" disabled={busy || !username || !pw}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setErr(''); setMode('pulih') }}>Lupa kata sandi Administrator?</button>
        <p className="muted small">Pengguna selain Administrator: minta Administrator mengatur ulang kata sandi Anda.</p>
      </form>
      <div className="g-sep">atau</div>
      <TombolGoogle teks="signin_with" onProfil={async (g) => { setErr(''); setBusy(true); try { await proses(await masukGoogle(g)) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) } }} />
    </Layar>
  )
}
