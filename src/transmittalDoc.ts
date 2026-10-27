import type { AppState, Project, Settings, Transmittal } from './types'
import { Pdf, wrap, logoJpeg } from './pdf'
import { fmtDate } from './util'

export const DEFAULT_EMAIL_TEMPLATE = {
  subject: 'Transmittal {{nomor}} - {{kode}} - {{perihal}}',
  body: `Yth. {{kepada}},

Bersama email ini kami sampaikan transmittal {{nomor}} tanggal {{tanggal}} untuk proyek {{proyek}} ({{kode}}) dengan perihal "{{perihal}}".

Dokumen yang dikirim ({{jumlah}} dokumen):
{{daftar}}

Mohon dokumen tersebut dapat direview dan hasilnya dikembalikan paling lambat sesuai batas waktu review. Mohon konfirmasi penerimaan dengan membalas email ini.

Terima kasih.

Hormat kami,
{{pengirim}}
{{organisasi}}`,
}

export interface TrLine { no: number; number: string; title: string; rev: string; status: string; format: string; due: string }

export function trLines(state: AppState, t: Transmittal): TrLine[] {
  return t.items.map((i, k) => {
    const d = state.documents.find((x) => x.id === i.docId)
    const r = d?.revisions.find((x) => x.id === i.revId)
    const ext = r?.fileName?.includes('.') ? r.fileName.split('.').pop()!.toUpperCase() : r?.fileName ? '-' : 'Softcopy'
    return { no: k + 1, number: d?.number || '-', title: d?.title || '-', rev: r?.rev || '-', status: r?.status || '-', format: ext, due: r?.dueDate ? fmtDate(r.dueDate) : '-' }
  })
}

export function fillTemplate(tpl: string, p: Project, t: Transmittal, lines: TrLine[], s: Settings): string {
  const map: Record<string, string> = {
    nomor: t.number, kode: p.code, proyek: p.name, tanggal: fmtDate(t.date), kepada: t.to, dari: t.from, perihal: t.subject,
    jumlah: String(lines.length), daftar: lines.map((l) => `${l.no}. ${l.number} - ${l.title} (Rev ${l.rev}, ${l.status})`).join('\n'),
    pengirim: t.from, organisasi: s.organization || '',
  }
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? '')
}

const PINK: [number, number, number] = [242, 220, 219]
const GREY: [number, number, number] = [71, 85, 105]

