import { useState } from 'react'
import { getKurikulum } from '../curricula'
import { RaporDoc, catatanId, dataRapor } from '../rapor'
import { put, useCol, useSekolah } from '../store'
import type { CatatanRapor, Rombel, Siswa } from '../types'
import { Btn, Card, Empty, Field, Modal, PageHead, printDoc, toast } from '../ui'

export default function Rapor() {
  const sekolah = useSekolah()
  const rombel = useCol('rombel')
  const siswa = useCol('siswa')
  useCol('nilai'); useCol('rapor'); useCol('absensi') // render ulang saat data berubah
  const rombelAktif = rombel.filter((r) => r.tahunAjaran === sekolah.tahunAjaranAktif).sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true }))
  const [rid, setRid] = useState('')
  const [sem, setSem] = useState<1 | 2>(sekolah.semesterAktif)
  const [edit, setEdit] = useState<Siswa | null>(null)
  const r = rombelAktif.find((x) => x.id === rid) ?? rombelAktif[0]
  if (!r) return <div><PageHead title="Cetak Rapor" /><Empty>Belum ada rombel pada tahun ajaran aktif.</Empty></div>
  const anggota = r.siswaIds.map((i) => siswa.find((s) => s.id === i)).filter((s): s is Siswa => !!s).sort((a, b) => a.nama.localeCompare(b.nama))
  const kur = getKurikulum(r.kurikulumId)

  const cetak = (list: Siswa[]) => printDoc(<>{list.map((s) => <RaporDoc key={s.id} siswa={s} rombel={r} semester={sem} />)}</>)

  return (
    <div>
      <PageHead title="Cetak Rapor" sub={`${kur.nama} · ${r.nama} · TA ${r.tahunAjaran} Semester ${sem}`}>
        <Btn icon="print" kind="primary" onClick={() => cetak(anggota)} disabled={!anggota.length}>Cetak semua ({anggota.length})</Btn>
      </PageHead>
      <div className="filters bar">
        <select value={r.id} onChange={(e) => setRid(e.target.value)} aria-label="Rombel">{rombelAktif.map((x) => <option key={x.id} value={x.id}>{x.nama} ({x.jenjang})</option>)}</select>
        <select value={sem} onChange={(e) => setSem(Number(e.target.value) as 1 | 2)} aria-label="Semester"><option value={1}>Semester 1 (Ganjil)</option><option value={2}>Semester 2 (Genap)</option></select>
      </div>
      <Card title={`Peserta didik ${r.nama}`}>
        {!anggota.length ? <Empty>Rombel belum memiliki anggota.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th className="num">No</th><th>Nama</th><th>NIS</th><th className="c">Mapel terisi</th>{!kur.naratif && <th className="c">Rata-rata</th>}<th className="c">S / I / A</th><th className="c">Catatan</th><th></th></tr></thead>
              <tbody>
                {anggota.map((s, i) => {
                  const d = dataRapor(s, r, sem)
                  const terisi = d.baris.filter((b) => b.ada).length
                  const nil = d.baris.map((b) => b.hasil.nilai).filter((x): x is number => x !== undefined)
                  return (
                    <tr key={s.id}>
                      <td className="num">{i + 1}</td><td><b>{s.nama}</b></td><td>{s.noInduk}</td>
                      <td className="c"><span className={`pill ${terisi === d.baris.length ? 'ok' : 'warn'}`}>{terisi}/{d.baris.length}</span></td>
                      {!kur.naratif && <td className="c">{nil.length ? (nil.reduce((a, b) => a + b, 0) / nil.length).toFixed(1) : '-'}</td>}
                      <td className="c">{d.hadir.sakit} / {d.hadir.izin} / {d.hadir.alpa}</td>
                      <td className="c">{d.catatan?.catatanWali ? <span className="pill ok">Ada</span> : <span className="pill">Belum</span>}</td>
                      <td className="row-actions">
                        <Btn icon="edit" kind="ghost" onClick={() => setEdit(s)}>Catatan</Btn>
                        <Btn icon="print" kind="ghost" onClick={() => cetak([s])}>Cetak</Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {edit && <CatatanForm siswa={edit} rombel={r} semester={sem} onClose={() => setEdit(null)} />}
    </div>
  )
}

function CatatanForm({ siswa, rombel, semester, onClose }: { siswa: Siswa; rombel: Rombel; semester: 1 | 2; onClose: () => void }) {
  const ekskul = useCol('ekskul')
  const id = catatanId(rombel.tahunAjaran, semester, siswa.id)
  const awal = useCol('rapor').find((c) => c.id === id)
  const kur = getKurikulum(rombel.kurikulumId)
  const [c, setC] = useState<CatatanRapor>(awal ?? { id, tahunAjaran: rombel.tahunAjaran, semester, siswaId: siswa.id, rombelId: rombel.id, isian: {}, ekskul: [] })
  const set = (p: Partial<CatatanRapor>) => setC((o) => ({ ...o, ...p }))
  const auto = dataRapor(siswa, rombel, semester).hadir
  const numOrU = (v: string) => (v === '' ? undefined : Number(v))
  return (
    <Modal title={`Catatan Rapor · ${siswa.nama}`} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={async () => { await put('rapor', c); toast('Catatan rapor disimpan'); onClose() }}>Simpan</Btn></>}>
      <div className="form-grid">
        {kur.isianRapor.map((x) => (
          <Field key={x.key} label={x.label} span={x.options ? 1 : 3}>
            {x.options
              ? <select value={c.isian[x.key] ?? ''} onChange={(e) => set({ isian: { ...c.isian, [x.key]: e.target.value } })}><option value="">-</option>{x.options.map((o) => <option key={o}>{o}</option>)}</select>
              : <textarea rows={2} value={c.isian[x.key] ?? ''} onChange={(e) => set({ isian: { ...c.isian, [x.key]: e.target.value } })} />}
          </Field>
        ))}
      </div>
      <h4 className="sec">Ekstrakurikuler</h4>
      {c.ekskul.map((e, i) => (
        <div key={i} className="filters">
          <select value={e.nama} onChange={(x) => { const n = [...c.ekskul]; n[i] = { ...e, nama: x.target.value }; set({ ekskul: n }) }}>
            <option value="">-</option>{ekskul.map((k) => <option key={k.id}>{k.nama}</option>)}{e.nama && !ekskul.some((k) => k.nama === e.nama) && <option>{e.nama}</option>}
          </select>
          <select value={e.predikat} onChange={(x) => { const n = [...c.ekskul]; n[i] = { ...e, predikat: x.target.value }; set({ ekskul: n }) }}>
            <option value="">Predikat</option>{['Sangat Baik', 'Baik', 'Cukup', 'Kurang'].map((p) => <option key={p}>{p}</option>)}
          </select>
          <input placeholder="Keterangan" value={e.ket ?? ''} onChange={(x) => { const n = [...c.ekskul]; n[i] = { ...e, ket: x.target.value }; set({ ekskul: n }) }} />
          <Btn icon="trash" kind="ghost" onClick={() => set({ ekskul: c.ekskul.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <Btn icon="plus" onClick={() => set({ ekskul: [...c.ekskul, { nama: ekskul[0]?.nama ?? '', predikat: 'Baik' }] })}>Tambah ekskul</Btn>
      <h4 className="sec">Ketidakhadiran</h4>
      <p className="muted small">Otomatis dari absensi semester ini: sakit {auto.sakit}, izin {auto.izin}, alpa {auto.alpa}. Isi kolom di bawah hanya jika ingin mengganti angka otomatis.</p>
      <div className="form-grid">
        <Field label="Sakit (manual)"><input type="number" min={0} value={c.sakitManual ?? ''} onChange={(e) => set({ sakitManual: numOrU(e.target.value) })} /></Field>
        <Field label="Izin (manual)"><input type="number" min={0} value={c.izinManual ?? ''} onChange={(e) => set({ izinManual: numOrU(e.target.value) })} /></Field>
        <Field label="Alpa (manual)"><input type="number" min={0} value={c.alpaManual ?? ''} onChange={(e) => set({ alpaManual: numOrU(e.target.value) })} /></Field>
      </div>
      <div className="form-grid">
        <Field label="Catatan wali kelas" span={3}><textarea rows={3} value={c.catatanWali ?? ''} onChange={(e) => set({ catatanWali: e.target.value })} /></Field>
        <Field label="Keputusan (akhir tahun)" span={3}><input value={c.keputusan ?? ''} placeholder="mis. Naik ke kelas 5 / Lulus" onChange={(e) => set({ keputusan: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
