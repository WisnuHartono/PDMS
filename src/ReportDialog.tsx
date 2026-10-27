import { useMemo, useState } from 'react'
import { actions, useApp } from './store'
import { Modal, notify } from './ui'
import { PERIOD_NAME, PERIOD_WORD, asOfDate, buildRows, headers, periodStats, periodText, reportFileName, summary, type Period, type Scope } from './report'
import { buildXlsx } from './xlsx'
import { buildPdf } from './pdf'
import { downloadBlob, today } from './util'
import { ReportPrint } from './ReportPrint'
import type { Project } from './types'

export default function ReportDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { state } = useApp()
  const st = state.settings
  const rs = st.report
  const [date, setDate] = useState(today())
  const [disc, setDisc] = useState<string[]>([])
  const [stat, setStat] = useState<string[]>([])
  const [hl, setHl] = useState(true)
  const [busy, setBusy] = useState('')
  const [preview, setPreview] = useState(false)
  const [hol, setHol] = useState(rs.holidays.join(', '))
  const setR = (p: Partial<typeof rs>) => actions.updateSettings({ report: { ...rs, ...p } })

  const rows = useMemo(
    () => buildRows(state, project, { date, period: rs.period, scope: rs.scope, disciplines: disc, statuses: stat, highlightNew: hl }),
    [state, project, date, rs.period, rs.scope, disc, stat, hl],
  )
  const meta = { word: PERIOD_WORD[rs.period], asOf: asOfDate(date, rs.period, today()), periodText: periodText(date, rs.period), stats: periodStats(state, project, date, rs.period).text }
  const H = headers(rs.reviewer)
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const extra = { org: st.organization, footer: st.footerText, appName: st.appName }

  const run = async (kind: 'pdf' | 'xlsx') => {
    setBusy(kind === 'pdf' ? 'Membuat PDF...' : 'Membuat Excel...')
    try {
      const blob = kind === 'pdf' ? await buildPdf(project, rows, meta, rs.reviewer, { paper: rs.paper, ...extra }) : await buildXlsx(project, rows, meta, rs.reviewer, extra)
      downloadBlob(blob, reportFileName(project, date, rs.period, kind))
    } catch (e: any) {
      notify('Gagal membuat laporan: ' + e.message)
    } finally {
      setBusy('')
    }
  }

  const chip = (on: boolean) => ({ className: 'pill', style: { cursor: 'pointer', border: '1px solid var(--line)', background: on ? 'var(--pri)' : 'var(--bg)', color: on ? '#fff' : 'inherit', marginRight: 4 } })

  return (
    <Modal title={`Laporan ${PERIOD_NAME[rs.period]} Dokumen`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 10 }}>
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <button key={p} className={'auto' + (rs.period === p ? '' : ' sec')} onClick={() => setR({ period: p })}>{PERIOD_NAME[p]}</button>
        ))}
        <span className="muted auto">{periodText(date, rs.period)}</span>
      </div>
      <div className="row">
        <label>{rs.period === 'daily' ? 'Tanggal laporan' : rs.period === 'weekly' ? 'Tanggal (pekan yang memuat tanggal ini)' : 'Tanggal (bulan yang memuat tanggal ini)'}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Nama pihak reviewer<input value={rs.reviewer} onChange={(e) => setR({ reviewer: e.target.value })} placeholder="mis. PDM Zona III" /></label>
      </div>
      <div className="row">
        <label>Dokumen yang dimuat
          <select value={rs.scope} onChange={(e) => setR({ scope: e.target.value as Scope })}>
            <option value="outstanding">Outstanding (menunggu review)</option>
            <option value="activity">Ada aktivitas dalam periode</option>
            <option value="all">Semua dokumen</option>
          </select>
        </label>
        <label>Hari kerja<select value={rs.workdays} onChange={(e) => setR({ workdays: +e.target.value as 5 | 6 })}><option value={5}>Senin - Jumat</option><option value={6}>Senin - Sabtu</option></select></label>
        <label>Kertas PDF<select value={rs.paper} onChange={(e) => setR({ paper: e.target.value as 'A4' | 'A3' })}><option>A4</option><option>A3</option></select></label>
      </div>
      <label>Hari libur nasional / cuti bersama (tanggal yyyy-mm-dd, pisahkan koma; tidak dihitung sebagai hari kerja)
        <input value={hol} onChange={(e) => setHol(e.target.value)} onBlur={() => setR({ holidays: hol.split(/[,\s]+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) })} placeholder="2026-10-20, 2026-12-25" />
      </label>
      <div style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 12 }}>Filter disiplin (kosong = semua)</div>
        {st.disciplines.map((d) => <span key={d} {...chip(disc.includes(d))} onClick={() => toggle(disc, d, setDisc)}>{d}</span>)}
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 12 }}>Filter deskripsi / status (kosong = semua)</div>
        {st.statuses.map((d) => <span key={d.code} {...chip(stat.includes(d.code))} onClick={() => toggle(stat, d.code, setStat)}>{d.code}</span>)}
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit' }}>
        <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={hl} onChange={(e) => setHl(e.target.checked)} />
        Sorot kuning dokumen yang diterbitkan dalam periode ini
      </label>

      <p className="muted" style={{ margin: '0 0 6px' }}>{meta.stats}</p>
      <h3>Pratinjau ({rows.length} dokumen{rows.length ? ' · ' + summary(rows).map(([k, n]) => `${k}: ${n}`).join(', ') : ''})</h3>
      <div className="tw" style={{ maxHeight: 240, overflow: 'auto', marginBottom: 10 }}>
        <table style={{ fontSize: 11 }}>
          <thead><tr><th>Disiplin</th><th>DOC. NO.</th><th>Judul</th><th>{H.daysPic}</th><th>{H.datePic}</th><th>{H.pic}</th><th>{H.dateSubmit}</th><th>{H.trsNo}</th><th>Rev</th><th>Status</th><th>{H.desc}</th><th>{H.daysZone}</th><th>{H.holder}</th></tr></thead>
          <tbody>
            {rows.slice(0, 50).map((r) => (
              <tr key={r.docId}>
                <td>{r.disiplin}</td><td style={{ background: r.highlight ? '#ffff00' : undefined, color: r.highlight ? '#000' : undefined }}>{r.docNo}</td><td style={{ background: r.highlight ? '#ffff00' : undefined, color: r.highlight ? '#000' : undefined }}>{r.title}</td>
                <td>{r.daysPic}</td><td>{r.datePic}</td><td>{r.pic || <span className="muted">-</span>}</td><td>{r.dateSubmit}</td><td>{r.trsNo}</td><td>{r.rev}</td>
                <td style={{ background: '#8db4e2', color: '#000', textAlign: 'center' }}>{r.lastStatus}</td><td>{r.desc}</td><td>{r.daysZone}</td><td>{r.holder}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={13} className="muted">Tidak ada dokumen yang sesuai filter.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && rows.some((r) => !r.pic) && <p className="muted" style={{ fontSize: 12 }}>Sebagian dokumen belum memiliki PIC / tanggal ke PIC. Isi lewat tombol "Ubah pelacakan" pada detail dokumen.</p>}
      <div className="row">
        <button className="auto" onClick={() => setPreview(true)}>🖨 Pratinjau Cetak</button>
        <button className="auto sec" disabled={!!busy} onClick={() => run('pdf')}>⬇ Unduh PDF</button>
        <button className="auto sec" disabled={!!busy} onClick={() => run('xlsx')}>⬇ Unduh Excel (.xlsx)</button>
        {busy && <span className="muted">{busy}</span>}
      </div>
      {preview && <ReportPrint project={project} rows={rows} meta={meta} reviewer={rs.reviewer} paper={rs.paper} org={st.organization} footer={st.footerText} onPaper={(p) => setR({ paper: p })} onDownload={() => run('pdf')} onClose={() => setPreview(false)} />}
    </Modal>
  )
}
