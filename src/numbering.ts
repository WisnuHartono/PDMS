import type { Project, Settings } from './types'

export interface NumberingSettings {
  template: string // mis. {prefix}-{doc}-{disc}-{seq}-{paper}
  disciplineCodes: Record<string, string>
  categoryCodes: Record<string, string>
  papers: string[]
  defaultPaper: string
}

export const NUM_TOKENS: [string, string][] = [
  ['{prefix}', 'Inisial proyek'], ['{doc}', 'Kode jenis dokumen'], ['{disc}', 'Kode disiplin'],
  ['{seq}', 'No. urut'], ['{paper}', 'Ukuran kertas'], ['{year}', 'Tahun'], ['{projectcode}', 'Kode proyek'],
]

export const NUM_PRESETS: [string, string][] = [
  ['{prefix}-{doc}-{disc}-{seq}-{paper}', 'GSP-LST-00-000-A4 (Proyek-Dokumen-Disiplin-No-Kertas)'],
  ['{prefix}-{doc}-{disc}-{seq}', 'GSP-LST-00-000 (tanpa ukuran kertas)'],
  ['{prefix}-{disc}-{doc}-{seq}', 'GSP-00-LST-000 (Disiplin sebelum Dokumen)'],
  ['{prefix}-{seq}', 'GSP-0001 (urut sederhana)'],
]

export const DEFAULT_DISC_CODES: Record<string, string> = {
  Umum: '00', Sipil: '01', Struktur: '02', Mekanikal: '03', Perpipaan: '04', Elektrikal: '05', Instrument: '06', Proses: '07', HSE: '08',
}
export const DEFAULT_CAT_CODES: Record<string, string> = {
  Drawing: 'DWG', Specification: 'SPC', Calculation: 'CAL', Datasheet: 'DTS', Report: 'RPT', Procedure: 'PRC', 'Method Statement': 'MTS',
  'Inspection & Test Plan': 'ITP', 'Vendor Document': 'VND', Manual: 'MNL', 'As-Built': 'ASB', 'Minutes of Meeting': 'MOM', Correspondence: 'COR',
}

export const defaultNumbering = (): NumberingSettings => ({
  template: NUM_PRESETS[0][0], disciplineCodes: { ...DEFAULT_DISC_CODES }, categoryCodes: { ...DEFAULT_CAT_CODES },
  papers: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'], defaultPaper: 'A4',
})

export const numberingOf = (s: Settings): NumberingSettings => ({ ...defaultNumbering(), ...s.numbering })

const fallback = (name: string) => name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '-'
export const discCode = (s: Settings, d: string) => numberingOf(s).disciplineCodes[d] || fallback(d)
export const catCode = (s: Settings, c: string) => numberingOf(s).categoryCodes[c] || fallback(c)

const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface In { discipline: string; category: string; paper?: string; date?: string }

function parts(s: Settings, p: Project, i: In) {
  const n = numberingOf(s)
  return {
    prefix: p.numberPrefix || p.code, projectcode: p.code, doc: catCode(s, i.category), disc: discCode(s, i.discipline),
    paper: i.paper || n.defaultPaper, year: (i.date || new Date().toISOString()).slice(0, 4),
  } as Record<string, string>
}

export function buildNumber(s: Settings, p: Project, i: In, seq: number) {
  const n = numberingOf(s)
  const v: Record<string, string> = { ...parts(s, p, i), seq: String(seq).padStart(p.numberPadding || 3, '0') }
  return n.template.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m))
}

// nomor urut berikutnya = urutan terbesar pada dokumen dengan komponen lain yang sama + 1
export function nextNumber(s: Settings, p: Project, existing: string[], i: In) {
  const n = numberingOf(s)
  const v = parts(s, p, i)
  let re = ''
  let hasSeq = false
  let last = 0
  n.template.replace(/\{(\w+)\}/g, (m, k, idx: number) => {
    re += esc(n.template.slice(last, idx))
    last = idx + m.length
    if (k === 'seq') { re += '(\\d+)'; hasSeq = true } else re += esc(k in v ? v[k] : m)
    return m
  })
  re += esc(n.template.slice(last))
  const rx = new RegExp('^' + re + '$', 'i')
  let max = 0
  for (const x of existing) { const m = rx.exec(x); if (m && hasSeq) max = Math.max(max, parseInt(m[1], 10)) }
  let seq = hasSeq ? max + 1 : existing.length + 1
  while (existing.includes(buildNumber(s, p, i, seq))) seq++
  return buildNumber(s, p, i, seq)
}
