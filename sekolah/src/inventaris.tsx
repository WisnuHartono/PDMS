// Inventaris: label QR/barcode siap cetak dan stok opname (pindai kamera, pemindai USB, atau ketik kode).
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import jsQR from 'jsqr'
import { formatNoInv, noInvBerikut } from './administrasi'
import { Barcode128, qrUrl } from './barcode'
import { KopSurat, TandaTangan, pejabat } from './print'
import { getSekolah, getState, put, useCol, useSekolah } from './store'
import type { Arsip, Sekolah } from './types'
import { Btn, Modal, printDoc, tanya, toast } from './ui'
import { fmtTanggal, today, uid } from './util'

export const KONDISI = ['Baik', 'Rusak Ringan', 'Rusak Berat']
export interface Butir { a: Arsip; noinv: string; nama: string; merk: string; ruang: string; tahun: string; kondisi: string; jumlah: number; satuan: string }

export function butirInventaris(arsip: Arsip[]): Butir[] {
  return arsip.filter((a) => a.register === 'inventaris').map((a) => ({
    a, noinv: String(a.data.noinv ?? ''), nama: String(a.data.nama ?? ''), merk: String(a.data.merk ?? ''), ruang: String(a.data.ruang ?? ''),
    tahun: String(a.data.tahun ?? ''), kondisi: String(a.data.kondisi ?? 'Baik'), jumlah: Math.max(1, Number(a.data.jumlah ?? 1) || 1), satuan: String(a.data.satuan ?? ''),
  })).sort((x, y) => x.ruang.localeCompare(y.ruang) || x.nama.localeCompare(y.nama))
}

/** Beri nomor inventaris pada butir yang belum punya, berurutan; mengembalikan butir terbaru. */
export async function pastikanNomor(butir: Butir[], s: Sekolah): Promise<Butir[]> {
  let urut = noInvBerikut(getState().arsip)
  const out: Butir[] = []
  for (const b of butir) {
    if (b.noinv) { out.push(b); continue }
    const noinv = formatNoInv(s, urut++)
    await put('arsip', { ...b.a, data: { ...b.a.data, noinv }, diubah: new Date().toISOString() })
    out.push({ ...b, noinv })
  }
  return out
}

/** Kode dasar dari hasil pindai: buang sufiks unit "/02" dan spasi. */
export const kodeDasar = (k: string) => k.trim().toUpperCase().replace(/\/\d+$/, '')

// ---------------------------------------------------------------- LABEL
const UKURAN: Record<string, { l: number; t: number; nama: string }> = {
  '50x30': { l: 50, t: 30, nama: '50 × 30 mm (kecil)' }, '70x40': { l: 70, t: 40, nama: '70 × 40 mm' },
  '90x50': { l: 90, t: 50, nama: '90 × 50 mm (kartu)' }, '100x60': { l: 100, t: 60, nama: '100 × 60 mm (besar)' },
}
const WARNA: Record<string, string> = { teal: '#0f766e', biru: '#1d4ed8', hitam: '#111827', jingga: '#c2410c' }
interface OpsiLabel { judul: string; footer: string; ukuran: string; isi: 'qr' | 'barcode' | 'keduanya'; perUnit: boolean; logo: boolean; sekolah: boolean; lokasi: boolean; tahun: boolean; kondisi: boolean; warna: string }
const OPSI: OpsiLabel = { judul: 'KARTU INVENTARIS BARANG', footer: 'Pindai QR untuk menuju data inventaris', ukuran: '90x50', isi: 'qr', perUnit: false, logo: true, sekolah: true, lokasi: true, tahun: true, kondisi: true, warna: 'teal' }

interface ItemLabel { kode: string; b: Butir }
const itemLabel = (butir: Butir[], perUnit: boolean): ItemLabel[] =>
  butir.flatMap((b) => (perUnit && b.jumlah > 1 ? Array.from({ length: b.jumlah }, (_, i) => ({ kode: `${b.noinv}/${String(i + 1).padStart(2, '0')}`, b })) : [{ kode: b.noinv, b }]))

