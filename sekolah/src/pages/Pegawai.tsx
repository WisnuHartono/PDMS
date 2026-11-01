import { useState } from 'react'
import { put, remove, useCol, useSekolah } from '../store'
import { AGAMA, type JenisPegawai, type Pegawai, type StatusKepegawaian } from '../types'
import { Avatar, Btn, Card, Empty, Field, Inp, Modal, PageHead, Sel, toast, tanya } from '../ui'
import { download, fmtTanggal, fotoKecil, namaPegawai, toCsv, uid } from '../util'

const JENIS: JenisPegawai[] = ['Guru', 'Tenaga Kependidikan', 'Yayasan']
const STATUS: StatusKepegawaian[] = ['PNS', 'PPPK', 'GTY/PTY', 'GTT/PTT', 'Honorer', 'Kontrak', 'Lainnya']

export default function PegawaiPage() {
  const pegawai = useCol('pegawai')
  const mapel = useCol('mapel')
  const rombel = useCol('rombel')
  const sekolah = useSekolah()
  const [q, setQ] = useState('')
  const [jenis, setJenis] = useState('')
  const [aktif, setAktif] = useState('1')
  const [edit, setEdit] = useState<Pegawai | null>(null)

  const list = pegawai
    .filter((p) => (!jenis || p.jenis === jenis) && (aktif === '' || p.aktif === (aktif === '1')))
    .filter((p) => { const x = q.toLowerCase(); return !x || p.nama.toLowerCase().includes(x) || (p.nip ?? '').includes(x) || (p.nuptk ?? '').includes(x) })
    .sort((a, b) => a.nama.localeCompare(b.nama))

  // Beban mengajar pada TA aktif dari data pembelajaran rombel
  const ajar = new Map<string, { kode: Set<string>; jp: number }>()
  for (const r of rombel.filter((x) => x.tahunAjaran === sekolah.tahunAjaranAktif)) for (const b of r.pembelajaran ?? []) {
    if (!b.guruId) continue
    const v = ajar.get(b.guruId) ?? { kode: new Set<string>(), jp: 0 }
    const m = mapel.find((x) => x.id === b.mapelId)
    if (m) v.kode.add(m.kode.replace(/^(SD|SMP|SMA|SMK)-/, ''))
    v.jp += b.jp || 0
    ajar.set(b.guruId, v)
  }

  const exportCsv = () => {
    const rows = [['Nama', 'NIP', 'NUPTK', 'JK', 'Jenis', 'Jabatan', 'Status Kepegawaian', 'Pendidikan', 'TMT', 'Telepon', 'Email']]
    for (const p of list) rows.push([namaPegawai(p), p.nip ?? '', p.nuptk ?? '', p.jk, p.jenis, p.jabatan ?? '', p.statusKepegawaian ?? '', p.pendidikanTerakhir ?? '', p.tmt ?? '', p.telepon ?? '', p.email ?? ''])
    download('guru-pegawai.csv', toCsv(rows), 'text/csv')
  }

  return (
    <div>
      <PageHead title="Guru & Pegawai" sub="Pendidik, tenaga kependidikan, dan pegawai yayasan">
        <Btn icon="download" onClick={exportCsv}>Ekspor CSV</Btn>
        <Btn icon="plus" kind="primary" onClick={() => setEdit({ id: uid(), nama: '', jenis: (jenis || 'Guru') as JenisPegawai, jk: 'L', aktif: true })}>Tambah</Btn>
      </PageHead>
      <Card title={`${list.length} orang`} actions={
        <div className="filters">
          <input placeholder="Cari nama / NIP / NUPTK" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={jenis} onChange={(e) => setJenis(e.target.value)}><option value="">Semua jenis</option>{JENIS.map((j) => <option key={j}>{j}</option>)}</select>
          <select value={aktif} onChange={(e) => setAktif(e.target.value)}><option value="1">Aktif</option><option value="0">Nonaktif</option><option value="">Semua</option></select>
        </div>
      }>
        {list.length === 0 ? <Empty>Belum ada data guru / pegawai.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th></th><th>Nama</th><th>NIP</th><th>NUPTK</th><th className="c">L/P</th><th>Jenis</th><th>Jabatan</th><th>Status</th><th>Mapel diampu</th><th className="num">JP</th><th></th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} onDoubleClick={() => setEdit(p)}>
                    <td className="av"><Avatar nama={p.nama} foto={p.foto} size={24} /></td>
                    <td className="nowrap"><b>{namaPegawai(p)}</b></td>
                    <td className="mono nowrap">{p.nip || '-'}</td>
                    <td className="mono nowrap">{p.nuptk || '-'}</td>
                    <td className="c">{p.jk}</td><td className="nowrap">{p.jenis}</td><td className="nowrap">{p.jabatan}</td>
                    <td><span className="pill">{p.statusKepegawaian ?? '-'}</span></td>
                    <td className="small clip" title={[...(ajar.get(p.id)?.kode ?? [])].join(', ')}>{[...(ajar.get(p.id)?.kode ?? (p.mapelIds ?? []).map((id) => mapel.find((m) => m.id === id)?.kode).filter(Boolean))].join(', ') || <span className="muted">-</span>}</td>
                    <td className="num">{ajar.get(p.id)?.jp || <span className="muted">-</span>}</td>
                    <td className="row-actions">
                      <Btn icon="edit" kind="ghost" title="Ubah" onClick={() => setEdit(p)} />
                      <Btn icon="trash" kind="ghost" title="Hapus" onClick={async () => { if (await tanya(`Hapus ${p.nama}?`)) await remove('pegawai', p.id) }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {edit && <PegawaiForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function PegawaiForm({ initial, onClose }: { initial: Pegawai; onClose: () => void }) {
  const mapel = useCol('mapel')
  const rombel = useCol('rombel')
  const sekolah = useSekolah()
  const [p, setP] = useState(initial)
  const set = (x: Partial<Pegawai>) => setP((o) => ({ ...o, ...x }))
  const simpan = async () => {
    if (!p.nama.trim()) return toast('Nama wajib diisi')
    await put('pegawai', p)
    toast('Disimpan')
    onClose()
  }
  const toggleMapel = (id: string) => set({ mapelIds: (p.mapelIds ?? []).includes(id) ? p.mapelIds!.filter((x) => x !== id) : [...(p.mapelIds ?? []), id] })
  return (
    <Modal title={initial.nama ? `Ubah: ${initial.nama}` : 'Guru / Pegawai Baru'} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={simpan}>Simpan</Btn></>}>
      <div className="form-grid">
        <div className="foto-box span-1">
          <Avatar nama={p.nama || '?'} foto={p.foto} size={96} />
          <label className="btn btn-ghost">Pilih foto<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ foto: await fotoKecil(f) }) }} /></label>
        </div>
        <Field label="Gelar depan"><Inp obj={p} k="gelarDepan" set={set} /></Field>
        <Field label="Nama lengkap *"><Inp obj={p} k="nama" set={set} autoFocus /></Field>
        <Field label="Gelar belakang"><Inp obj={p} k="gelarBelakang" set={set} /></Field>
        <Field label="Jenis"><Sel obj={p} k="jenis" set={set} options={JENIS} /></Field>
        <Field label="Jabatan"><Inp obj={p} k="jabatan" set={set} placeholder="Guru Kelas, Kepala TU, …" /></Field>
        <Field label="Status kepegawaian"><Sel obj={p} k="statusKepegawaian" set={set} options={STATUS} empty="-" /></Field>
        <Field label="NIP"><Inp obj={p} k="nip" set={set} /></Field>
        <Field label="NUPTK"><Inp obj={p} k="nuptk" set={set} /></Field>
        <Field label="NIK"><Inp obj={p} k="nik" set={set} /></Field>
        <Field label="Jenis kelamin"><Sel obj={p} k="jk" set={set} options={[['L', 'Laki-laki'], ['P', 'Perempuan']]} /></Field>
        <Field label="Tempat lahir"><Inp obj={p} k="tempatLahir" set={set} /></Field>
        <Field label="Tanggal lahir"><Inp obj={p} k="tanggalLahir" set={set} type="date" /></Field>
        <Field label="Agama"><Sel obj={p} k="agama" set={set} options={AGAMA} empty="-" /></Field>
        <Field label="Pendidikan terakhir"><Inp obj={p} k="pendidikanTerakhir" set={set} /></Field>
        <Field label="Jurusan"><Inp obj={p} k="jurusan" set={set} /></Field>
        <Field label="TMT"><Inp obj={p} k="tmt" set={set} type="date" /></Field>
        <Field label="Telepon"><Inp obj={p} k="telepon" set={set} /></Field>
        <Field label="Email" span={2}><Inp obj={p} k="email" set={set} type="email" /></Field>
        <Field label="Alamat" span={2}><Inp obj={p} k="alamat" set={set} /></Field>
        <Field label="Tugas tambahan" span={2}><Inp obj={p} k="tugasTambahan" set={set} placeholder="Wakasek, Kepala Perpustakaan, Operator, …" /></Field>
        <Field label="No. sertifikat pendidik"><Inp obj={p} k="noSertifikatPendidik" set={set} /></Field>
        <Field label="Tahun sertifikasi"><Inp obj={p} k="tahunSertifikasi" set={set} type="number" /></Field>
        <Field label="Bidang sertifikasi" span={3}><Inp obj={p} k="bidangSertifikasi" set={set} /></Field>
        <Field label="Status"><select value={p.aktif ? '1' : '0'} onChange={(e) => set({ aktif: e.target.value === '1' })}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></Field>
      </div>
      {p.jenis === 'Guru' && mapel.length > 0 && (
        <>
          <h4 className="sec">Mata pelajaran yang diampu</h4>
          <div className="chips">
            {[...mapel].sort((a, b) => a.urutan - b.urutan).map((m) => (
              <label key={m.id} className={`chip ${(p.mapelIds ?? []).includes(m.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={(p.mapelIds ?? []).includes(m.id)} onChange={() => toggleMapel(m.id)} />{m.nama} <span className="muted">({m.jenjang.join('/')})</span>
              </label>
            ))}
          </div>
        </>
      )}
      {p.tmt && <p className="muted small">Masa kerja sejak {fmtTanggal(p.tmt)}</p>}
      {p.jenis === 'Guru' && (() => {
        const tugas = rombel.filter((r) => r.tahunAjaran === sekolah.tahunAjaranAktif).flatMap((r) => (r.pembelajaran ?? []).filter((x) => x.guruId === p.id).map((x) => ({ r, x })))
        const jp = tugas.reduce((a, t) => a + (t.x.jp || 0), 0)
        return (
          <p className="small"><b>Beban kerja TA {sekolah.tahunAjaranAktif}:</b> {jp} JP/minggu {jp > 0 && jp < 24 && !p.tugasTambahan ? <span className="pill warn">di bawah 24 JP</span> : null}
            {tugas.length > 0 && <span className="muted"> · {tugas.map((t) => `${mapel.find((m) => m.id === t.x.mapelId)?.nama ?? '?'} ${t.r.nama} (${t.x.jp})`).join(', ')}</span>}
            {!tugas.length && <span className="muted"> · atur di Kelas / Rombel → Pembelajaran</span>}
          </p>
        )
      })()}
    </Modal>
  )
}
