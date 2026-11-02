// Ekspor seluruh database ke Excel (.xlsx) atau CSV. Penulis ZIP/XLSX ditulis sendiri (tanpa pustaka tambahan)
// sehingga berjalan di browser maupun aplikasi Windows. Berkas gambar (data:) tidak diekspor; kunci API tidak ikut.
import { registerById } from './administrasi'
import type { CollectionName } from './types'

export type Sel = string | number | boolean | undefined
export interface Lembar { nama: string; kolom: string[]; baris: Sel[][] }

const NAMA_KOLEKSI: Record<CollectionName, string> = {
  sekolah: 'Profil Sekolah', siswa: 'Peserta Didik', pegawai: 'GTK', rombel: 'Rombel', mapel: 'Mata Pelajaran', absensi: 'Absensi',
  nilai: 'Nilai', rapor: 'Catatan Rapor', ekskul: 'Ekstrakurikuler', tanah: 'Tanah', bangunan: 'Bangunan', ruang: 'Ruang',
  pengajuan: 'Pengajuan Prasarana', arsip: 'Administrasi',
}
const ABAIKAN = new Set(['ai', 'cloud']) // kunci API & kata sandi cloud tidak diekspor

/** Ratakan dokumen bertingkat menjadi pasangan kolom → nilai (kunci bertingkat dipisah titik). */
export function ratakan(o: unknown, pre = '', out: Record<string, Sel> = {}): Record<string, Sel> {
  if (o === null || o === undefined) return out
  if (Array.isArray(o)) {
    out[pre] = o.every((x) => x === null || typeof x !== 'object') ? o.join('; ') : JSON.stringify(o, (k, v) => (typeof v === 'string' && v.startsWith('data:') ? '[berkas]' : v))
    return out
  }
  if (typeof o === 'object') {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (!pre && ABAIKAN.has(k)) continue
      ratakan(v, pre ? `${pre}.${k}` : k, out)
    }
    return out
  }
  if (typeof o === 'string' && o.startsWith('data:')) { out[pre] = '[berkas]'; return out }
  out[pre] = o as Sel
  return out
}

function lembarDari(nama: string, docs: unknown[]): Lembar {
  const rows = docs.map((d) => ratakan(d))
  const kolom: string[] = []
  const lihat = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) if (!lihat.has(k)) { lihat.add(k); kolom.push(k) }
  return { nama, kolom, baris: rows.map((r) => kolom.map((k) => r[k])) }
}

const bersihNama = (s: string) => s.replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Data'

/** Susun lembar dari seluruh data: satu lembar per koleksi; administrasi dipecah per buku/register. */
export function susunLembar(data: { [K in CollectionName]?: unknown }): Lembar[] {
  const out: Lembar[] = []
  const pakai = new Set<string>()
  const unik = (n: string) => { let x = bersihNama(n), i = 2; while (pakai.has(x.toLowerCase())) x = bersihNama(n).slice(0, 28) + ' ' + i++; pakai.add(x.toLowerCase()); return x }
  for (const c of Object.keys(NAMA_KOLEKSI) as CollectionName[]) {
    const docs = (data[c] ?? []) as { id?: string; register?: string }[]
    if (!docs.length && c !== 'siswa' && c !== 'pegawai') continue
    if (c === 'arsip') {
      const per = new Map<string, typeof docs>()
      for (const a of docs) { const r = a.register ?? '-'; (per.get(r) ?? per.set(r, []).get(r)!).push(a) }
      for (const [r, list] of per) {
        const nama = r.startsWith('_') ? ({ _dok: 'Dokumen Wajib', _dokdef: 'Daftar Dokumen Wajib', _bidang: 'Daftar Bidang' } as Record<string, string>)[r] ?? r : registerById(r)?.nama ?? r
        const l = lembarDari(unik(nama), list.map((a) => ({ ...a, register: undefined })))
        l.kolom = l.kolom.filter((k) => k !== 'register'); out.push(l)
      }
    } else out.push(lembarDari(unik(NAMA_KOLEKSI[c]), docs))
  }
  return out
}

// ---------- CSV ----------
export function csvDari(l: Lembar, pemisah: ';' | ',' = ';'): string {
  const q = (v: Sel) => {
    const t = v === undefined ? '' : String(v)
    return new RegExp(`[${pemisah}"\\r\\n]`).test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return '﻿' + [l.kolom, ...l.baris].map((r) => r.map(q).join(pemisah)).join('\r\n') + '\r\n'
}

// ---------- ZIP (tanpa kompresi) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
export function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const enc = new TextEncoder()

export function buatZip(files: { nama: string; isi: string | Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const d = new Date()
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  for (const f of files) {
    const nama = enc.encode(f.nama), isi = typeof f.isi === 'string' ? enc.encode(f.isi) : f.isi, crc = crc32(isi)
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true)
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true)
    lh.setUint32(18, isi.length, true); lh.setUint32(22, isi.length, true); lh.setUint16(26, nama.length, true); lh.setUint16(28, 0, true)
    parts.push(new Uint8Array(lh.buffer), nama, isi)
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true)
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true)
    ch.setUint32(20, isi.length, true); ch.setUint32(24, isi.length, true); ch.setUint16(28, nama.length, true); ch.setUint32(42, offset, true)
    central.push(new Uint8Array(ch.buffer), nama)
    offset += 30 + nama.length + isi.length
  }
  const cdSize = central.reduce((s, x) => s + x.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true)
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0))
  let p = 0
  for (const x of all) { out.set(x, p); p += x.length }
  return out
}

// ---------- XLSX ----------
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const kol = (i: number) => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s }

function xmlLembar(l: Lembar) {
  const lebar = l.kolom.map((k, i) => Math.min(48, Math.max(8, k.length + 2, ...l.baris.slice(0, 200).map((r) => String(r[i] ?? '').length + 2))))
  const sel = (v: Sel, ref: string, gaya = '') => {
    if (v === undefined || v === '') return ''
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${gaya}><v>${v}</v></c>`
    if (typeof v === 'boolean') return `<c r="${ref}"${gaya} t="b"><v>${v ? 1 : 0}</v></c>`
    return `<c r="${ref}"${gaya} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`
  }
  const rows = [l.kolom, ...l.baris].map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => sel(v, kol(ci) + (ri + 1), ri === 0 ? ' s="1"' : '')).join('')}</row>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData></worksheet>`
}

export function buatXlsx(lembar: Lembar[]): Uint8Array {
  const ada = lembar.length ? lembar : [{ nama: 'Data', kolom: ['Kosong'], baris: [] }]
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  return buatZip([
    { nama: '[Content_Types].xml', isi: `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ada.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { nama: '_rels/.rels', isi: `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nama: 'xl/workbook.xml', isi: `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${ada.map((l, i) => `<sheet name="${esc(l.nama)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { nama: 'xl/_rels/workbook.xml.rels', isi: `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ada.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${ada.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nama: 'xl/styles.xml', isi: `${X}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...ada.map((l, i) => ({ nama: `xl/worksheets/sheet${i + 1}.xml`, isi: xmlLembar(l) })),
  ])
}

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
