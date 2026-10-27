import { useMemo, useState } from 'react'
import { useApp } from './store'
import { Modal, notify } from './ui'
import type { Project, Transmittal } from './types'
import { DEFAULT_EMAIL_TEMPLATE, buildTransmittalPdf, fillTemplate, trLines } from './transmittalDoc'
import { channelReady, recoveryOf, sendVia } from './recovery'
import { downloadBlob } from './util'

const toB64 = (b: Blob) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => bad(new Error('Gagal membaca file.')); r.readAsDataURL(b) })
export const trPdfName = (t: Transmittal) => `Transmittal_${t.number}`.replace(/[\\/:*?"<>|\s]+/g, '-') + '.pdf'

// Siapkan email pengiriman transmittal: isi dari template, lampiran PDF transmittal.
export function TransmittalEmail({ project, t, onClose }: { project: Project; t: Transmittal; onClose: () => void }) {
  const { state } = useApp()
  const s = state.settings
  const tpl = s.emailTemplate || DEFAULT_EMAIL_TEMPLATE
  const lines = useMemo(() => trLines(state, t), [state, t])
  const [to, setTo] = useState(t.toEmail || '')
  const [cc, setCc] = useState(t.ccEmail || '')
  const [subject, setSubject] = useState(fillTemplate(tpl.subject, project, t, lines, s))
  const [body, setBody] = useState(fillTemplate(tpl.body, project, t, lines, s))
  const [busy, setBusy] = useState('')
  const rc = recoveryOf(s.recovery)
  const gw = channelReady(rc, 'email')

  const pdf = () => buildTransmittalPdf(state, project, t)
  const download = async () => { setBusy('Membuat PDF...'); try { downloadBlob(await pdf(), trPdfName(t)) } finally { setBusy('') } }
  const mailto = async () => {
    setBusy('Membuat PDF...')
    try {
      downloadBlob(await pdf(), trPdfName(t))
      const q = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body.length > 1800 ? body.slice(0, 1800) + '...' : body).replace(/%0A/g, '%0D%0A')}`, cc && `cc=${encodeURIComponent(cc)}`].filter(Boolean).join('&')
      window.location.href = `mailto:${encodeURIComponent(to.trim())}?${q}`
      notify(`File ${trPdfName(t)} sudah diunduh. Lampirkan file itu pada email yang terbuka di aplikasi email Anda (aplikasi web tidak dapat melampirkan file secara otomatis lewat mailto).`)
    } finally { setBusy('') }
  }
  const gateway = async () => {
    if (!to.trim()) return notify('Isi alamat email penerima.')
    setBusy('Mengirim...')
    try {
      const b = await pdf()
      await sendVia(rc, 'email', to.trim(), subject, body, s.appName, { cc: cc.trim(), attachments: [{ name: trPdfName(t), mime: 'application/pdf', base64: await toB64(b) }] })
      notify('Permintaan kirim email telah dikirim ke layanan pengirim.')
    } catch (e: any) { notify('Gagal mengirim: ' + e.message) } finally { setBusy('') }
  }
  return (
    <Modal title={`Kirim Transmittal ${t.number} via Email`} onClose={onClose}>
      <div className="row">
        <label>Kepada (email)<input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="penerima@contoh.com" /></label>
        <label>CC (opsional)<input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="pisahkan dengan koma" /></label>
      </div>
      <label>Subjek<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label>Isi email<textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <p className="muted" style={{ fontSize: 12 }}>📎 Lampiran: <b>{trPdfName(t)}</b> (formulir transmittal berisi {lines.length} dokumen, dibuat otomatis). Template isi email bisa diubah di Pengaturan.</p>
      <div className="row">
        <button className="auto" disabled={!!busy} onClick={mailto}>✉ Buka di aplikasi email</button>
        {gw && <button className="auto" disabled={!!busy} onClick={gateway}>🚀 Kirim langsung (dengan lampiran)</button>}
        <button className="auto sec" disabled={!!busy} onClick={download}>⬇ Unduh lampiran PDF</button>
        {busy && <span className="muted">{busy}</span>}
      </div>
      {!gw && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Pengiriman langsung dengan lampiran otomatis tersedia bila URL pengirim email diisi di Pengaturan, bagian Lupa Sandi.</p>}
    </Modal>
  )
}
