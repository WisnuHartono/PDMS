import { useEffect, useMemo, useState } from 'react'
import { getKurikulum, type Baris } from '../curricula'
import { put, useCol, useSekolah } from '../store'
import type { LembarNilai } from '../types'
import { Btn, Card, Empty, PageHead, toast } from '../ui'

export default function Penilaian() {
  const sekolah = useSekolah()
  const rombel = useCol('rombel')
  const mapel = useCol('mapel')
  const siswa = useCol('siswa')
  const nilai = useCol('nilai')
  const rombelAktif = rombel.filter((r) => r.tahunAjaran === sekolah.tahunAjaranAktif).sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true }))
  const [rid, setRid] = useState('')
  const [mid, setMid] = useState('')
  const [sem, setSem] = useState<1 | 2>(sekolah.semesterAktif)
  useEffect(() => setSem(sekolah.semesterAktif), [sekolah.semesterAktif])

  const r = rombelAktif.find((x) => x.id === rid) ?? rombelAktif[0]
  const mapelR = useMemo(() => (r ? mapel.filter((m) => m.jenjang.includes(r.jenjang)).sort((a, b) => a.urutan - b.urutan) : []), [mapel, r])
  const m = mapelR.find((x) => x.id === mid) ?? mapelR[0]
  const kur = getKurikulum(r?.kurikulumId)
  const kkm = m?.kkm ?? 70
  const id = r && m ? `${r.tahunAjaran}|${sem}|${r.id}|${m.id}` : ''
  const ada = nilai.find((n) => n.id === id)

  const [tujuan, setTujuan] = useState<string[]>([])
  const [data, setData] = useState<LembarNilai['data']>({})
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    setTujuan(ada?.tujuan ?? [])
    setData(ada?.data ?? {})
    setDirty(false)
  }, [id, ada])

  if (!rombelAktif.length) return <div><PageHead title="Penilaian" /><Empty>Belum ada rombel pada tahun ajaran aktif.</Empty></div>
  if (!r || !m) return <div><PageHead title="Penilaian" /><Empty>Belum ada mata pelajaran untuk jenjang {r?.jenjang}. Tambahkan di menu Mata Pelajaran.</Empty></div>

  const anggota = r.siswaIds.map((i) => siswa.find((s) => s.id === i)).filter((s): s is NonNullable<typeof s> => !!s).sort((a, b) => a.nama.localeCompare(b.nama))
  const pakaiTujuan = kur.komponen.some((k) => k.perTujuan)

  const setCell = (sid: string, key: string, v: string | number | undefined) => {
    setData((d) => ({ ...d, [sid]: { ...d[sid], [key]: v } }))
    setDirty(true)
  }
  const simpan = async () => {
    await put('nilai', { id, tahunAjaran: r.tahunAjaran, semester: sem, rombelId: r.id, mapelId: m.id, tujuan, data })
    setDirty(false)
    toast(`Nilai ${m.nama} ${r.nama} disimpan`)
  }

  const cols = kur.komponen.flatMap((k) => (k.perTujuan ? tujuan.map((t, i) => ({ ...k, key: `tp${i}`, label: `${k.perTujuan ? 'TP' : ''}${i + 1}`, title: t })) : [{ ...k, title: k.label }]))

  return (
    <div>
      <PageHead title="Penilaian" sub={`${kur.nama}${kur.naratif ? '' : ` · KKM/KKTP ${kkm}`} · TA ${r.tahunAjaran} Semester ${sem}`}>
        <Btn kind="primary" onClick={simpan} disabled={!dirty}>{ada && !dirty ? 'Tersimpan' : 'Simpan nilai'}</Btn>
      </PageHead>
      <div className="filters bar">
        <select value={r.id} onChange={(e) => { setRid(e.target.value); setMid('') }} aria-label="Rombel">{rombelAktif.map((x) => <option key={x.id} value={x.id}>{x.nama} ({x.jenjang})</option>)}</select>
        <select value={m.id} onChange={(e) => setMid(e.target.value)} aria-label="Mata pelajaran">{mapelR.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select>
        <select value={sem} onChange={(e) => setSem(Number(e.target.value) as 1 | 2)} aria-label="Semester"><option value={1}>Semester 1 (Ganjil)</option><option value={2}>Semester 2 (Genap)</option></select>
      </div>

      {pakaiTujuan && (
        <Card title={kur.istilahTujuan} className="mb">
          <ol className="tp-list">
            {tujuan.map((t, i) => (
              <li key={i}>
                <input value={t} placeholder={`Rumusan ${kur.istilahTujuan.split(' (')[0].toLowerCase()} ${i + 1}`} onChange={(e) => { const n = [...tujuan]; n[i] = e.target.value; setTujuan(n); setDirty(true) }} />
                <Btn icon="trash" kind="ghost" title="Hapus" onClick={() => {
                  // geser nilai tp setelah indeks i agar tetap sejajar
                  const n = tujuan.filter((_, j) => j !== i)
                  setData((d) => Object.fromEntries(Object.entries(d).map(([sid, row]) => {
                    const nr: Baris = { ...row }
                    for (let j = i; j < tujuan.length; j++) nr[`tp${j}`] = row[`tp${j + 1}`]
                    delete nr[`tp${tujuan.length - 1}`]
                    return [sid, nr]
                  })))
                  setTujuan(n); setDirty(true)
                }} />
              </li>
            ))}
          </ol>
          <Btn icon="plus" onClick={() => { setTujuan([...tujuan, '']); setDirty(true) }}>Tambah {kur.istilahTujuan.split(' (')[0].toLowerCase()}</Btn>
          {!tujuan.length && <p className="muted small">Tambahkan minimal satu {kur.istilahTujuan.split(' (')[0].toLowerCase()} agar kolom nilai per tujuan muncul dan deskripsi rapor bisa dibuat otomatis.</p>}
        </Card>
      )}

      <Card title={`${m.nama} · ${r.nama}`}>
        {!anggota.length ? <Empty>Rombel ini belum memiliki anggota.</Empty> : (
          <div className="table-wrap">
            <table className="tbl nilai-tbl">
              <thead>
                <tr>
                  <th className="num">No</th><th>Nama</th>
                  {cols.map((c) => <th key={c.key} title={c.title} className="c">{c.label}</th>)}
                  {!kur.naratif && <th className="c">Nilai Akhir</th>}
                  {kur.kolomRapor.some((k) => /^(pred\.?|grade|capaian)$/i.test(k.label)) && <th className="c">Predikat</th>}
                  {!kur.naratif && <th>Deskripsi rapor (otomatis)</th>}
                </tr>
              </thead>
              <tbody>
                {anggota.map((s, i) => {
                  const row = data[s.id]
                  const h = kur.hitung(row, tujuan, kkm)
                  return (
                    <tr key={s.id}>
                      <td className="num">{i + 1}</td><td className="nowrap"><b>{s.nama}</b></td>
                      {cols.map((c) => (
                        <td key={c.key} className="c">
                          {c.type === 'number' && (
                            <input className={`num-in ${typeof row?.[c.key] === 'number' && (row[c.key] as number) < kkm ? 'below' : ''}`} type="number" min={0} max={100} value={row?.[c.key] ?? ''}
                              onChange={(e) => setCell(s.id, c.key, e.target.value === '' ? undefined : Math.max(0, Math.min(100, Number(e.target.value))))} aria-label={`${s.nama} ${c.title}`} />
                          )}
                          {c.type === 'select' && (
                            <select value={String(row?.[c.key] ?? '')} onChange={(e) => setCell(s.id, c.key, e.target.value || undefined)} aria-label={`${s.nama} ${c.title}`}>
                              <option value="">-</option>{c.options?.map((o) => <option key={o}>{o}</option>)}
                            </select>
                          )}
                          {c.type === 'text' && (
                            <textarea rows={kur.naratif ? 2 : 1} style={{ width: c.width ?? 240 }} value={String(row?.[c.key] ?? '')} onChange={(e) => setCell(s.id, c.key, e.target.value)} aria-label={`${s.nama} ${c.title}`} />
                          )}
                        </td>
                      ))}
                      {!kur.naratif && <td className={`c strong ${h.nilai !== undefined && h.nilai < kkm ? 'bad-t' : ''}`}>{h.nilai ?? '-'}</td>}
                      {kur.kolomRapor.some((k) => /^(pred\.?|grade|capaian)$/i.test(k.label)) && <td className="c">{h.predikat ?? '-'}{h.extra?.predKet ? ` / ${h.extra.predKet}` : ''}</td>}
                      {!kur.naratif && <td className="small desc">{h.deskripsi || <span className="muted">-</span>}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
