// Pembuat PDF minimal (teks Helvetica + kotak + logo JPEG) untuk laporan mingguan. Tanpa pustaka eksternal.
import type { Project } from './types'
import { headers, longDate, summary, type ReportRow } from './report'
import type { ReportMeta } from './xlsx'

const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]

const code = (ch: string) => { const c = ch.charCodeAt(0); return c > 255 ? 63 : c }
const width = (s: string, size: number, bold: boolean) => {
  let w = 0
  for (const ch of s) { const c = code(ch); w += c >= 32 && c <= 126 ? W[c - 32] : 556 }
  return (w * size * (bold ? 1.06 : 1)) / 1000
}

export function wrap(text: string, max: number, size: number, bold = false): string[] {
  const out: string[] = []
  for (const para of String(text).split('\n')) {
    let line = ''
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (width(word, size, bold) > max) { // pecah kata yang terlalu panjang
        let i = word.length
        while (i > 1 && width(word.slice(0, i), size, bold) > max) i--
        if (line) { out.push(line); line = '' }
        out.push(word.slice(0, i)); word = word.slice(i)
      }
      const t = line ? line + ' ' + word : word
      if (width(t, size, bold) <= max) line = t
      else { out.push(line); line = word }
    }
    out.push(line)
  }
  return out.filter((l, i, a) => l || a.length === 1)
}

export class Pdf {
  pages: string[] = []
  images: { w: number; h: number; data: Uint8Array }[] = []
  cur = ''
  constructor(public pw: number, public ph: number) {}
  newPage() { if (this.cur) this.pages.push(this.cur); this.cur = '' }
  finish() { if (this.cur || !this.pages.length) this.pages.push(this.cur); this.cur = '' }
  fill(x: number, y: number, w: number, h: number, rgb: [number, number, number]) {
    this.cur += `${rgb.map((v) => (v / 255).toFixed(3)).join(' ')} rg ${x.toFixed(2)} ${(this.ph - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`
  }
  box(x: number, y: number, w: number, h: number, lw = 0.4) {
    this.cur += `0 0 0 RG ${lw} w ${x.toFixed(2)} ${(this.ph - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S\n`
  }
  text(s: string, x: number, y: number, size: number, bold = false, align: 'l' | 'c' | 'r' = 'l', maxW = 0, color: [number, number, number] = [0, 0, 0]) {
    const w = width(s, size, bold)
    const px = align === 'c' ? x + (maxW - w) / 2 : align === 'r' ? x + maxW - w : x
    const bytes = [...s].map((ch) => { const c = code(ch); return c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : String.fromCharCode(c < 32 ? 32 : c) }).join('')
    this.cur += `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.map((v) => (v / 255).toFixed(3)).join(' ')} rg ${px.toFixed(2)} ${(this.ph - y - size * 0.82).toFixed(2)} Td (${bytes}) Tj ET\n`
  }
  image(idx: number, x: number, y: number, w: number, h: number) {
    this.cur += `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(this.ph - y - h).toFixed(2)} cm /Im${idx} Do Q\n`
  }

