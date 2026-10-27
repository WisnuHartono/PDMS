import { useMemo, useState, type ReactNode } from 'react'
import { actions, useApp, useAuth } from './store'
import { useCurrent, setDocPreset, isLate } from './Documents'
import { Avatar, Logo, BannerImg, StatusBadge, go, notify } from './ui'
import ReportDialog from './ReportDialog'
import { PERIOD_NAME, periodRange, periodText, type Period } from './report'
import { Columns, Donut, StackBars, Trend } from './charts'
import { ago, computeDash, shiftDate, type Bucket, type DocRow } from './dashboard'
import { Modal } from './ui'
import { downloadBlob, fileToLogo, fmtDate, toCsv, today } from './util'
import { bannerOf, bannerStyle } from './banner'
import { BannerControls } from './Projects'
import { BannerHead } from './ProjectBanner'
import type { DashPrefs } from './types'

type Span = 4 | 6 | 8 | 12
const DEFAULT_WIDGETS: { id: string; span: Span }[] = [
  { id: 'kpi', span: 12 }, { id: 'trend', span: 8 }, { id: 'aging', span: 4 }, { id: 'status', span: 4 }, { id: 'results', span: 4 },
  { id: 'discipline', span: 4 }, { id: 'attention', span: 6 }, { id: 'due', span: 6 }, { id: 'pic', span: 6 }, { id: 'activity', span: 6 },
]
const TITLES: Record<string, string> = {
  kpi: '📊 Ringkasan', trend: '📈 Tren Aktivitas', aging: '⏳ Usia Tunggu Review', status: '🏷 Dokumen per Status', results: '✅ Hasil Review',
  discipline: '🧩 Dokumen per Disiplin', attention: '🚨 Perlu Perhatian (terlambat)', due: '📅 Jatuh Tempo ≤ 7 Hari', pic: '👤 Beban per PIC', activity: '🕘 Aktivitas Terbaru',
}
const SPANS: Span[] = [4, 6, 8, 12]
const SPAN_LABEL: Record<number, string> = { 4: '⅓', 6: '½', 8: '⅔', 12: 'Penuh' }

const defaultPrefs = (): DashPrefs => ({ widgets: DEFAULT_WIDGETS.map((w) => ({ id: w.id, visible: true, span: w.span })), compact: false, hero: true, collapsed: [] })
function normalizePrefs(p?: DashPrefs): DashPrefs {
  const d = defaultPrefs()
  if (!p) return d
  const have = new Set(p.widgets.map((w) => w.id))
  return { ...d, ...p, widgets: [...p.widgets.filter((w) => TITLES[w.id]), ...d.widgets.filter((w) => !have.has(w.id))] }
}

let dragRef: string | null = null

interface Drill { title: string; rows: DocRow[]; preset?: Parameters<typeof setDocPreset>[0] }

