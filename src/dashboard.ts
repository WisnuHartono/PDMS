import type { AppState, Doc, Project, Revision } from './types'
import { asOfDate, periodRange, periodStats, workdaysBetween, type Period } from './report'

export interface DocRow {
  doc: Doc
  rev: Revision
  daysWait: number // hari kerja menunggu sejak submit / kembali
  late: boolean
  daysLate: number // hari kalender melewati batas review
  dueIn: number // hari kalender menuju batas review (negatif = lewat)
}

export interface Bucket { key: string; label: string; start: string; end: string; issued: number; reviewed: number; trs: number }

const iso = (d: Date) => d.toISOString().slice(0, 10)
const parse = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00Z')
const diffDays = (a: string, b: string) => Math.round((+parse(b) - +parse(a)) / 864e5)
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function shiftDate(date: string, period: Period, dir: 1 | -1) {
  const d = parse(date)
  if (period === 'daily') d.setUTCDate(d.getUTCDate() + dir)
  else if (period === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * dir)
  else d.setUTCMonth(d.getUTCMonth() + dir)
  return iso(d)
}

export function computeDash(state: AppState, project: Project, period: Period, date: string, today: string) {
  const hol = new Set(state.settings.report.holidays)
  const wd = state.settings.report.workdays
  const docs = state.documents.filter((d) => d.projectId === project.id)
  const rows: DocRow[] = []
  for (const doc of docs) {
    const rev = doc.revisions.at(-1)
    if (!rev) continue
    const pending = rev.reviewResult === 'Pending'
    const from = rev.reviewedDate || rev.issuedDate
    const late = pending && !!rev.dueDate && rev.dueDate < today
    rows.push({
      doc, rev,
      daysWait: pending ? workdaysBetween(from, today, wd, hol) : 0,
      late,
      daysLate: late ? diffDays(rev.dueDate, today) : 0,
      dueIn: rev.dueDate ? diffDays(today, rev.dueDate) : 9999,
    })
  }
  const pend = rows.filter((r) => r.rev.reviewResult === 'Pending')
  const kpi = {
    total: rows.length,
    pending: pend.length,
    late: rows.filter((r) => r.late).length,
    approved: rows.filter((r) => r.rev.reviewResult.startsWith('Approved')).length,
    rejected: rows.filter((r) => r.rev.reviewResult === 'Rejected').length,
    avgWait: pend.length ? Math.round((pend.reduce((a, r) => a + r.daysWait, 0) / pend.length) * 10) / 10 : 0,
  }

  const byStatus = state.settings.statuses.map((s) => ({ key: s.code, label: s.label, color: s.color, value: rows.filter((r) => r.rev.status === s.code).length }))
  const discSet = [...new Set([...state.settings.disciplines, ...docs.map((d) => d.discipline)])]
  const byDiscipline = discSet
    .map((k) => {
      const rs = rows.filter((r) => r.doc.discipline === k)
      return { key: k, total: rs.length, pending: rs.filter((r) => r.rev.reviewResult === 'Pending').length, approved: rs.filter((r) => r.rev.reviewResult.startsWith('Approved')).length, rejected: rs.filter((r) => r.rev.reviewResult === 'Rejected').length }
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)

  const results = [
    { key: 'Pending', label: 'Menunggu review', color: '#d97706', value: kpi.pending },
    { key: 'Approved', label: 'Disetujui', color: '#16a34a', value: rows.filter((r) => r.rev.reviewResult === 'Approved').length },
    { key: 'Approved with comments', label: 'Disetujui dgn komentar', color: '#0891b2', value: rows.filter((r) => r.rev.reviewResult === 'Approved with comments').length },
    { key: 'Rejected', label: 'Ditolak', color: '#dc2626', value: kpi.rejected },
  ]

  const bucketsDef: [string, number, number, number][] = [['0-5', 0, 5, 0], ['6-10', 6, 10, 0], ['11-20', 11, 20, 0], ['>20', 21, 9999, 0]]
  const aging = bucketsDef.map(([label, lo, hi]) => ({ key: label + ' hari kerja', label, value: pend.filter((r) => r.daysWait >= lo && r.daysWait <= hi).length, danger: lo >= 11 }))

  const picMap = new Map<string, DocRow[]>()
  for (const r of pend) picMap.set(r.rev.pic || '(Belum ada PIC)', [...(picMap.get(r.rev.pic || '(Belum ada PIC)') || []), r])
  const byPic = [...picMap.entries()].map(([key, rs]) => ({ key, value: rs.length, late: rs.filter((r) => r.late).length, avg: Math.round((rs.reduce((a, r) => a + r.daysWait, 0) / rs.length) * 10) / 10 })).sort((a, b) => b.value - a.value)

  const attention = rows.filter((r) => r.late).sort((a, b) => b.daysLate - a.daysLate)
  const dueSoon = pend.filter((r) => !r.late && r.dueIn <= 7).sort((a, b) => a.dueIn - b.dueIn)

  // Tren: harian 14 hari, mingguan 8 pekan, bulanan 6 bulan (berakhir di periode terpilih)
  const buckets: Bucket[] = []
  const count = period === 'daily' ? 14 : period === 'weekly' ? 8 : 6
  let ref = date
  for (let i = 0; i < count; i++) {
    const { start, end } = periodRange(ref, period)
    const inR = (s?: string) => !!s && s.slice(0, 10) >= start && s.slice(0, 10) <= end
    let issued = 0, reviewed = 0
    for (const d of docs) for (const r of d.revisions) { if (inR(r.issuedDate)) issued++; if (inR(r.reviewedDate)) reviewed++ }
    const trs = state.transmittals.filter((t) => t.projectId === project.id && inR(t.date)).length
    const sd = parse(start)
    const label = period === 'monthly' ? `${MON[sd.getUTCMonth()]} ${String(sd.getUTCFullYear()).slice(2)}` : `${sd.getUTCDate()} ${MON[sd.getUTCMonth()]}`
    buckets.unshift({ key: start, label, start, end, issued, reviewed, trs })
    ref = shiftDate(start, period, -1)
  }

  const stats = periodStats(state, project, date, period)
  const asOf = asOfDate(date, period, today)
  const logs = state.logs.filter((l) => l.projectId === project.id)
  const progress = {
    schedule: project.startDate && project.endDate ? Math.max(0, Math.min(100, Math.round((diffDays(project.startDate, today) / Math.max(1, diffDays(project.startDate, project.endDate))) * 100))) : null,
    docs: rows.length ? Math.round((kpi.approved / rows.length) * 100) : 0,
    daysLeft: project.endDate ? diffDays(today, project.endDate) : null,
  }
  return { rows, kpi, byStatus, byDiscipline, results, aging, byPic, attention, dueSoon, buckets, stats, asOf, logs, progress, docs }
}

export function ago(ts: string) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'baru saja'
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} hari lalu`
  return new Date(ts).toLocaleDateString('id-ID')
}
