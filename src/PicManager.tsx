import { useState } from 'react'
import { actions, useApp } from './store'
import { Modal } from './ui'
import { uid } from './util'
import type { Project, ProjectPic } from './types'

const FUNCS = ['Reviewer', 'Approver', 'Engineer', 'Document Control', 'Project Manager', 'Inspector', 'Konsultan MK']

// Daftar PIC per proyek: nama, fungsi, jabatan, kontak, dan disiplin yang ditangani.
export function PicManager({ project, onClose }: { project: Project; onClose: () => void }) {
  const { state } = useApp()
  const [list, setList] = useState<ProjectPic[]>(project.picList || [])
  const set = (id: string, p: Partial<ProjectPic>) => setList(list.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const add = (init: Partial<ProjectPic> = {}) => setList([...list, { id: uid(), name: '', func: '', position: '', disciplines: [], active: true, ...init }])
  const fromUsers = state.users.filter((u) => u.active && !list.some((x) => x.name === u.name))
  const toggleD = (x: ProjectPic, d: string) => set(x.id, { disciplines: x.disciplines.includes(d) ? x.disciplines.filter((y) => y !== d) : [...x.disciplines, d] })
  const chip = (on: boolean) => ({ className: 'pill', style: { cursor: 'pointer', border: '1px solid var(--line)', background: on ? 'var(--pri)' : 'var(--bg)', color: on ? '#fff' : 'inherit', marginRight: 4 } })
  return (
    <Modal title={`Daftar PIC · ${project.code}`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>Orang yang dapat menjadi PIC dokumen proyek ini. Pada form dokumen, pilihan PIC difilter menurut disiplin dokumen. Tanpa disiplin yang dipilih berarti semua disiplin.</p>
      {list.length === 0 && <div className="card muted">Belum ada PIC. Tambahkan PIC pertama atau ambil dari daftar pengguna.</div>}
      {list.map((x) => (
        <div className="card" key={x.id} style={{ padding: 10, marginBottom: 8, opacity: x.active ? 1 : 0.6 }}>
          <div className="row">
            <label>Nama<input value={x.name} onChange={(e) => set(x.id, { name: e.target.value })} /></label>
            <label>Fungsi<input list="pic-funcs" value={x.func} onChange={(e) => set(x.id, { func: e.target.value })} placeholder="mis. Reviewer" /></label>
            <label>Jabatan<input value={x.position} onChange={(e) => set(x.id, { position: e.target.value })} placeholder="mis. Sr. Engineer" /></label>
          </div>
          <div className="row">
            <label>Perusahaan / instansi<input value={x.company || ''} onChange={(e) => set(x.id, { company: e.target.value })} /></label>
            <label>Email<input type="email" value={x.email || ''} onChange={(e) => set(x.id, { email: e.target.value })} /></label>
            <label>Telepon / WhatsApp<input value={x.phone || ''} onChange={(e) => set(x.id, { phone: e.target.value })} /></label>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>Disiplin yang ditangani {x.disciplines.length === 0 && '(semua disiplin)'}</div>
          <div style={{ marginBottom: 6 }}>{state.settings.disciplines.map((d) => <span key={d} {...chip(x.disciplines.includes(d))} onClick={() => toggleD(x, d)}>{d}</span>)}</div>
          <div className="row" style={{ alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'inherit', margin: 0 }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={x.active} onChange={(e) => set(x.id, { active: e.target.checked })} /> Aktif</label>
            <button className="auto sec sm" onClick={() => setList(list.filter((y) => y.id !== x.id))}>Hapus</button>
          </div>
        </div>
      ))}
      <datalist id="pic-funcs">{FUNCS.map((f) => <option key={f} value={f} />)}</datalist>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="auto sec" onClick={() => add()}>+ Tambah PIC</button>
        {fromUsers.length > 0 && (
          <select className="auto" value="" onChange={(e) => { const u = state.users.find((y) => y.id === e.target.value); if (u) add({ name: u.name, position: u.position, company: u.company, email: u.email, phone: u.phone, func: state.roles.find((r) => r.id === u.roleId)?.name || '' }) }}>
            <option value="">+ Ambil dari pengguna...</option>
            {fromUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>
      <button disabled={list.some((x) => !x.name.trim())} onClick={() => { actions.setPicList(project.id, list.map((x) => ({ ...x, name: x.name.trim() }))); onClose() }}>Simpan Daftar PIC</button>
    </Modal>
  )
}
