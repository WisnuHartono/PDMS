import { useState } from 'react'
import { actions, useApp, useAuth } from './store'
import { allowedStatuses } from './statusrules'
import { Modal, StatusBadge, PicInput, PickBox, go, ask, notify } from './ui'
import { downloadBlob, fmtDate, fmtSize, addDays, today } from './util'
import { isLate } from './Documents'
import { driveViewUrl } from './drive'
import { StorageBadges } from './StorageUI'
import type { Revision, ReviewResult } from './types'

export default function DocDetail({ id }: { id: string }) {
  const { state } = useApp()
  const { can, projects } = useAuth()
  const doc = state.documents.find((d) => d.id === id)
  const [newRev, setNewRev] = useState(false)
  const [review, setReview] = useState<Revision | null>(null)
  const [edit, setEdit] = useState(false)
  const [track, setTrack] = useState<Revision | null>(null)
  if (!doc || !projects.some((p) => p.id === doc.projectId)) return <div className="card">Dokumen tidak ditemukan atau Anda tidak memiliki akses ke proyeknya. <a href="#/documents">Kembali</a></div>
  const logs = state.logs.filter((l) => l.docId === id)
  const trName = (tid?: string) => state.transmittals.find((t) => t.id === tid)?.number

  const open = async (r: Revision) => {
    try {
      const b = await actions.openFile(r)
      if (b) downloadBlob(b, r.fileName || 'file')
      else if (r.driveFileId) window.open(driveViewUrl(r.driveFileId), '_blank')
      else notify('File tidak tersedia di perangkat ini. Hubungkan Google Drive untuk mengunduh.')
    } catch (e: any) {
      notify(e.message)
    }
  }

  return (
    <>
      <div className="top">
        <div>
          <a href="#/documents">← Register</a>
          <h1>{doc.number}</h1>
          <div>{doc.title}</div>
          <div className="muted">{doc.discipline} · {doc.category}</div>
        </div>
        <div className="row">
          {can('revision.issue') && <button className="auto" onClick={() => setNewRev(true)}>+ Terbitkan Revisi / Status Baru</button>}
          {can('doc.edit') && <button className="auto sec" onClick={() => setEdit(true)}>Ubah Data</button>}
          {can('doc.delete') && <button className="auto dng" onClick={async () => { if (await ask('Hapus dokumen ini beserta seluruh revisinya?')) { actions.deleteDoc(id); go('/documents') } }}>Hapus</button>}
        </div>
      </div>

      <div className="card">
        <h2>Riwayat Revisi & Status</h2>
        <div className="tl">
          {[...doc.revisions].reverse().map((r) => (
            <div key={r.id}>
              <div className="row" style={{ gap: 8 }}>
                <b className="auto">Rev {r.rev}</b>
                <span className="auto"><StatusBadge code={r.status} /></span>
                <span className="auto pill">{r.reviewResult}</span>
                {trName(r.transmittalId) && <span className="auto pill">{trName(r.transmittalId)}</span>}
              </div>
              <div className="muted">
                Terbit {fmtDate(r.issuedDate)} · batas review <span className={isLate(r) ? 'late' : ''}>{fmtDate(r.dueDate)}</span>
                {r.reviewedDate && <> · direview {fmtDate(r.reviewedDate)}</>} · oleh {r.createdBy}
              </div>
              {r.storage && <div style={{ marginTop: 4 }}><StorageBadges m={r.storage} />{Object.values(r.storage).find((x) => x?.ok) && <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>📁 {Object.values(r.storage).find((x) => x?.ok)!.path}</div>}{Object.values(r.storage).filter((x) => x && !x.ok).map((x, i) => <div key={i} className="err" style={{ fontSize: 12 }}>{x!.error}</div>)}</div>}
              {(r.pic || r.picDate || r.trsNo) && <div className="muted">PIC: <b>{r.pic || '-'}</b> · Ada pada: <b>{r.holder || (r.reviewResult === 'Pending' ? r.pic || '-' : 'pengirim')}</b> · ke PIC {fmtDate(r.picDate)}{r.trsNo && <> · Trs {r.trsNo}</>}</div>}
              {r.notes && <div>{r.notes}</div>}
              {r.reviewComment && <div><b>Komentar review:</b> {r.reviewComment}</div>}
              <div className="row" style={{ marginTop: 6 }}>
                {r.fileName && <button className="auto sec sm" onClick={() => open(r)}>⬇ {r.fileName} ({fmtSize(r.fileSize)})</button>}
                {r.driveFileId && <a className="auto" href={driveViewUrl(r.driveFileId)} target="_blank" rel="noreferrer">Buka di Drive</a>}
                {r.fileName && can('revision.issue') && <button className="auto sec sm" onClick={() => actions.resyncRevision(id, r.id, true)}>Kirim ulang</button>}
                {can('review.record') && <button className="auto sec sm" onClick={() => setReview(r)}>Catat hasil review</button>}
                {(can('revision.issue') || can('review.record')) && <button className="auto sec sm" onClick={() => setTrack(r)}>Ubah pelacakan</button>}
                {can('doc.delete') && <button className="auto sec sm" onClick={async () => (await ask(`Hapus Rev ${r.rev}?`)) && actions.deleteRevision(id, r.id)}>Hapus</button>}
              </div>
            </div>
          ))}
          {doc.revisions.length === 0 && <div className="muted">Belum ada revisi.</div>}
        </div>
      </div>

      <div className="card">
        <h2>Jejak Aktivitas (Audit Trail)</h2>
        <div className="tw"><table><tbody>
          {logs.map((l) => <tr key={l.id}><td>{new Date(l.ts).toLocaleString('id-ID')}</td><td>{l.user}</td><td>{l.action}</td><td>{l.detail}</td></tr>)}
        </tbody></table></div>
      </div>

      {newRev && <RevForm docId={id} onClose={() => setNewRev(false)} />}
      {edit && <EditDoc docId={id} onClose={() => setEdit(false)} />}
      {track && <TrackForm docId={id} rev={track} onClose={() => setTrack(null)} />}
      {review && <ReviewForm docId={id} rev={review} onClose={() => setReview(null)} />}
    </>
  )
}

