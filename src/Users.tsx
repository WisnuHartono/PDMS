import { useState } from 'react'
import { actions, useApp, useAuth } from './store'
import { Avatar, Modal, PasswordInput, ask, notify } from './ui'
import { IdentityFields, PhotoPicker } from './Profile'
import { passwordIssues } from './auth'
import { PERMISSIONS } from './defaults'
import type { Permission, Role, User } from './types'
import { uid } from './util'

type Draft = Omit<User, 'id' | 'pw' | 'createdAt' | 'failedAttempts'>
const blank = (roleId: string): Draft => ({
  username: '', name: '', email: '', phone: '', position: '', department: '', company: '', employeeId: '', note: '',
  roleId, active: true, allowedProjects: 'all', mustChange: true,
})

function UserForm({ user, onClose }: { user?: User; onClose: () => void }) {
  const { state } = useApp()
  const [f, setF] = useState<Draft & { photo?: string }>(user ? { ...user } : blank('doc_control'))
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: any) => setF({ ...f, [k]: v })
  const sel = f.allowedProjects === 'all' ? [] : f.allowedProjects
  const scoped = !!state.roles.find((r) => r.id === f.roleId)?.projectScoped
  const setRole = (id: string) => setF({ ...f, roleId: id, allowedProjects: state.roles.find((r) => r.id === id)?.projectScoped && f.allowedProjects === 'all' ? [] : f.allowedProjects })

  const save = async () => {
    setErr('')
    setBusy(true)
    try {
      if (!f.name.trim() || !f.username.trim() || !f.email.trim()) throw new Error('Nama, username, dan email wajib diisi.')
      if (user) {
        actions.updateUser(user.id, f)
      } else {
        const issues = passwordIssues(pw, f, state.settings.minPasswordLength)
        if (issues.length) throw new Error('Kata sandi: ' + issues.join('; '))
        await actions.createUser(f, pw)
      }
      onClose()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={user ? `Ubah Pengguna · ${user.username}` : 'Pengguna Baru'} onClose={onClose}>
      <PhotoPicker name={f.name} photo={f.photo} onChange={(v) => set('photo', v)} />
      <IdentityFields f={f} set={set} />
      <div className="row">
        <label>Peran<select value={f.roleId} onChange={(e) => setRole(e.target.value)}>{state.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label>Status akun<select value={f.active ? '1' : '0'} onChange={(e) => set('active', e.target.value === '1')}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></label>
      </div>
      <label>Akses proyek
        <select value={f.allowedProjects === 'all' ? 'all' : 'sel'} onChange={(e) => set('allowedProjects', e.target.value === 'all' ? 'all' : [])}>
          {!scoped && <option value="all">Semua proyek</option>}<option value="sel">Proyek tertentu saja</option>
        </select>
        {scoped && <span className="muted" style={{ fontSize: 12 }}>Peran ini wajib dibatasi pada proyek yang ditugaskan. Pilih minimal satu proyek.</span>}
      </label>
      {f.allowedProjects !== 'all' && (
        <div className="card" style={{ padding: 8 }}>
          {state.projects.length === 0 && <span className="muted">Belum ada proyek.</span>}
          {state.projects.map((p) => (
            <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit', margin: 0 }}>
              <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={sel.includes(p.id)} onChange={(e) => set('allowedProjects', e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} />
              {p.code} - {p.name}
            </label>
          ))}
        </div>
      )}
      {!user && (
        <>
          <PasswordInput label="Kata sandi awal" value={pw} onChange={setPw} ctx={f} minLen={state.settings.minPasswordLength} generate />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit' }}>
            <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={f.mustChange} onChange={(e) => set('mustChange', e.target.checked)} />
            Wajib ganti kata sandi saat login pertama
          </label>
        </>
      )}
      {err && <p className="err">{err}</p>}
      <button disabled={busy} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
    </Modal>
  )
}

function ResetPw({ user, onClose }: { user: User; onClose: () => void }) {
  const { state } = useApp()
  const [pw, setPw] = useState('')
  const [must, setMust] = useState(true)
  const [err, setErr] = useState('')
  return (
    <Modal title={`Reset Kata Sandi · ${user.username}`} onClose={onClose}>
      <PasswordInput label="Kata sandi baru" value={pw} onChange={setPw} ctx={user} minLen={state.settings.minPasswordLength} generate />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit' }}>
        <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={must} onChange={(e) => setMust(e.target.checked)} /> Wajib diganti saat login berikutnya
      </label>
      {err && <p className="err">{err}</p>}
      <button onClick={async () => {
        const i = passwordIssues(pw, user, state.settings.minPasswordLength)
        if (i.length) return setErr(i.join('; '))
        try { await actions.setPassword(user.id, pw, must); onClose(); notify('Kata sandi direset. Sampaikan kata sandi baru kepada pengguna melalui jalur yang aman.') } catch (e: any) { setErr(e.message) }
      }}>Reset</button>
    </Modal>
  )
}

function RoleManager() {
  const { state } = useApp()
  const [name, setName] = useState('')
  const toggle = (r: Role, p: Permission) =>
    actions.saveRole({ ...r, permissions: r.permissions.includes(p) ? r.permissions.filter((x) => x !== p) : [...r.permissions, p] })
  return (
    <div className="card rtab">
      <h2>Peran & Hak Akses</h2>
      <table>
        <colgroup><col style={{ width: '28%' }} />{state.roles.map((r) => <col key={r.id} />)}</colgroup>
        <thead><tr><th>Hak akses</th>{state.roles.map((r) => <th key={r.id} style={{ textAlign: 'center' }}>{r.name}</th>)}</tr></thead>
        <tbody>
          {PERMISSIONS.map(([p, label]) => (
            <tr key={p}>
              <td>{label}</td>
              {state.roles.map((r) => (
                <td key={r.id} style={{ textAlign: 'center' }}>
                  <input type="checkbox" style={{ width: 'auto' }} disabled={r.id === 'admin'} checked={r.id === 'admin' || r.permissions.includes(p)} onChange={() => toggle(r, p)} />
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td><b>Akses terbatas pada proyek yang ditugaskan</b><div className="muted">Hanya melihat dan mengelola proyek yang dipilih untuk pengguna.</div></td>
            {state.roles.map((r) => (
              <td key={r.id} style={{ textAlign: 'center' }}>
                <input type="checkbox" style={{ width: 'auto' }} disabled={r.id === 'admin'} checked={!!r.projectScoped} onChange={() => actions.saveRole({ ...r, projectScoped: !r.projectScoped })} />
              </td>
            ))}
          </tr>
          <tr className="rdel">
            <td></td>
            {state.roles.map((r) => (
              <td key={r.id} style={{ textAlign: 'center' }}>
                {!['admin', 'doc_control'].includes(r.id) && (
                  <button className="dng sm" onClick={async () => { if (await ask(`Hapus peran ${r.name}?`)) try { actions.deleteRole(r.id) } catch (e: any) { notify(e.message) } }}>Hapus</button>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 10 }}>
        <input placeholder="Nama peran baru (mis. Kontraktor, Klien)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="auto" disabled={!name.trim()} onClick={() => { actions.saveRole({ id: 'r_' + uid(), name: name.trim(), description: '', permissions: [] }); setName('') }}>+ Tambah peran</button>
      </div>
    </div>
  )
}

export default function Users() {
  const { state } = useApp()
  const { user: me, can } = useAuth()
  const [edit, setEdit] = useState<User | 'new' | null>(null)
  const [reset, setReset] = useState<User | null>(null)
  if (!can('users.manage')) return <div className="card">Anda tidak memiliki izin untuk mengelola pengguna.</div>
  const guard = (fn: () => void) => { try { fn() } catch (e: any) { notify(e.message) } }

  return (
    <>
      <div className="top"><h1>Pengguna</h1><button onClick={() => setEdit('new')}>+ Pengguna Baru</button></div>
      <div className="card tw utab">
        <table>
          <thead><tr><th>Pengguna</th><th>Peran</th><th>Kontak</th><th>Proyek</th><th>Status</th><th>Login terakhir</th><th></th></tr></thead>
          <tbody>
            {state.users.map((u) => {
              const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date()
              return (
                <tr key={u.id}>
                  <td><div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}><Avatar name={u.name} photo={u.photo} /><div><b>{u.name}</b>{u.id === me?.id && ' (Anda)'}<div className="muted">@{u.username} · {u.position || '-'}</div></div></div></td>
                  <td>{state.roles.find((r) => r.id === u.roleId)?.name || u.roleId}</td>
                  <td>{u.email}<div className="muted">{u.phone}</div></td>
                  <td>{u.allowedProjects === 'all' ? 'Semua' : u.allowedProjects.map((id) => state.projects.find((p) => p.id === id)?.code).filter(Boolean).join(', ') || <span className="err">belum ada</span>}</td>
                  <td>
                    <span className={'pill ' + (u.active ? 'ok' : 'err')}>{u.active ? 'Aktif' : 'Nonaktif'}</span>{' '}
                    {locked && <span className="pill err">Terkunci</span>} {u.totpEnabled && <span className="pill">2FA</span>} {u.mustChange && <span className="pill">Wajib ganti sandi</span>}
                  </td>
                  <td className="nw">{u.lastLogin ? new Date(u.lastLogin).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td><div className="acts">
                    <button className="sec sm" onClick={() => setEdit(u)}>Ubah</button>
                    <button className="sec sm" onClick={() => setReset(u)}>Reset sandi</button>
                    {locked && <button className="sec sm" onClick={() => actions.unlockUser(u.id)}>Buka kunci</button>}
                    {u.totpEnabled && <button className="sec sm" onClick={() => actions.disableTotp(u.id)}>Matikan 2FA</button>}
                    {u.id !== me?.id && <button className="dng sm" onClick={async () => { if (await ask(`Hapus pengguna ${u.username}?`)) guard(() => actions.deleteUser(u.id)) }}>Hapus</button>}
                  </div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <RoleManager />
      {edit && <UserForm user={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {reset && <ResetPw user={reset} onClose={() => setReset(null)} />}
    </>
  )
}