/** Menyusutkan isi label (tanpa melipat teks) hingga pas di kotak ukurannya, sehingga tidak ada informasi terpotong. */
function PasLabel({ lebar, tinggi, warna, kecil, children }: { lebar: number; tinggi: number; warna: string; kecil: boolean; children: ReactNode }) {
  const luar = useRef<HTMLDivElement>(null)
  const dalam = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const hitung = () => {
      const o = luar.current, d = dalam.current
      if (!o || !d) return
      const w = o.clientWidth, h = o.clientHeight
      if (!w || !h) return
      d.style.transform = 'none'; d.style.width = `${w}px`; d.style.height = 'auto'
      const s = Math.min(1, w / Math.max(d.scrollWidth, 1), h / Math.max(d.scrollHeight, d.offsetHeight, 1)) * 0.995
      d.style.width = `${w / s}px`; d.style.height = `${h / s}px`; d.style.transform = `scale(${s})`
    }
    hitung()
    document.fonts?.ready.then(hitung).catch(() => undefined)
  })
  return (
    <div ref={luar} className={`lbl ${kecil ? 'kecil' : ''}`} style={{ width: `${lebar}mm`, height: `${tinggi}mm`, borderColor: warna }}>
      <div ref={dalam} className="lbl-fit">{children}</div>
    </div>
  )
}

export function KartuLabel({ it, o, qr, s }: { it: ItemLabel; o: OpsiLabel; qr?: string; s: Sekolah }) {
  const u = UKURAN[o.ukuran]
  const w = WARNA[o.warna]
  const kecil = u.t <= 30
  const baris: [string, string, boolean][] = [['Kode', it.kode, true], ['Nama', it.b.nama + (it.b.merk && !kecil ? ` (${it.b.merk})` : ''), false]]
  if (o.lokasi && it.b.ruang) baris.push(['Lokasi', it.b.ruang, false])
  const th = o.tahun && it.b.tahun ? it.b.tahun : ''
  const kd = o.kondisi ? it.b.kondisi : ''
  const qs = Math.max(10, Math.min(u.t - (kecil ? 8 : 15), u.l * 0.42))
  const qstyle = { width: `${qs}mm`, height: `${qs}mm` }
  return (
    <PasLabel lebar={u.l} tinggi={u.t} warna={w} kecil={kecil}>
      <div className="lbl-judul" style={{ background: w }}>{o.judul || 'KARTU INVENTARIS BARANG'}</div>
      <div className="lbl-body">
        {o.isi !== 'barcode' && (qr ? <img className="lbl-qr" style={qstyle} src={qr} alt={`QR ${it.kode}`} /> : <div className="lbl-qr" style={qstyle} />)}
        <div className="lbl-info">
          {(o.sekolah || o.logo) && (
            <div className="lbl-sek" style={{ color: w }}>
              {o.logo && s.logo && <img src={s.logo} alt="" />}
              {o.sekolah && <b>{s.nama}</b>}
            </div>
          )}
          {(() => {
            const semua = [...baris, ...(th ? [['Tahun', th, false] as [string, string, boolean]] : []), ...(kd ? [['Kondisi', kd, false] as [string, string, boolean]] : [])]
            const baris2 = (arr: [string, string, boolean][]) => (
              <div className="lbl-data">
                {arr.map(([k, v, tebal]) => (
                  <Fragment key={k}><span className="k">{k}</span><span className="t">:</span><b className={tebal ? 'kode' : ''} style={tebal ? { color: w } : undefined}>{v}</b></Fragment>
                ))}
              </div>
            )
            if (o.isi !== 'barcode' || semua.length < 4) return baris2(semua)
            const n = Math.ceil(semua.length / 2)
            return <div className="lbl-dua">{baris2(semua.slice(0, n))}{baris2(semua.slice(n))}</div>
          })()}
          {o.isi !== 'qr' && <div className={`lbl-bar ${o.isi === 'barcode' ? 'solo' : ''}`}><Barcode128 teks={it.kode} tinggi={o.isi === 'barcode' ? (kecil ? 40 : 46) : kecil ? 30 : 34} /></div>}
        </div>
      </div>
      {o.footer && !kecil && <div className="lbl-foot">{o.footer}</div>}
    </PasLabel>
  )
}

