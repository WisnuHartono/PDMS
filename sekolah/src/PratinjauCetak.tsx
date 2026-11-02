// Pratinjau dokumen sebelum dicetak/disimpan. Semua dokumen (rapor, buku induk, BKU, surat, dll.) lewat sini.
// - Cetak: dialog cetak sistem.
// - Simpan PDF: di aplikasi Windows langsung membuat berkas PDF (printToPDF); di browser memakai "Simpan sebagai PDF".
// - Simpan Word: berkas .doc (HTML yang dapat dibuka dan disunting di Microsoft Word / LibreOffice).
// - Simpan ke Arsip: salinan dokumen disimpan terenkripsi di Administrasi TU → Daftar Arsip.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'
import { getSesi } from './security/sesi'
import { MARGIN } from './kertas'
import { put } from './store'
import { Btn, _pasangPrint, toast } from './ui'
import { download, today, uid } from './util'

interface SimasDesktop { simpanPdf?: (nama: string, kiri?: string) => Promise<{ ok: boolean; path?: string; batal?: boolean; pesan?: string }> }
const desktop = () => (globalThis as unknown as { simas?: SimasDesktop }).simas

const aman = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Dokumen SIMAS'

/** CSS yang dipakai dokumen, disalin ke berkas Word/arsip agar tampilannya sama. */
function cssDokumen() {
  let out = ''
  for (const sh of Array.from(document.styleSheets)) {
    try { for (const r of Array.from(sh.cssRules)) out += r.cssText + '\n' } catch { /* stylesheet lintas domain */ }
  }
  return out
}

export function htmlDokumen(isi: string, judul: string, word = false) {
  const head = word
    ? '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->'
    : '<!doctype html><html lang="id"><head><meta charset="utf-8">'
  return `${head}<title>${judul.replace(/</g, '&lt;')}</title><style>:root{--kw:${getComputedStyle(document.documentElement).getPropertyValue('--kw') || '210mm'};--kh:${getComputedStyle(document.documentElement).getPropertyValue('--kh') || '297mm'};--kw-l:${getComputedStyle(document.documentElement).getPropertyValue('--kw-l') || '297mm'};--kh-l:${getComputedStyle(document.documentElement).getPropertyValue('--kh-l') || '210mm'}}${cssDokumen()}\n#print-root{display:block;position:static;background:#fff}.pp-body{padding:0}.doc{margin:0 auto 12px}</style></head><body><div id="print-root"><div class="pp-body">${isi}</div></div></body></html>`
}

