// Pembuat berkas .xlsx minimal (tanpa pustaka): gaya, gabung sel, filter, freeze panes, dan cetak landscape.
import { buildZip } from './zip'
import type { Project } from './types'
import { headers, longDate, summary, type ReportRow } from './report'

export interface ReportMeta { word: string; asOf: string; periodText: string; stats: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
const COLS = 'ABCDEFGHIJKLM'.split('')
type Cell = { v?: string | number; s: number }

// gaya: 0 default, 1 header pink, 2 header lavender, 3 isi kiri, 4 isi tengah, 5 isi kuning, 6 isi biru (status), 7 judul, 8 tebal, 9 isi kuning tengah? (tidak dipakai), 10 catatan
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF475569"/><name val="Calibri"/></font></fonts>
<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2DCDB"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE4DFEC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF8DB4E2"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

export async function buildXlsx(p: Project, rows: ReportRow[], meta: ReportMeta, reviewer: string, extra: { org?: string; footer?: string } = {}): Promise<Blob> {
  const H = headers(reviewer)
  const grid: Cell[][] = []
  const merges: string[] = []
  const put = (r: number, c: number, cell: Cell) => { (grid[r] ||= [])[c] = cell }

  // Blok judul
  put(0, 0, { v: `LAPORAN ${meta.word} DOKUMEN PROYEK`, s: 7 })
  put(1, 0, { v: `${p.code} - ${p.name}${p.contractNo ? '   |   No. Kontrak: ' + p.contractNo : ''}`, s: 8 })
  put(2, 0, { v: [p.client && 'Klien: ' + p.client, p.contractor && 'Kontraktor: ' + p.contractor, extra.org, meta.periodText.startsWith('Periode') ? meta.periodText : ''].filter(Boolean).join('   |   '), s: 10 })

  // Header 2 tingkat (baris 4-5)
  const R1 = 4, R2 = 5
  const top: [number, string, number][] = [[0, H.disiplin, 1], [1, H.docNo, 1], [2, H.title, 1], [8, H.rev, 1], [9, H.lastStatus, 1], [10, H.desc, 1], [11, H.daysZone, 1], [12, H.holder, 1]]
  for (const [c, t, s] of top) { put(R1 - 1, c, { v: t, s }); put(R2 - 1, c, { s }); merges.push(`${COLS[c]}${R1}:${COLS[c]}${R2}`) }
  put(R1 - 1, 3, { v: longDate(meta.asOf), s: 2 }); put(R1 - 1, 4, { s: 2 }); put(R1 - 1, 5, { s: 2 }); merges.push(`D${R1}:F${R1}`)
  put(R1 - 1, 6, { v: H.resume, s: 1 }); put(R1 - 1, 7, { s: 1 }); merges.push(`G${R1}:H${R1}`)
  ;[[3, H.daysPic, 2], [4, H.datePic, 2], [5, H.pic, 2], [6, H.dateSubmit, 1], [7, H.trsNo, 1]].forEach(([c, t, s]) => put(R2 - 1, c as number, { v: t as string, s: s as number }))

  // Isi
  rows.forEach((r, i) => {
    const y = R2 + i
    const l = r.highlight ? 5 : 3
    const vals: Cell[] = [
      { v: r.disiplin, s: 4 }, { v: r.docNo, s: l }, { v: r.title, s: l },
      { v: r.daysPic === '' ? undefined : r.daysPic, s: 4 }, { v: r.datePic, s: 4 }, { v: r.pic, s: 4 },
      { v: r.dateSubmit, s: 4 }, { v: r.trsNo, s: 4 }, { v: r.rev, s: 4 }, { v: r.lastStatus, s: 6 }, { v: r.desc, s: 4 }, { v: r.daysZone, s: 4 }, { v: r.holder, s: 4 },
    ]
    vals.forEach((c, ci) => put(y, ci, c))
  })

  // Ringkasan
  const endRow = R2 + rows.length
  put(endRow + 1, 0, { v: `Total dokumen: ${rows.length}   |   ` + summary(rows).map(([k, n]) => `${k}: ${n}`).join('   |   '), s: 8 })
  put(endRow + 2, 0, { v: meta.stats, s: 8 })
  put(endRow + 3, 0, { v: 'Hari dihitung sebagai hari kerja. Baris kuning = dokumen baru diterbitkan dalam periode laporan. ' + (extra.footer || ''), s: 10 })

  const widths = [14, 24, 52, 11, 14, 14, 15, 24, 11, 11, 11, 15, 24]
  let sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="3" ySplit="${R2}" topLeftCell="D${R2 + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>`
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]
    if (!row) continue
    const ht = r === 0 ? ' ht="22" customHeight="1"' : r === R1 - 1 || r === R2 - 1 ? ' ht="32" customHeight="1"' : ''
    sheet += `<row r="${r + 1}"${ht}>`
    row.forEach((c, ci) => {
      if (!c) return
      const ref = COLS[ci] + (r + 1)
      if (c.v === undefined || c.v === '') sheet += `<c r="${ref}" s="${c.s}"/>`
      else if (typeof c.v === 'number') sheet += `<c r="${ref}" s="${c.s}"><v>${c.v}</v></c>`
      else sheet += `<c r="${ref}" s="${c.s}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`
    })
    sheet += '</row>'
  }
  sheet += `</sheetData><autoFilter ref="A${R2}:M${Math.max(R2, R2 + rows.length)}"/>`
  sheet += `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
  sheet += `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`

  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Laporan Mingguan" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Laporan Mingguan'!$A$${R2}:$L$${Math.max(R2, R2 + rows.length)}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'Laporan Mingguan'!$${R1}:$${R2}</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': STYLES,
    'xl/worksheets/sheet1.xml': sheet,
  }
  const zip = await buildZip(Object.entries(files).map(([path, x]) => ({ path, blob: new Blob([x]) })))
  return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
