import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BIDANG, DOK_REGISTER, STATUS_DOKUMEN, barisRegister, dokId, dokumenJatuhTempo, nomorOtomatis, ringkasBidang, totalKolom,
  type Bidang, type FieldDef, type ItemDef, type RegisterDef,
} from '../administrasi'
import { LabelInventaris, OpnameInventaris, butirInventaris } from '../inventaris'
import { CetakDaftar, CetakItem, labelNilai } from '../cetakAdministrasi'
import { Icon } from '../icons'
import { put, remove, useCol } from '../store'
import { bolehBidang, getSesi } from '../security/sesi'
import type { Arsip, Lampiran, NilaiArsip } from '../types'
import { Btn, Card, Empty, Field, Modal, PageHead, printDoc, toast, useNav } from '../ui'
import { BULAN, fmtTanggal, readFileAsDataUrl, today, uid } from '../util'

export const rupiah = (v: NilaiArsip) => (v === undefined || v === '' ? '' : `Rp ${Number(v).toLocaleString('id-ID')}`)
const MAKS_LAMPIRAN = 2 * 1024 * 1024

/** Susun isian per baris 4 kolom: sisa kolom di ujung baris diberikan ke isian terakhir agar rata kanan. */
function rapatkan(items: { key: string; span: number; node: (span: number) => ReactNode }[]) {
  const spans = items.map((i) => Math.min(4, i.span))
  let used = 0
  for (let i = 0; i < items.length; i++) {
    if (used + spans[i] > 4) { spans[i - 1] += 4 - used; used = 0 }
    used += spans[i]
    if (used === 4) used = 0
  }
  if (used > 0) spans[items.length - 1] += 4 - used
  return items.map((it, i) => it.node(spans[i]))
}

type Lokasi = { bidang?: string; reg?: string }
/** Posisi terakhir di Administrasi, dipulihkan saat pengguna menekan "Kembali" dari modul terkait. */
let lokKembali: Lokasi | null = null

function BackBar({ onBack, ke, children }: { onBack: () => void; ke: string; children: ReactNode }) {
  useEffect(() => {
    // Alt+← atau tombol "back" mouse juga kembali ke menu sebelumnya
    const k = (e: KeyboardEvent) => { if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); onBack() } }
    const m = (e: MouseEvent) => { if (e.button === 3) { e.preventDefault(); onBack() } }
    window.addEventListener('keydown', k); window.addEventListener('mouseup', m)
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('mouseup', m) }
  }, [onBack])
  return (
    <div className="back-bar">
      <Btn icon="chevL" onClick={onBack} title={`Kembali ke ${ke} (Alt+←)`}>Kembali</Btn>
      <div className="crumb">{children}</div>
    </div>
  )
}

export default function Administrasi() {
  const [lok, setLokState] = useState<Lokasi>(() => { const l = lokKembali ?? {}; lokKembali = null; return l })
  const setLok = (l: Lokasi) => { setLokState(l); document.querySelector('.content')?.scrollTo(0, 0) }
  const bidang = BIDANG.filter((b) => bolehBidang(b.id))
  const b = bidang.find((x) => x.id === lok.bidang)
  const r = b?.items.find((i): i is Extract<ItemDef, { jenis: 'register' }> => i.jenis === 'register' && i.reg.id === lok.reg)?.reg
  if (b && r) return <RegisterView bidang={b} reg={r} onBack={() => setLok({ bidang: b.id })} />
  if (b) return <BidangView bidang={b} onBack={() => setLok({})} onReg={(id) => setLok({ bidang: b.id, reg: id })} />
  return <Beranda bidang={bidang} onOpen={(id) => setLok({ bidang: id })} />
}

