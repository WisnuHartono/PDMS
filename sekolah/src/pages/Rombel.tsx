import { useMemo, useState } from 'react'
import { KURIKULUM, getKurikulum, kurikulumDefault } from '../curricula'
import { put, remove, useCol, useSekolah } from '../store'
import { JENJANG, TINGKAT_PER_JENJANG, type Jenjang, type Rombel } from '../types'
import { Btn, Card, Empty, Field, Inp, Modal, PageHead, Sel, toast } from '../ui'
import { namaPegawai, uid } from '../util'

export default function RombelPage() {
  const sekolah = useSekolah()
  const rombel = useCol('rombel')
  const pegawai = useCol('pegawai')
  const [ta, setTa] = useState(sekolah.tahunAjaranAktif)
  const [edit, setEdit] = useState<Rombel | null>(null)
  const daftarTa = [...new Set([sekolah.tahunAjaranAktif, ...rombel.map((r) => r.tahunAjaran)])].sort().reverse()
  const list = rombel.filter((r) => r.tahunAjaran === ta).sort((a, b) => JENJANG.indexOf(a.jenjang) - JENJANG.indexOf(b.jenjang) || a.nama.localeCompare(b.nama, 'id', { numeric: true }))

  const naikKelas = async () => {
    const [y1] = ta.split('/').map(Number)
    const next = `${y1 + 1}/${y1 + 2}`
    if (rombel.some((r) => r.tahunAjaran === next)) return toast(`Rombel TA ${next} sudah ada`)
    if (!confirm(`Buat rombel TA ${next} dengan menaikkan tingkat semua rombel TA ${ta}? Kelas tingkat akhir tidak disalin.`)) return
    let n = 0
    for (const r of list) {
      const tingkat = TINGKAT_PER_JENJANG[r.jenjang]
      const i = tingkat.indexOf(r.tingkat)
      if (i < 0 || i === tingkat.length - 1) continue
      const t = tingkat[i + 1]
      await put('rombel', { ...r, id: uid(), tahunAjaran: next, tingkat: t, nama: r.nama.replace(r.tingkat, t) })
      n++
    }
    toast(`${n} rombel dibuat untuk TA ${next}`)
    setTa(next)
  }

  return (
    <div>
      <PageHead title="Kelas / Rombongan Belajar" sub="Atur rombel, wali kelas, kurikulum, dan anggota kelas">
        <Btn onClick={naikKelas}>Kenaikan kelas → TA berikutnya</Btn>
        <Btn icon="plus" kind="primary" onClick={() => setEdit({ id: uid(), nama: '', jenjang: sekolah.jenjang[0] ?? 'SD', tingkat: TINGKAT_PER_JENJANG[sekolah.jenjang[0] ?? 'SD'][0], tahunAjaran: ta, kurikulumId: kurikulumDefault(sekolah.jenjang[0] ?? 'SD'), siswaIds: [] })}>Tambah Rombel</Btn>
      </PageHead>
      <Card title={`Rombel TA ${ta}`} actions={<select value={ta} onChange={(e) => setTa(e.target.value)}>{daftarTa.map((t) => <option key={t}>{t}</option>)}</select>}>
        {list.length === 0 ? <Empty>Belum ada rombel untuk tahun ajaran ini.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Rombel</th><th>Jenjang</th><th>Tingkat</th><th>Wali Kelas</th><th>Kurikulum</th><th className="num">Siswa</th><th></th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} onDoubleClick={() => setEdit(r)}>
                    <td><b>{r.nama}</b></td><td>{r.jenjang}</td><td>{r.tingkat}</td>
                    <td>{namaPegawai(pegawai.find((p) => p.id === r.waliKelasId)) || '-'}</td>
                    <td><span className="pill">{getKurikulum(r.kurikulumId).singkat}</span></td>
                    <td className="num">{r.siswaIds.length}</td>
                    <td className="row-actions">
                      <Btn icon="edit" kind="ghost" title="Ubah" onClick={() => setEdit(r)} />
                      <Btn icon="trash" kind="ghost" title="Hapus" onClick={async () => { if (confirm(`Hapus rombel ${r.nama}?`)) await remove('rombel', r.id) }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {edit && <RombelForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function RombelForm({ initial, onClose }: { initial: Rombel; onClose: () => void }) {
  const siswa = useCol('siswa')
  const rombel = useCol('rombel')
  const pegawai = useCol('pegawai')
  const [r, setR] = useState(initial)
  const [q, setQ] = useState('')
  const set = (p: Partial<Rombel>) => setR((o) => ({ ...o, ...p }))

  const diRombelLain = useMemo(() => {
    const m = new Map<string, string>()
    for (const x of rombel) if (x.tahunAjaran === r.tahunAjaran && x.id !== r.id) for (const id of x.siswaIds) m.set(id, x.nama)
    return m
  }, [rombel, r.tahunAjaran, r.id])

  const kandidat = siswa
    .filter((s) => s.status === 'Aktif' && s.jenjang === r.jenjang)
    .filter((s) => !q || s.nama.toLowerCase().includes(q.toLowerCase()) || s.noInduk.includes(q))
    .sort((a, b) => a.nama.localeCompare(b.nama))

  const toggle = (id: string) => set({ siswaIds: r.siswaIds.includes(id) ? r.siswaIds.filter((x) => x !== id) : [...r.siswaIds, id] })
  const kurOk = KURIKULUM.filter((k) => k.jenjang.includes(r.jenjang))

  const simpan = async () => {
    if (!r.nama.trim()) return toast('Nama rombel wajib diisi')
    await put('rombel', r)
    toast('Rombel disimpan')
    onClose()
  }

  return (
    <Modal title={initial.nama ? `Rombel ${initial.nama}` : 'Rombel Baru'} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={simpan}>Simpan</Btn></>}>
      <div className="form-grid">
        <Field label="Nama rombel *"><Inp obj={r} k="nama" set={set} placeholder="mis. 7A, TK B, X IPA 1" autoFocus /></Field>
        <Field label="Jenjang"><select value={r.jenjang} onChange={(e) => { const j = e.target.value as Jenjang; set({ jenjang: j, tingkat: TINGKAT_PER_JENJANG[j][0], kurikulumId: kurikulumDefault(j), siswaIds: [] }) }}>{JENJANG.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <Field label="Tingkat"><Sel obj={r} k="tingkat" set={set} options={TINGKAT_PER_JENJANG[r.jenjang]} /></Field>
        <Field label="Tahun ajaran"><Inp obj={r} k="tahunAjaran" set={set} placeholder="2025/2026" /></Field>
        <Field label="Wali kelas" span={2}><Sel obj={r} k="waliKelasId" set={set} empty="-" options={pegawai.filter((p) => p.aktif && p.jenis === 'Guru').map((p) => [p.id, namaPegawai(p)] as [string, string])} /></Field>
        <Field label="Kurikulum" span={2} hint={getKurikulum(r.kurikulumId).asal === 'Internasional' ? 'Kurikulum internasional: nilai dan rapor memakai format kurikulum tersebut.' : undefined}>
          <Sel obj={r} k="kurikulumId" set={set} options={(kurOk.length ? kurOk : KURIKULUM).map((k) => [k.id, `${k.nama}${k.asal === 'Internasional' ? ' (Int.)' : ''}`] as [string, string])} />
        </Field>
      </div>
      <h4 className="sec">Anggota kelas ({r.siswaIds.length})</h4>
      <div className="filters"><input placeholder="Cari siswa jenjang ini" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="pick-list">
        {kandidat.map((s) => {
          const lain = diRombelLain.get(s.id)
          return (
            <label key={s.id} className={r.siswaIds.includes(s.id) ? 'on' : ''}>
              <input type="checkbox" checked={r.siswaIds.includes(s.id)} onChange={() => toggle(s.id)} />
              <span>{s.nama}</span><span className="muted small">{s.noInduk}</span>
              {lain && <em className="pill warn">di {lain}</em>}
            </label>
          )
        })}
        {!kandidat.length && <p className="muted">Tidak ada siswa aktif pada jenjang {r.jenjang}.</p>}
      </div>
    </Modal>
  )
}
