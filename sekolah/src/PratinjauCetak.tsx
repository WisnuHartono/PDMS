// Pratinjau dokumen sebelum dicetak/disimpan. Semua dokumen (rapor, buku induk, BKU, surat, dll.) lewat sini.
// - Cetak: dialog cetak sistem.
// - Simpan PDF: di aplikasi Windows langsung membuat berkas PDF (printToPDF); di browser memakai "Simpan sebagai PDF".
// - Simpan Word: berkas .doc (HTML yang dapat dibuka dan disunting di Microsoft Word / LibreOffice).
// - Simpan ke Arsip: salinan dokumen disimpan terenkripsi di Administrasi TU → Daftar Arsip.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'
import { getSesi } from './security/sesi'
import { put } from './store'
import { Btn, _pasangPrint, toast } from './ui'
import { download, today, uid } from './util'

interface SimasDesktop { simpanPdf?: (nama: string) => Promise<{ ok: boolean; path?: string; batal?: boolean; pesan?: string }> }
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
  return `${head}<title>${judul.replace(/</g, '&lt;')}</title><style>${cssDokumen()}\n#print-root{display:block;position:static;background:#fff}.pp-body{padding:0}.doc{margin:0 auto 12px}@page{size:A4;margin:12mm}</style></head><body><div id="print-root"><div class="pp-body">${isi}</div></div></body></html>`
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

  const judul = () => aman(body.current?.querySelector('.doc-title')?.textContent ?? body.current?.querySelector('h1')?.textContent ?? 'Dokumen SIMAS')
  const namaBerkas = () => `${judul()} ${today()}`
  const isi = () => body.current?.innerHTML ?? ''

  const cetak = () => { try { window.print() } catch { toast('Cetak tidak tersedia di tampilan ini. Gunakan Simpan Word atau buka aplikasi di browser/Windows.') } }
  const simpanPdf = async () => {
    const d = desktop()
    if (d?.simpanPdf) {
      setSibuk(true)
      try {
        const r = await d.simpanPdf(`${namaBerkas()}.pdf`)
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
    </div>,
    document.body,
  )
}