// Lampiran email: formulir transmittal A4 portrait (logo, identitas, daftar dokumen, tanda tangan).
export async function buildTransmittalPdf(state: AppState, p: Project, t: Transmittal): Promise<Blob> {
  const s = state.settings
  const pdf = new Pdf(595.28, 841.89)
  const M = 36, tw = pdf.pw - M * 2, fs = 9, lh = fs * 1.3, pad = 4
  const logos = [await logoJpeg(p.clientLogo), await logoJpeg(p.contractorLogo)] // kiri: owner/klien, kanan: kontraktor
  const idx = logos.map((l) => (l ? (pdf.images.push(l), pdf.images.length - 1) : null))
  const lines = trLines(state, t)
  let y = M

  // Kop
  const lh2 = 40
  logos.forEach((l, i) => {
    if (!l || idx[i] === null) return
    const w = Math.min(lh2 * (l.w / l.h), 130)
    pdf.image(idx[i]!, i === 0 ? M : M + tw - w, y, w, lh2)
  })
  y += lh2 + 8
  pdf.fill(M, y, tw, 1.5, [30, 41, 59]); y += 10
  pdf.text('TRANSMITTAL', M, y, 16, true, 'c', tw); y += 22
  pdf.text('Document Transmittal Form', M, y, 8.5, false, 'c', tw, GREY); y += 18

  // Identitas
  const info: [string, string][] = [
    ['No. Transmittal', t.number], ['Tanggal', fmtDate(t.date)],
    ['Kepada', t.to], ['Dari', t.from],
    ['Proyek', `${p.name} (${p.code})`], ['No. Kontrak', p.contractNo || '-'],
    ['Perihal', t.subject],
  ]
  const lw = 100
  for (const [k, v] of info) {
    const ls = wrap(v, tw - lw - 14, fs)
    pdf.text(k, M, y, fs, true); pdf.text(':', M + lw, y, fs, true)
    ls.forEach((l, i) => pdf.text(l, M + lw + 10, y + i * lh, fs))
    y += Math.max(1, ls.length) * lh + 2
  }
  y += 6

  // Tabel
  const frac = [0.06, 0.2, 0.36, 0.07, 0.09, 0.1, 0.12]
  const cw = frac.map((f) => f * tw)
  const cx = cw.reduce<number[]>((a, _, i) => (a.push(i ? a[i - 1] + cw[i - 1] : M), a), [])
  const heads = ['No.', 'No. Dokumen', 'Judul Dokumen', 'Rev', 'Status', 'Format', 'Batas Review']
  const cell = (x: number, yy: number, w: number, h: number, fill?: [number, number, number]) => { if (fill) pdf.fill(x, yy, w, h, fill); pdf.box(x, yy, w, h) }
  const head = () => {
    const h = lh + pad * 2
    heads.forEach((hd, i) => { cell(cx[i], y, cw[i], h, PINK); pdf.text(hd, cx[i], y + pad + 1, fs, true, 'c', cw[i]) })
    y += h
  }
  const bottom = pdf.ph - M - 150
  head()
  for (const l of lines) {
    const vals = [String(l.no), l.number, l.title, l.rev, l.status, l.format, l.due]
    const wr = vals.map((v, i) => wrap(v, cw[i] - pad * 2, fs))
    const h = Math.max(...wr.map((x) => x.length)) * lh + pad * 2
    if (y + h > pdf.ph - M - 30) { pdf.newPage(); y = M; head() }
    vals.forEach((_, i) => {
      cell(cx[i], y, cw[i], h)
      const left = i === 2
      wr[i].forEach((ln, k) => pdf.text(ln, cx[i] + (left ? pad : 0), y + pad + 1 + k * lh, fs, false, left ? 'l' : 'c', cw[i] - (left ? pad : 0)))
    })
    y += h
  }
  void bottom
  y += 10
  pdf.text(`Jumlah dokumen: ${lines.length}`, M, y, fs, true); y += lh + 4
  if (t.notes) {
    pdf.text('Catatan:', M, y, fs, true); y += lh
    wrap(t.notes, tw, fs).forEach((l) => { pdf.text(l, M, y, fs); y += lh })
    y += 4
  }
  pdf.text('Mohon konfirmasi penerimaan dengan menandatangani dan mengembalikan salinan transmittal ini.', M, y, 8, false, 'l', 0, GREY); y += 20

  // Tanda tangan
  const boxH = 100
  if (y + boxH > pdf.ph - M - 16) { pdf.newPage(); y = M }
  const bw = tw / 2 - 6
  ;[['Dikirim oleh', t.from], ['Diterima oleh', t.to]].forEach(([title, who], i) => {
    const x = M + i * (bw + 12)
    cell(x, y, bw, boxH)
    pdf.fill(x, y, bw, 16, PINK); pdf.box(x, y, bw, 16)
    pdf.text(title, x, y + 4, fs, true, 'c', bw)
    pdf.text(who, x + 6, y + 21, 8, false, 'l', bw - 12, GREY)
    pdf.text('Nama', x + 6, y + boxH - 26, 8); pdf.text(':', x + 38, y + boxH - 26, 8)
    pdf.text('Tanggal', x + 6, y + boxH - 14, 8); pdf.text(':', x + 38, y + boxH - 14, 8)
    pdf.fill(x + 42, y + boxH - 17, bw - 52, 0.5, [0, 0, 0]); pdf.fill(x + 42, y + boxH - 29, bw - 52, 0.5, [0, 0, 0])
  })

  pdf.finish()
  const total = pdf.pages.length
  pdf.pages = pdf.pages.map((c, i) => {
    const tmp = new Pdf(pdf.pw, pdf.ph)
    tmp.text(`${t.number} · ${s.appName || 'DocControl'}`, M, pdf.ph - M + 8, 7, false, 'l', 0, [100, 116, 139])
    tmp.text(`Halaman ${i + 1} / ${total}`, M, pdf.ph - M + 8, 7, false, 'r', tw, [100, 116, 139])
    return c + tmp.cur
  })
  return pdf.build()
}
