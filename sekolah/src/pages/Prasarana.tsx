import { useState } from 'react'
import { Meter } from '../charts'
import { KopSurat, TandaTangan } from '../print'
import {
  ALASAN_PENGHAPUSAN, BATAS_DOKUMEN, DAFTAR_PERIKSA, JENIS_BANGUNAN, JENIS_DOKUMEN, JENIS_PENGAJUAN, JENIS_RUANG, KET_STATUS,
  STATUS_KEPEMILIKAN_BANGUNAN, STATUS_KEPEMILIKAN_TANAH, STATUS_PENGAJUAN, dokumenWajib, klasifikasiKerusakan, pengajuanAktif,
  pillKerusakan, validasiBangunan, validasiPengajuan, validasiRuang, validasiTanah,
} from '../prasarana'
import { getSekolah, getState, put, remove, useCol, useSekolah } from '../store'
import type { Bangunan, DokumenPengajuan, JenisDokumen, JenisPengajuan, ObjekPrasarana, PengajuanPrasarana, Ruang, StatusPengajuan, Tanah } from '../types'
import { Btn, Card, Empty, Field, Inp, Modal, PageHead, Sel, Tabs, printDoc, toast, tanya } from '../ui'
import { fmtTanggal, namaPegawai, readFileAsDataUrl, today, uid } from '../util'

type Tab = 'ringkasan' | 'tanah' | 'bangunan' | 'ruang' | 'pengajuan'

const rp = (n?: number) => (n === undefined ? '-' : `Rp ${n.toLocaleString('id-ID')}`)
const m2 = (n?: number) => (n === undefined ? '-' : `${n.toLocaleString('id-ID')} m²`)

export default function Prasarana() {
  const [tab, setTab] = useState<Tab>('ringkasan')
  const [ajuan, setAjuan] = useState<PengajuanPrasarana | null>(null)
  const pengajuan = useCol('pengajuan')

  /** Buat pengajuan baru; ditolak bila masih ada pengajuan aktif (Diajukan / Proses Verifikasi). */
  const ajukan = (objek: ObjekPrasarana, jenis: JenisPengajuan, objekId = '', namaObjek = '') => {
    const aktif = pengajuanAktif(pengajuan)
    if (aktif) return toast(`Belum bisa membuat pengajuan baru: "${aktif.nama}" masih ${aktif.status}.`)
    setAjuan({
      id: uid(), objek, jenis, objekId, nama: namaObjek ? `${jenis} Data ${namaObjek.toLowerCase().startsWith(objek.toLowerCase()) ? '' : `${objek} `}${namaObjek}` : '', alasan: '', dokumen: [],
      periksa: DAFTAR_PERIKSA.map(() => false), status: 'Draf', dibuat: today(),
    })
    setTab('pengajuan')
  }

  return (
    <div>
      <PageHead title="Prasarana (Sarpras)" sub="Data tanah, bangunan, dan ruang serta pengajuan perubahannya ke Dapodik (Panduan Dapodik versi 2027)" />
      <Tabs tabs={[['ringkasan', 'Ringkasan & Panduan'], ['tanah', 'Tanah'], ['bangunan', 'Bangunan'], ['ruang', 'Ruang'], ['pengajuan', 'Pengajuan Dapodik']]} value={tab} onChange={setTab} />
      {tab === 'ringkasan' && <Ringkasan onTab={setTab} />}
      {tab === 'tanah' && <TanahTab ajukan={ajukan} />}
      {tab === 'bangunan' && <BangunanTab ajukan={ajukan} />}
      {tab === 'ruang' && <RuangTab ajukan={ajukan} />}
      {tab === 'pengajuan' && <PengajuanTab ajukan={ajukan} onEdit={setAjuan} />}
      {ajuan && <PengajuanForm initial={ajuan} onClose={() => setAjuan(null)} />}
    </div>
  )
}

type Ajukan = (o: ObjekPrasarana, j: JenisPengajuan, id?: string, nama?: string) => void

function AksiAjukan({ objek, id, nama, ajukan, dihapus }: { objek: ObjekPrasarana; id: string; nama: string; ajukan: Ajukan; dihapus?: boolean }) {
  if (dihapus) return null
  return (
    <select className="mini-sel" value="" onChange={(e) => e.target.value && ajukan(objek, e.target.value as JenisPengajuan, id, nama)} aria-label={`Ajukan ke Dapodik: ${nama}`}>
      <option value="">Ajukan ke Dapodik…</option>
      <option value="Penambahan">Penambahan (data baru)</option>
      <option value="Perbaikan">Perbaikan data</option>
      <option value="Penghapusan">Penghapusan</option>
    </select>
  )
}

function Hapus({ d }: { d?: { tanggal: string; alasan: string } }) {
  return d ? <span className="pill bad" title={`Dihapus ${fmtTanggal(d.tanggal)}`}>Dihapus · {d.alasan}</span> : null
}

