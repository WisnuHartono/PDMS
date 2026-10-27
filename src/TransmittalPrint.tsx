import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AppState, Project, Transmittal } from './types'
import { trLines } from './transmittalDoc'
import { fmtDate } from './util'

// Pratinjau cetak transmittal: lembar A4 portrait seperti di kertas; baru dari sini bisa dicetak.
export function TransmittalPrint({ state, project, t, onDownload, onClose }: { state: AppState; project: Project; t: Transmittal; onDownload: () => void; onClose: () => void }) {
  const lines = trLines(state, t)
  const [zoom, setZoom] = useState(() => (window.innerWidth < 800 ? 0.45 : 0.9))
  const [margin, setMargin] = useState(12)
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = `@page{size:A4 portrait;margin:${margin}mm}`
    document.head.appendChild(el)
    return () => el.remove()
  }, [margin])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const info: [string, string][] = [
    ['No. Transmittal', t.number], ['Tanggal', fmtDate(t.date)], ['Kepada', t.to], ['Dari', t.from],
    ['Proyek', `${project.name} (${project.code})`], ['No. Kontrak', project.contractNo || '-'], ['Perihal', t.subject],
  ]
  return createPortal(
    <div className="pp-overlay">
      <div className="pp-toolbar">
        <b>Pratinjau Cetak · {t.number}</b>
        <label>Margin {margin} mm<input type="range" min={5} max={25} value={margin} onChange={(e) => setMargin(+e.target.value)} /></label>
        <label>Zoom {Math.round(zoom * 100)}%<input type="range" min={0.3} max={1.5} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} /></label>
        <span style={{ flex: 1 }} />
        <button className="auto" onClick={() => { try { window.print() } catch { /* dialog cetak diblokir */ } }}>🖨 Cetak</button>
        <button className="auto sec" onClick={onDownload}>⬇ Unduh PDF</button>
        <button className="auto sec" onClick={onClose}>Tutup</button>
      </div>
      <div className="pp-stage">
        <div className="pp-sheet" style={{ width: '210mm', minHeight: '297mm', padding: `${margin}mm`, fontSize: '10pt', zoom }}>
          <div className="pp-head" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
            <div className="pp-logo">{project.clientLogo && <img src={project.clientLogo} alt="" />}</div>
            <div />
            <div className="pp-logo" style={{ justifyContent: 'flex-end' }}>{project.contractorLogo && <img src={project.contractorLogo} alt="" />}</div>
          </div>
          <hr style={{ border: 0, borderTop: '2px solid #1e293b', margin: '4px 0 10px' }} />
          <div style={{ textAlign: 'center', fontSize: '1.8em', fontWeight: 700 }}>TRANSMITTAL</div>
          <div style={{ textAlign: 'center', color: '#475569', fontSize: '.85em', marginBottom: 12 }}>Document Transmittal Form</div>
          <table style={{ marginBottom: 12, borderCollapse: 'collapse' }}>
            <tbody>{info.map(([k, v]) => <tr key={k}><td style={{ fontWeight: 700, padding: '1px 0', width: '34mm', verticalAlign: 'top' }}>{k}</td><td style={{ padding: '1px 8px 1px 0', verticalAlign: 'top' }}>:</td><td style={{ padding: '1px 0' }}>{v}</td></tr>)}</tbody>
          </table>
          <table className="pp-table">
            <colgroup>{[0.06, 0.2, 0.36, 0.07, 0.09, 0.1, 0.12].map((f, i) => <col key={i} style={{ width: f * 100 + '%' }} />)}</colgroup>
            <thead><tr>{['No.', 'No. Dokumen', 'Judul Dokumen', 'Rev', 'Status', 'Format', 'Batas Review'].map((h) => <th key={h} style={{ background: '#f2dcdb' }}>{h}</th>)}</tr></thead>
            <tbody>
              {lines.map((l) => <tr key={l.no}><td>{l.no}</td><td>{l.number}</td><td style={{ textAlign: 'left' }}>{l.title}</td><td>{l.rev}</td><td>{l.status}</td><td>{l.format}</td><td>{l.due}</td></tr>)}
            </tbody>
          </table>
          <div style={{ margin: '10px 0 4px' }}><b>Jumlah dokumen: {lines.length}</b></div>
          {t.notes && <div style={{ marginBottom: 6 }}><b>Catatan:</b><div style={{ whiteSpace: 'pre-wrap' }}>{t.notes}</div></div>}
          <div style={{ color: '#475569', fontSize: '.85em', marginBottom: 18 }}>Mohon konfirmasi penerimaan dengan menandatangani dan mengembalikan salinan transmittal ini.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, pageBreakInside: 'avoid' }}>
            {([['Dikirim oleh', t.from], ['Diterima oleh', t.to]] as const).map(([title, who]) => (
              <div key={title} style={{ border: '1px solid #000', height: '38mm', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#f2dcdb', textAlign: 'center', fontWeight: 700, borderBottom: '1px solid #000', padding: '2px 0' }}>{title}</div>
                <div style={{ padding: '3px 6px', color: '#475569', fontSize: '.85em', flex: 1 }}>{who}</div>
                <div style={{ padding: '0 6px 6px', fontSize: '.85em' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>Nama <span style={{ flex: 1, borderBottom: '1px solid #000', height: 14 }} /></div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 4 }}>Tanggal <span style={{ flex: 1, borderBottom: '1px solid #000', height: 14 }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
