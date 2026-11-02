import { useEffect, useRef, useState } from 'react'
import { aktifkanSerial, hitungStatus, type StatusLisensi } from '../lisensi'
import { Btn, Card, Modal, toast } from '../ui'

type Pendengar = (s: StatusLisensi) => void
const pendengar = new Set<Pendengar>()
let terakhir: StatusLisensi | null = null
const sebar = (s: StatusLisensi) => { terakhir = s; pendengar.forEach((f) => f(s)) }

/** Periksa ulang status lisensi sekarang (dipakai setelah aktivasi dan berkala). */
export async function segarkanLisensi() { const s = await hitungStatus(); sebar(s); return s }

/** Status lisensi aktif; null selama pemeriksaan pertama. Diperiksa ulang tiap menit agar trial yang habis saat dipakai langsung terkunci. */
export function useLisensi() {
  const [s, setS] = useState<StatusLisensi | null>(terakhir)
  useEffect(() => {
    pendengar.add(setS)
    segarkanLisensi().catch(() => undefined)
    const t = setInterval(() => { segarkanLisensi().catch(() => undefined) }, 60_000)
    return () => { pendengar.delete(setS); clearInterval(t) }
  }, [])
  return s
}

const tgl = (ms: number) => new Date(ms - 1).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

function FormSerial({ kode, onSukses }: { kode: string; onSukses?: () => void }) {
  const [teks, setTeks] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const berkas = useRef<HTMLInputElement>(null)
  const aktif = async (t = teks) => {
    setSibuk(true); setGalat('')
    try { sebar(await aktifkanSerial(t)); toast('Lisensi diaktifkan. Terima kasih!'); onSukses?.() } catch (e) { setGalat((e as Error).message) }
    setSibuk(false)
  }
  const salin = async () => { try { await navigator.clipboard.writeText(kode); toast('Kode Instalasi disalin') } catch { toast('Salin manual kode di layar.') } }
  return (
    <div className="lisensi-form">
      <div className="lisensi-kode">
        <span className="muted small">Kode Instalasi komputer ini</span>
        <div className="row-actions"><code className="kode-inst">{kode}</code><Btn kind="ghost" onClick={salin}>Salin</Btn></div>
        <span className="muted small">Kirim kode ini ke penyedia aplikasi bila serial Anda perlu diikat ke komputer ini.</span>
      </div>
      <label className="small" htmlFor="serial-simas"><b>Serial / kunci lisensi</b></label>
      <textarea id="serial-simas" rows={4} value={teks} onChange={(e) => setTeks(e.target.value)} placeholder="SIMAS-XXXXX-XXXXX-XXXXX-…" spellCheck={false} autoComplete="off" />
      {galat && <div className="errs small" role="alert">{galat}</div>}
      <div className="row-actions">
        <Btn kind="primary" onClick={() => aktif()} disabled={sibuk || teks.trim().length < 20}>{sibuk ? 'Memeriksa…' : 'Aktifkan lisensi'}</Btn>
        <Btn onClick={() => berkas.current?.click()}>Buka berkas .lisensi</Btn>
        <input ref={berkas} type="file" accept=".lisensi,.txt" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const t = await f.text(); setTeks(t.trim()); aktif(t) } }} />
      </div>
    </div>
  )
}

/** Layar kunci penuh: tampil bila trial/lisensi habis. Semua fungsi aplikasi (termasuk login) tertutup. */
export function GerbangLisensi({ status }: { status: Extract<StatusLisensi, { mode: 'habis' }> }) {
  return (
    <div className="welcome">
      <div className="welcome-card gerbang">
        <div className="gerbang-ikon" aria-hidden>🔒</div>
        <h1>Lisensi diperlukan</h1>
        <p>{status.pesan}</p>
        <p className="muted small">Data sekolah Anda tetap aman dan tidak dihapus. Setelah serial dimasukkan, semua fungsi aktif kembali.</p>
        <FormSerial kode={status.kodeInstalasi} />
      </div>
    </div>
  )
}

/** Chip di bilah atas selama masa percobaan; klik untuk memasukkan serial. */
export function ChipTrial() {
  const s = useLisensi()
  const [buka, setBuka] = useState(false)
  if (!s || s.mode !== 'trial') return null
  return (
    <>
      <button className="chip-trial no-print" onClick={() => setBuka(true)} title="Masa percobaan. Klik untuk memasukkan serial lisensi.">Trial · sisa {s.sisaHari} hari</button>
      {buka && <Modal title="Aktifkan lisensi" onClose={() => setBuka(false)}><p className="muted small">Masa percobaan {s.sisaHari} hari lagi. Masukkan serial untuk memakai aplikasi tanpa batas waktu percobaan.</p><FormSerial kode={s.kodeInstalasi} onSukses={() => setBuka(false)} /></Modal>}
    </>
  )
}

export function KartuLisensi() {
  const s = useLisensi()
  if (!s) return <Card title="Lisensi aplikasi"><div className="muted">Memeriksa…</div></Card>
  return (
    <Card title="Lisensi aplikasi">
      {s.mode === 'lisensi' && (
        <div className="lisensi-ringkas">
          <span className="pill ok">Berlisensi</span>
          <table className="tbl"><tbody>
            <tr><th>Pemegang lisensi</th><td>{s.pemegang}</td></tr>
            <tr><th>Nomor seri</th><td><code>{s.noSeri}</code></td></tr>
            <tr><th>Masa berlaku</th><td>{s.kedaluwarsa ? `sampai ${tgl(s.kedaluwarsa)} (${s.sisaHari} hari lagi)` : 'Permanen'}</td></tr>
            <tr><th>Kode Instalasi</th><td><code>{s.kodeInstalasi}</code></td></tr>
          </tbody></table>
          <p className="muted small">Untuk mengganti atau memperpanjang lisensi, masukkan serial baru di bawah.</p>
        </div>
      )}
      {s.mode === 'trial' && <p><span className="pill warn">Masa percobaan</span> Sisa <b>{s.sisaHari} hari</b>. Setelah itu semua fungsi terkunci sampai serial lisensi dimasukkan.</p>}
      {s.mode === 'habis' && <p><span className="pill bad">Terkunci</span> {s.pesan}</p>}
      <FormSerial kode={s.kodeInstalasi} />
    </Card>
  )
}