  build(): Blob {
    const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255)
    const parts: Uint8Array[] = []
    const offsets: number[] = []
    let len = 0
    const push = (b: Uint8Array | string) => { const u = typeof b === 'string' ? enc(b) : b; parts.push(u); len += u.length }
    const obj = (n: number, body: string | (Uint8Array | string)[]) => {
      offsets[n] = len
      push(`${n} 0 obj\n`)
      ;(Array.isArray(body) ? body : [body]).forEach(push)
      push('\nendobj\n')
    }
    const nImg = this.images.length
    const firstPage = 5 + nImg
    push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
    obj(2, `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(' ')}] /Count ${this.pages.length} >>`)
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    this.images.forEach((im, i) =>
      obj(5 + i, [`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`, im.data, '\nendstream']),
    )
    const xo = this.images.map((_, i) => `/Im${i} ${5 + i} 0 R`).join(' ')
    this.pages.forEach((c, i) => {
      const pn = firstPage + i * 2
      obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pw.toFixed(2)} ${this.ph.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xo} >> >> /Contents ${pn + 1} 0 R >>`)
      const data = enc(c)
      obj(pn + 1, [`<< /Length ${data.length} >>\nstream\n`, data, '\nendstream'])
    })
    const total = firstPage + this.pages.length * 2
    const xref = len
    push(`xref\n0 ${total}\n0000000000 65535 f \n`)
    for (let i = 1; i < total; i++) push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n')
    push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
    return new Blob(parts as BlobPart[], { type: 'application/pdf' })
  }
}

export async function logoJpeg(src?: string): Promise<{ w: number; h: number; data: Uint8Array } | null> {
  if (!src) return null
  try {
    const img = new Image()
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error()); img.src = src })
    const w = img.naturalWidth || 300, h = img.naturalHeight || 100
    const k = Math.min(1, 400 / Math.max(w, h))
    const c = document.createElement('canvas')
    c.width = Math.round(w * k); c.height = Math.round(h * k)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1]
    const bin = atob(b64)
    return { w: c.width, h: c.height, data: Uint8Array.from(bin, (ch) => ch.charCodeAt(0)) }
  } catch { return null }
}

const PINK: [number, number, number] = [242, 220, 219]
const LAV: [number, number, number] = [228, 223, 236]
const YEL: [number, number, number] = [255, 255, 0]
const BLUE: [number, number, number] = [141, 180, 226]

export async function buildPdf(p: Project, rows: ReportRow[], meta: ReportMeta, reviewer: string, opt: { paper: 'A4' | 'A3'; org?: string; footer?: string; appName?: string }): Promise<Blob> {
  const A3 = opt.paper === 'A3'
  const pdf = new Pdf(A3 ? 1190.55 : 841.89, A3 ? 841.89 : 595.28)
  const M = A3 ? 32 : 24
  const fs = A3 ? 9 : 6.8
  const lh = fs * 1.25
  const pad = A3 ? 3.5 : 2.5
  const H = headers(reviewer)
  const tw = pdf.pw - M * 2
  const frac = [0.065, 0.14, 0.18, 0.05, 0.06, 0.06, 0.07, 0.1, 0.05, 0.055, 0.05, 0.05, 0.07]
  const cw = frac.map((f) => f * tw)
  const cx = cw.reduce<number[]>((a, w, i) => (a.push(i ? a[i - 1] + cw[i - 1] : M), a), [])

  const logos = [await logoJpeg(p.clientLogo), await logoJpeg(p.contractorLogo)]
  const idx: (number | null)[] = logos.map((l) => (l ? (pdf.images.push(l), pdf.images.length - 1) : null))

  const drawHeaderBlock = () => {
    const lhgt = A3 ? 46 : 34
    let xr = pdf.pw - M
    logos.forEach((l, i) => {
      if (!l || idx[i] === null) return
      const w = Math.min(lhgt * (l.w / l.h), lhgt * 3)
      if (i === 0) pdf.image(idx[i]!, M, M, w, lhgt)
      else { pdf.image(idx[i]!, xr - w, M, w, lhgt); xr -= w + 8 }
    })
    pdf.text(`LAPORAN ${meta.word} DOKUMEN PROYEK`, M, M + 2, A3 ? 16 : 12, true, 'c', tw)
    pdf.text(`${p.code} - ${p.name}${p.contractNo ? '   |   No. Kontrak: ' + p.contractNo : ''}`, M, M + (A3 ? 24 : 18), A3 ? 10.5 : 8.5, true, 'c', tw)
    pdf.text([p.client && 'Klien: ' + p.client, p.contractor && 'Kontraktor: ' + p.contractor, opt.org, meta.periodText.startsWith('Periode') ? meta.periodText : ''].filter(Boolean).join('   |   '), M, M + (A3 ? 38 : 29), A3 ? 8.5 : 7, false, 'c', tw, [71, 85, 105])
    return M + lhgt + (A3 ? 14 : 10)
  }

  const cell = (x: number, y: number, w: number, h: number, fill?: [number, number, number]) => { if (fill) pdf.fill(x, y, w, h, fill); pdf.box(x, y, w, h) }
  const hdrH = lh * 4 + pad * 4
  const drawTableHeader = (y: number) => {
    const h1 = lh + pad * 2, h2 = hdrH - h1
    const spanCols = [0, 1, 2, 8, 9, 10, 11, 12]
    const labels = [H.disiplin, H.docNo, H.title, '', '', '', '', '', H.rev, H.lastStatus, H.desc, H.daysZone, H.holder]
    for (const c of spanCols) {
      cell(cx[c], y, cw[c], hdrH, PINK)
      const ls = wrap(labels[c], cw[c] - pad * 2, fs, true)
      const th = ls.length * lh
      ls.forEach((l, i) => pdf.text(l, cx[c], y + (hdrH - th) / 2 + i * lh + 0.5, fs, true, 'c', cw[c]))
    }
    const gw = cw[3] + cw[4] + cw[5]
    cell(cx[3], y, gw, h1, LAV); pdf.text(longDate(meta.asOf), cx[3], y + (h1 - fs) / 2 + 0.5, fs, true, 'c', gw)
    const rw = cw[6] + cw[7]
    cell(cx[6], y, rw, h1, PINK); pdf.text(H.resume, cx[6], y + (h1 - fs) / 2 + 0.5, fs, true, 'c', rw)
    const sub: [number, string, typeof PINK][] = [[3, H.daysPic, LAV], [4, H.datePic, LAV], [5, H.pic, LAV], [6, H.dateSubmit, PINK], [7, H.trsNo, PINK]]
    for (const [c, t, f] of sub) {
      cell(cx[c], y + h1, cw[c], h2, f)
      const ls = wrap(t, cw[c] - pad * 2, fs, true)
      const th = ls.length * lh
      ls.forEach((l, i) => pdf.text(l, cx[c], y + h1 + (h2 - th) / 2 + i * lh + 0.5, fs, true, 'c', cw[c]))
    }
    return y + hdrH
  }

  let y = drawHeaderBlock()
  y = drawTableHeader(y)
  const bottom = pdf.ph - M - 14
  for (const r of rows) {
    const vals = [r.disiplin, r.docNo, r.title, r.daysPic === '' ? '' : String(r.daysPic), r.datePic, r.pic, r.dateSubmit, r.trsNo, r.rev, r.lastStatus, r.desc, String(r.daysZone), r.holder]
    const lines = vals.map((v, i) => wrap(v, cw[i] - pad * 2, fs))
    const h = Math.max(...lines.map((l) => l.length)) * lh + pad * 2
    if (y + h > bottom) { pdf.newPage(); y = drawTableHeader(M) }
    vals.forEach((_, i) => {
      const fill = i === 9 ? BLUE : r.highlight && (i === 1 || i === 2) ? YEL : undefined
      cell(cx[i], y, cw[i], h, fill)
      const th = lines[i].length * lh
      const left = i === 1 || i === 2
      lines[i].forEach((l, k) => pdf.text(l, cx[i] + (left ? pad : 0), y + (h - th) / 2 + k * lh + 0.5, fs, false, left ? 'l' : 'c', cw[i] - (left ? pad : 0)))
    })
    y += h
  }
  if (!rows.length) { cell(M, y, tw, lh + pad * 2); pdf.text('Tidak ada dokumen yang sesuai dengan filter laporan.', M, y + pad, fs, false, 'c', tw); y += lh + pad * 2 }
  y += 8
  if (y + lh * 3 + 4 > bottom) { pdf.newPage(); y = M }
  pdf.text(`Total dokumen: ${rows.length}   |   ` + summary(rows).map(([k, n]) => `${k}: ${n}`).join('   |   '), M, y, fs + 0.5, true)
  pdf.text(meta.stats, M, y + lh + 2, fs, false)
  pdf.text('Hari dihitung sebagai hari kerja. Baris kuning = dokumen baru diterbitkan dalam periode laporan.', M, y + lh * 2 + 4, fs - 0.5, false, 'l', 0, [71, 85, 105])
  pdf.finish()
  // nomor halaman
  const total = pdf.pages.length
  pdf.pages = pdf.pages.map((c, i) => {
    const tmp = new Pdf(pdf.pw, pdf.ph)
    tmp.text(`${opt.appName || 'DocControl'}${opt.footer ? ' - ' + opt.footer : ''}`, M, pdf.ph - M + 2, fs - 0.5, false, 'l', 0, [100, 116, 139])
    tmp.text(`Halaman ${i + 1} / ${total}`, M, pdf.ph - M + 2, fs - 0.5, false, 'r', tw, [100, 116, 139])
    return c + tmp.cur
  })
  return pdf.build()
}
