import { numberingOf } from './numbering'
import { useMemo, useState } from 'react'
import { actions, useApp, useAuth } from './store'
import { allowedStatuses } from './statusrules'
import { Modal, StatusBadge, PicInput, PickBox, go } from './ui'
import { downloadBlob, fmtDate, toCsv, today } from './util'
import { folderSegments } from './storage'

export function useCurrent() {
  const { state } = useApp()
  const { projects } = useAuth()
  const project = projects.find((p) => p.id === state.currentProjectId) || projects.find((p) => !p.archived)
  return { state, project }
}

export interface DocPreset { q?: string; st?: string; disc?: string; rv?: string; openNew?: boolean }
let preset: DocPreset | null = null
/** Dipakai Dashboard untuk membuka Register dengan filter / aksi tertentu. */
export const setDocPreset = (p: DocPreset | null) => { preset = p }

export function isLate(r: { dueDate: string; reviewResult: string }) {
  return r.reviewResult === 'Pending' && !!r.dueDate && r.dueDate < today()
}

export default function Documents() {
  const { state, project } = useCurrent()
  const { can } = useAuth()
  const [init] = useState<DocPreset>(() => { const p = preset || {}; preset = null; return p })
  const [q, setQ] = useState(init.q || '')
  const [st, setSt] = useState(init.st || '')
  const [disc, setDisc] = useState(init.disc || '')
  const [rv, setRv] = useState(init.rv || '')
  const [adding, setAdding] = useState(!!init.openNew)

  const rows = useMemo(
    () =>
      state.documents
        .filter((d) => d.projectId === project?.id)
        .filter((d) => !q || (d.number + ' ' + d.title).toLowerCase().includes(q.toLowerCase()))
        .filter((d) => !disc || d.discipline === disc)
        .filter((d) => !st || d.revisions.at(-1)?.status === st)
        .filter((d) => !rv || (rv === 'late' ? !!d.revisions.at(-1) && isLate(d.revisions.at(-1)!) : d.revisions.at(-1)?.reviewResult === rv)),
    [state.documents, project, q, st, disc, rv],
  )

  if (!project) return <div className="card">Buat atau pilih proyek terlebih dahulu.</div>

  const exportCsv = () => {
    const head = ['No. Dokumen', 'Judul', 'Disiplin', 'Kategori', 'Rev', 'Status', 'Tgl Terbit', 'Batas Review', 'Hasil Review']
    const body = rows.map((d) => {
      const r = d.revisions.at(-1)
      return [d.number, d.title, d.discipline, d.category, r?.rev, r?.status, r?.issuedDate, r?.dueDate, r?.reviewResult]
    })
    downloadBlob(new Blob(['﻿' + toCsv([head, ...body])], { type: 'text/csv' }), `register-${project.code}.csv`)
  }

  return (
    <>
      <div className="top">
        <h1>Register Dokumen · {project.code}</h1>
        <div className="row">
          {can('export') && <button className="auto sec" onClick={exportCsv}>Ekspor CSV</button>}
          {can('doc.create') && <button className="auto" onClick={() => setAdding(true)}>+ Dokumen Baru</button>}
        </div>
      </div>
      <div className="card">
        <div className="row">
          <input placeholder="Cari nomor / judul..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="">Semua status</option>
            {state.settings.statuses.map((s) => <option key={s.code}>{s.code}</option>)}
          </select>
          <select value={disc} onChange={(e) => setDisc(e.target.value)}>
            <option value="">Semua disiplin</option>
            {state.settings.disciplines.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={rv} onChange={(e) => setRv(e.target.value)}>
            <option value="">Semua hasil review</option>
            <option value="late">Terlambat (lewat batas review)</option>
            {['Pending', 'Approved', 'Approved with comments', 'Rejected'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="card tw">
        <table>
          <thead><tr><th>No. Dokumen</th><th>Judul</th><th>Disiplin</th><th>Rev</th><th>Status</th><th>Terbit</th><th>Batas Review</th><th>Review</th></tr></thead>
          <tbody>
            {rows.map((d) => {
              const r = d.revisions.at(-1)
              return (
                <tr key={d.id} className="click" onClick={() => go('/doc/' + d.id)}>
                  <td><b>{d.number}</b></td>
                  <td>{d.title}<div className="muted">{d.category}</div></td>
                  <td>{d.discipline}</td>
                  <td>{r?.rev ?? '-'}</td>
                  <td>{r ? <StatusBadge code={r.status} /> : '-'}</td>
                  <td>{fmtDate(r?.issuedDate)}</td>
                  <td className={r && isLate(r) ? 'late' : ''}>{fmtDate(r?.dueDate)}{r && isLate(r) && ' (terlambat)'}</td>
                  <td>{r?.reviewResult ?? '-'}</td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">Tidak ada dokumen.</td></tr>}
          </tbody>
        </table>
      </div>
      {adding && <NewDoc projectId={project.id} onClose={() => setAdding(false)} />}
    </>
  )
}

function NewDoc({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { state } = useApp()
  const s = state.settings
  const [title, setTitle] = useState('')
  const [discipline, setDiscipline] = useState(s.disciplines[0] || '')
  const [category, setCategory] = useState(s.categories[0] || '')
  const nb = numberingOf(s)
  const [paper, setPaper] = useState(nb.defaultPaper)
  const [manual, setManual] = useState<string | null>(null)
  const auto = actions.nextDocNumber(projectId, { discipline, category, paper })
  const number = manual ?? auto
  const setNumber = (v: string) => setManual(v)
  const [status, setStatus] = useState(s.statuses[0]?.code || 'IFR')
  const [file, setFile] = useState<File>()
  const [pic, setPic] = useState('')
  const [picDate, setPicDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const allowed = allowedStatuses(s, category)
  const effStatus = allowed.some((x) => x.code === status) ? status : allowed[0]?.code || status
  const dup = state.documents.some((d) => d.projectId === projectId && d.number === number)

  const save = async () => {
    setBusy(true)
    const id = actions.addDoc({ projectId, number, title, discipline, category, paper })
    await actions.addRevision(id, { rev: actions.suggestRev(id), status: effStatus, ...(pic.trim() ? { pic: pic.trim(), picDate: picDate || today() } : {}) }, file)
    onClose()
    go('/doc/' + id)
  }
  return (
    <Modal title="Dokumen Baru" onClose={onClose}>
      <div className="row">
        <label>Nomor dokumen * <span className="muted" style={{ fontWeight: 400 }}>({manual === null ? 'otomatis dari disiplin, jenis & kertas' : <a href="#" onClick={(e) => { e.preventDefault(); setManual(null) }}>kembali ke otomatis</a>})</span><input value={number} onChange={(e) => setNumber(e.target.value)} />{dup && <span className="err">Nomor sudah dipakai</span>}</label>
        <label>Status awal<select value={effStatus} onChange={(e) => setStatus(e.target.value)}>{allowed.map((x) => <option key={x.code} value={x.code}>{x.code} - {x.label}</option>)}</select></label>
      </div>
      <label>Judul dokumen *<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <div className="row">
        <label>Disiplin<select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>{s.disciplines.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Jenis dokumen<select value={category} onChange={(e) => setCategory(e.target.value)}>{s.categories.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Ukuran kertas<select value={paper} onChange={(e) => setPaper(e.target.value)}>{nb.papers.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="row">
        <PicInput label="PIC (penerima dokumen / reviewer)" value={pic} onChange={setPic} projectId={projectId} discipline={discipline} placeholder="pilih atau ketik nama" />
        <label>Tanggal ke PIC<input type="date" value={picDate} onChange={(e) => setPicDate(e.target.value)} /></label>
      </div>
      <label>File (opsional, disimpan otomatis ke tujuan penyimpanan di Pengaturan)<PickBox text="Pilih file" name={file?.name} onFile={setFile} /></label>
      {(() => {
        const p = state.projects.find((x) => x.id === projectId)
        if (!p) return null
        const probe = { rev: actions.suggestRev('__new__'), status: effStatus, issuedDate: today() }
        const segs = folderSegments(s, p, { discipline, category, number } as any, probe)
        return <p className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>📁 Folder tujuan: {segs.join(' / ')}</p>
      })()}
      <button disabled={!number.trim() || !title.trim() || dup || busy} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
    </Modal>
  )
}