export function CetakLabel({ items, o, qrs, s }: { items: ItemLabel[]; o: OpsiLabel; qrs: Record<string, string>; s: Sekolah }) {
  return (
    <div className="doc label-sheet">
      <div className="lbl-grid">{items.map((it, i) => <KartuLabel key={i} it={it} o={o} s={s} qr={qrs[it.kode]} />)}</div>
    </div>
  )
}

export function LabelInventaris({ butir, onClose }: { butir: Butir[]; onClose: () => void }) {
  const s = useSekolah()
  const [pilih, setPilih] = useState<Set<string>>(() => new Set(butir.map((b) => b.a.id)))
  const [o, setO] = useState<OpsiLabel>(OPSI)
  const [qrs, setQrs] = useState<Record<string, string>>({})
  const [sibuk, setSibuk] = useState(false)
  const terpilih = useMemo(() => butir.filter((b) => pilih.has(b.a.id)), [butir, pilih])
  const tanpaNomor = terpilih.filter((b) => !b.noinv).length
  const pratinjau = useMemo(() => itemLabel(terpilih.slice(0, 1).map((b) => (b.noinv ? b : { ...b, noinv: formatNoInv(s, noInvBerikut(getState().arsip)) })), o.perUnit).slice(0, 1), [terpilih, o.perUnit, s])
  const set = (p: Partial<OpsiLabel>) => setO((x) => ({ ...x, ...p }))

  const buatQr = async (items: ItemLabel[]) => {
    const out: Record<string, string> = {}
    if (o.isi !== 'barcode') for (const it of items) out[it.kode] = out[it.kode] ?? await qrUrl(it.kode)
    return out
  }
  const kodePrev = pratinjau[0]?.kode
  useEffect(() => { let batal = false; if (kodePrev && o.isi !== 'barcode') qrUrl(kodePrev).then((u) => { if (!batal) setQrs({ [kodePrev]: u }) }); return () => { batal = true } }, [kodePrev, o.isi])

  const cetak = async () => {
    setSibuk(true)
    try {
      const siap = await pastikanNomor(terpilih, s)
      const items = itemLabel(siap, o.perUnit)
      if (items.length > 300 && !(await tanya(`${items.length} label akan dicetak. Lanjutkan?`, 'Cetak'))) return
      const q = await buatQr(items)
      printDoc(<CetakLabel items={items} o={o} qrs={q} s={getSekolah()} />)
    } finally { setSibuk(false) }
  }
  const jumlahLabel = itemLabel(terpilih, o.perUnit).length
  const ruangList = [...new Set(butir.map((b) => b.ruang || '(tanpa ruang)'))]

  return (
    <Modal wide title="Cetak label inventaris" onClose={onClose} footer={<><Btn onClick={onClose}>Tutup</Btn><Btn kind="primary" icon="print" onClick={cetak} disabled={!terpilih.length || sibuk}>{sibuk ? 'Menyiapkan…' : `Cetak ${jumlahLabel} label`}</Btn></>}>
      <div className="lbl-set">
        <div>
          <h4 className="sec">Pilih barang ({terpilih.length}/{butir.length})</h4>
          <div className="filters">
            <Btn kind="ghost" onClick={() => setPilih(new Set(butir.map((b) => b.a.id)))}>Semua</Btn>
            <Btn kind="ghost" onClick={() => setPilih(new Set())}>Kosongkan</Btn>
            <Btn kind="ghost" onClick={() => setPilih(new Set(butir.filter((b) => !b.noinv).map((b) => b.a.id)))}>Yang belum bernomor</Btn>
            <select aria-label="Pilih per ruang" value="" onChange={(e) => { if (e.target.value) setPilih(new Set(butir.filter((b) => (b.ruang || '(tanpa ruang)') === e.target.value).map((b) => b.a.id))) }}>
              <option value="">Per ruang…</option>{ruangList.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="lbl-list">
            {butir.map((b) => (
              <label key={b.a.id} className="lbl-row">
                <input type="checkbox" checked={pilih.has(b.a.id)} onChange={(e) => setPilih((p) => { const n = new Set(p); if (e.target.checked) n.add(b.a.id); else n.delete(b.a.id); return n })} />
                <span className="mono">{b.noinv || '— otomatis —'}</span><b>{b.nama}</b><span className="muted small">{b.ruang} · {b.jumlah} {b.satuan}</span>
              </label>
            ))}
            {!butir.length && <div className="muted">Belum ada barang pada Buku Inventaris.</div>}
          </div>
          {tanpaNomor > 0 && <p className="small">{tanpaNomor} barang terpilih belum bernomor; nomor dibuat otomatis saat mencetak (urut berikutnya).</p>}
        </div>
        <div>
          <h4 className="sec">Pengaturan label</h4>
          <div className="form-grid g2">
            <label className="field"><span className="field-l">Ukuran</span><select value={o.ukuran} onChange={(e) => set({ ukuran: e.target.value })}>{Object.entries(UKURAN).map(([k, v]) => <option key={k} value={k}>{v.nama}</option>)}</select></label>
            <label className="field"><span className="field-l">Isi kode</span><select value={o.isi} onChange={(e) => set({ isi: e.target.value as OpsiLabel['isi'] })}><option value="qr">QR Code</option><option value="barcode">Barcode (Code 128)</option><option value="keduanya">QR + Barcode</option></select></label>
            <label className="field"><span className="field-l">Warna</span><select value={o.warna} onChange={(e) => set({ warna: e.target.value })}><option value="teal">Hijau tosca</option><option value="biru">Biru</option><option value="jingga">Jingga</option><option value="hitam">Hitam</option></select></label>
            <label className="field"><span className="field-l">Jumlah</span><div className="radio-row"><input type="checkbox" checked={o.perUnit} onChange={(e) => set({ perUnit: e.target.checked })} /> Satu label per unit (-01, -02, …)</div></label>
          </div>
          <div className="form-grid g2">
            <label className="field"><span className="field-l">Judul label</span><input value={o.judul} onChange={(e) => set({ judul: e.target.value })} /></label>
            <label className="field"><span className="field-l">Teks bawah (opsional)</span><input value={o.footer} onChange={(e) => set({ footer: e.target.value })} /></label>
          </div>
          <div className="radio-row" style={{ flexWrap: 'wrap', rowGap: 4 }}>
            {([['logo', 'Logo'], ['sekolah', 'Nama sekolah'], ['lokasi', 'Lokasi'], ['tahun', 'Tahun'], ['kondisi', 'Kondisi']] as const).map(([k, l]) => (
              <label key={k} className="chk"><input type="checkbox" checked={o[k]} onChange={(e) => set({ [k]: e.target.checked })} /> {l}</label>
            ))}
          </div>
          <h4 className="sec">Pratinjau</h4>
          <div className="lbl-prev">{pratinjau.length ? <KartuLabel it={pratinjau[0]} o={o} qr={qrs[pratinjau[0].kode]} s={s} /> : <span className="muted small">Pilih barang untuk melihat pratinjau.</span>}</div>
          <p className="muted small">QR berisi nomor inventaris (mis. {formatNoInv(s, 12)}), sehingga terbaca oleh kamera ponsel, pemindai USB, dan stok opname di SIMAS. Cetak pada kertas tebal atau stiker, lalu laminasi agar tahan aktivitas anak.</p>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- OPNAME
type Status = 'ada' | 'lain' | 'tidak'
interface HasilItem { status: Status; kondisi: string; catatan?: string; waktu?: string }
const KET: Record<Status, string> = { ada: 'Ditemukan', lain: 'Ruang lain', tidak: 'Tidak ditemukan' }

function Pemindai({ onKode }: { onKode: (k: string) => void }) {
  const vid = useRef<HTMLVideoElement>(null)
  const [galat, setGalat] = useState('')
  const terakhir = useRef({ k: '', t: 0 })
  useEffect(() => {
    let stop = false
    let stream: MediaStream | undefined
    const kanvas = document.createElement('canvas')
    const ctx = kanvas.getContext('2d', { willReadFrequently: true })
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stop || !vid.current) return
        vid.current.srcObject = stream
        await vid.current.play()
        const loop = () => {
          if (stop) return
          const v = vid.current
          if (v && v.videoWidth && ctx) {
            kanvas.width = v.videoWidth; kanvas.height = v.videoHeight
            ctx.drawImage(v, 0, 0)
            const img = ctx.getImageData(0, 0, kanvas.width, kanvas.height)
            const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
            if (r?.data) {
              const sekarang = Date.now()
              if (r.data !== terakhir.current.k || sekarang - terakhir.current.t > 2500) { terakhir.current = { k: r.data, t: sekarang }; onKode(r.data) }
            }
          }
          setTimeout(loop, 160)
        }
        loop()
      } catch (e) { setGalat(`Kamera tidak dapat dipakai: ${(e as Error).message}. Gunakan pemindai USB atau ketik kode.`) }
    })()
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()) }
  }, [onKode])
  return galat ? <p className="small bad-t">{galat}</p> : <video ref={vid} className="opn-video" muted playsInline />
}

