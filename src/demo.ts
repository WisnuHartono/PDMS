import type { AppState, Doc, Revision, ReviewResult } from './types'
import { emptyState } from './defaults'
import { addDays, today } from './util'
import { fileNameFor, folderSegments } from './storage'

const d = (n: number) => addDays(today(), n)

const svgLogo = (text: string, bg: string, fg = '#fff') =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><rect width="300" height="100" rx="14" fill="${bg}"/><circle cx="48" cy="50" r="24" fill="${fg}" opacity=".9"/><text x="92" y="62" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="${fg}">${text}</text></svg>`)

export function demoState(): AppState {
  const base = emptyState()
  const mkProj = (id: string, code: string, name: string, client: string, location: string, color: string) => ({
    id, code, name, client, location, color, contractor: 'PT Contoh Engineering', manager: 'Budi Santoso', description: '',
    contractNo: '045/KTR/' + code, contractDate: d(-130), contractValue: 'Rp 12.500.000.000', clientLogo: svgLogo('TIRTA', '#0e7490'), contractorLogo: svgLogo('CONTOH', '#b45309'), startDate: d(-120), endDate: d(240), archived: false, createdAt: d(-120), numberPrefix: code, numberPadding: 4,
  })
  const rows: [string, string, string, [string, string, number, number, ReviewResult, string][]][] = [
    ['Plot Plan', 'Sipil', 'Drawing', [['A', 'IFR', -40, -26, 'Approved with comments', 'Perbarui batas lahan'], ['B', 'IFA', -20, -6, 'Approved', ''], ['0', 'IFC', -5, 9, 'Pending', '']]],
    ['Piping & Instrument Diagram Unit 100', 'Proses', 'Drawing', [['A', 'IFR', -18, -4, 'Pending', '']]],
    ['Single Line Diagram', 'Elektrikal', 'Drawing', [['A', 'IFR', -30, -16, 'Rejected', 'Rating breaker tidak sesuai'], ['B', 'IFR', -10, 4, 'Pending', '']]],
    ['Datasheet Pompa Transfer', 'Mekanikal', 'Datasheet', [['A', 'IFP', -12, 2, 'Approved', '']]],
    ['Perhitungan Pondasi Tangki', 'Struktur', 'Calculation', [['A', 'IFR', -25, -11, 'Pending', '']]],
    ['Prosedur Konstruksi Pemasangan Pipa', 'Perpipaan', 'Procedure', [['A', 'IFI', -8, 6, 'Approved', '']]],
    ['Spesifikasi Kabel Tegangan Menengah', 'Elektrikal', 'Specification', [['A', 'IFA', -15, -1, 'Pending', '']]],
    ['Laporan Survei Tanah', 'Sipil', 'Report', [['0', 'IFI', -60, -46, 'Approved', '']]],
  ]
  const documents: Doc[] = rows.map(([title, discipline, category, revs], i) => ({
    id: 'demo-d' + i, projectId: 'demo-p1', number: `PRJ-001-${String(i + 1).padStart(4, '0')}`, title, discipline, category,
    createdAt: d(revs[0][2]),
    revisions: revs.map(([rev, status, a, b, res, c], j): Revision => ({
      id: `demo-d${i}r${j}`, rev, status, issuedDate: d(a), dueDate: d(b), notes: '', reviewResult: res, reviewComment: c,
      reviewedDate: res === 'Pending' ? undefined : d(a + 7), createdBy: 'doc.control@contoh.com',
      transmittalId: (i === 0 && j === 1) || i === 7 ? 'demo-t1' : undefined,
    })),
  }))
  const proj1 = mkProj('demo-p1', 'PRJ-001', 'Pembangunan Pabrik Pengolahan Air', 'PT Tirta Makmur', 'Cikarang, Jawa Barat', '#1d4ed8')
  documents.forEach((doc) => {
    if (doc.projectId !== 'demo-p1') return
    doc.revisions.forEach((r, j) => {
      const orig = `${doc.title.replace(/[^A-Za-z0-9]+/g, '-')}_${r.rev}.pdf`
      const pics = ['Ali', 'Beny', 'Bagus', 'Billy']
      r.pic = pics[(doc.number.charCodeAt(doc.number.length - 1) + j) % 4]
      r.picDate = r.issuedDate
      r.fileName = orig
      r.fileSize = 180_000 + doc.number.length * 41_000 + j * 23_000
      r.fileMime = 'application/pdf'
      const segs = folderSegments(base.settings, proj1 as any, doc, r)
      const name = fileNameFor(base.settings, proj1 as any, doc, r, orig)
      const at = new Date().toISOString()
      r.storage = {
        local: { ok: true, path: ['Dokumen Proyek', ...segs, name].join('/'), at },
        drive: { ok: true, path: ['DocControl', ...segs, name].join('/'), at, id: 'demo' },
      }
      if (doc.number.endsWith('0005')) r.storage.drive = { ok: false, path: ['DocControl', ...segs, name].join('/'), at, error: 'Google Drive belum terhubung.' }
    })
  })
  documents.push({
    id: 'demo-d9', projectId: 'demo-p2', number: 'PRJ-002-0001', title: 'Layout Gardu Induk', discipline: 'Elektrikal', category: 'Drawing', createdAt: d(-9),
    revisions: [{ id: 'demo-d9r0', rev: 'A', status: 'IFR', issuedDate: d(-9), dueDate: d(5), notes: '', reviewResult: 'Pending', reviewComment: '', createdBy: 'doc.control@contoh.com' }],
  })
  return {
    ...base,
    updatedAt: new Date().toISOString(),
    settings: { ...base.settings, organization: 'PT Contoh Engineering' },
    projects: [
      mkProj('demo-p1', 'PRJ-001', 'Pembangunan Pabrik Pengolahan Air', 'PT Tirta Makmur', 'Cikarang, Jawa Barat', '#1d4ed8'),
      mkProj('demo-p2', 'PRJ-002', 'Upgrade Gardu Induk 150 kV', 'PT Listrik Nusantara', 'Surabaya, Jawa Timur', '#16a34a'),
    ],
    documents,
    transmittals: [{
      id: 'demo-t1', projectId: 'demo-p1', number: 'TR-PRJ-001-001', date: d(-20), from: 'PT Contoh Engineering', to: 'PT Tirta Makmur',
      subject: 'Submittal dokumen engineering tahap 1', notes: '',
      items: [{ docId: 'demo-d0', revId: 'demo-d0r1' }, { docId: 'demo-d7', revId: 'demo-d7r0' }],
    }],
    logs: documents.slice(0, 8).map((x, i) => ({
      id: 'demo-l' + i, ts: new Date(Date.now() - (i + 1) * 5 * 3600e3).toISOString(), projectId: x.projectId, docId: x.id,
      user: 'doc.control@contoh.com', action: 'Revisi diterbitkan', detail: `${x.number} Rev ${x.revisions.at(-1)!.rev} (${x.revisions.at(-1)!.status})`,
    })),
    currentProjectId: 'demo-p1',
  }
}
