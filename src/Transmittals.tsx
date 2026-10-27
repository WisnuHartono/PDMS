import { useState } from 'react'
import { actions, useAuth } from './store'
import { useCurrent } from './Documents'
import { Modal, StatusBadge, ask, Logo } from './ui'
import { downloadBlob, fmtDate, today } from './util'
import { TransmittalPrint } from './TransmittalPrint'
import { TransmittalEmail, trPdfName } from './TransmittalEmail'
import { buildTransmittalPdf } from './transmittalDoc'

export default function Transmittals() {
  const { state, project } = useCurrent()
  const { can } = useAuth()
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<string | null>(null)
  const [mail, setMail] = useState(false)
  const [prev, setPrev] = useState(false)
  if (!project) return <div className="card">Pilih proyek terlebih dahulu.</div>
  const list = state.transmittals.filter((t) => t.projectId === project.id)
  const t = list.find((x) => x.id === view)
  return (
    <>
      <div className="top"><h1>Transmittal · {project.code}</h1>{can('transmittal.manage') && <button onClick={() => setAdding(true)}>+ Transmittal Baru</button>}</div>
      <div className="card tw">
        <table>
          <thead><tr><th>No.</th><th>Tanggal</th><th>Kepada</th><th>Perihal</th><th>Dokumen</th><th></th></tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}><td><b>{x.number}</b></td><td>{fmtDate(x.date)}</td><td>{x.to}</td><td>{x.subject}</td><td>{x.items.length}</td>
                <td><button className="sec sm" onClick={() => setView(x.id)}>Lihat / Cetak</button>{can('transmittal.manage') && <> <button className="dng sm" onClick={async () => (await ask('Hapus transmittal ini?')) && actions.deleteTransmittal(x.id)}>Hapus</button></>}</td></tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="muted">Belum ada transmittal.</td></tr>}
          </tbody>
        </table>
      </div>
      {adding && <NewTr projectId={project.id} onClose={() => setAdding(false)} />}
      {t && (
        <Modal title={t.number} onClose={() => setView(null)}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <Logo src={project.clientLogo} label={project.client} h={48} />
            <div style={{ textAlign: 'center', alignSelf: 'center', flex: 1, padding: '0 8px' }}><b>{project.name}</b></div>
            <Logo src={project.contractorLogo} label={project.contractor} h={48} />
          </div>
          {(state.settings.organization || state.settings.orgAddress) && (
            <div className="muted" style={{ fontSize: 12, margin: '6px 0' }}>
              <b>{state.settings.organization}</b> {[state.settings.orgAddress, state.settings.orgPhone, state.settings.orgEmail, state.settings.orgWebsite].filter(Boolean).join(' · ')}
            </div>
          )}
          <div><b>{project.name}</b> ({project.code}){project.contractNo && <> · Kontrak {project.contractNo}</>}</div>
          <div>Dari: {t.from} → Kepada: {t.to}</div>
          <div>Tanggal: {fmtDate(t.date)} · Perihal: {t.subject}</div>
          <table style={{ margin: '10px 0' }}>
            <thead><tr><th>No. Dokumen</th><th>Judul</th><th>Rev</th><th>Status</th></tr></thead>
            <tbody>{t.items.map((i) => {
              const d = state.documents.find((x) => x.id === i.docId); const r = d?.revisions.find((x) => x.id === i.revId)
              return <tr key={i.revId}><td>{d?.number}</td><td>{d?.title}</td><td>{r?.rev}</td><td>{r && <StatusBadge code={r.status} />}</td></tr>
            })}</tbody>
          </table>
          {t.notes && <p>Catatan: {t.notes}</p>}
          <div className="row">
            <button className="auto" onClick={async () => downloadBlob(await buildTransmittalPdf(state, project, t), trPdfName(t))}>⬇ Unduh PDF Transmittal</button>
            <button className="auto" onClick={() => setMail(true)}>✉ Kirim via Email</button>
            <button className="auto sec" onClick={() => setPrev(true)}>🖨 Pratinjau Cetak</button>
            <button className="auto sec" onClick={() => downloadBlob(new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' }), t.number + '.json')}>Unduh JSON</button>
          </div>
        </Modal>
      )}
      {t && prev && <TransmittalPrint state={state} project={project} t={t} onDownload={async () => downloadBlob(await buildTransmittalPdf(state, project, t), trPdfName(t))} onClose={() => setPrev(false)} />}
      {t && mail && <TransmittalEmail project={project} t={t} onClose={() => setMail(false)} />}
    </>
  )
}

function NewTr({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { state } = useCurrent()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const cands = state.documents.filter((d) => d.projectId === projectId).map((d) => ({ d, r: d.revisions.at(-1) })).filter((x) => x.r && !x.r.transmittalId)
  const items = cands.filter((x) => sel[x.r!.id]).map((x) => ({ docId: x.d.id, revId: x.r!.id }))
  return (
    <Modal title="Transmittal Baru" onClose={onClose}>
      <div className="row">
        <label>Kepada *<input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Klien / reviewer" /></label>
        <label>Perihal *<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      </div>
      <label>Email penerima (opsional, untuk pengiriman email)<input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} /></label>
      <h3>Pilih revisi terbaru yang belum dikirim</h3>
      <div style={{ maxHeight: 220, overflow: 'auto', marginBottom: 10 }}>
        {cands.map(({ d, r }) => (
          <label key={r!.id} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit' }}>
            <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={!!sel[r!.id]} onChange={(e) => setSel({ ...sel, [r!.id]: e.target.checked })} />
            {d.number} · Rev {r!.rev} · <StatusBadge code={r!.status} /> · {d.title}
          </label>
        ))}
        {cands.length === 0 && <div className="muted">Semua dokumen sudah ditransmit.</div>}
      </div>
      <label>Catatan<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <button disabled={!to || !subject || !items.length} onClick={() => {
        actions.addTransmittal({ projectId, number: actions.nextTransmittalNumber(projectId), date: today(), from: state.settings.organization || 'Document Control', to, subject, notes, items, ...(toEmail.trim() ? { toEmail: toEmail.trim() } : {}) })
        onClose()
      }}>Buat Transmittal ({items.length})</button>
    </Modal>
  )
}