export function CetakOpname({ a }: { a: Arsip }) {
  const s = getSekolah()
  const ruang = String(a.data.ruang ?? '')
  const hasil: Record<string, HasilItem> = JSON.parse(String(a.data.hasil ?? '{}'))
  const butir = butirInventaris(getState().arsip).filter((b) => (!ruang || b.ruang === ruang) && b.noinv)
  const ada = butir.filter((b) => hasil[b.noinv]?.status === 'ada').length
  const lain = butir.filter((b) => hasil[b.noinv]?.status === 'lain').length
  const hilang = butir.length - ada - lain
  const rusak = butir.filter((b) => (hasil[b.noinv]?.kondisi ?? b.kondisi) !== 'Baik' && hasil[b.noinv]).length
  return (
    <div className="doc landscape">
      <KopSurat jenis="adm" judul="BERITA ACARA STOK OPNAME INVENTARIS" sub={`${ruang ? `Ruang: ${ruang} · ` : 'Seluruh ruang · '}Tanggal ${fmtTanggal(String(a.data.tanggal ?? today()))}`} />
      <p>Pada tanggal tersebut telah dilakukan pencocokan fisik barang dengan Buku Inventaris oleh <b>{String(a.data.petugas ?? '-')}</b>. Hasil: <b>{ada}</b> ditemukan, <b>{lain}</b> ditemukan di ruang lain, <b>{hilang}</b> tidak ditemukan, dan <b>{rusak}</b> berkondisi rusak dari total <b>{butir.length}</b> butir.</p>
      <table className="nilai">
        <thead><tr><th style={{ width: 28 }}>No</th><th>No. Inventaris</th><th>Nama Barang</th><th>Lokasi Tercatat</th><th>Kondisi Tercatat</th><th>Hasil</th><th>Kondisi Ditemukan</th><th>Catatan</th></tr></thead>
        <tbody>
          {butir.map((b, i) => {
            const h = hasil[b.noinv]
            return <tr key={b.a.id}><td className="c">{i + 1}</td><td>{b.noinv}</td><td>{b.nama}</td><td>{b.ruang}</td><td>{b.kondisi}</td><td>{h ? KET[h.status] : KET.tidak}</td><td>{h?.kondisi ?? '-'}</td><td>{h?.catatan ?? ''}</td></tr>
          })}
        </tbody>
      </table>
      <TandaTangan kiri={{ ...pejabat('kepsek') }} kanan={{ jabatan: 'Petugas Stok Opname', nama: String(a.data.petugas ?? '') || undefined }} tanggal={String(a.data.tanggal ?? today())} />
      <p className="small">Dicetak dari SIMAS · {s.nama}</p>
    </div>
  )
}
export function OpnameInventaris({ butir: semua, onClose }: { butir: Butir[]; onClose: () => void }) {
  const arsip = useCol('arsip')
  const ruangList = [...new Set(semua.map((b) => b.ruang).filter(Boolean))].sort()
  const [ruang, setRuang] = useState('')
  const [petugas, setPetugas] = useState('')
  const [hasil, setHasil] = useState<Record<string, HasilItem>>({})
  const [input, setInput] = useState('')
  const [kamera, setKamera] = useState(false)
  const [asing, setAsing] = useState<string[]>([])
  const [terapkan, setTerapkan] = useState(true)
  const [tab, setTab] = useState<'pindai' | 'riwayat'>('pindai')
  const kamu = useRef<HTMLInputElement>(null)
  const target = semua.filter((b) => b.noinv && (!ruang || b.ruang === ruang))
  const tanpaNomor = semua.filter((b) => !b.noinv && (!ruang || b.ruang === ruang)).length
  const peta = useMemo(() => new Map(semua.filter((b) => b.noinv).map((b) => [b.noinv.toUpperCase(), b])), [semua])
  const hasilRef = useRef(hasil); hasilRef.current = hasil
  const ruangRef = useRef(ruang); ruangRef.current = ruang

  const proses = (mentah: string) => {
    const kode = kodeDasar(mentah)
    if (!kode) return
    const b = peta.get(kode)
    if (!b) { setAsing((a) => (a.includes(kode) ? a : [...a, kode])); toast(`Kode ${kode} tidak ada di inventaris`); return }
    if (hasilRef.current[b.noinv]) { toast(`${b.noinv} sudah dipindai`); return }
    const lain = !!ruangRef.current && b.ruang !== ruangRef.current
    setHasil((h) => ({ ...h, [b.noinv]: { status: lain ? 'lain' : 'ada', kondisi: b.kondisi, waktu: new Date().toISOString(), catatan: lain ? `Tercatat di ${b.ruang}` : undefined } }))
    toast(`${b.noinv} · ${b.nama}${lain ? ' (ruang lain)' : ''}`)
  }
  const prosesRef = useRef(proses); prosesRef.current = proses
  const dariKamera = useMemo(() => (k: string) => prosesRef.current(k), [])

  const ubah = (noinv: string, p: Partial<HasilItem>) => setHasil((h) => ({ ...h, [noinv]: { ...({ status: 'ada', kondisi: 'Baik' } as HasilItem), ...h[noinv], ...p } }))
  const nDitemukan = target.filter((b) => hasil[b.noinv]).length
  const riwayat = arsip.filter((a) => a.register === 'opname').sort((x, y) => y.dibuat.localeCompare(x.dibuat))

  const simpan = async () => {
    if (!nDitemukan) return toast('Belum ada barang yang dipindai atau ditandai.')
    if (nDitemukan < target.length && !(await tanya(`${target.length - nDitemukan} barang belum ditemukan dan akan dicatat sebagai TIDAK DITEMUKAN. Simpan hasil opname?`, 'Simpan'))) return
    const a: Arsip = { id: `opn-${uid()}`, register: 'opname', dibuat: new Date().toISOString(), oleh: petugas, data: { tanggal: today(), ruang, petugas, hasil: JSON.stringify(hasil), ditemukan: nDitemukan, total: target.length } }
    await put('arsip', a)
    if (terapkan) {
      for (const b of target) { const h = hasil[b.noinv]; if (h && h.kondisi !== b.kondisi) await put('arsip', { ...b.a, data: { ...b.a.data, kondisi: h.kondisi }, diubah: new Date().toISOString() }) }
    }
    toast('Hasil stok opname disimpan')
    printDoc(<CetakOpname a={a} />)
  }

  return (
    <Modal wide title="Stok opname inventaris" onClose={onClose}
      footer={tab === 'pindai' ? <><Btn onClick={onClose}>Tutup</Btn><Btn kind="primary" icon="validasi" onClick={simpan}>Simpan & cetak berita acara</Btn></> : <Btn onClick={onClose}>Tutup</Btn>}>
      <div className="filters">
        <button className={`chip ${tab === 'pindai' ? 'on' : ''}`} onClick={() => setTab('pindai')}>Pindai</button>
        <button className={`chip ${tab === 'riwayat' ? 'on' : ''}`} onClick={() => setTab('riwayat')}>Riwayat ({riwayat.length})</button>
      </div>
      {tab === 'riwayat' ? (
        <table className="tbl"><thead><tr><th>Tanggal</th><th>Ruang</th><th>Petugas</th><th className="c">Ditemukan</th><th /></tr></thead>
          <tbody>
            {riwayat.map((a) => <tr key={a.id}><td>{fmtTanggal(String(a.data.tanggal))}</td><td>{String(a.data.ruang || 'Semua')}</td><td>{String(a.data.petugas || '-')}</td><td className="c">{String(a.data.ditemukan)}/{String(a.data.total)}</td><td><Btn kind="ghost" icon="print" onClick={() => printDoc(<CetakOpname a={a} />)}>Berita acara</Btn></td></tr>)}
            {!riwayat.length && <tr><td colSpan={5} className="muted">Belum ada riwayat opname.</td></tr>}
          </tbody></table>
      ) : (
        <>
          <div className="form-grid g4">
            <label className="field span-2"><span className="field-l">Ruang yang dicek</span><select value={ruang} onChange={(e) => { setRuang(e.target.value); setHasil({}); setAsing([]) }}><option value="">Semua ruang</option>{ruangList.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="field span-2"><span className="field-l">Petugas</span><input value={petugas} onChange={(e) => setPetugas(e.target.value)} placeholder="Nama petugas opname" /></label>
          </div>
          <div className="opn-scan">
            <input ref={kamu} autoFocus className="opn-input" placeholder="Pindai QR/barcode dengan pemindai USB, atau ketik nomor lalu Enter" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { proses(input); setInput('') } }} aria-label="Kode inventaris" />
            <Btn icon="search" onClick={() => { proses(input); setInput(''); kamu.current?.focus() }}>Cocokkan</Btn>
            <Btn kind={kamera ? 'danger' : 'default'} onClick={() => setKamera((k) => !k)}>{kamera ? 'Matikan kamera' : 'Pindai dengan kamera'}</Btn>
          </div>
          {kamera && <Pemindai onKode={dariKamera} />}
          <div className="opn-ring"><b>{nDitemukan}</b> / {target.length} dicocokkan <div className="opn-bar"><i style={{ width: `${target.length ? (nDitemukan / target.length) * 100 : 0}%` }} /></div></div>
          {tanpaNomor > 0 && <p className="small">{tanpaNomor} barang di ruang ini belum bernomor, jadi tidak ikut dicek. Cetak labelnya dulu agar mendapat nomor.</p>}
          {asing.length > 0 && <p className="small bad-t">Kode tidak dikenal: {asing.join(', ')}</p>}
          <div className="table-wrap" style={{ maxHeight: 300, overflow: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>No. Inventaris</th><th>Nama</th><th>Ruang</th><th className="c">Hasil</th><th>Kondisi ditemukan</th><th>Catatan</th></tr></thead>
              <tbody>
                {target.map((b) => {
                  const h = hasil[b.noinv]
                  return (
                    <tr key={b.a.id} className={h ? 'opn-ok' : ''}>
                      <td className="mono nowrap">{b.noinv}</td><td>{b.nama}</td><td className="small">{b.ruang}</td>
                      <td className="c">{h ? <span className={`pill ${h.status === 'ada' ? 'ok' : 'warn'}`}>{KET[h.status]}</span> : <span className="pill bad">Belum</span>}
                        {!h && <button className="link small" onClick={() => ubah(b.noinv, { status: 'ada', kondisi: b.kondisi })}> tandai ada</button>}</td>
                      <td>{h ? <select value={h.kondisi} onChange={(e) => ubah(b.noinv, { kondisi: e.target.value })}>{KONDISI.map((k) => <option key={k}>{k}</option>)}</select> : <span className="muted">-</span>}</td>
                      <td>{h ? <input value={h.catatan ?? ''} onChange={(e) => ubah(b.noinv, { catatan: e.target.value })} placeholder="mis. pindah ke Kelas B" /> : null}</td>
                    </tr>
                  )
                })}
                {!target.length && <tr><td colSpan={6} className="muted">Belum ada barang bernomor{ruang ? ' di ruang ini' : ''}.</td></tr>}
              </tbody>
            </table>
          </div>
          <label className="chk"><input type="checkbox" checked={terapkan} onChange={(e) => setTerapkan(e.target.checked)} /> Perbarui kondisi di Buku Inventaris sesuai hasil temuan</label>
          <p className="muted small">Barang yang tidak dipindai dicatat “Tidak ditemukan” pada berita acara. Hasil opname tersimpan di Riwayat sehingga dapat dicetak ulang.</p>
        </>
      )}
    </Modal>
  )
}