export default function Dashboard() {
  const { state, project } = useCurrent()
  const { can, user } = useAuth()
  const [report, setReport] = useState(false)
  const [date, setDate] = useState(today())
  const [edit, setEdit] = useState(false)
  const [drill, setDrill] = useState<Drill | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const period = state.settings.report.period
  const prefs = normalizePrefs(user?.dashPrefs)
  const setPrefs = (p: DashPrefs) => actions.setDashPrefs(p)

  const t = today()
  const d = useMemo(() => (project ? computeDash(state, project, period, date, t) : null), [state, project, period, date, t])

  if (!project || !d)
    return (
      <div className="card">
        <h2>Selamat datang di {state.settings.appName || 'DocControl'}</h2>
        <p>Mulai dengan membuat proyek pertama Anda, lalu hubungkan akun Google di Pengaturan untuk menyimpan dokumen di Google Drive.</p>
        <div className="row"><button className="auto" onClick={() => go('/projects')}>Buat Proyek</button><button className="auto sec" onClick={() => actions.loadDemo()}>Muat data contoh</button></div>
      </div>
    )

  const open = (title: string, rows: DocRow[], preset?: Drill['preset']) => setDrill({ title: `${title} (${rows.length})`, rows, preset })
  const rowsBy = (f: (r: DocRow) => boolean) => d.rows.filter(f)
  const openBucket = (b: Bucket) => open(`Aktivitas ${b.start === b.end ? b.start : b.start + ' s.d. ' + b.end}`, rowsBy((r) => r.doc.revisions.some((x) => [x.issuedDate, x.reviewedDate].some((s) => s && s.slice(0, 10) >= b.start && s.slice(0, 10) <= b.end))))
  const mutate = (id: string, p: Partial<DashPrefs['widgets'][number]>) => setPrefs({ ...prefs, widgets: prefs.widgets.map((w) => (w.id === id ? { ...w, ...p } : w)) })
  const drop = (target: string) => {
    const src = dragRef || dragId
    if (!src || src === target) return
    const ws = [...prefs.widgets]
    const from = ws.findIndex((w) => w.id === src), to = ws.findIndex((w) => w.id === target)
    ws.splice(to, 0, ws.splice(from, 1)[0])
    setPrefs({ ...prefs, widgets: ws })
    dragRef = null
    setDragId(null)
  }
  const move = (id: string, dir: -1 | 1) => {
    const ws = [...prefs.widgets]
    const vis = ws.map((w, i) => (w.visible ? i : -1)).filter((i) => i >= 0)
    const pos = vis.findIndex((i) => ws[i].id === id)
    const tgt = vis[pos + dir]
    if (tgt === undefined) return
    const from = vis[pos]
    ;[ws[from], ws[tgt]] = [ws[tgt], ws[from]]
    setPrefs({ ...prefs, widgets: ws })
  }
  const matches = q.trim() ? d.docs.filter((x) => (x.number + ' ' + x.title).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : []
  const k = d.kpi

  const kpiCards: { label: string; value: ReactNode; color: string; icon: string; sub?: string; onClick: () => void }[] = [
    { label: 'Total dokumen', value: k.total, color: '#2563eb', icon: '🗂', sub: `+${d.stats.issued} diterbitkan periode ini`, onClick: () => open('Semua dokumen', d.rows, {}) },
    { label: 'Menunggu review', value: k.pending, color: '#d97706', icon: '⏳', sub: `rata-rata ${k.avgWait} hari kerja`, onClick: () => open('Menunggu review', rowsBy((r) => r.rev.reviewResult === 'Pending').sort((a, b) => b.daysWait - a.daysWait), { rv: 'Pending' }) },
    { label: 'Review terlambat', value: k.late, color: '#dc2626', icon: '🚨', sub: k.late ? 'lewat batas review' : 'semua tepat waktu', onClick: () => open('Review terlambat', d.attention, { rv: 'late' }) },
    { label: 'Disetujui', value: k.approved, color: '#16a34a', icon: '✅', sub: `${d.progress.docs}% dari total`, onClick: () => open('Disetujui', rowsBy((r) => r.rev.reviewResult.startsWith('Approved')), { rv: 'Approved' }) },
    { label: 'Ditolak', value: k.rejected, color: '#7f1d1d', icon: '⛔', sub: 'perlu revisi ulang', onClick: () => open('Ditolak', rowsBy((r) => r.rev.reviewResult === 'Rejected'), { rv: 'Rejected' }) },
    { label: 'Direview periode ini', value: d.stats.reviewed, color: '#0891b2', icon: '🔁', sub: `${d.stats.trs} transmittal`, onClick: () => openBucket({ key: '', label: '', ...periodRange(date, period), issued: 0, reviewed: 0, trs: 0 } as Bucket) },
  ]

  const body: Record<string, () => ReactNode> = {
    kpi: () => (
      <div className="kpis">
        {kpiCards.map((c) => (
          <button key={c.label} className="kpi" style={{ ['--kc' as string]: c.color }} onClick={c.onClick} title="Klik untuk rincian">
            <span className="kic">{c.icon}</span>
            <b>{c.value}</b>
            <span>{c.label}</span>
            <em>{c.sub}</em>
          </button>
        ))}
      </div>
    ),
    trend: () => <Trend buckets={d.buckets} onPick={openBucket} />,
    aging: () => (
      <>
        <Columns data={d.aging} unit=" hari kerja" onPick={(key) => { const a = d.aging.find((x) => x.key === key)!; const [lo, hi] = a.label === '>20' ? [21, 9999] : a.label.split('-').map(Number); open(`Menunggu ${a.label} hari kerja`, rowsBy((r) => r.rev.reviewResult === 'Pending' && r.daysWait >= lo && r.daysWait <= hi), { rv: 'Pending' }) }} />
        <div className="muted" style={{ textAlign: 'center', fontSize: 12 }}>hari kerja menunggu · merah = lebih dari 10 hari</div>
      </>
    ),
    status: () => <Donut data={d.byStatus} centerLabel="dokumen" onPick={(key) => open(`Status ${key}`, rowsBy((r) => r.rev.status === key), { st: key })} />,
    results: () => <Donut data={d.results} centerLabel="dokumen" onPick={(key) => open(d.results.find((x) => x.key === key)!.label, rowsBy((r) => r.rev.reviewResult === key), { rv: key })} />,
    discipline: () => (
      <StackBars
        rows={d.byDiscipline.map((x) => ({ key: x.key, parts: [{ v: x.approved, color: '#16a34a', label: 'Disetujui' }, { v: x.pending, color: '#d97706', label: 'Menunggu' }, { v: x.rejected, color: '#dc2626', label: 'Ditolak' }] }))}
        onPick={(key) => open(`Disiplin ${key}`, rowsBy((r) => r.doc.discipline === key), { disc: key })}
      />
    ),
    attention: () => (
      <div className="list">
        {d.attention.length === 0 && <div className="muted">🎉 Tidak ada dokumen terlambat.</div>}
        {d.attention.slice(0, 8).map((r) => (
          <a key={r.doc.id} href={'#/doc/' + r.doc.id} className="li">
            <div><b>{r.doc.number}</b> · Rev {r.rev.rev} <StatusBadge code={r.rev.status} /><div className="muted">{r.doc.title}</div></div>
            <div className="late" style={{ textAlign: 'right' }}>{r.daysLate} hari<div className="muted" style={{ fontWeight: 400 }}>PIC: {r.rev.pic || '-'}</div></div>
          </a>
        ))}
        {d.attention.length > 8 && <button className="sec sm" onClick={() => open('Review terlambat', d.attention, { rv: 'late' })}>Lihat semua ({d.attention.length})</button>}
      </div>
    ),
    due: () => (
      <div className="list">
        {d.dueSoon.length === 0 && <div className="muted">Tidak ada batas review dalam 7 hari ke depan.</div>}
        {d.dueSoon.slice(0, 8).map((r) => (
          <a key={r.doc.id} href={'#/doc/' + r.doc.id} className="li">
            <div><b>{r.doc.number}</b> · Rev {r.rev.rev} <StatusBadge code={r.rev.status} /><div className="muted">{r.doc.title}</div></div>
            <div style={{ textAlign: 'right', color: r.dueIn <= 2 ? 'var(--warn)' : undefined, fontWeight: 600 }}>{r.dueIn === 0 ? 'hari ini' : `${r.dueIn} hari lagi`}<div className="muted" style={{ fontWeight: 400 }}>{fmtDate(r.rev.dueDate)}</div></div>
          </a>
        ))}
      </div>
    ),
    pic: () => (
      <div className="list">
        {d.byPic.length === 0 && <div className="muted">Tidak ada dokumen yang sedang menunggu review.</div>}
        {d.byPic.map((p) => (
          <div key={p.key} className="li" style={{ cursor: 'pointer' }} onClick={() => open(`PIC ${p.key}`, rowsBy((r) => r.rev.reviewResult === 'Pending' && (r.rev.pic || '(Belum ada PIC)') === p.key), { rv: 'Pending' })}>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}><Avatar name={p.key.replace('(', '')} size={28} /><div><b>{p.key}</b><div className="muted">rata-rata {p.avg} hari kerja</div></div></div>
            <div style={{ textAlign: 'right' }}><b>{p.value}</b> dokumen{p.late > 0 && <div className="late">{p.late} terlambat</div>}</div>
          </div>
        ))}
      </div>
    ),
    activity: () => (
      <div className="list scroll">
        {d.logs.length === 0 && <div className="muted">Belum ada aktivitas.</div>}
        {d.logs.slice(0, 10).map((l) => {
          const ic = /Review/i.test(l.action) ? '✅' : /Transmittal/i.test(l.action) ? '📨' : /Revisi/i.test(l.action) ? '📄' : /Dokumen/i.test(l.action) ? '🗂' : /Proyek/i.test(l.action) ? '📁' : '•'
          return (
            <div key={l.id} className="li" style={{ cursor: l.docId ? 'pointer' : 'default' }} onClick={() => l.docId && go('/doc/' + l.docId)}>
              <div><span style={{ marginRight: 6 }}>{ic}</span><b>{l.action}</b><div className="muted">{l.detail} · {l.user.replace(/\s*\(.*\)$/, '')}</div></div>
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>{ago(l.ts)}</span>
            </div>
          )
        })}
      </div>
    ),
  }

  const hiddenW = prefs.widgets.filter((w) => !w.visible)
  const color = project.color || '#1d4ed8'
  const bs = bannerStyle(project)
  const P = d.progress

  return (
    <div className={prefs.compact ? 'compact' : ''}>
      {prefs.hero && (
        <div className={'hero pb-d' + (bs.dark ? ' dark' : '')} style={bs.style}>
          <BannerHead project={project} factor={0.7}>
            <div className="hero-code">{project.code}{project.contractNo && <span> · Kontrak {project.contractNo}</span>}</div>
            <h1>{project.name}</h1>
            <div className="hero-meta">
              {project.client && <span>🏢 {project.client}</span>}
              {project.contractor && <span>🏗 {project.contractor}</span>}
              {project.location && <span>📍 {project.location}</span>}
              {project.manager && <span>👤 PM: {project.manager}</span>}
            </div>
          </BannerHead>
          <div className="hero-prog">
            {P.schedule !== null && (
              <div><div className="hp-l"><span>Jadwal proyek</span><b>{P.schedule}%</b></div><div className="hp-b"><i style={{ width: P.schedule + '%' }} /></div>
                <small>{fmtDate(project.startDate)} → {fmtDate(project.endDate)}{P.daysLeft !== null && (P.daysLeft >= 0 ? ` · sisa ${P.daysLeft} hari` : ` · lewat ${-P.daysLeft} hari`)}</small></div>
            )}
            <div><div className="hp-l"><span>Dokumen disetujui</span><b>{P.docs}%</b></div><div className="hp-b"><i style={{ width: P.docs + '%', background: '#4ade80' }} /></div><small>{k.approved} dari {k.total} dokumen</small></div>
            <div><div className="hp-l"><span>Tepat waktu</span><b>{k.pending ? Math.round(((k.pending - k.late) / k.pending) * 100) : 100}%</b></div><div className="hp-b"><i style={{ width: (k.pending ? ((k.pending - k.late) / k.pending) * 100 : 100) + '%', background: '#fbbf24' }} /></div><small>{k.late} dari {k.pending} review terlambat</small></div>
          </div>
          <div className="row hero-act">
            {can('doc.create') && <button className="auto hbtn" onClick={() => { setDocPreset({ openNew: true }); go('/documents') }}>＋ Dokumen</button>}
            {can('transmittal.manage') && <button className="auto hbtn" onClick={() => go('/transmittals')}>📨 Transmittal</button>}
            <button className="auto hbtn" onClick={() => go('/files')}>📁 Berkas</button>
          </div>
        </div>
      )}

      <div className="rbar">
        <h2 className="rbar-t">📊 Laporan Proyek <span className="muted rbar-s">{project.code}</span></h2>
        <select className="rsel" value={period} title="Periode laporan" onChange={(e) => actions.updateSettings({ report: { ...state.settings.report, period: e.target.value as Period } })}>
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => <option key={p} value={p}>{PERIOD_NAME[p]}</option>)}
        </select>
        <div className="seg rnav">
          <button onClick={() => setDate(shiftDate(date, period, -1))} title="Periode sebelumnya">‹</button>
          <button className="rnav-d" title={periodText(date, period)} style={{ cursor: 'default' }}>{periodText(date, period).replace('Periode: ', '')}</button>
          <button onClick={() => setDate(shiftDate(date, period, 1))} title="Periode berikutnya">›</button>
          <button onClick={() => setDate(t)} disabled={date === t}>Hari ini</button>
        </div>
        <div className="search rbar-q">
          <input placeholder="🔎 Cari dokumen…" title="Cari berdasarkan nomor atau judul dokumen" value={q} onChange={(e) => setQ(e.target.value)} />
          {matches.length > 0 && (
            <div className="sres">
              {matches.map((m) => <a key={m.id} href={'#/doc/' + m.id}><b>{m.number}</b> {m.title}<span className="muted"> · {m.discipline}</span></a>)}
            </div>
          )}
        </div>
        <div className="rbar-a">
          {can('export') && <button className="auto" title={'Buat laporan ' + PERIOD_NAME[period].toLowerCase()} onClick={() => setReport(true)}>📄 Laporan</button>}
          <button className={'auto' + (edit ? '' : ' sec')} onClick={() => setEdit(!edit)}>{edit ? '✓ Selesai' : '⚙ Sesuaikan'}</button>
        </div>
      </div>

      {edit && (
        <div className="card editbar">
          <b>Mode sesuaikan:</b> seret widget (atau pakai tombol ↑ ↓) untuk memindah, pilih ukuran, atau sembunyikan. Tersimpan per pengguna.
          <div className="row" style={{ marginTop: 8, gap: 12 }}>
            <label className="chk"><input type="checkbox" checked={prefs.hero} onChange={(e) => setPrefs({ ...prefs, hero: e.target.checked })} /> Banner proyek</label>
            <label className="chk"><input type="checkbox" checked={prefs.compact} onChange={(e) => setPrefs({ ...prefs, compact: e.target.checked })} /> Mode ringkas</label>
            {hiddenW.map((w) => <button key={w.id} className="auto sec sm" onClick={() => mutate(w.id, { visible: true })}>＋ {TITLES[w.id]}</button>)}
            <button className="auto sec sm" onClick={() => setPrefs(defaultPrefs())}>↺ Reset tata letak</button>
          </div>
          {can('project.manage') && (
            <div style={{ marginTop: 10 }}>
              <BannerControls value={bannerOf(project)} onChange={(b) => actions.setBanner(project.id, b)} has={{ client: !!project.clientLogo, contractor: !!project.contractorLogo }} color={project.color}
                logos={{ client: project.clientLogo, contractor: project.contractorLogo }}
                onLogo={async (k, file) => { if (!file) return; try { actions.updateProject(project.id, k === 'client' ? { clientLogo: await fileToLogo(file) } : { contractorLogo: await fileToLogo(file) }) } catch (e: any) { notify(e.message) } }}
                onClear={(k) => actions.updateProject(project.id, k === 'client' ? { clientLogo: '' } : { contractorLogo: '' })} />
            </div>
          )}
                  </div>
      )}

      <div className="g12">
        {prefs.widgets.filter((w) => w.visible).map((w) => {
          const collapsed = prefs.collapsed.includes(w.id)
          return (
            <section key={w.id} className={'w' + (edit ? ' editing' : '') + (dragId === w.id ? ' dragging' : '')} style={{ gridColumn: `span ${w.span}` }}
              draggable={edit} onDragStart={(e) => { e.dataTransfer.setData('text/plain', w.id); e.dataTransfer.effectAllowed = 'move'; dragRef = w.id; setTimeout(() => setDragId(w.id), 0) }} onDragEnd={() => { dragRef = null; setDragId(null) }} onDragOver={(e) => edit && e.preventDefault()} onDrop={(e) => { e.preventDefault(); drop(w.id) }}>
              <header className="wh">
                <h3>{edit && <span className="grip" title="Seret untuk memindah">⠿</span>}{TITLES[w.id]}</h3>
                <span className="wc">
                  {edit ? (
                    <>
                      <button className="sec sm" onClick={() => move(w.id, -1)} title="Naikkan">↑</button>
                      <button className="sec sm" onClick={() => move(w.id, 1)} title="Turunkan">↓</button>
                      <select value={w.span} onChange={(e) => mutate(w.id, { span: +e.target.value as Span })} title="Ukuran">{SPANS.map((s) => <option key={s} value={s}>{SPAN_LABEL[s]}</option>)}</select>
                      <button className="sec sm" onClick={() => mutate(w.id, { visible: false })} title="Sembunyikan">✕</button>
                    </>
                  ) : (
                    <button className="sec sm" onClick={() => setPrefs({ ...prefs, collapsed: collapsed ? prefs.collapsed.filter((x) => x !== w.id) : [...prefs.collapsed, w.id] })} title={collapsed ? 'Buka' : 'Ciutkan'}>{collapsed ? '▸' : '▾'}</button>
                  )}
                </span>
              </header>
              {!collapsed && <div className="wb">{body[w.id]()}</div>}
            </section>
          )
        })}
      </div>
      {prefs.widgets.every((w) => !w.visible) && <div className="card muted">Semua widget disembunyikan. Klik "Sesuaikan" untuk menampilkannya kembali.</div>}

      {report && <ReportDialog project={project} onClose={() => setReport(false)} />}
      {drill && <DrillModal drill={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}

function DrillModal({ drill, onClose }: { drill: Drill; onClose: () => void }) {
  const csv = () => {
    const rows = [['No. Dokumen', 'Judul', 'Disiplin', 'Rev', 'Status', 'Hasil review', 'PIC', 'Hari tunggu', 'Batas review']].concat(
      drill.rows.map((r) => [r.doc.number, r.doc.title, r.doc.discipline, r.rev.rev, r.rev.status, r.rev.reviewResult, r.rev.pic || '', String(r.daysWait), r.rev.dueDate]),
    )
    downloadBlob(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv' }), 'rincian-dashboard.csv')
  }
  return (
    <Modal title={drill.title} onClose={onClose}>
      <div className="tw" style={{ maxHeight: '60vh', overflow: 'auto' }}>
        <table>
          <thead><tr><th>No. Dokumen</th><th>Judul</th><th>Disiplin</th><th>Rev</th><th>Status</th><th>Review</th><th>PIC</th><th>Hari tunggu</th><th>Batas</th></tr></thead>
          <tbody>
            {drill.rows.map((r) => (
              <tr key={r.doc.id} className="click" onClick={() => { onClose(); go('/doc/' + r.doc.id) }}>
                <td><b>{r.doc.number}</b></td><td>{r.doc.title}</td><td>{r.doc.discipline}</td><td>{r.rev.rev}</td><td><StatusBadge code={r.rev.status} /></td>
                <td>{r.rev.reviewResult}</td><td>{r.rev.pic || '-'}</td><td>{r.rev.reviewResult === 'Pending' ? r.daysWait : '-'}</td>
                <td className={isLate(r.rev) ? 'late' : ''}>{fmtDate(r.rev.dueDate)}</td>
              </tr>
            ))}
            {drill.rows.length === 0 && <tr><td colSpan={9} className="muted">Tidak ada dokumen.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {drill.preset && <button className="auto" onClick={() => { setDocPreset(drill.preset!); onClose(); go('/documents') }}>Buka di Register</button>}
        <button className="auto sec" onClick={csv}>⬇ Unduh CSV</button>
      </div>
    </Modal>
  )
}