function RevForm({ docId, onClose }: { docId: string; onClose: () => void }) {
  const { state } = useApp()
  const [rev, setRev] = useState(actions.suggestRev(docId))
  const doc = state.documents.find((d) => d.id === docId)
  const allowed = allowedStatuses(state.settings, doc?.category || '')
  const [status, setStatus] = useState(allowed[0]?.code || 'IFR')
  const [issued, setIssued] = useState(today())
  const [due, setDue] = useState(addDays(today(), state.settings.defaultReviewDays))
  const [notes, setNotes] = useState('')
  const [pic, setPic] = useState('')
  const [picDate, setPicDate] = useState('')
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  return (
    <Modal title="Terbitkan Revisi / Status Baru" onClose={onClose}>
      <div className="row">
        <label>Revisi<input value={rev} onChange={(e) => setRev(e.target.value)} /></label>
        <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}>{allowed.map((x) => <option key={x.code} value={x.code}>{x.code} - {x.label}</option>)}</select></label>
      </div>
      <div className="row">
        <label>Tanggal terbit<input type="date" value={issued} onChange={(e) => { setIssued(e.target.value); setDue(addDays(e.target.value, state.settings.defaultReviewDays)) }} /></label>
        <label>Batas review<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      </div>
      <div className="row">
        <PicInput label="PIC reviewer (opsional)" value={pic} onChange={setPic} projectId={state.documents.find((d) => d.id === docId)?.projectId} discipline={state.documents.find((d) => d.id === docId)?.discipline} />
        <label>Tanggal ke PIC<input type="date" value={picDate} onChange={(e) => setPicDate(e.target.value)} /></label>
      </div>
      <label>Catatan<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <label>File<PickBox text="Pilih file" name={file?.name} onFile={setFile} /></label>
      <button disabled={!rev.trim() || busy} onClick={async () => {
        setBusy(true)
        await actions.addRevision(docId, { rev, status, issuedDate: issued, dueDate: due, notes, pic: pic.trim() || undefined, picDate: picDate || undefined }, file)
        onClose()
      }}>{busy ? 'Menyimpan...' : 'Terbitkan'}</button>
    </Modal>
  )
}

