import { useState } from 'react'
import { put, remove, useCol } from '../store'
import { JENJANG, type Jenjang, type Mapel } from '../types'
import { Btn, Card, Empty, Field, Inp, Modal, PageHead, toast, tanya } from '../ui'
import { uid } from '../util'

export default function MapelPage() {
  const mapel = useCol('mapel')
  const [jenjang, setJenjang] = useState('')
  const [edit, setEdit] = useState<Mapel | null>(null)
  const list = mapel.filter((m) => !jenjang || m.jenjang.includes(jenjang as Jenjang)).sort((a, b) => a.urutan - b.urutan)
  return (
    <div>
      <PageHead title="Mata Pelajaran" sub="Mapel, elemen capaian PAUD, atau subject kurikulum internasional, beserta KKM/KKTP">
        <Btn icon="plus" kind="primary" onClick={() => setEdit({ id: uid(), kode: '', nama: '', jenjang: jenjang ? [jenjang as Jenjang] : ['SD'], urutan: (mapel.reduce((a, m) => Math.max(a, m.urutan), 0) || 0) + 1, kkm: 70 })}>Tambah Mapel</Btn>
      </PageHead>
      <Card title={`${list.length} mata pelajaran`} actions={<select value={jenjang} onChange={(e) => setJenjang(e.target.value)}><option value="">Semua jenjang</option>{JENJANG.map((j) => <option key={j}>{j}</option>)}</select>}>
        {!list.length ? <Empty>Belum ada mata pelajaran.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th className="num">Urut</th><th>Kode</th><th>Nama</th><th>Kelompok</th><th>Jenjang</th><th className="num">KKM/KKTP</th><th></th></tr></thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id} onDoubleClick={() => setEdit(m)}>
                    <td className="num">{m.urutan}</td><td>{m.kode}</td><td><b>{m.nama}</b></td><td>{m.kelompok}</td><td>{m.jenjang.join(', ')}</td><td className="num">{m.kkm ?? '-'}</td>
                    <td className="row-actions">
                      <Btn icon="edit" kind="ghost" title="Ubah" onClick={() => setEdit(m)} />
                      <Btn icon="trash" kind="ghost" title="Hapus" onClick={async () => { if (await tanya(`Hapus ${m.nama}?`)) await remove('mapel', m.id) }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {edit && <MapelForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function MapelForm({ initial, onClose }: { initial: Mapel; onClose: () => void }) {
  const [m, setM] = useState(initial)
  const set = (p: Partial<Mapel>) => setM((o) => ({ ...o, ...p }))
  const toggle = (j: Jenjang) => set({ jenjang: m.jenjang.includes(j) ? m.jenjang.filter((x) => x !== j) : [...m.jenjang, j] })
  return (
    <Modal title={initial.nama ? `Ubah ${initial.nama}` : 'Mata Pelajaran Baru'} onClose={onClose} footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={async () => { if (!m.nama.trim()) return toast('Nama wajib diisi'); await put('mapel', m); onClose() }}>Simpan</Btn></>}>
      <div className="form-grid">
        <Field label="Kode"><Inp obj={m} k="kode" set={set} /></Field>
        <Field label="Nama *" span={2}><Inp obj={m} k="nama" set={set} autoFocus /></Field>
        <Field label="Kelompok"><Inp obj={m} k="kelompok" set={set} placeholder="Umum / Muatan Lokal / Peminatan" /></Field>
        <Field label="Urutan di rapor"><Inp obj={m} k="urutan" set={set} type="number" /></Field>
        <Field label="KKM / KKTP"><Inp obj={m} k="kkm" set={set} type="number" min={0} max={100} /></Field>
      </div>
      <h4 className="sec">Berlaku untuk jenjang</h4>
      <div className="chips">
        {JENJANG.map((j) => <label key={j} className={`chip ${m.jenjang.includes(j) ? 'on' : ''}`}><input type="checkbox" checked={m.jenjang.includes(j)} onChange={() => toggle(j)} />{j}</label>)}
      </div>
    </Modal>
  )
}
