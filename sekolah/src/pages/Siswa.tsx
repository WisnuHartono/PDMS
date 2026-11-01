import { useMemo, useRef, useState } from 'react'
import { put, remove, useCol } from '../store'
import { AGAMA, JENJANG, type Jenjang, type OrangTua, type Siswa, type StatusSiswa } from '../types'
import { Avatar, Btn, Card, Empty, Field, Inp, Modal, PageHead, Sel, Tabs, toast } from '../ui'
import { download, fmtTanggal, fotoKecil, readFileAsText, toCsv, uid } from '../util'
import { parseCsv } from '../csv'

const STATUS: StatusSiswa[] = ['Aktif', 'Lulus', 'Mutasi Keluar', 'Keluar', 'Meninggal']

export const siswaBaru = (jenjang: Jenjang = 'SD'): Siswa => ({
  id: uid(), noInduk: '', nama: '', jk: 'L', jenjang, status: 'Aktif', kewarganegaraan: 'WNI', ayah: {}, ibu: {}, wali: {},
})

export default function SiswaPage() {
  const siswa = useCol('siswa')
  const rombel = useCol('rombel')
  const [q, setQ] = useState('')
  const [jenjang, setJenjang] = useState('')
  const [status, setStatus] = useState('Aktif')
  const [edit, setEdit] = useState<Siswa | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const rombelOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of [...rombel].sort((a, b) => a.tahunAjaran.localeCompare(b.tahunAjaran))) for (const id of r.siswaIds) m.set(id, r.nama)
    return m
  }, [rombel])

  const list = siswa
    .filter((s) => (!jenjang || s.jenjang === jenjang) && (!status || s.status === status))
    .filter((s) => { const x = q.toLowerCase(); return !x || s.nama.toLowerCase().includes(x) || s.noInduk.includes(x) || (s.nisn ?? '').includes(x) })
    .sort((a, b) => a.noInduk.localeCompare(b.noInduk))

  const exportCsv = () => {
    const rows = [['No Induk', 'NISN', 'Nama', 'JK', 'Tempat Lahir', 'Tanggal Lahir', 'Agama', 'Jenjang', 'Kelas', 'Status', 'Alamat', 'Nama Ayah', 'Nama Ibu', 'Telepon']]
    for (const s of list) rows.push([s.noInduk, s.nisn ?? '', s.nama, s.jk, s.tempatLahir ?? '', s.tanggalLahir ?? '', s.agama ?? '', s.jenjang, rombelOf.get(s.id) ?? '', s.status, s.alamat ?? '', s.ayah.nama ?? '', s.ibu.nama ?? '', s.telepon ?? s.ayah.telepon ?? ''])
    download('peserta-didik.csv', toCsv(rows), 'text/csv')
  }

  const importCsv = async (f: File) => {
    const rows = parseCsv(await readFileAsText(f))
    const [head, ...body] = rows
    if (!head) return
    const idx = (n: string) => head.findIndex((h) => h.trim().toLowerCase() === n.toLowerCase())
    const col = (r: string[], n: string) => { const i = idx(n); return i >= 0 ? r[i]?.trim() || undefined : undefined }
    let n = 0
    for (const r of body) {
      const nama = col(r, 'Nama')
      if (!nama) continue
      const j = (col(r, 'Jenjang') ?? 'SD').toUpperCase() as Jenjang
      const s: Siswa = {
        ...siswaBaru(JENJANG.includes(j) ? j : 'SD'),
        noInduk: col(r, 'No Induk') ?? '', nisn: col(r, 'NISN'), nama, jk: col(r, 'JK') === 'P' ? 'P' : 'L',
        tempatLahir: col(r, 'Tempat Lahir'), tanggalLahir: col(r, 'Tanggal Lahir'), agama: col(r, 'Agama'), alamat: col(r, 'Alamat'),
        telepon: col(r, 'Telepon'), ayah: { nama: col(r, 'Nama Ayah') }, ibu: { nama: col(r, 'Nama Ibu') },
      }
      await put('siswa', s)
      n++
    }
    toast(`${n} peserta didik diimpor`)
  }

  return (
    <div>
      <PageHead title="Peserta Didik" sub="Identitas siswa / peserta didik dari PAUD sampai SMA">
        <Btn icon="upload" onClick={() => fileRef.current?.click()}>Impor CSV</Btn>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = '' }} />
        <Btn icon="download" onClick={exportCsv}>Ekspor CSV</Btn>
        <Btn icon="plus" kind="primary" onClick={() => setEdit(siswaBaru((jenjang || 'SD') as Jenjang))}>Tambah Siswa</Btn>
      </PageHead>
      <Card title={`${list.length} peserta didik`} actions={
        <div className="filters">
          <input placeholder="Cari nama / NIS / NISN" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={jenjang} onChange={(e) => setJenjang(e.target.value)}><option value="">Semua jenjang</option>{JENJANG.map((j) => <option key={j}>{j}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua status</option>{STATUS.map((j) => <option key={j}>{j}</option>)}</select>
        </div>
      }>
        {list.length === 0 ? <Empty>Belum ada data. Klik <b>Tambah Siswa</b> atau impor dari CSV (kolom: No Induk, NISN, Nama, JK, Tempat Lahir, Tanggal Lahir, Agama, Jenjang, Alamat, Nama Ayah, Nama Ibu, Telepon).</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th></th><th>No Induk</th><th>NISN</th><th>Nama</th><th>L/P</th><th>Tempat, Tgl Lahir</th><th>Jenjang</th><th>Kelas</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} onDoubleClick={() => setEdit(s)}>
                    <td><Avatar nama={s.nama} foto={s.foto} size={28} /></td>
                    <td>{s.noInduk}</td><td>{s.nisn}</td><td><b>{s.nama}</b></td><td>{s.jk}</td>
                    <td>{s.tempatLahir}{s.tanggalLahir ? `, ${fmtTanggal(s.tanggalLahir)}` : ''}</td>
                    <td>{s.jenjang}</td><td>{rombelOf.get(s.id) ?? '-'}</td>
                    <td><span className={`pill ${s.status === 'Aktif' ? 'ok' : ''}`}>{s.status}</span></td>
                    <td className="row-actions">
                      <Btn icon="edit" kind="ghost" title="Ubah" onClick={() => setEdit(s)} />
                      <Btn icon="trash" kind="ghost" title="Hapus" onClick={async () => { if (confirm(`Hapus ${s.nama}?`)) { await remove('siswa', s.id); toast('Dihapus') } }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {edit && <SiswaForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function OrtuForm({ v, set }: { v: OrangTua; set: (p: Partial<OrangTua>) => void }) {
  return (
    <>
      <Field label="Nama" span={2}><Inp obj={v} k="nama" set={set} /></Field>
      <Field label="Pekerjaan"><Inp obj={v} k="pekerjaan" set={set} /></Field>
      <Field label="Pendidikan"><Inp obj={v} k="pendidikan" set={set} /></Field>
      <Field label="Telepon"><Inp obj={v} k="telepon" set={set} /></Field>
      <Field label="Alamat" span={3}><Inp obj={v} k="alamat" set={set} /></Field>
    </>
  )
}

export function SiswaForm({ initial, onClose }: { initial: Siswa; onClose: () => void }) {
  const [s, setS] = useState<Siswa>(initial)
  const [tab, setTab] = useState<'id' | 'ortu' | 'riwayat' | 'keluar'>('id')
  const set = (p: Partial<Siswa>) => setS((x) => ({ ...x, ...p }))
  const simpan = async () => {
    if (!s.nama.trim()) return toast('Nama wajib diisi')
    await put('siswa', s)
    toast('Data peserta didik disimpan')
    onClose()
  }
  return (
    <Modal title={initial.nama ? `Ubah: ${initial.nama}` : 'Peserta Didik Baru'} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={simpan}>Simpan</Btn></>}>
      <Tabs tabs={[['id', 'Identitas'], ['ortu', 'Orang Tua / Wali'], ['riwayat', 'Riwayat Masuk'], ['keluar', 'Meninggalkan Sekolah']]} value={tab} onChange={setTab} />
      {tab === 'id' && (
        <div className="form-grid">
          <div className="foto-box span-1">
            <Avatar nama={s.nama || '?'} foto={s.foto} size={96} />
            <label className="btn btn-ghost">Pilih foto<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ foto: await fotoKecil(f) }) }} /></label>
          </div>
          <Field label="Nama lengkap *" span={2}><Inp obj={s} k="nama" set={set} autoFocus /></Field>
          <Field label="Nama panggilan"><Inp obj={s} k="namaPanggilan" set={set} /></Field>
          <Field label="No Induk (NIS)"><Inp obj={s} k="noInduk" set={set} /></Field>
          <Field label="NISN"><Inp obj={s} k="nisn" set={set} /></Field>
          <Field label="NIK"><Inp obj={s} k="nik" set={set} /></Field>
          <Field label="Jenis kelamin"><Sel obj={s} k="jk" set={set} options={[['L', 'Laki-laki'], ['P', 'Perempuan']]} /></Field>
          <Field label="Tempat lahir"><Inp obj={s} k="tempatLahir" set={set} /></Field>
          <Field label="Tanggal lahir"><Inp obj={s} k="tanggalLahir" set={set} type="date" /></Field>
          <Field label="Agama"><Sel obj={s} k="agama" set={set} options={AGAMA} empty="-" /></Field>
          <Field label="Kewarganegaraan"><Inp obj={s} k="kewarganegaraan" set={set} /></Field>
          <Field label="Anak ke-"><Inp obj={s} k="anakKe" set={set} type="number" /></Field>
          <Field label="Jumlah saudara"><Inp obj={s} k="jumlahSaudara" set={set} type="number" /></Field>
          <Field label="Bahasa di rumah"><Inp obj={s} k="bahasaRumah" set={set} /></Field>
          <Field label="Golongan darah"><Sel obj={s} k="golDarah" set={set} options={['A', 'B', 'AB', 'O']} empty="-" /></Field>
          <Field label="Tinggi badan (cm)"><Inp obj={s} k="tinggiBadan" set={set} type="number" /></Field>
          <Field label="Berat badan (kg)"><Inp obj={s} k="beratBadan" set={set} type="number" /></Field>
          <Field label="Riwayat penyakit" span={2}><Inp obj={s} k="riwayatPenyakit" set={set} /></Field>
          <Field label="Alamat" span={3}><Inp obj={s} k="alamat" set={set} /></Field>
          <Field label="Telepon"><Inp obj={s} k="telepon" set={set} /></Field>
          <Field label="Tinggal dengan"><Sel obj={s} k="tinggalDengan" set={set} options={['Orang tua', 'Wali', 'Asrama', 'Lainnya']} empty="-" /></Field>
        </div>
      )}
      {tab === 'ortu' && (
        <>
          <h4 className="sec">Ayah</h4>
          <div className="form-grid"><OrtuForm v={s.ayah} set={(p) => set({ ayah: { ...s.ayah, ...p } })} /></div>
          <h4 className="sec">Ibu</h4>
          <div className="form-grid"><OrtuForm v={s.ibu} set={(p) => set({ ibu: { ...s.ibu, ...p } })} /></div>
          <h4 className="sec">Wali (jika ada)</h4>
          <div className="form-grid"><OrtuForm v={s.wali} set={(p) => set({ wali: { ...s.wali, ...p } })} /></div>
        </>
      )}
      {tab === 'riwayat' && (
        <div className="form-grid">
          <Field label="Jenjang"><Sel obj={s} k="jenjang" set={set} options={JENJANG} /></Field>
          <Field label="Tanggal diterima"><Inp obj={s} k="tanggalMasuk" set={set} type="date" /></Field>
          <Field label="Diterima di kelas"><Inp obj={s} k="diterimaDiKelas" set={set} /></Field>
          <Field label="Asal sekolah" span={2}><Inp obj={s} k="asalSekolah" set={set} /></Field>
          <Field label="No ijazah / STTB asal"><Inp obj={s} k="noIjazahAsal" set={set} /></Field>
          <Field label="Pindahan dari (jika mutasi masuk)" span={2}><Inp obj={s} k="pindahanDari" set={set} /></Field>
          <Field label="Alasan pindah"><Inp obj={s} k="alasanPindah" set={set} /></Field>
          <Field label="Catatan" span={3}><textarea value={s.catatan ?? ''} onChange={(e) => set({ catatan: e.target.value })} rows={3} /></Field>
        </div>
      )}
      {tab === 'keluar' && (
        <div className="form-grid">
          <Field label="Status"><Sel obj={s} k="status" set={set} options={STATUS} /></Field>
          <Field label="Tanggal keluar / lulus"><Inp obj={s} k="tanggalKeluar" set={set} type="date" /></Field>
          <Field label="No ijazah"><Inp obj={s} k="noIjazah" set={set} /></Field>
          <Field label="Alasan keluar / pindah ke" span={2}><Inp obj={s} k="alasanKeluar" set={set} /></Field>
          <Field label="Melanjutkan ke"><Inp obj={s} k="melanjutkanKe" set={set} /></Field>
        </div>
      )}
    </Modal>
  )
}
