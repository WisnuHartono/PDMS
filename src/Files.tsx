import { useMemo, useState } from 'react'
import { actions, useAuth } from './store'
import { useCurrent } from './Documents'
import { StorageBadges } from './StorageUI'
import { StatusBadge, notify, go } from './ui'
import { buildZip } from './zip'
import { downloadBlob, fmtDate, fmtSize } from './util'
import { clean, enabledDests, fileNameFor, folderSegments } from './storage'
import type { Doc, Revision } from './types'

interface Item { doc: Doc; rev: Revision; segs: string[]; name: string }

export default function Files() {
  const { state, project } = useCurrent()
  const { can } = useAuth()
  const [busy, setBusy] = useState('')
  const [q, setQ] = useState('')
  const st = state.settings

  const items = useMemo<Item[]>(() => {
    if (!project) return []
    const out: Item[] = []
    for (const doc of state.documents.filter((d) => d.projectId === project.id))
      for (const rev of doc.revisions)
        if (rev.fileName) out.push({ doc, rev, segs: folderSegments(st, project, doc, rev), name: fileNameFor(st, project, doc, rev, rev.fileName) })
    return out.filter((i) => !q || (i.name + i.doc.title).toLowerCase().includes(q.toLowerCase()))
  }, [state.documents, project, st, q])

  if (!project) return <div className="card">Pilih proyek terlebih dahulu.</div>

  // pohon: folder (path) -> item
  const groups = new Map<string, Item[]>()
  for (const i of items) {
    const k = i.segs.join('/')
    groups.set(k, [...(groups.get(k) || []), i])
  }
  const keys = [...groups.keys()].sort()
  const dests = enabledDests(st)
  const failed = items.filter((i) => dests.some((d) => !i.rev.storage?.[d]?.ok)).length
  const total = items.reduce((a, i) => a + (i.rev.fileSize || 0), 0)

  const zip = async () => {
    setBusy('Menyusun ZIP...')
    try {
      const entries: { path: string; blob: Blob }[] = []
      let missing = 0
      for (const i of items) {
        const b = await actions.openFile(i.rev).catch(() => undefined)
        if (b) entries.push({ path: [...i.segs, i.name].join('/'), blob: b })
        else missing++
      }
      if (project.contractFile) {
        const b = await actions.openContract(project)
        if (b) entries.push({ path: `${clean(project.code + ' - ' + project.name)}/_Kontrak/${clean(project.contractFile.name, 180)}`, blob: b })
      }
      if (!entries.length) return notify('Tidak ada file yang tersedia di perangkat ini untuk dimasukkan ke ZIP.')
      downloadBlob(await buildZip(entries), `${clean(project.code)}-berkas.zip`)
      if (missing) notify(`${missing} file tidak tersedia di perangkat ini dan tidak dimasukkan (hubungkan Google Drive untuk mengambilnya).`)
    } catch (e: any) { notify(e.message) } finally { setBusy('') }
  }

  return (
    <>
      <div className="top">
        <div><h1>Berkas · {project.code}</h1><div className="muted">{items.length} file · {fmtSize(total)} · tujuan aktif: {dests.length ? dests.join(', ') : 'tidak ada'}</div></div>
        <div className="row">
          {can('export') && <button className="auto sec" disabled={!!busy} onClick={zip}>⬇ Unduh ZIP struktur folder</button>}
          {can('revision.issue') && <button className="auto" disabled={!!busy || !failed} onClick={async () => { setBusy('Mengirim...'); await actions.resyncAll(project.id); setBusy('') }}>↻ Kirim ulang yang belum tersimpan ({failed})</button>}
        </div>
      </div>
      {busy && <div className="card">{busy}</div>}
      <div className="card"><input placeholder="Cari nama file / judul dokumen..." value={q} onChange={(e) => setQ(e.target.value)} /></div>

      {project.contractFile && (
        <div className="card">
          <b>📁 {clean(project.code + ' - ' + project.name)} / _Kontrak</b>
          <div className="row" style={{ marginTop: 6 }}>
            <span>📎 {project.contractFile.name} ({fmtSize(project.contractFile.size)})</span>
            <span className="auto"><StorageBadges m={project.contractFile.storage} /></span>
          </div>
        </div>
      )}

      {keys.length === 0 && <div className="card muted">Belum ada berkas. Unggah file saat mencatat dokumen atau menerbitkan revisi.</div>}
      {keys.map((k) => (
        <details key={k} className="card" open>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>📁 {k} <span className="muted">({groups.get(k)!.length})</span></summary>
          <div className="tw"><table>
            <thead><tr><th>Nama file</th><th>Dokumen</th><th>Rev / Status</th><th>Ukuran</th><th>Tersimpan di</th><th></th></tr></thead>
            <tbody>
              {groups.get(k)!.map(({ doc, rev, name }) => (
                <tr key={rev.id}>
                  <td style={{ wordBreak: 'break-all' }}>📄 {name}</td>
                  <td><a href={'#/doc/' + doc.id}>{doc.number}</a><div className="muted">{doc.title}</div></td>
                  <td>Rev {rev.rev} <StatusBadge code={rev.status} /><div className="muted">{fmtDate(rev.issuedDate)}</div></td>
                  <td>{fmtSize(rev.fileSize)}</td>
                  <td><StorageBadges m={rev.storage} />{!rev.storage && <span className="muted">hanya di browser</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="sec sm" onClick={async () => { const b = await actions.openFile(rev).catch(() => undefined); b ? downloadBlob(b, rev.fileName || name) : notify('File tidak tersedia di perangkat ini.') }}>Unduh</button>{' '}
                    {can('revision.issue') && <button className="sec sm" onClick={() => actions.resyncRevision(doc.id, rev.id, true)}>Kirim ulang</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </details>
      ))}
      <p className="muted" style={{ fontSize: 12 }}>Folder lokal dan cloud disusun otomatis sesuai pola di Pengaturan &gt; Penyimpanan File. <a href="#/settings" onClick={() => go('/settings')}>Ubah pengaturan</a></p>
    </>
  )
}