function ReviewForm({ docId, rev, onClose }: { docId: string; rev: Revision; onClose: () => void }) {
  const [result, setResult] = useState<ReviewResult>(rev.reviewResult)
  const [comment, setComment] = useState(rev.reviewComment)
  const [date, setDate] = useState(rev.reviewedDate || today())
  return (
    <Modal title={`Hasil Review Rev ${rev.rev}`} onClose={onClose}>
      <label>Hasil<select value={result} onChange={(e) => setResult(e.target.value as ReviewResult)}>
        {['Pending', 'Approved', 'Approved with comments', 'Rejected'].map((x) => <option key={x}>{x}</option>)}
      </select></label>
      <label>Tanggal review<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>Komentar<textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
      <button onClick={() => {
        actions.updateRevision(docId, rev.id, { reviewResult: result, reviewComment: comment, reviewedDate: result === 'Pending' ? undefined : date }, `Review: ${result}`)
        onClose()
      }}>Simpan</button>
    </Modal>
  )
}

function EditDoc({ docId, onClose }: { docId: string; onClose: () => void }) {
  const { state } = useApp()
  const d = state.documents.find((x) => x.id === docId)!
  const [f, setF] = useState({ number: d.number, title: d.title, discipline: d.discipline, category: d.category })
  const dup = state.documents.some((x) => x.projectId === d.projectId && x.id !== d.id && x.number === f.number)
  return (
    <Modal title="Ubah Data Dokumen" onClose={onClose}>
      <label>Nomor dokumen<input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />{dup && <span className="err">Nomor sudah dipakai</span>}</label>
      <label>Judul<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <div className="row">
        <label>Disiplin<select value={f.discipline} onChange={(e) => setF({ ...f, discipline: e.target.value })}>{[...new Set([f.discipline, ...state.settings.disciplines])].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Kategori<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{[...new Set([f.category, ...state.settings.categories])].map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <button disabled={!f.number.trim() || !f.title.trim() || dup} onClick={() => { actions.updateDoc(docId, f); onClose() }}>Simpan</button>
    </Modal>
  )
}

function TrackForm({ docId, rev, onClose }: { docId: string; rev: Revision; onClose: () => void }) {
  const { state } = useApp()
  const [f, setF] = useState({ pic: rev.pic || '', picDate: rev.picDate || '', issuedDate: rev.issuedDate, trsNo: rev.trsNo || '', lastStatus: rev.lastStatus || '', holder: rev.holder || '' })
  const set = (k: string, v: string) => setF({ ...f, [k]: v })
  return (
    <Modal title={`Pelacakan Rev ${rev.rev}`} onClose={onClose}>
      <div className="row">
        <PicInput label="PIC reviewer" value={f.pic} onChange={(v) => set('pic', v)} projectId={state.documents.find((d) => d.id === docId)?.projectId} discipline={state.documents.find((d) => d.id === docId)?.discipline} />
        <label>Tanggal ke PIC<input type="date" value={f.picDate} onChange={(e) => set('picDate', e.target.value)} /></label>
      </div>
      <div className="row">
        <label>Tanggal submit<input type="date" value={f.issuedDate} onChange={(e) => set('issuedDate', e.target.value)} /></label>
        <label>No. transmittal (manual, bila tidak dibuat di aplikasi)<input value={f.trsNo} onChange={(e) => set('trsNo', e.target.value)} placeholder="mis. 301/TD/NK-BBB/TBBM" /></label>
      </div>
      <PicInput label="Dokumen saat ini ada pada (kosong = otomatis)" value={f.holder} onChange={(v) => set('holder', v)} projectId={state.documents.find((d) => d.id === docId)?.projectId} discipline={state.documents.find((d) => d.id === docId)?.discipline} placeholder="mis. PIC reviewer / kontraktor" />
      <label>Status terakhir di laporan
        <select value={f.lastStatus} onChange={(e) => set('lastStatus', e.target.value)}>
          <option value="">Otomatis (dari hasil review)</option>
          {state.settings.report.lastStatuses.map((s) => <option key={s.code} value={s.code}>{s.code} - {s.label}</option>)}
        </select>
      </label>
      <button onClick={() => {
        actions.updateRevision(docId, rev.id, { pic: f.pic.trim() || undefined, picDate: f.picDate || undefined, issuedDate: f.issuedDate, trsNo: f.trsNo.trim() || undefined, lastStatus: f.lastStatus || undefined, holder: f.holder.trim() || undefined }, 'Pelacakan diubah')
        onClose()
      }}>Simpan</button>
    </Modal>
  )
}
