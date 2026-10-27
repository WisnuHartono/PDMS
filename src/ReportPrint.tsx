import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Project } from './types'
import { headers, longDate, summary, type ReportRow } from './report'

interface Meta { word: string; asOf: string; periodText: string; stats: string }

// Pratinjau cetak: lembar laporan seperti di kertas + tombol Cetak (mencetak lembar ini saja).
export function ReportPrint({ project, rows, meta, reviewer, paper, org, footer, onPaper, onDownload, onClose }: {
  project: Project; rows: ReportRow[]; meta: Meta; reviewer: string; paper: 'A4' | 'A3'; org?: string; footer?: string
  onPaper: (p: 'A4' | 'A3') => void; onDownload: () => void; onClose: () => void
}) {
  const [zoom, setZoom] = useState(() => (window.innerWidth < 800 ? 0.4 : 0.8))
  const [margin, setMargin] = useState(8)
  const H = headers(reviewer)
  const w = paper === 'A4' ? 297 : 420
  const fs = paper === 'A4' ? 7.5 : 10

  // @page dinamis sesuai ukuran kertas & margin
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = `@page{size:${paper} landscape;margin:${margin}mm}`
    document.head.appendChild(el)
    return () => el.remove()
  }, [paper, margin])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const print = () => { try { window.print() } catch { /* dialog cetak diblokir */ } }
  const th = (label: string, extra: Record<string, unknown> = {}, bg = '#f2dcdb') => <th style={{ background: bg }} {...extra}>{label}</th>

  return createPortal(
    <div className="pp-overlay">
      <div className="pp-toolbar">
        <b>Pratinjau Cetak</b>
        <label>Kertas
          <select value={paper} onChange={(e) => onPaper(e.target.value as 'A4' | 'A3')}><option>A4</option><option>A3</option></select>
        </label>
        <label>Margin {margin} mm<input type="range" min={4} max={20} value={margin} onChange={(e) => setMargin(+e.target.value)} /></label>
        <label>Zoom {Math.round(zoom * 100)}%<input type="range" min={0.3} max={1.5} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} /></label>
        <span style={{ flex: 1 }} />
        <button className="auto" onClick={print}>🖨 Cetak</button>
        <button className="auto sec" onClick={onDownload}>⬇ Unduh PDF</button>
        <button className="auto sec" onClick={onClose}>Tutup</button>
      </div>
      <div className="pp-stage">
        <div className="pp-sheet" style={{ width: `${w}mm`, padding: `${margin}mm`, fontSize: `${fs}pt`, zoom }}>
          <div className="pp-head">
            <div className="pp-logo">{project.clientLogo && <img src={project.clientLogo} alt="" />}</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.9em', fontWeight: 700 }}>LAPORAN {meta.word} DOKUMEN PROYEK</div>
              <div style={{ fontWeight: 700, fontSize: '1.2em' }}>{project.code} - {project.name}{project.contractNo ? `   |   No. Kontrak: ${project.contractNo}` : ''}</div>
              <div style={{ color: '#475569' }}>{[project.client && 'Klien: ' + project.client, project.contractor && 'Kontraktor: ' + project.contractor, org, meta.periodText.startsWith('Periode') ? meta.periodText : ''].filter(Boolean).join('   |   ')}</div>
            </div>
            <div className="pp-logo" style={{ justifyContent: 'flex-end' }}>{project.contractorLogo && <img src={project.contractorLogo} alt="" />}</div>
          </div>
          <table className="pp-table">
            <colgroup>{[0.065, 0.14, 0.18, 0.05, 0.06, 0.06, 0.07, 0.1, 0.05, 0.055, 0.05, 0.05, 0.07].map((f, i) => <col key={i} style={{ width: f * 100 + '%' }} />)}</colgroup>
            <thead>
              <tr>
                {th(H.disiplin, { rowSpan: 2 })}{th(H.docNo, { rowSpan: 2 })}{th(H.title, { rowSpan: 2 })}
                {th(longDate(meta.asOf), { colSpan: 3 }, '#e4dfec')}{th(H.resume, { colSpan: 2 })}
                {th(H.rev, { rowSpan: 2 })}{th(H.lastStatus, { rowSpan: 2 })}{th(H.desc, { rowSpan: 2 })}{th(H.daysZone, { rowSpan: 2 })}{th(H.holder, { rowSpan: 2 })}
              </tr>
              <tr>
                {th(H.daysPic, {}, '#e4dfec')}{th(H.datePic, {}, '#e4dfec')}{th(H.pic, {}, '#e4dfec')}{th(H.dateSubmit)}{th(H.trsNo)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const y = r.highlight ? { background: '#ffff00' } : undefined
                return (
                  <tr key={r.docId}>
                    <td>{r.disiplin}</td><td style={y}>{r.docNo}</td><td style={{ ...y, textAlign: 'left' }}>{r.title}</td>
                    <td>{r.daysPic}</td><td>{r.datePic}</td><td>{r.pic}</td><td>{r.dateSubmit}</td><td>{r.trsNo}</td><td>{r.rev}</td>
                    <td style={{ background: '#8db4e2' }}>{r.lastStatus}</td><td>{r.desc}</td><td>{r.daysZone}</td><td>{r.holder}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={13}>Tidak ada dokumen yang sesuai dengan filter laporan.</td></tr>}
            </tbody>
          </table>
          <div style={{ marginTop: 8 }}>
            <b>Total dokumen: {rows.length}{rows.length > 0 && '   |   ' + summary(rows).map(([k, n]) => `${k}: ${n}`).join('   |   ')}</b>
            <div>{meta.stats}</div>
            <div style={{ color: '#475569', fontSize: '.9em' }}>Hari dihitung sebagai hari kerja. Baris kuning = dokumen baru diterbitkan dalam periode laporan. {footer}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