// ---------- Beranda: 8 kartu bidang ----------
function Beranda({ bidang, onOpen }: { bidang: Bidang[]; onOpen: (id: string) => void }) {
  const arsip = useCol('arsip')
  const tempo = dokumenJatuhTempo(arsip)
  return (
    <div>
      <PageHead title="Administrasi Sekolah" sub="Delapan bidang administrasi: buku/register, dokumen wajib, dan modul terkait" />
      {tempo.length > 0 && (
        <div className="notice warn mb">
          <b>Dokumen perlu diperbarui:</b>{' '}
          {tempo.slice(0, 4).map((t, i) => <span key={i}>{i ? ' · ' : ''}{t.nama} ({t.lewat ? 'habis' : 'berakhir'} {fmtTanggal(t.berlaku)})</span>)}
          {tempo.length > 4 && ` dan ${tempo.length - 4} lainnya`}
        </div>
      )}
      {!bidang.length && <Empty>Jenis akun Anda belum diberi akses ke bidang administrasi mana pun.</Empty>}
      <div className="adm-list" role="list">
        <div className="adm-list-h" aria-hidden>
          <span>No</span><span>Bidang administrasi</span><span className="r">Buku</span><span className="r">Catatan</span><span className="r">Dokumen wajib</span><span />
        </div>
        {bidang.map((b) => {
          const s = ringkasBidang(b, arsip)
          const lengkap = s.dokumen > 0 && s.dokAda === s.dokumen
          return (
            <button key={b.id} role="listitem" className={`adm-row t-${b.tema}`} onClick={() => onOpen(b.id)}>
              <span className="adm-no2">{b.no}</span>
              <span className="adm-nama">
                <span className="adm-ikon2"><Icon name={b.ikon} size={20} /></span>
                <span><b>{b.nama}</b><small>{b.ket}</small></span>
              </span>
              <span className="r">{s.register}</span>
              <span className="r">{s.catatan}</span>
              <span className="r">{s.dokumen ? <em className={`pill ${lengkap ? 'ok' : s.dokAda ? 'warn' : ''}`}>{s.dokAda}/{s.dokumen}</em> : <span className="muted">-</span>}</span>
              <span className="adm-go"><Icon name="chevR" size={16} /></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Isi satu bidang ----------
function BidangView({ bidang, onBack, onReg }: { bidang: Bidang; onBack: () => void; onReg: (id: string) => void }) {
  const arsip = useCol('arsip')
  const nav = useNav()
  const halaman = bidang.items.filter((i): i is Extract<ItemDef, { jenis: 'halaman' }> => i.jenis === 'halaman')
  const regs = bidang.items.filter((i): i is Extract<ItemDef, { jenis: 'register' }> => i.jenis === 'register')
  const doks = bidang.items.filter((i): i is Extract<ItemDef, { jenis: 'dokumen' }> => i.jenis === 'dokumen')
  return (
    <div>
      <BackBar onBack={onBack} ke="Administrasi Sekolah"><button className="link" onClick={onBack}>Administrasi Sekolah</button> / <b>{bidang.nama}</b></BackBar>
      <div className={`adm-head t-${bidang.tema}`}>
        <span className="adm-ikon"><Icon name={bidang.ikon} size={28} /></span>
        <div><h2>{bidang.nama}</h2><p className="muted">{bidang.ket}</p></div>
        <span className="adm-no">{bidang.no}</span>
      </div>

      {halaman.length > 0 && (
        <>
          <h4 className="sec">Modul terkait</h4>
          <div className="adm-items">
            {halaman.map((h) => (
              <button key={h.page} className="adm-item link-item" onClick={() => nav.open(h.page, { label: bidang.nama, page: 'administrasi', onBack: () => { lokKembali = { bidang: bidang.id } } })}>
                <b>{h.nama} <Icon name="chevR" size={14} /></b><span>{h.ket}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {regs.length > 0 && (
        <>
          <h4 className="sec">Buku dan register</h4>
          <div className="adm-items">
            {regs.map(({ reg }) => {
              const jml = arsip.filter((a) => a.register === reg.id).length
              return (
                <button key={reg.id} className="adm-item" onClick={() => onReg(reg.id)}>
                  <b>{reg.nama}</b><span>{reg.ket}</span>
                  <small className={jml ? 'ok-t' : 'muted'}>{jml ? `${jml} catatan` : 'Belum ada catatan'}</small>
                </button>
              )
            })}
          </div>
        </>
      )}

      {doks.length > 0 && <DokumenWajib doks={doks} arsip={arsip} />}
    </div>
  )
}

function DokumenWajib({ doks, arsip }: { doks: Extract<ItemDef, { jenis: 'dokumen' }>[]; arsip: Arsip[] }) {
  const [edit, setEdit] = useState<{ item: Extract<ItemDef, { jenis: 'dokumen' }>; a: Arsip } | null>(null)
  const kini = today()
  return (
    <Card title={`Dokumen wajib (${doks.filter((d) => arsip.find((a) => a.id === dokId(d.id))?.data.status === 'Ada').length}/${doks.length} lengkap)`} className="mt">
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Dokumen</th><th>Status</th><th>Nomor</th><th>Tanggal</th><th>Berlaku s.d.</th><th>Berkas</th><th></th></tr></thead>
          <tbody>
            {doks.map((d) => {
              const a = arsip.find((x) => x.id === dokId(d.id))
              const st = String(a?.data.status ?? 'Belum ada')
              const bl = a?.data.berlaku ? String(a.data.berlaku) : ''
              return (
                <tr key={d.id}>
                  <td><b>{d.nama}</b><div className="muted small">{d.ket}</div></td>
                  <td><span className={`pill ${st === 'Ada' ? 'ok' : st === 'Perlu diperbarui' ? 'warn' : ''}`}>{st}</span></td>
                  <td>{a?.data.nomor ?? '-'}</td>
                  <td className="nowrap">{a?.data.tanggal ? fmtTanggal(String(a.data.tanggal)) : '-'}</td>
                  <td className={`nowrap ${bl && bl < kini ? 'bad-t' : ''}`}>{bl ? fmtTanggal(bl) : '-'}</td>
                  <td>{a?.lampiran?.length ? <LampiranLink l={a.lampiran[0]} /> : <span className="muted">-</span>}</td>
                  <td className="row-actions"><Btn icon="edit" kind="ghost" onClick={() => setEdit({ item: d, a: a ?? { id: dokId(d.id), register: DOK_REGISTER, data: { status: 'Belum ada' }, dibuat: new Date().toISOString() } })}>Perbarui</Btn></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {edit && (
        <FormArsip
          judul={edit.item.nama}
          fields={[
            { k: 'status', l: 'Status', t: 'select', opsi: STATUS_DOKUMEN, wajib: true },
            { k: 'nomor', l: 'Nomor dokumen' }, { k: 'tanggal', l: 'Tanggal terbit', t: 'date' },
            ...(edit.item.berlaku ? [{ k: 'berlaku', l: 'Berlaku sampai', t: 'date' } as FieldDef] : []),
            { k: 'ket', l: 'Keterangan', span: 4 },
          ]}
          awal={edit.a} lampiran onClose={() => setEdit(null)}
          onSimpan={async (a) => { await put('arsip', a); toast('Status dokumen disimpan') }}
        />
      )}
    </Card>
  )
}

// ---------- Satu buku/register ----------
function RegisterView({ bidang, reg, onBack }: { bidang: Bidang; reg: RegisterDef; onBack: () => void }) {
  const arsip = useCol('arsip')
  const [q, setQ] = useState('')
  const [tahun, setTahun] = useState('')
  const [bulan, setBulan] = useState('')
  const [kel, setKel] = useState('')
  const [edit, setEdit] = useState<Arsip | null>(null)
  const [hapus, setHapus] = useState('')
  const [alat, setAlat] = useState<'' | 'label' | 'opname'>('')
  const butirInv = useMemo(() => (reg.id === 'inventaris' ? butirInventaris(arsip) : []), [reg.id, arsip])
  useEffect(() => { if (!hapus) return; const t = setTimeout(() => setHapus(''), 4000); return () => clearTimeout(t) }, [hapus])

  const semua = useMemo(() => barisRegister(reg, arsip), [reg, arsip])
  const tg = reg.tanggal
  const tahunList = tg ? [...new Set(semua.map((r) => String(r.d[tg] ?? '').slice(0, 4)).filter(Boolean))].sort().reverse() : []
  const kelompokKas = reg.kas?.kelompok
  const fieldKel = kelompokKas ? reg.fields.find((f) => f.k === kelompokKas) : undefined

  // Saldo dihitung ulang untuk subset kelompok (mis. per sumber dana), lalu difilter periode.
  const baris = useMemo(() => {
    let rows = semua
    if (kel && kelompokKas) {
      let saldo = 0
      rows = rows.filter((r) => r.d[kelompokKas] === kel).map((r) => { saldo += Number(r.d[reg.kas!.masuk] ?? 0) - Number(r.d[reg.kas!.keluar] ?? 0); return { ...r, saldo } })
    }
    const awal = (() => {
      if (!reg.kas || !tg || !tahun) return 0
      const batas = `${tahun}-${bulan ? String(Number(bulan) + 1).padStart(2, '0') : '01'}-01`
      const sebelum = rows.filter((r) => String(r.d[tg] ?? '') < batas)
      return sebelum.length ? sebelum[sebelum.length - 1].saldo : 0
    })()
    const filtered = rows.filter((r) => {
      const t = tg ? String(r.d[tg] ?? '') : ''
      if (tahun && !t.startsWith(tahun)) return false
      if (bulan && tahun && t.slice(5, 7) !== String(Number(bulan) + 1).padStart(2, '0')) return false
      if (q) {
        const s = q.toLowerCase()
        return reg.fields.some((f) => labelNilai(f, r.d[f.k]).toLowerCase().includes(s))
      }
      return true
    })
    return { rows: filtered, saldoAwal: awal }
  }, [semua, kel, kelompokKas, tahun, bulan, q, reg, tg])

  const kolom = reg.fields.filter((f) => f.daftar)
  const periode = tahun ? `${bulan ? `${BULAN[Number(bulan)]} ` : ''}${tahun}` : ''
  const cetakDaftar = () => printDoc(<CetakDaftar reg={reg} rows={baris.rows} saldoAwal={baris.saldoAwal} periode={periode} kelompok={kel} />)
  const baru = (): Arsip => ({ id: uid(), register: reg.id, data: tg ? { [tg]: today() } : {}, dibuat: new Date().toISOString() })

  return (
    <div>
      <BackBar onBack={onBack} ke={bidang.nama}><button className="link" onClick={onBack}>{bidang.nama}</button> / <b>{reg.nama}</b></BackBar>
      <PageHead title={reg.nama} sub={reg.ket}>
        {reg.id === 'inventaris' && <><Btn icon="asesmen" onClick={() => setAlat('opname')}>Stok opname</Btn><Btn icon="print" onClick={() => setAlat('label')}>Label QR / barcode</Btn></>}
        <Btn icon="print" onClick={cetakDaftar} disabled={!baris.rows.length}>Cetak{reg.kelompokCetak ? ' KIR' : ''}</Btn>
        <Btn icon="plus" kind="primary" onClick={() => setEdit(baru())}>Tambah</Btn>
      </PageHead>
      <div className="filters bar">
        <input placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari" />
        {tg && (
          <>
            <select value={tahun} onChange={(e) => { setTahun(e.target.value); if (!e.target.value) setBulan('') }} aria-label="Tahun"><option value="">Semua tahun</option>{tahunList.map((t) => <option key={t}>{t}</option>)}</select>
            {tahun && <select value={bulan} onChange={(e) => setBulan(e.target.value)} aria-label="Bulan"><option value="">Semua bulan</option>{BULAN.map((b, i) => <option key={b} value={i}>{b}</option>)}</select>}
          </>
        )}
        {fieldKel && <select value={kel} onChange={(e) => setKel(e.target.value)} aria-label={fieldKel.l}><option value="">Semua {fieldKel.l.toLowerCase()}</option>{fieldKel.opsi?.map((o) => <option key={o}>{o}</option>)}</select>}
      </div>
      <Card title={`${baris.rows.length} catatan${periode ? ` · ${periode}` : ''}`}>
        {!baris.rows.length ? <Empty>Belum ada catatan. Klik <b>Tambah</b> untuk mengisi {reg.nama.toLowerCase()}.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="num">No</th>
                  {kolom.map((f) => <th key={f.k} className={f.t === 'rupiah' || f.t === 'number' ? 'r' : ''}>{f.l}</th>)}
                  {reg.kolomHitung?.map((k) => <th key={k.k} className={k.rupiah ? 'r' : ''}>{k.l}</th>)}
                  {reg.kas && <th className="r">Saldo</th>}
                  {reg.lampiran && <th>Berkas</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reg.kas && tahun && <tr className="muted"><td /><td colSpan={kolom.length + (reg.kolomHitung?.length ?? 0)}>Saldo awal periode</td><td className="r">{rupiah(baris.saldoAwal)}</td>{reg.lampiran && <td />}<td /></tr>}
                {baris.rows.map((r, i) => (
                  <tr key={r.a.id}>
                    <td className="num">{i + 1}</td>
                    {kolom.map((f) => <td key={f.k} className={f.t === 'rupiah' || f.t === 'number' ? 'r nowrap' : f.t === 'textarea' ? 'small desc' : (f.span ?? 1) >= 2 ? 'wide' : 'nowrap'}>{f.t === 'textarea' ? potong(labelNilai(f, r.d[f.k])) : labelNilai(f, r.d[f.k])}</td>)}
                    {reg.kolomHitung?.map((k) => <td key={k.k} className={k.rupiah ? 'r nowrap' : ''}>{k.rupiah ? rupiah(r.d[k.k]) : <Predikat v={r.d[k.k]} />}</td>)}
                    {reg.kas && <td className="r nowrap strong">{rupiah(r.saldo)}</td>}
                    {reg.lampiran && <td>{r.a.lampiran?.length ? <LampiranLink l={r.a.lampiran[0]} n={r.a.lampiran.length} /> : ''}</td>}
                    <td className="row-actions nowrap">
                      {reg.cetak && <Btn icon="print" kind="ghost" title="Cetak" onClick={() => printDoc(<CetakItem reg={reg} a={r.a} d={r.d} />)} />}
                      <Btn icon="edit" kind="ghost" title="Ubah" onClick={() => setEdit(r.a)} />
                      <Btn icon="trash" kind={hapus === r.a.id ? 'danger' : 'ghost'} title="Hapus" onClick={async () => {
                        if (hapus !== r.a.id) { setHapus(r.a.id); toast('Klik ikon hapus sekali lagi untuk menghapus'); return }
                        await remove('arsip', r.a.id); setHapus(''); toast('Catatan dihapus')
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
              {(reg.total?.length || reg.kas) && (
                <tfoot>
                  <tr>
                    <td />
                    {kolom.map((f, i) => <td key={f.k} className="r nowrap strong">{i === 0 ? 'Jumlah' : reg.total?.includes(f.k) || (reg.kas && (f.k === reg.kas.masuk || f.k === reg.kas.keluar)) ? (f.t === 'rupiah' ? rupiah(totalKolom(baris.rows, f.k)) : totalKolom(baris.rows, f.k).toLocaleString('id-ID')) : ''}</td>)}
                    {reg.kolomHitung?.map((k) => <td key={k.k} className="r nowrap strong">{reg.total?.includes(k.k) ? (k.rupiah ? rupiah(totalKolom(baris.rows, k.k)) : totalKolom(baris.rows, k.k)) : ''}</td>)}
                    {reg.kas && <td className="r nowrap strong">{rupiah(baris.rows.length ? baris.rows[baris.rows.length - 1].saldo : baris.saldoAwal)}</td>}
                    {reg.lampiran && <td />}<td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>
      {alat === 'label' && <LabelInventaris butir={butirInv} onClose={() => setAlat('')} />}
      {alat === 'opname' && <OpnameInventaris butir={butirInv} onClose={() => setAlat('')} />}
      {edit && (
        <FormArsip
          judul={reg.nama} fields={reg.fields} awal={edit} lampiran={reg.lampiran} reg={reg} onClose={() => setEdit(null)}
          onSimpan={async (a) => {
            const data = nomorOtomatis(reg, arsip.filter((x) => x.id !== a.id), a.data)
            await put('arsip', { ...a, data })
            await reg.onSimpan?.(data)
            toast('Catatan disimpan')
          }}
        />
      )}
    </div>
  )
}

const potong = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s)

function Predikat({ v }: { v: NilaiArsip }) {
  if (v === undefined || v === '') return <span className="muted">-</span>
  const s = String(v)
  const cls = /amat baik|dikembalikan/i.test(s) ? 'ok' : /^baik$/i.test(s) ? 'info' : /terlambat|kurang/i.test(s) ? 'bad' : /cukup|dipinjam/i.test(s) ? 'warn' : ''
  return cls ? <span className={`pill ${cls}`}>{s}</span> : <>{s}</>
}

export function LampiranLink({ l, n }: { l: Lampiran; n?: number }) {
  return <a href={l.data} download={l.nama} className="link small" title={`${l.nama} · ${(l.ukuran / 1024).toFixed(0)} KB`}>📎 {potong(l.nama, 22)}{n && n > 1 ? ` +${n - 1}` : ''}</a>
}

// ---------- Formulir generik ----------
function FormArsip({ judul, fields, awal, lampiran, reg, onClose, onSimpan }: {
  judul: string; fields: FieldDef[]; awal: Arsip; lampiran?: boolean; reg?: RegisterDef; onClose: () => void; onSimpan: (a: Arsip) => Promise<void>
}) {
  const [a, setA] = useState<Arsip>(awal)
  const [err, setErr] = useState('')
  const set = (k: string, v: NilaiArsip) => setA((o) => ({ ...o, data: { ...o.data, [k]: v } }))
  const hitung = reg?.hitung?.(a.data) ?? {}
  const simpan = async () => {
    const kurang = fields.filter((f) => f.wajib && (a.data[f.k] === undefined || a.data[f.k] === '')).map((f) => f.l)
    if (kurang.length) return setErr(`Wajib diisi: ${kurang.join(', ')}`)
    const sesi = getSesi()
    await onSimpan({ ...a, diubah: new Date().toISOString(), oleh: sesi?.akun.username })
    onClose()
  }
  const unggah = async (f?: File) => {
    if (!f) return
    if (f.size > MAKS_LAMPIRAN) return setErr('Ukuran berkas maksimal 2 MB.')
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(f.type)) return setErr('Berkas harus PDF, JPG, PNG, atau WEBP.')
    setErr('')
    const l: Lampiran = { nama: f.name, ukuran: f.size, tipe: f.type, data: await readFileAsDataUrl(f) }
    setA((o) => ({ ...o, lampiran: [...(o.lampiran ?? []), l] }))
  }
  return (
    <Modal title={judul} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={simpan}>Simpan</Btn></>}>
      <div className="form-grid four">
        {rapatkan([
          ...fields.map((f) => ({ key: f.k, span: f.span ?? (f.t === 'textarea' ? 4 : 1), node: (span: number) => (
            <Field key={f.k} label={`${f.l}${f.wajib ? ' *' : ''}`} span={span as 1 | 2 | 3 | 4}>
              <Masukan f={f} v={a.data[f.k]} on={(v) => set(f.k, v)} otomatis={reg?.nomor?.k === f.k} />
            </Field>
          ) })),
          ...(reg?.kolomHitung ?? []).map((k) => ({ key: k.k, span: 1, node: (span: number) => (
            <Field key={k.k} label={`${k.l} (otomatis)`} span={span as 1 | 2 | 3 | 4}><input readOnly value={k.rupiah ? rupiah(hitung[k.k]) : String(hitung[k.k] ?? '')} /></Field>
          ) })),
        ])}
      </div>
      {lampiran && (
        <>
          <h4 className="sec">Lampiran (PDF/JPG/PNG, maks. 2 MB)</h4>
          <ul className="lampiran">
            {(a.lampiran ?? []).map((l, i) => (
              <li key={i}><LampiranLink l={l} /> <span className="muted small">{(l.ukuran / 1024).toFixed(0)} KB</span>
                <Btn icon="trash" kind="ghost" title="Hapus lampiran" onClick={() => setA((o) => ({ ...o, lampiran: o.lampiran?.filter((_, j) => j !== i) }))} /></li>
            ))}
          </ul>
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => { unggah(e.target.files?.[0]); e.target.value = '' }} aria-label="Unggah lampiran" />
        </>
      )}
      {err && <div className="errs">{err}</div>}
    </Modal>
  )
}

function Masukan({ f, v, on, otomatis }: { f: FieldDef; v: NilaiArsip; on: (v: NilaiArsip) => void; otomatis?: boolean }): ReactNode {
  const siswa = useCol('siswa')
  const pegawai = useCol('pegawai')
  const rombel = useCol('rombel')
  const mapel = useCol('mapel')
  const ruang = useCol('ruang')
  const s = v === undefined ? '' : String(v)
  const num = (x: string) => on(x === '' ? undefined : Number(x))
  switch (f.t) {
    case 'textarea': return <textarea rows={3} value={s} onChange={(e) => on(e.target.value)} placeholder={f.ph} />
    case 'date': return <input type="date" value={s} onChange={(e) => on(e.target.value || undefined)} />
    case 'time': return <input type="time" value={s} onChange={(e) => on(e.target.value || undefined)} />
    case 'number': return <input type="number" value={s} onChange={(e) => num(e.target.value)} />
    case 'rupiah': return <input type="number" min={0} step={500} value={s} onChange={(e) => num(e.target.value)} placeholder="Rp" />
    case 'select': return <select value={s} onChange={(e) => on(e.target.value || undefined)}><option value="">-</option>{f.opsi?.map((o) => <option key={o}>{o}</option>)}</select>
    case 'siswa': return (
      <select value={s} onChange={(e) => on(e.target.value || undefined)}>
        <option value="">- pilih -</option>
        {[...siswa].sort((a, b) => a.nama.localeCompare(b.nama)).map((x) => <option key={x.id} value={x.id}>{x.nama} · {x.noInduk} · {x.jenjang}{x.status !== 'Aktif' ? ` (${x.status})` : ''}</option>)}
      </select>
    )
    case 'pegawai': return <select value={s} onChange={(e) => on(e.target.value || undefined)}><option value="">- pilih -</option>{pegawai.filter((p) => p.aktif || p.id === s).map((p) => <option key={p.id} value={p.id}>{p.nama}{p.jabatan ? ` · ${p.jabatan}` : ''}</option>)}</select>
    case 'rombel': return <select value={s} onChange={(e) => on(e.target.value || undefined)}><option value="">-</option>{rombel.map((r) => <option key={r.id} value={r.id}>{r.nama} · {r.tahunAjaran}</option>)}</select>
    case 'mapel': return <select value={s} onChange={(e) => on(e.target.value || undefined)}><option value="">-</option>{mapel.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select>
    case 'ruang': return (
      <>
        <input list="ruang-list" value={s} onChange={(e) => on(e.target.value)} placeholder="Pilih atau ketik nama ruang" />
        <datalist id="ruang-list">{ruang.filter((r) => !r.dihapus).map((r) => <option key={r.id} value={r.nama} />)}</datalist>
      </>
    )
    default: return <input value={s} onChange={(e) => on(e.target.value)} placeholder={otomatis ? 'Otomatis bila dikosongkan' : f.ph} />
  }
}
