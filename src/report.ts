import type { AppState, Doc, Project, Revision, ReportSettings } from './types'

export interface ReportRow {
  disiplin: string
  docNo: string
  title: string
  daysPic: number | ''
  datePic: string
  pic: string
  holder: string
  dateSubmit: string
  trsNo: string
  rev: string
  lastStatus: string
  desc: string
  daysZone: number
  highlight: boolean
  docId: string
}

export type Period = 'daily' | 'weekly' | 'monthly'
export type Scope = 'outstanding' | 'activity' | 'all'

export interface ReportOptions {
  date: string // yyyy-mm-dd, tanggal acuan periode
  period: Period
  scope: Scope
  disciplines: string[] // kosong = semua
  statuses: string[] // kosong = semua
  highlightNew: boolean
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const parse = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00Z')

/** 29-Sep-26 */
export function shortDate(s?: string) {
  if (!s) return ''
  const d = parse(s)
  if (isNaN(+d)) return s
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MON[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`
}

/** Monday, 19 October 2026 */
export function longDate(s: string) {
  return parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Jumlah hari kerja setelah `from` sampai dengan `to` (Senin-Jumat, atau Senin-Sabtu), tidak termasuk hari libur. */
export function workdaysBetween(from: string, to: string, days: 5 | 6, holidays: Set<string>) {
  const a = parse(from), b = parse(to)
  if (isNaN(+a) || isNaN(+b) || b <= a) return 0
  let n = 0
  for (const d = new Date(a.getTime() + 864e5); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay()
    if (wd === 0 || (days === 5 && wd === 6)) continue
    if (holidays.has(d.toISOString().slice(0, 10))) continue
    n++
  }
  return n
}

export function defaultLastStatus(r: Revision) {
  return r.reviewResult === 'Approved' ? 'A' : r.reviewResult === 'Approved with comments' ? 'C' : r.reviewResult === 'Rejected' ? 'X' : 'R'
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
export const PERIOD_WORD: Record<Period, string> = { daily: 'HARIAN', weekly: 'MINGGUAN', monthly: 'BULANAN' }
export const PERIOD_NAME: Record<Period, string> = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' }

/** Rentang periode: hari itu / Senin-Minggu pekan itu / 1 s.d. akhir bulan. */
export function periodRange(date: string, period: Period): { start: string; end: string } {
  const d = parse(date)
  if (period === 'daily') return { start: date, end: date }
  if (period === 'weekly') {
    const off = (d.getUTCDay() + 6) % 7
    const s = new Date(d.getTime() - off * 864e5)
    return { start: iso(s), end: iso(new Date(s.getTime() + 6 * 864e5)) }
  }
  return { start: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), end: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) }
}

/** Tanggal acuan perhitungan hari: akhir periode, tetapi tidak melewati hari ini. */
export function asOfDate(date: string, period: Period, todayStr: string) {
  const { end } = periodRange(date, period)
  return period === 'daily' ? date : end > todayStr ? todayStr : end
}

export function periodText(date: string, period: Period) {
  const { start, end } = periodRange(date, period)
  if (period === 'daily') return longDate(date)
  if (period === 'weekly') return `Periode: ${shortDate(start)} s.d. ${shortDate(end)}`
  return 'Periode: ' + parse(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function periodStats(state: AppState, project: Project, date: string, period: Period) {
  const { start, end } = periodRange(date, period)
  const inR = (s?: string) => !!s && s.slice(0, 10) >= start && s.slice(0, 10) <= end
  let issued = 0, reviewed = 0
  for (const d of state.documents.filter((x) => x.projectId === project.id))
    for (const r of d.revisions) { if (inR(r.issuedDate)) issued++; if (inR(r.reviewedDate)) reviewed++ }
  const trs = state.transmittals.filter((t) => t.projectId === project.id && inR(t.date)).length
  return { issued, reviewed, trs, text: `Diterbitkan: ${issued}   |   Direview/dikembalikan: ${reviewed}   |   Transmittal: ${trs}` }
}

export function buildRows(state: AppState, project: Project, o: ReportOptions): ReportRow[] {
  const rs: ReportSettings = state.settings.report
  const hol = new Set(rs.holidays)
  const order = state.settings.disciplines
  const rows: ReportRow[] = []
  const asOf = asOfDate(o.date, o.period, new Date().toISOString().slice(0, 10))
  for (const d of state.documents.filter((x) => x.projectId === project.id)) {
    const r = d.revisions.at(-1)
    if (!r) continue
    const rng = periodRange(o.date, o.period)
    const inR = (s?: string) => !!s && s.slice(0, 10) >= rng.start && s.slice(0, 10) <= rng.end
    const active = d.revisions.some((x) => inR(x.issuedDate) || inR(x.reviewedDate) || inR(x.picDate))
    if (o.scope === 'outstanding' && r.reviewResult !== 'Pending') continue
    if (o.scope === 'activity' && !active) continue
    if (o.disciplines.length && !o.disciplines.includes(d.discipline)) continue
    if (o.statuses.length && !o.statuses.includes(r.status)) continue
    const dateSubmit = r.reviewedDate || r.issuedDate
    const tr = state.transmittals.find((t) => t.id === r.transmittalId)
        rows.push({
      disiplin: d.discipline,
      docNo: d.number,
      title: d.title,
      daysPic: r.picDate ? workdaysBetween(r.picDate, asOf, rs.workdays, hol) : '',
      datePic: shortDate(r.picDate),
      pic: r.pic || '',
      holder: r.holder || (r.reviewResult === 'Pending' ? r.pic || 'Belum ada PIC' : project.contractor || r.createdBy || 'Pengirim'),
      dateSubmit: shortDate(dateSubmit),
      trsNo: tr?.number || r.trsNo || '',
      rev: `Rev ${r.rev}`,
      lastStatus: r.lastStatus || defaultLastStatus(r),
      desc: r.status,
      daysZone: workdaysBetween(dateSubmit, asOf, rs.workdays, hol),
      highlight: o.highlightNew && inR(r.issuedDate),
      docId: d.id,
    })
  }
  const idx = (x: string) => { const i = order.indexOf(x); return i < 0 ? 999 : i }
  return rows.sort((a, b) => idx(a.disiplin) - idx(b.disiplin) || a.docNo.localeCompare(b.docNo, undefined, { numeric: true }))
}

export function headers(reviewer: string) {
  return {
    disiplin: 'Disiplin', docNo: 'DOC. NO.', title: 'DRAWING / DOCUMENT TITLE',
    daysPic: 'Total Hari di PIC', datePic: 'Tanggal Ke PIC', pic: `PIC ${reviewer}`,
    resume: 'Resume', dateSubmit: 'Tanggal Submit / Kembali', trsNo: 'Nomor Trs', rev: 'Nomor Revisi',
    lastStatus: 'Status Terakhir', desc: 'Deskripsi', daysZone: `Total Hari Di ${reviewer}`, holder: 'Dokumen Saat Ini Ada Pada',
  }
}

export function summary(rows: ReportRow[]) {
  const by = new Map<string, number>()
  rows.forEach((r) => by.set(r.desc, (by.get(r.desc) || 0) + 1))
  return [...by.entries()]
}

export const reportFileName = (p: Project, date: string, period: Period, ext: string) => `Laporan-${PERIOD_NAME[period]}_${p.code}_${periodRange(date, period).start}${period === 'daily' ? '' : '_sd_' + periodRange(date, period).end}.${ext}`.replace(/[\\/:*?"<>|]/g, '-')
export type { Doc }