// ---------------- Ringkasan & panduan ----------------
function Ringkasan({ onTab }: { onTab: (t: Tab) => void }) {
  const tanah = useCol('tanah').filter((x) => !x.dihapus)
  const bangunan = useCol('bangunan').filter((x) => !x.dihapus)
  const ruang = useCol('ruang').filter((x) => !x.dihapus)
  const pengajuan = useCol('pengajuan')
  const aktif = pengajuanAktif(pengajuan)
  const kondisi = ['Tidak ada kerusakan', 'Rusak Ringan', 'Rusak Sedang', 'Rusak Berat', 'Rusak Total', '-']
  const hit = (list: { bobotKerusakan?: number }[]) => kondisi.map((k) => [k, list.filter((x) => klasifikasiKerusakan(x.bobotKerusakan) === k).length] as const)
  const perluTarik = pengajuan.filter((p) => p.status === 'Disetujui' && !p.tarikData)
  return (
    <>
      <div className="grid-3">
        <Card title="Ringkasan Prasarana">
          <div className="kpis">
            <button className="kpi" onClick={() => onTab('tanah')}><span>Tanah</span><b>{tanah.length}</b><span>{m2(tanah.reduce((a, t) => a + (t.luas ?? 0), 0))}</span></button>
            <button className="kpi" onClick={() => onTab('bangunan')}><span>Bangunan</span><b>{bangunan.length}</b><span>{m2(bangunan.reduce((a, t) => a + (t.luasTapak ?? 0), 0))} tapak</span></button>
            <button className="kpi" onClick={() => onTab('ruang')}><span>Ruang</span><b>{ruang.length}</b><span>{ruang.filter((r) => r.jenisPrasarana === 'Ruang Teori/Kelas').length} ruang kelas</span></button>
            <button className="kpi" onClick={() => onTab('pengajuan')}><span>Pengajuan aktif</span><b>{aktif ? 1 : 0}</b><span>{aktif ? aktif.status : 'tidak ada'}</span></button>
          </div>
          {perluTarik.length > 0 && <p className="small"><span className="pill warn">Perlu Tarik Data</span> {perluTarik.length} pengajuan disetujui belum ditarik ke Aplikasi Dapodik.</p>}
        </Card>
        {([['Kondisi Bangunan', bangunan], ['Kondisi Ruang', ruang]] as const).map(([judul, list]) => (
          <Card key={judul} title={judul}>
            <ul className="progress-list">
              {hit(list).filter(([, n]) => n > 0).map(([k, n]) => (
                <li key={k}><div><b>{k === '-' ? 'Belum dinilai' : k}</b><em className={`pill ${pillKerusakan(k)}`}>{n}</em></div><Meter pct={(n / Math.max(1, list.length)) * 100} color={pillKerusakan(k) === 'ok' ? 'var(--ok)' : pillKerusakan(k) === 'warn' ? 'var(--warn)' : pillKerusakan(k) === 'bad' ? 'var(--bad)' : 'var(--muted)'} /></li>
              ))}
              {!list.length && <li className="muted">Belum ada data.</li>}
            </ul>
          </Card>
        ))}
      </div>
      <Card title="Panduan Singkat Pengajuan Data Prasarana (Dapodik versi 2027)">
        <div className="guide">
          <ol>
            <li><b>Persiapan.</b> Periksa data prasarana di Aplikasi Dapodik, pastikan objek (tanah, bangunan, atau ruang) dan jenis pengajuan (penambahan, perbaikan, atau penghapusan), siapkan alasan dan dokumen pendukung.</li>
            <li><b>Isi data di SIMAS.</b> Catat atau perbaiki data di tab Tanah, Bangunan, atau Ruang. SIMAS memeriksa ketentuan pengisian, misalnya luas lahan tersedia tidak melebihi luas tanah, luas tapak tidak melebihi luas tanah, kode pos 5 digit, dan kode ruang tidak ganda.</li>
            <li><b>Buat pengajuan.</b> Pilih <i>Ajukan ke Dapodik</i> pada baris data. SIMAS menampilkan dokumen wajib sesuai matriks panduan, dan dokumen harus PDF maksimal 2 MB.</li>
            <li><b>Daftar periksa.</b> Centang 7 butir pemeriksaan mandiri dan cetak lembar pengajuan untuk diperiksa kepala sekolah.</li>
            <li><b>Kirim di Manajemen Satuan Pendidikan.</b> Masukkan data dan dokumen di <span className="nowrap">sp.datadik.kemendikdasmen.go.id</span> (menu Sarpras &gt; Pengajuan), lalu tandai pengajuan di SIMAS sebagai <i>Diajukan</i>.</li>
            <li><b>Pantau verifikasi.</b> Dinas Pendidikan lalu BBPMP/BPMP memverifikasi. Selama status <i>Diajukan</i> atau <i>Proses Verifikasi</i>, pengajuan baru tidak dapat dibuat.</li>
            <li><b>Tarik Data.</b> Setelah <i>Disetujui</i>, lakukan Tarik Data di Aplikasi Dapodik, periksa hasilnya, lalu centang <i>Tarik Data selesai</i>. Jika <i>Ditolak</i>, baca catatan penolakan dan buat pengajuan baru.</li>
          </ol>
          <table className="mini">
            <thead><tr><th>Dokumen wajib</th><th>Penambahan</th><th>Perbaikan</th><th>Penghapusan</th></tr></thead>
            <tbody>
              {(['Tanah', 'Bangunan', 'Ruang'] as ObjekPrasarana[]).map((o) => (
                <tr key={o}><td><b>{o}</b></td>{JENIS_PENGAJUAN.map((j) => <td key={j} className="small">{dokumenWajib(o, j).join(', ')}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Surat BPKAD untuk sekolah negeri, surat yayasan untuk sekolah swasta. Klasifikasi kerusakan dihitung otomatis dari bobot kerusakan: 0 tidak ada kerusakan, ≤30% rusak ringan, ≤45% rusak sedang, ≤65% rusak berat, &gt;65% rusak total.</p>
        </div>
      </Card>
    </>
  )
}

function Errs({ e }: { e: string[] }) {
  return e.length ? <ul className="errs">{e.map((x) => <li key={x}>{x}</li>)}</ul> : null
}

// ---------------- Tanah ----------------
function TanahTab({ ajukan }: { ajukan: Ajukan }) {
  const tanah = useCol('tanah')
  const [edit, setEdit] = useState<Tanah | null>(null)
  const [semua, setSemua] = useState(false)
  const list = tanah.filter((t) => semua || !t.dihapus)
  return (
    <Card title={`${list.length} data tanah`} actions={<>
      <label className="small"><input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan yang dihapus</label>
      <Btn icon="plus" kind="primary" onClick={() => setEdit({ id: uid(), nama: '', samaDenganSekolah: true })}>Tambah Tanah</Btn>
    </>}>
      {!list.length ? <Empty>Belum ada data tanah.</Empty> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Nama</th><th>No Sertifikat</th><th className="num">Luas</th><th className="num">Tersedia</th><th>Kepemilikan</th><th className="num">Nilai Perolehan</th><th>Lokasi</th><th></th></tr></thead>
          <tbody>{list.map((t) => (
            <tr key={t.id} className={t.dihapus ? 'gone' : ''} onDoubleClick={() => setEdit(t)}>
              <td><b>{t.nama}</b> <Hapus d={t.dihapus} /></td><td>{t.noSertifikat}</td><td className="num">{m2(t.luas)}</td><td className="num">{m2(t.luasTersedia)}</td>
              <td>{t.statusKepemilikan}</td><td className="num">{rp(t.nilaiPerolehan)}</td>
              <td className="small">{t.samaDenganSekolah ? 'Sama dengan lokasi sekolah' : [t.alamatJalan, t.desa, t.kecamatan].filter(Boolean).join(', ')}</td>
              <td className="row-actions"><AksiAjukan objek="Tanah" id={t.id} nama={t.nama} ajukan={ajukan} dihapus={!!t.dihapus} /><Btn icon="edit" kind="ghost" title="Ubah" onClick={() => setEdit(t)} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {edit && <TanahForm initial={edit} onClose={() => setEdit(null)} />}
    </Card>
  )
}

function TanahForm({ initial, onClose }: { initial: Tanah; onClose: () => void }) {
  const s = useSekolah()
  const [t, setT] = useState(initial)
  const [cek, setCek] = useState(false)
  const set = (p: Partial<Tanah>) => setT((o) => ({ ...o, ...p }))
  const err = validasiTanah(t)
  const lok = t.samaDenganSekolah ? { ...t, provinsi: s.provinsi, kabupaten: s.kabupaten, kecamatan: s.kecamatan, desa: s.kelurahan, kodePos: t.kodePos || s.kodePos } : t
  const simpan = async () => {
    setCek(true)
    if (err.length && !await tanya(`Masih ada ${err.length} isian belum sesuai ketentuan. Simpan sebagai catatan sementara?`)) return
    await put('tanah', lok)
    toast('Data tanah disimpan')
    onClose()
  }
  return (
    <Modal title={initial.nama ? `Tanah: ${initial.nama}` : 'Tanah Baru'} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={simpan}>Simpan Tanah</Btn></>}>
      <div className="form-grid">
        <Field label="Nama tanah *" span={2} hint="mis. Tanah Utama SD Negeri Contoh 01"><Inp obj={t} k="nama" set={set} autoFocus /></Field>
        <Field label="No sertifikat tanah *" span={2}><Inp obj={t} k="noSertifikat" set={set} placeholder="12.34.56.07.1.00001" /></Field>
        <Field label="Panjang (m) *"><Inp obj={t} k="panjang" set={set} type="number" min={0} /></Field>
        <Field label="Lebar (m) *"><Inp obj={t} k="lebar" set={set} type="number" min={0} /></Field>
        <Field label="Luas (m²) *" hint="sesuai sertifikat"><Inp obj={t} k="luas" set={set} type="number" min={0} /></Field>
        <Field label="Luas lahan tersedia (m²) *" hint="belum dipakai bangunan"><Inp obj={t} k="luasTersedia" set={set} type="number" min={0} /></Field>
        <Field label="Nilai perolehan aset (Rp)"><Inp obj={t} k="nilaiPerolehan" set={set} type="number" min={0} /></Field>
        <Field label="Status kepemilikan *"><Sel obj={t} k="statusKepemilikan" set={set} options={STATUS_KEPEMILIKAN_TANAH} empty="-" /></Field>
        <Field label="Keterangan" span={2}><Inp obj={t} k="keterangan" set={set} /></Field>
      </div>
      <h4 className="sec">Lokasi tanah</h4>
      <label className="chip on" style={{ marginBottom: 8 }}><input type="checkbox" checked={t.samaDenganSekolah} onChange={(e) => set({ samaDenganSekolah: e.target.checked })} />Sama dengan lokasi sekolah</label>
      <div className="form-grid">
        <Field label="Provinsi"><input value={lok.provinsi ?? ''} disabled={t.samaDenganSekolah} onChange={(e) => set({ provinsi: e.target.value })} /></Field>
        <Field label="Kabupaten/Kota"><input value={lok.kabupaten ?? ''} disabled={t.samaDenganSekolah} onChange={(e) => set({ kabupaten: e.target.value })} /></Field>
        <Field label="Kecamatan"><input value={lok.kecamatan ?? ''} disabled={t.samaDenganSekolah} onChange={(e) => set({ kecamatan: e.target.value })} /></Field>
        <Field label="Desa/Kelurahan"><input value={lok.desa ?? ''} disabled={t.samaDenganSekolah} onChange={(e) => set({ desa: e.target.value })} /></Field>
        <Field label="Alamat jalan" span={2}><Inp obj={t} k="alamatJalan" set={set} /></Field>
        <Field label="RT"><Inp obj={t} k="rt" set={set} inputMode="numeric" /></Field>
        <Field label="RW"><Inp obj={t} k="rw" set={set} inputMode="numeric" /></Field>
        <Field label="Nama dusun"><Inp obj={t} k="dusun" set={set} /></Field>
        <Field label="Kode pos"><Inp obj={t} k="kodePos" set={set} inputMode="numeric" maxLength={5} /></Field>
        <Field label="Lintang" hint="desimal, mis. -7.0737"><Inp obj={t} k="lintang" set={set} type="number" step="any" /></Field>
        <Field label="Bujur" hint="desimal, mis. 110.4141"><Inp obj={t} k="bujur" set={set} type="number" step="any" /></Field>
      </div>
      {t.lintang !== undefined && t.bujur !== undefined && <p className="small"><a href={`https://www.google.com/maps?q=${t.lintang},${t.bujur}`} target="_blank" rel="noreferrer">Periksa titik koordinat di peta</a></p>}
      {(cek || initial.nama) && <Errs e={err} />}
    </Modal>
  )
}

// ---------------- Bangunan ----------------
function BangunanTab({ ajukan }: { ajukan: Ajukan }) {
  const bangunan = useCol('bangunan')
  const tanah = useCol('tanah')
  const ruang = useCol('ruang')
  const [edit, setEdit] = useState<Bangunan | null>(null)
  const [semua, setSemua] = useState(false)
  const list = bangunan.filter((b) => semua || !b.dihapus)
  return (
    <Card title={`${list.length} bangunan / prasarana`} actions={<>
      <label className="small"><input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan yang dihapus</label>
      <Btn icon="plus" kind="primary" onClick={() => setEdit({ id: uid(), nama: '', jenisPrasarana: 'Bangunan', tanahId: tanah.find((t) => !t.dihapus)?.id })}>Tambah Bangunan</Btn>
    </>}>
      {!list.length ? <Empty>Belum ada data bangunan. Tambahkan data tanah terlebih dahulu.</Empty> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Nama</th><th>Jenis</th><th>Tanah</th><th className="num">Luas Tapak</th><th className="c">Lantai</th><th className="c">Tahun</th><th className="c">Ruang</th><th>Kondisi</th><th></th></tr></thead>
          <tbody>{list.map((b) => {
            const k = klasifikasiKerusakan(b.bobotKerusakan)
            return (
              <tr key={b.id} className={b.dihapus ? 'gone' : ''} onDoubleClick={() => setEdit(b)}>
                <td><b>{b.nama}</b> <Hapus d={b.dihapus} /></td><td>{b.jenisPrasarana}</td><td>{tanah.find((t) => t.id === b.tanahId)?.nama ?? '-'}</td>
                <td className="num">{m2(b.luasTapak)}</td><td className="c">{b.jumlahLantai ?? '-'}</td><td className="c">{b.tahunPembangunan ?? '-'}</td>
                <td className="c">{ruang.filter((r) => r.bangunanId === b.id && !r.dihapus).length}</td>
                <td><span className={`pill ${pillKerusakan(k)}`}>{k}{b.bobotKerusakan ? ` (${b.bobotKerusakan}%)` : ''}</span></td>
                <td className="row-actions"><AksiAjukan objek="Bangunan" id={b.id} nama={b.nama} ajukan={ajukan} dihapus={!!b.dihapus} /><Btn icon="edit" kind="ghost" title="Ubah" onClick={() => setEdit(b)} /></td>
              </tr>
            )
          })}</tbody>
        </table></div>
      )}
      {edit && <BangunanForm initial={edit} onClose={() => setEdit(null)} />}
    </Card>
  )
}

function BangunanForm({ initial, onClose }: { initial: Bangunan; onClose: () => void }) {
  const tanah = useCol('tanah').filter((t) => !t.dihapus)
  const [b, setB] = useState(initial)
  const [cek, setCek] = useState(false)
  const set = (p: Partial<Bangunan>) => setB((o) => ({ ...o, ...p }))
  const err = validasiBangunan(b, tanah.find((t) => t.id === b.tanahId))
  const k = klasifikasiKerusakan(b.bobotKerusakan)
  const simpan = async () => {
    setCek(true)
    if (err.length && !await tanya(`Masih ada ${err.length} isian belum sesuai ketentuan. Simpan sebagai catatan sementara?`)) return
    await put('bangunan', b)
    toast('Data bangunan disimpan')
    onClose()
  }
  return (
    <Modal title={initial.nama ? `Bangunan: ${initial.nama}` : 'Bangunan Baru'} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={simpan}>Simpan Bangunan</Btn></>}>
      <div className="form-grid">
        <Field label="Tanah *" span={2}><Sel obj={b} k="tanahId" set={set} empty="-" options={tanah.map((t) => [t.id, `${t.nama} (${m2(t.luas)})`] as [string, string])} /></Field>
        <Field label="Jenis prasarana *" span={2}><Sel obj={b} k="jenisPrasarana" set={set} options={JENIS_BANGUNAN} /></Field>
        <Field label="Nama bangunan *" span={2}><Inp obj={b} k="nama" set={set} autoFocus /></Field>
        <Field label="Status kepemilikan *"><Sel obj={b} k="statusKepemilikan" set={set} options={STATUS_KEPEMILIKAN_BANGUNAN} empty="-" /></Field>
        <Field label="Nilai perolehan aset (Rp)"><Inp obj={b} k="nilaiPerolehan" set={set} type="number" min={0} /></Field>
        <Field label="Panjang (m) *"><Inp obj={b} k="panjang" set={set} type="number" min={0} /></Field>
        <Field label="Lebar (m) *"><Inp obj={b} k="lebar" set={set} type="number" min={0} /></Field>
        <Field label="Luas tapak (m²) *" hint={b.panjang && b.lebar ? `panjang x lebar = ${b.panjang * b.lebar} m²` : undefined}><Inp obj={b} k="luasTapak" set={set} type="number" min={0} /></Field>
        <Field label="Jumlah lantai *"><Inp obj={b} k="jumlahLantai" set={set} type="number" min={1} /></Field>
        <Field label="Tahun pembangunan *"><Inp obj={b} k="tahunPembangunan" set={set} type="number" /></Field>
        <Field label="Tanggal SK pemakai"><Inp obj={b} k="tanggalSk" set={set} type="date" /></Field>
        <Field label="Bobot kerusakan (%)"><Inp obj={b} k="bobotKerusakan" set={set} type="number" min={0} max={100} /></Field>
        <Field label="Klasifikasi kerusakan" hint="otomatis dari bobot"><input value={k} readOnly /></Field>
        <Field label="Keterangan" span={4}><Inp obj={b} k="keterangan" set={set} placeholder="mis. digunakan untuk ruang kelas, ruang guru, dan ruang kepala sekolah" /></Field>
      </div>
      {(cek || initial.nama) && <Errs e={err} />}
    </Modal>
  )
}

// ---------------- Ruang ----------------
function RuangTab({ ajukan }: { ajukan: Ajukan }) {
  const ruang = useCol('ruang')
  const bangunan = useCol('bangunan')
  const [edit, setEdit] = useState<Ruang | null>(null)
  const [semua, setSemua] = useState(false)
  const [bid, setBid] = useState('')
  const list = ruang.filter((r) => (semua || !r.dihapus) && (!bid || r.bangunanId === bid)).sort((a, b) => a.kode.localeCompare(b.kode, 'id', { numeric: true }))
  return (
    <Card title={`${list.length} ruang`} actions={<>
      <select value={bid} onChange={(e) => setBid(e.target.value)} aria-label="Filter bangunan"><option value="">Semua bangunan</option>{bangunan.filter((b) => !b.dihapus).map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}</select>
      <label className="small"><input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan yang dihapus</label>
      <Btn icon="plus" kind="primary" onClick={() => setEdit({ id: uid(), kode: '', nama: '', jenisPrasarana: 'Ruang Teori/Kelas', bangunanId: bid || bangunan.find((b) => !b.dihapus)?.id, lantaiKe: 1 })}>Tambah Ruang</Btn>
    </>}>
      {!list.length ? <Empty>Belum ada data ruang. Ruang harus dikaitkan dengan bangunan yang sudah tercatat.</Empty> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Kode</th><th>Nama</th><th>Jenis</th><th>Bangunan</th><th className="c">Lantai</th><th className="num">Luas</th><th className="c">Kapasitas</th><th>Kondisi</th><th></th></tr></thead>
          <tbody>{list.map((r) => {
            const k = klasifikasiKerusakan(r.bobotKerusakan)
            return (
              <tr key={r.id} className={r.dihapus ? 'gone' : ''} onDoubleClick={() => setEdit(r)}>
                <td>{r.kode}</td><td><b>{r.nama}</b> <Hapus d={r.dihapus} /></td><td>{r.jenisPrasarana}</td><td>{bangunan.find((b) => b.id === r.bangunanId)?.nama ?? '-'}</td>
                <td className="c">{r.lantaiKe ?? '-'}</td><td className="num">{m2(r.luas)}</td><td className="c">{r.kapasitas ?? '-'}</td>
                <td><span className={`pill ${pillKerusakan(k)}`}>{k}</span></td>
                <td className="row-actions"><AksiAjukan objek="Ruang" id={r.id} nama={r.nama} ajukan={ajukan} dihapus={!!r.dihapus} /><Btn icon="edit" kind="ghost" title="Ubah" onClick={() => setEdit(r)} /></td>
              </tr>
            )
          })}</tbody>
        </table></div>
      )}
      {edit && <RuangForm initial={edit} onClose={() => setEdit(null)} />}
    </Card>
  )
}

function RuangForm({ initial, onClose }: { initial: Ruang; onClose: () => void }) {
  const semua = useCol('ruang')
  const bangunan = useCol('bangunan').filter((b) => !b.dihapus)
  const [r, setR] = useState(initial)
  const [cek, setCek] = useState(false)
  const set = (p: Partial<Ruang>) => setR((o) => ({ ...o, ...p }))
  const err = validasiRuang(r, semua, bangunan.find((b) => b.id === r.bangunanId))
  const simpan = async () => {
    setCek(true)
    if (err.length && !await tanya(`Masih ada ${err.length} isian belum sesuai ketentuan. Simpan sebagai catatan sementara?`)) return
    await put('ruang', r)
    toast('Data ruang disimpan')
    onClose()
  }
  return (
    <Modal title={initial.nama ? `Ruang: ${initial.nama}` : 'Ruang Baru'} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={simpan}>Simpan Ruang</Btn></>}>
      <div className="form-grid">
        <Field label="Jenis prasarana *" span={2}><Sel obj={r} k="jenisPrasarana" set={set} options={JENIS_RUANG} /></Field>
        <Field label="Bangunan *" span={2}><Sel obj={r} k="bangunanId" set={set} empty="-" options={bangunan.map((b) => [b.id, `${b.nama} (${b.jumlahLantai ?? '?'} lantai)`] as [string, string])} /></Field>
        <Field label="Kode ruang *" hint="unik, mis. RK-07"><Inp obj={r} k="kode" set={set} autoFocus /></Field>
        <Field label="Nama ruang *" span={2}><Inp obj={r} k="nama" set={set} placeholder="Ruang Kelas VII G" /></Field>
        <Field label="Registrasi ruang"><Inp obj={r} k="registrasi" set={set} placeholder="03.11.01.07" /></Field>
        <Field label="Lantai ke *"><Inp obj={r} k="lantaiKe" set={set} type="number" min={1} /></Field>
        <Field label="Panjang (m) *"><Inp obj={r} k="panjang" set={set} type="number" min={0} /></Field>
        <Field label="Lebar (m) *"><Inp obj={r} k="lebar" set={set} type="number" min={0} /></Field>
        <Field label="Luas ruang (m²) *" hint={r.panjang && r.lebar ? `panjang x lebar = ${r.panjang * r.lebar} m²` : undefined}><Inp obj={r} k="luas" set={set} type="number" min={0} /></Field>
        <Field label="Kapasitas *"><Inp obj={r} k="kapasitas" set={set} type="number" min={0} /></Field>
        <Field label="Bobot kerusakan (%)"><Inp obj={r} k="bobotKerusakan" set={set} type="number" min={0} max={100} /></Field>
        <Field label="Klasifikasi kerusakan" span={2}><input value={klasifikasiKerusakan(r.bobotKerusakan)} readOnly /></Field>
      </div>
      {(cek || initial.nama) && <Errs e={err} />}
    </Modal>
  )
}

// ---------------- Pengajuan ----------------
function namaObjek(p: Pick<PengajuanPrasarana, 'objek' | 'objekId'>) {
  const st = getState()
  const col = p.objek === 'Tanah' ? st.tanah : p.objek === 'Bangunan' ? st.bangunan : st.ruang
  return (col as { id: string; nama: string }[]).find((x) => x.id === p.objekId)?.nama ?? '-'
}

function errObjek(p: Pick<PengajuanPrasarana, 'objek' | 'objekId'>): string[] {
  const st = getState()
  if (p.objek === 'Tanah') { const t = st.tanah.find((x) => x.id === p.objekId); return t ? validasiTanah(t) : [] }
  if (p.objek === 'Bangunan') { const b = st.bangunan.find((x) => x.id === p.objekId); return b ? validasiBangunan(b, st.tanah.find((t) => t.id === b.tanahId)) : [] }
  const r = st.ruang.find((x) => x.id === p.objekId)
  return r ? validasiRuang(r, st.ruang, st.bangunan.find((b) => b.id === r.bangunanId)) : []
}

function PengajuanTab({ ajukan, onEdit }: { ajukan: Ajukan; onEdit: (p: PengajuanPrasarana) => void }) {
  const pengajuan = useCol('pengajuan')
  useCol('tanah'); useCol('bangunan'); useCol('ruang')
  const aktif = pengajuanAktif(pengajuan)
  const [objek, setObjek] = useState<ObjekPrasarana>('Tanah')
  const [jenis, setJenis] = useState<JenisPengajuan>('Penambahan')
  const list = [...pengajuan].sort((a, b) => b.dibuat.localeCompare(a.dibuat))
  return (
    <>
      {aktif && <div className="notice warn">Pengajuan <b>{aktif.nama}</b> masih berstatus <b>{aktif.status}</b>. Sesuai panduan, pengajuan baru tidak dapat dibuat sampai statusnya Disetujui, Ditolak, atau Dibatalkan.</div>}
      <Card title="Daftar Pengajuan" actions={<>
        <select value={objek} onChange={(e) => setObjek(e.target.value as ObjekPrasarana)} aria-label="Objek"><option>Tanah</option><option>Bangunan</option><option>Ruang</option></select>
        <select value={jenis} onChange={(e) => setJenis(e.target.value as JenisPengajuan)} aria-label="Jenis pengajuan">{JENIS_PENGAJUAN.map((j) => <option key={j}>{j}</option>)}</select>
        <Btn icon="plus" kind="primary" disabled={!!aktif} onClick={() => ajukan(objek, jenis)}>Buat Pengajuan</Btn>
      </>}>
        {!list.length ? <Empty>Belum ada pengajuan. Pilih objek dan jenis pengajuan lalu klik <b>Buat Pengajuan</b>, atau gunakan <i>Ajukan ke Dapodik</i> pada baris data tanah, bangunan, atau ruang.</Empty> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Nama Ajuan</th><th>Objek</th><th>Jenis</th><th>Data</th><th className="c">Dokumen</th><th>Status</th><th>Tindakan berikutnya</th><th></th></tr></thead>
            <tbody>{list.map((p) => {
              const wajib = dokumenWajib(p.objek, p.jenis)
              const ada = wajib.filter((d) => p.dokumen.some((x) => x.jenis === d)).length
              return (
                <tr key={p.id} onDoubleClick={() => onEdit(p)}>
                  <td><b>{p.nama || '(tanpa nama)'}</b><br /><span className="muted small">dibuat {fmtTanggal(p.dibuat)}{p.diajukan ? ` · dikirim ${fmtTanggal(p.diajukan)}` : ''}</span></td>
                  <td>{p.objek}</td><td>{p.jenis}</td><td>{namaObjek(p)}</td>
                  <td className="c"><span className={`pill ${ada === wajib.length ? 'ok' : 'warn'}`}>{ada}/{wajib.length}</span></td>
                  <td><span className={`pill ${KET_STATUS[p.status].pill}`}>{p.status}</span>{p.status === 'Disetujui' && (p.tarikData ? <span className="pill ok">Tarik Data selesai</span> : <span className="pill warn">Perlu Tarik Data</span>)}</td>
                  <td className="small">{p.status === 'Disetujui' && p.tarikData ? 'Selesai' : KET_STATUS[p.status].tindakan}</td>
                  <td className="row-actions">
                    <Btn icon="print" kind="ghost" title="Cetak lembar pengajuan" onClick={() => printDoc(<LembarPengajuan p={p} />)} />
                    <Btn icon="edit" kind="ghost" onClick={() => onEdit(p)}>Buka</Btn>
                    {p.status === 'Draf' && <Btn icon="trash" kind="ghost" title="Hapus draf" onClick={async () => { if (await tanya('Hapus draf pengajuan ini?')) await remove('pengajuan', p.id) }} />}
                  </td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      </Card>
    </>
  )
}

function PengajuanForm({ initial, onClose }: { initial: PengajuanPrasarana; onClose: () => void }) {
  const semua = useCol('pengajuan')
  const tanah = useCol('tanah'); const bangunan = useCol('bangunan'); const ruang = useCol('ruang')
  const [p, setP] = useState(initial)
  const [jenisDok, setJenisDok] = useState<JenisDokumen>(dokumenWajib(initial.objek, initial.jenis)[0] ?? 'Dokumen lain')
  const set = (x: Partial<PengajuanPrasarana>) => setP((o) => ({ ...o, ...x }))
  const draf = p.status === 'Draf'
  const pilihan = (p.objek === 'Tanah' ? tanah : p.objek === 'Bangunan' ? bangunan : ruang).filter((x) => !x.dihapus) as { id: string; nama: string }[]
  const wajib = dokumenWajib(p.objek, p.jenis)
  const err = validasiPengajuan(p, semua, errObjek(p))

  const unggah = async (f: File) => {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return toast('Dokumen harus berformat PDF.')
    if (f.size > BATAS_DOKUMEN) return toast(`"${f.name}" berukuran ${(f.size / 1048576).toFixed(1)} MB, melebihi batas 2 MB.`)
    const d: DokumenPengajuan = { id: uid(), jenis: jenisDok, namaBerkas: f.name, ukuran: f.size, data: await readFileAsDataUrl(f) }
    set({ dokumen: [...p.dokumen, d] })
  }
  const simpan = async (x: Partial<PengajuanPrasarana> = {}) => {
    const next = { ...p, ...x }
    await put('pengajuan', next)
    // Penghapusan yang disetujui: tandai objek sebagai dihapus dari pencatatan.
    if (next.status === 'Disetujui' && next.jenis === 'Penghapusan' && next.tanggalPenghapusan && next.alasanPenghapusan) {
      const d = { tanggal: next.tanggalPenghapusan, alasan: next.alasanPenghapusan }
      const st = getState()
      if (next.objek === 'Tanah') { const o = st.tanah.find((t) => t.id === next.objekId); if (o) await put('tanah', { ...o, dihapus: d }) }
      if (next.objek === 'Bangunan') { const o = st.bangunan.find((t) => t.id === next.objekId); if (o) await put('bangunan', { ...o, dihapus: d }) }
      if (next.objek === 'Ruang') { const o = st.ruang.find((t) => t.id === next.objekId); if (o) await put('ruang', { ...o, dihapus: d }) }
    }
    toast('Pengajuan disimpan')
    onClose()
  }
  const ruangAktif = p.objek === 'Bangunan' && p.jenis === 'Penghapusan' ? ruang.filter((r) => r.bangunanId === p.objekId && !r.dihapus) : []

  return (
    <Modal title={`Pengajuan ${p.jenis} Data ${p.objek}`} onClose={onClose} wide footer={<>
      <Btn icon="print" onClick={() => printDoc(<LembarPengajuan p={p} />)}>Cetak lembar</Btn>
      <div className="topbar-fill" />
      <Btn onClick={onClose}>Tutup</Btn>
      <Btn onClick={() => simpan()}>Simpan</Btn>
      {draf && <Btn kind="primary" disabled={err.length > 0} title={err.length ? 'Lengkapi semua butir di bawah terlebih dahulu' : ''} onClick={() => simpan({ status: 'Diajukan', diajukan: today() })}>Tandai sudah dikirim</Btn>}
    </>}>
      <div className="form-grid">
        <Field label="Nama ajuan *" span={2} hint="mis. Penambahan Ruang Kelas Baru SMP Negeri 21"><Inp obj={p} k="nama" set={set} disabled={!draf} /></Field>
        <Field label="Objek"><input value={p.objek} readOnly /></Field>
        <Field label="Jenis pengajuan"><select value={p.jenis} disabled={!draf} onChange={(e) => set({ jenis: e.target.value as JenisPengajuan })}>{JENIS_PENGAJUAN.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <Field label={`Data ${p.objek.toLowerCase()} yang diajukan *`} span={2}>
          <select value={p.objekId} disabled={!draf} onChange={(e) => set({ objekId: e.target.value })}><option value="">-</option>{pilihan.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select>
        </Field>
        <Field label="Alasan pengajuan *" span={2}><Inp obj={p} k="alasan" set={set} disabled={!draf} /></Field>
        {p.jenis === 'Penghapusan' && <>
          <Field label="Tanggal penghapusan *" hint="sesuai SK / berita acara"><Inp obj={p} k="tanggalPenghapusan" set={set} type="date" disabled={!draf} /></Field>
          <Field label="Alasan penghapusan *" span={3}>
            <select value={p.alasanPenghapusan ?? ''} disabled={!draf} onChange={(e) => set({ alasanPenghapusan: (e.target.value || undefined) as PengajuanPrasarana['alasanPenghapusan'] })}>
              <option value="">-</option>{ALASAN_PENGHAPUSAN.map((a) => <option key={a.v} value={a.v}>{a.v}: {a.ket}</option>)}
            </select>
          </Field>
        </>}
      </div>
      {ruangAktif.length > 0 && <div className="notice warn">Bangunan ini masih memiliki {ruangAktif.length} ruang aktif ({ruangAktif.map((r) => r.nama).join(', ')}). Selesaikan data ruang terlebih dahulu bila sistem mensyaratkan.</div>}
      {p.jenis === 'Perbaikan' && <p className="muted small">Perbaikan hanya mengubah data yang tidak sesuai. Ubah data di tab {p.objek} terlebih dahulu, lalu ajukan. Untuk objek yang sudah tidak ada, gunakan Penghapusan.</p>}

      <h4 className="sec">Dokumen pendukung (PDF, maksimal 2 MB per dokumen)</h4>
      <div className="chips">
        {wajib.map((d) => {
          const ok = p.dokumen.some((x) => x.jenis === d)
          return <span key={d} className={`pill ${ok ? 'ok' : 'warn'}`}>{ok ? '✓' : '○'} {d} (wajib)</span>
        })}
        {!wajib.length && <span className="muted small">Tidak ada dokumen wajib untuk jenis ini.</span>}
      </div>
      <table className="mini" style={{ marginTop: 8 }}>
        <tbody>
          {p.dokumen.map((d) => (
            <tr key={d.id}><td>{d.jenis}</td><td>{d.data ? <a href={d.data} download={d.namaBerkas}>{d.namaBerkas}</a> : d.namaBerkas}</td><td className="num">{(d.ukuran / 1024).toFixed(0)} KB</td>
              <td className="row-actions">{draf && <Btn icon="trash" kind="ghost" title="Hapus dokumen" onClick={() => set({ dokumen: p.dokumen.filter((x) => x.id !== d.id) })} />}</td></tr>
          ))}
        </tbody>
      </table>
      {draf && (
        <div className="filters" style={{ marginTop: 6 }}>
          <select value={jenisDok} onChange={(e) => setJenisDok(e.target.value as JenisDokumen)} aria-label="Jenis dokumen">{JENIS_DOKUMEN.map((j) => <option key={j}>{j}</option>)}</select>
          <label className="btn btn-default">Unggah PDF<input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) unggah(f) }} /></label>
        </div>
      )}

      <h4 className="sec">Daftar periksa sebelum pengiriman</h4>
      <div className="checklist">
        {DAFTAR_PERIKSA.map((t, i) => (
          <label key={i}><input type="checkbox" disabled={!draf} checked={!!p.periksa[i]} onChange={(e) => { const n = [...p.periksa]; n[i] = e.target.checked; set({ periksa: n }) }} />{t}</label>
        ))}
      </div>

      {draf ? (
        err.length ? <><h4 className="sec">Belum siap dikirim</h4><Errs e={err} /></> : <div className="notice ok">Pengajuan lengkap. Kirim melalui Manajemen Satuan Pendidikan (menu Sarpras &gt; Pengajuan), lalu klik <b>Tandai sudah dikirim</b>.</div>
      ) : (
        <>
          <h4 className="sec">Status verifikasi</h4>
          <div className="form-grid">
            <Field label="Status"><select value={p.status} onChange={(e) => set({ status: e.target.value as StatusPengajuan })}>{STATUS_PENGAJUAN.filter((s) => s !== 'Draf').map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Catatan verifikasi / penolakan" span={3}><Inp obj={p} k="catatanVerifikasi" set={set} /></Field>
          </div>
          <p className="small muted">{KET_STATUS[p.status].ket}. Tindakan: {KET_STATUS[p.status].tindakan}.</p>
          {p.status === 'Disetujui' && (
            <label className="chip on"><input type="checkbox" checked={!!p.tarikData} onChange={(e) => set({ tarikData: e.target.checked })} />Tarik Data di Aplikasi Dapodik sudah dilakukan dan data {p.objek.toLowerCase()} sudah diperiksa</label>
          )}
          {p.status === 'Disetujui' && p.jenis === 'Penghapusan' && <p className="small muted">Saat disimpan, data {p.objek.toLowerCase()} ini ditandai dihapus per {fmtTanggal(p.tanggalPenghapusan)} ({p.alasanPenghapusan}).</p>}
        </>
      )}
    </Modal>
  )
}

function LembarPengajuan({ p }: { p: PengajuanPrasarana }) {
  const st = getState()
  const s = getSekolah()
  const kepsek = st.pegawai.find((x) => x.id === s.kepalaSekolahId)
  const rows: [string, string | number | undefined][] = []
  if (p.objek === 'Tanah') {
    const t = st.tanah.find((x) => x.id === p.objekId)
    if (t) rows.push(['Nama', t.nama], ['No sertifikat', t.noSertifikat], ['Panjang x lebar', `${t.panjang ?? '-'} x ${t.lebar ?? '-'} m`], ['Luas / tersedia', `${m2(t.luas)} / ${m2(t.luasTersedia)}`], ['Nilai perolehan', rp(t.nilaiPerolehan)], ['Status kepemilikan', t.statusKepemilikan], ['Lokasi', t.samaDenganSekolah ? 'Sama dengan lokasi sekolah' : [t.alamatJalan, t.rt && `RT ${t.rt}`, t.rw && `RW ${t.rw}`, t.desa, t.kecamatan, t.kabupaten, t.provinsi, t.kodePos].filter(Boolean).join(', ')], ['Koordinat', t.lintang !== undefined ? `${t.lintang}, ${t.bujur}` : '-'], ['Keterangan', t.keterangan])
  } else if (p.objek === 'Bangunan') {
    const b = st.bangunan.find((x) => x.id === p.objekId)
    if (b) rows.push(['Nama', b.nama], ['Jenis prasarana', b.jenisPrasarana], ['Tanah', st.tanah.find((t) => t.id === b.tanahId)?.nama], ['Panjang x lebar', `${b.panjang ?? '-'} x ${b.lebar ?? '-'} m`], ['Luas tapak', m2(b.luasTapak)], ['Status kepemilikan', b.statusKepemilikan], ['Nilai perolehan', rp(b.nilaiPerolehan)], ['Jumlah lantai', b.jumlahLantai], ['Tahun pembangunan', b.tahunPembangunan], ['Tanggal SK pemakai', b.tanggalSk ? fmtTanggal(b.tanggalSk) : '-'], ['Bobot / klasifikasi kerusakan', `${b.bobotKerusakan ?? '-'}% / ${klasifikasiKerusakan(b.bobotKerusakan)}`], ['Jumlah ruang terhubung', st.ruang.filter((r) => r.bangunanId === b.id && !r.dihapus).length], ['Keterangan', b.keterangan])
  } else {
    const r = st.ruang.find((x) => x.id === p.objekId)
    if (r) rows.push(['Kode / nama ruang', `${r.kode} / ${r.nama}`], ['Jenis prasarana', r.jenisPrasarana], ['Bangunan', st.bangunan.find((b) => b.id === r.bangunanId)?.nama], ['Registrasi', r.registrasi], ['Lantai ke', r.lantaiKe], ['Panjang x lebar', `${r.panjang ?? '-'} x ${r.lebar ?? '-'} m`], ['Luas', m2(r.luas)], ['Kapasitas', r.kapasitas], ['Bobot / klasifikasi kerusakan', `${r.bobotKerusakan ?? '-'}% / ${klasifikasiKerusakan(r.bobotKerusakan)}`])
  }
  return (
    <div className="doc">
      <KopSurat judul="LEMBAR PEMERIKSAAN PENGAJUAN DATA PRASARANA" sub="Acuan: Panduan Pengajuan Data Prasarana pada Dapodik versi 2027" />
      <table className="ident wide"><tbody>
        <tr><td className="lbl">Nama ajuan</td><td>: <b>{p.nama}</b></td></tr>
        <tr><td className="lbl">Objek / jenis pengajuan</td><td>: {p.objek} / {p.jenis}</td></tr>
        <tr><td className="lbl">Alasan pengajuan</td><td>: {p.alasan}</td></tr>
        {p.jenis === 'Penghapusan' && <tr><td className="lbl">Tanggal / alasan penghapusan</td><td>: {fmtTanggal(p.tanggalPenghapusan)} / {p.alasanPenghapusan}</td></tr>}
        <tr><td className="lbl">Status</td><td>: {p.status}{p.catatanVerifikasi ? ` (${p.catatanVerifikasi})` : ''}</td></tr>
      </tbody></table>
      <h4 className="sec">Data {p.objek}</h4>
      <table className="nilai"><tbody>{rows.map(([l, v]) => <tr key={l}><td style={{ width: '38%' }}>{l}</td><td>{v ?? '-'}</td></tr>)}</tbody></table>
      <h4 className="sec">Dokumen pendukung</h4>
      <table className="nilai">
        <thead><tr><th>Dokumen</th><th style={{ width: 80 }}>Syarat</th><th>Berkas</th></tr></thead>
        <tbody>{[...new Set([...dokumenWajib(p.objek, p.jenis), ...p.dokumen.map((d) => d.jenis)])].map((j) => (
          <tr key={j}><td>{j}</td><td className="c">{dokumenWajib(p.objek, p.jenis).includes(j) ? 'Wajib' : '-'}</td><td>{p.dokumen.filter((d) => d.jenis === j).map((d) => d.namaBerkas).join(', ') || 'Belum ada'}</td></tr>
        ))}</tbody>
      </table>
      <h4 className="sec">Daftar periksa sebelum pengiriman</h4>
      <table className="nilai">
        <thead><tr><th style={{ width: 30 }}>No</th><th>Pemeriksaan</th><th style={{ width: 70 }}>Ya/Tidak</th></tr></thead>
        <tbody>{DAFTAR_PERIKSA.map((t, i) => <tr key={i}><td className="c">{i + 1}</td><td>{t}</td><td className="c">{p.periksa[i] ? 'Ya' : 'Tidak'}</td></tr>)}</tbody>
      </table>
      <TandaTangan kanan={{ jabatan: 'Kepala Sekolah', nama: kepsek ? namaPegawai(kepsek) : undefined, nip: kepsek?.nip ?? '' }} />
    </div>
  )
}