export function PrintHost() {
  const [node, setNode] = useState<ReactNode>(null)
  const [sibuk, setSibuk] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => { _pasangPrint((n) => setNode(n)) }, [])
  useEffect(() => {
    if (!node) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setNode(null)
    window.addEventListener('keydown', k)
    document.body.classList.add('pratinjau')
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('pratinjau') }
  }, [node])

  // Pratinjau berupa lembar-lembar kertas sesuai ukuran terpilih: isi dokumen dipotong per halaman di batas baris/paragraf
  // (bukan di tengah teks), lengkap dengan margin, nomor halaman, dan tanda air di tiap lembar.
  const halaman = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = body.current, out = halaman.current
    if (!node || !el || !out) return
    const px = (v: string) => { const t = document.createElement('div'); t.style.cssText = `position:absolute;visibility:hidden;width:${v}`; out.appendChild(t); const w = t.getBoundingClientRect().width; t.remove(); return w }
    const rs = () => getComputedStyle(document.documentElement)
    const susun = () => {
      out.textContent = ''
      const docs = Array.from(el.querySelectorAll<HTMLElement>('.doc:not(.label-sheet)'))
      let total = 0
      const lembar: HTMLElement[] = []
      docs.forEach((d) => {
        const land = d.classList.contains('landscape')
        const W = px(rs().getPropertyValue(land ? '--kw-l' : '--kw') || (land ? '297mm' : '210mm'))
        const H = px(rs().getPropertyValue(land ? '--kh-l' : '--kh') || (land ? '210mm' : '297mm'))
        const mx = px(`${land ? MARGIN.lanskap.x : MARGIN.potret.x}mm`), my = px(`${land ? MARGIN.lanskap.y : MARGIN.potret.y}mm`)
        const cw = W - 2 * mx, C = H - 2 * my
        d.classList.add('pp-sumber'); d.style.width = `${cw}px`
        // Baris judul kolom (semua sel <th>) dijadikan <thead> agar diulang otomatis di halaman berikutnya (cetak & pratinjau)
        d.querySelectorAll('table').forEach((t) => {
          if (t.tHead) return
          const tr = t.rows[0]
          if (tr && tr.cells.length && Array.from(tr.cells).every((c) => c.tagName === 'TH') && t.rows.length > 1) t.createTHead().appendChild(tr)
        })
        const tinggi = d.offsetHeight
        const dTop = d.getBoundingClientRect().top
        // Blok yang tidak boleh terbelah (tabel berdampingan, kotak catatan, tanda tangan) dipindah utuh ke halaman berikutnya,
        // kecuali lebih tinggi dari satu halaman.
        const atom = Array.from(d.querySelectorAll<HTMLElement>('.two, .box, .ttd-row')).filter((e) => e.getBoundingClientRect().height <= C)
        const batas = Array.from(d.querySelectorAll<HTMLElement>('tr, p, li, .box, .ttd-row, .two, .kvn, .kvg, .induk-top, .asm-rapor, img, table')).filter((e) => !atom.some((a) => a !== e && a.contains(e))).map((e) => e.getBoundingClientRect().bottom - dTop).filter((v) => v > 0).sort((x, y) => x - y)
        const tabel = Array.from(d.querySelectorAll<HTMLTableElement>('table')).filter((t) => t.tHead).map((t) => { const r = t.getBoundingClientRect(); return { t, top: r.top - dTop, bottom: r.bottom - dTop, h: t.tHead!.getBoundingClientRect().height } })
        const halamanDoc: { s: number; e: number; hdr?: (typeof tabel)[number] }[] = []
        let a = 0
        while (a < tinggi - 1) {
          // halaman dimulai di tengah tabel: sisakan ruang untuk judul kolom yang diulang
          const hdr = a > 0 ? tabel.filter((x) => x.top < a - 1 && x.bottom > a + 1).pop() : undefined
          const kap = C - (hdr?.h ?? 0)
          const limit = a + kap
          let e = tinggi
          if (tinggi > limit + 1) { const ok = batas.filter((v) => v > a + C * 0.3 && v <= limit + 0.5); e = ok.length ? ok[ok.length - 1] : limit }
          halamanDoc.push({ s: a, e, hdr }); a = e
        }
        const n = halamanDoc.length
        halamanDoc.forEach(({ s: s0, e: e0, hdr }, i) => {
          const lb = document.createElement('div')
          lb.className = `pp-sheet${land ? ' landscape' : ''}`
          lb.style.cssText = `width:${W}px;height:${H}px;padding:${my}px ${mx}px`
          const hh = hdr?.h ?? 0
          const win = document.createElement('div'); win.className = 'pp-win'; win.style.height = `${e0 - s0 + hh}px`
          const kl = document.createElement('div'); kl.className = 'pp-klon'; kl.style.cssText = `top:${hh - s0}px;width:${cw}px`
          const c = d.cloneNode(true) as HTMLElement
          c.classList.remove('pp-sumber'); c.style.cssText = 'width:100%;min-height:0;padding:0;margin:0;box-shadow:none'
          kl.appendChild(c); win.appendChild(kl); lb.appendChild(win)
          if (hdr) {
            // salinan judul kolom tabel yang terpotong, di bagian atas halaman
            const wrap = d.cloneNode(false) as HTMLElement
            wrap.classList.remove('pp-sumber'); wrap.style.cssText = 'position:absolute;left:0;top:0;width:100%;min-height:0;padding:0;margin:0;box-shadow:none;background:#fff;z-index:2'
            const tb = hdr.t.cloneNode(false) as HTMLTableElement
            tb.style.width = `${hdr.t.getBoundingClientRect().width}px`; tb.style.marginLeft = `${hdr.t.getBoundingClientRect().left - d.getBoundingClientRect().left}px`; tb.style.marginTop = '0'
            const th = hdr.t.tHead!.cloneNode(true) as HTMLTableSectionElement
            Array.from(hdr.t.tHead!.rows[0].cells).forEach((cell, k) => { (th.rows[0].cells[k] as HTMLElement).style.width = `${cell.getBoundingClientRect().width}px` })
            tb.appendChild(th); wrap.appendChild(tb); win.appendChild(wrap)
            // tinggi judul kolom hasil salinan diukur langsung agar baris pertama tidak terpotong
            out.appendChild(lb); lb.style.visibility = 'hidden'
            const nyata = tb.getBoundingClientRect().height
            lb.remove(); lb.style.visibility = ''
            if (nyata && Math.abs(nyata - hh) > 0.5) { kl.style.top = `${nyata - s0}px`; win.style.height = `${e0 - s0 + nyata}px` }
          }
          // garis penutup + footer: identitas dokumen di kiri, nomor halaman di kanan
          const no = document.createElement('div'); no.className = 'pp-no'; no.style.cssText = `left:${mx}px;right:${mx}px;bottom:${Math.min(6, (land ? MARGIN.lanskap.y : MARGIN.potret.y) - 6)}mm`
          const kiri = document.createElement('span'); kiri.textContent = d.dataset.footer ?? ''
          const kanan = document.createElement('span'); kanan.textContent = `Halaman ${i + 1} dari ${n}`
          no.append(kiri, kanan)
          lb.appendChild(no); lembar.push(lb)
        })
        total += n
      })
      lembar.forEach((l) => out.appendChild(l))
      void total
    }
    susun()
    document.fonts?.ready.then(susun).catch(() => undefined)
    const ro = new ResizeObserver(() => { ro.disconnect(); susun(); observasi() })
    const observasi = () => el.querySelectorAll('.doc').forEach((d) => ro.observe(d))
    observasi()
    return () => ro.disconnect()
  }, [node])

  // Cetak: garis + footer lewat kotak margin @page (browser modern). Tiap dokumen punya halaman bernama sendiri agar teks kirinya berbeda.
  useEffect(() => {
    const el = body.current
    if (!node || !el) return
    const rs = getComputedStyle(document.documentElement)
    const q = (t: string) => t.replace(/[\\"]/g, ' ').replace(/[\r\n]+/g, ' ')
    let css = ''
    el.querySelectorAll<HTMLElement>('.doc:not(.label-sheet)').forEach((d, i) => {
      const land = d.classList.contains('landscape')
      const w = (rs.getPropertyValue(land ? '--kw-l' : '--kw') || (land ? '297mm' : '210mm')).trim(), h = (rs.getPropertyValue(land ? '--kh-l' : '--kh') || (land ? '210mm' : '297mm')).trim()
      const m = land ? MARGIN.lanskap : MARGIN.potret
      d.setAttribute('data-pf', String(i))
      const kotak = 'font: 8.5pt/1.2 sans-serif; color: #333; border-top: 0.3mm solid #333; padding-top: 1mm; vertical-align: top;'
      css += `.doc[data-pf="${i}"] { page: pf${i}; counter-reset: page 1; } @page pf${i} { size: ${w} ${h}; margin: ${m.y}mm ${m.x}mm; @bottom-left { content: "${q(d.dataset.footer ?? '')}"; ${kotak} } @bottom-right { content: "Halaman " counter(page); ${kotak} } }\n`
    })
    let st = document.getElementById('simas-footer-cetak')
    if (!st) { st = document.createElement('style'); st.id = 'simas-footer-cetak'; document.head.appendChild(st) }
    st.textContent = css
    return () => { st?.remove() }
  }, [node])

  const judul = () => aman(body.current?.querySelector('.doc-title')?.textContent ?? body.current?.querySelector('h1')?.textContent ?? 'Dokumen SIMAS')
  const namaBerkas = () => `${judul()} ${today()}`
  const isi = () => {
    const c = body.current?.cloneNode(true) as HTMLElement | undefined
    c?.querySelectorAll<HTMLElement>('.pp-sumber').forEach((e) => { e.classList.remove('pp-sumber'); e.style.removeProperty('width') })
    return c?.innerHTML ?? ''
  }

  const cetak = () => { try { window.print() } catch { toast('Cetak tidak tersedia di tampilan ini. Gunakan Simpan Word atau buka aplikasi di browser/Windows.') } }
  const simpanPdf = async () => {
    const d = desktop()
    if (d?.simpanPdf) {
      setSibuk(true)
      try {
        const kiriSet = new Set(Array.from(body.current?.querySelectorAll<HTMLElement>('.doc[data-footer]') ?? []).map((x) => x.dataset.footer ?? ''))
        const r = await d.simpanPdf(`${namaBerkas()}.pdf`, kiriSet.size === 1 ? [...kiriSet][0] : '')
        if (r.ok) toast(`PDF disimpan: ${r.path}`)
        else if (!r.batal) toast(r.pesan ?? 'Gagal menyimpan PDF')
      } finally { setSibuk(false) }
      return
    }
    toast('Pada dialog cetak, pilih tujuan "Simpan sebagai PDF" / "Microsoft Print to PDF".')
    setTimeout(cetak, 600)
  }
  const simpanWord = () => {
    download(`${namaBerkas()}.doc`, '﻿' + htmlDokumen(isi(), judul(), true), 'application/msword')
    toast('Berkas Word (.doc) diunduh')
  }
  const simpanArsip = async () => {
    const html = htmlDokumen(isi(), judul())
    const data = `data:text/html;charset=utf-8;base64,${btoa(unescape(encodeURIComponent(html)))}`
    await put('arsip', {
      id: uid(), register: 'arsip', dibuat: new Date().toISOString(), oleh: getSesi()?.akun.username,
      data: { tanggal: today(), nama: judul(), kategori: 'Lainnya', lokasi: 'Arsip digital SIMAS', retensi: 'Aktif 2 th' },
      lampiran: [{ nama: `${namaBerkas()}.html`, ukuran: html.length, tipe: 'text/html', data }],
    })
    toast('Dokumen disimpan ke Administrasi TU → Daftar Arsip')
  }

  return createPortal(
    <div id="print-root" className={node ? 'open' : ''} role={node ? 'dialog' : undefined} aria-label="Pratinjau dokumen">
      {node && (
        <div className="pp-bar no-print">
          <b className="pp-judul"><Icon name="print" size={18} /> Pratinjau dokumen</b>
          <div className="pp-aksi">
            <Btn icon="print" kind="primary" onClick={cetak}>Cetak</Btn>
            <Btn icon="download" onClick={simpanPdf} disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Simpan PDF'}</Btn>
            <Btn icon="download" onClick={simpanWord}>Simpan Word</Btn>
            <Btn icon="induk" onClick={simpanArsip}>Simpan ke Arsip</Btn>
            <Btn icon="close" kind="ghost" onClick={() => setNode(null)}>Tutup</Btn>
          </div>
        </div>
      )}
      <div className="pp-body" ref={body}>{node}</div>
      <div className="pp-halaman no-print" ref={halaman} />
    </div>,
    document.body,
  )
}
