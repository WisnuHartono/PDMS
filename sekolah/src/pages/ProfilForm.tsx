import { useEffect, useRef, useState } from 'react'
import { configGoogle, type ConfigGoogle, type PatchProfil } from '../security/akun'
import { nonceBaru, pasangTombolGoogle, verifikasiIdToken, type ProfilGoogle } from '../security/google'
import { Avatar, Btn, Field } from '../ui'
import { fotoKecil } from '../util'

/** Isian data profil lengkap + foto. Dipakai Administrator (semua akun) dan pengguna (profil sendiri). */
export function FormProfil({ v, onChange, nama }: { v: PatchProfil; onChange: (p: PatchProfil) => void; nama: string }) {
  const set = (p: PatchProfil) => onChange({ ...v, ...p })
  const t = (k: keyof PatchProfil, label: string, span: 1 | 2 | 3 | 4 = 2, tipe = 'text') => (
    <Field label={label} span={span}><input type={tipe} value={String(v[k] ?? '')} onChange={(e) => set({ [k]: e.target.value } as PatchProfil)} autoComplete="off" /></Field>
  )
  return (
    <div className="profil-form">
      <div className="profil-foto">
        <Avatar nama={v.nama || nama} foto={v.foto} size={92} />
        <div className="row-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <label className="btn">Pilih foto<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) set({ foto: await fotoKecil(f, 256) }) }} /></label>
          {v.foto && <Btn kind="ghost" onClick={() => set({ foto: undefined })}>Hapus foto</Btn>}
        </div>
      </div>
      <div className="form-grid">
        {t('nama', 'Nama lengkap', 2)}
        {t('jabatan', 'Jabatan / tugas', 2)}
        {t('nip', 'NIP / NIK / NUPTK', 2)}
        <Field label="Jenis kelamin" span={1}><select value={v.jk ?? ''} onChange={(e) => set({ jk: e.target.value as PatchProfil['jk'] })}><option value="">-</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></Field>
        {t('tempatLahir', 'Tempat lahir', 1)}
        {t('tanggalLahir', 'Tanggal lahir', 2, 'date')}
        {t('email', 'Email', 2, 'email')}
        {t('telepon', 'Telepon / WhatsApp', 2, 'tel')}
        {t('alamat', 'Alamat', 4)}
        <Field label="Keterangan / catatan" span={4}><textarea rows={2} value={v.keterangan ?? ''} onChange={(e) => set({ keterangan: e.target.value })} /></Field>
      </div>
    </div>
  )
}

/** Tombol resmi Google. Mengembalikan profil hanya setelah ID token lolos verifikasi di perangkat ini. */
export function TombolGoogle({ onProfil, teks = 'continue_with', cfg }: { onProfil: (g: ProfilGoogle) => void; teks?: 'signin_with' | 'continue_with'; cfg?: ConfigGoogle }) {
  const el = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState('')
  const [konfig, setKonfig] = useState<ConfigGoogle | undefined>(cfg)
  const [ulang, setUlang] = useState(0)
  useEffect(() => { if (!cfg) configGoogle().then(setKonfig) }, [cfg])
  useEffect(() => {
    if (!konfig?.aktif || !konfig.clientId || !el.current) return
    const nonce = nonceBaru()
    let batal = false
    pasangTombolGoogle(el.current, konfig.clientId, nonce, async (cred) => {
      try { const g = await verifikasiIdToken(cred, { clientId: konfig.clientId, nonce }); if (!batal) { setErr(''); onProfil(g) } } catch (e) { setErr((e as Error).message); setUlang((x) => x + 1) }
    }, teks).catch((e) => setErr((e as Error).message))
    return () => { batal = true }
  }, [konfig?.aktif, konfig?.clientId, ulang]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!konfig?.aktif || !konfig.clientId) return null
  return (
    <div className="g-wrap">
      <div ref={el} className="g-btn" />
      {err && <div className="errs small">{err}</div>}
    </div>
  )
}
