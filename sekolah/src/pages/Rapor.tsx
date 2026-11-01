import { useState } from 'react'
import { getKurikulum } from '../curricula'
import { aiSiap, isiNama, variasiHint, panggilAi, promptCatatan, systemPrompt } from '../ai'
import { asesmenSiswa } from '../asesmen'
import { RaporDoc, catatanId, dataRapor } from '../rapor'
import { getState, put, useCol, useSekolah } from '../store'
import type { CatatanRapor, Rombel, Siswa } from '../types'
import { Btn, Card, Empty, Field, Modal, PageHead, printDoc, toast } from '../ui'

export default function Rapor() {
  const sekolah = useSekolah()
  const rombel = useCol('rombel')
  const siswa = useCol('siswa')
  const arsipAll = useCol('arsip')
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
              <thead><tr><th className="num">No</th><th>Nama</th><th>NIS</th><th className="c">Mapel terisi</th>{!kur.naratif && <th className="c">Rata-rata</th>}<th className="c">S / I / A</th><th className="c">Asesmen</th><th className="c">Catatan</th><th></th></tr></thead>
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
                      <td className="c">{(() => {
                        const a = asesmenSiswa(arsipAll, r.tahunAjaran, sem, s.id)
                        const f = a.filter((x) => x.rekam.final).length
                        return a.length ? <span className={`pill ${f === a.length ? 'ok' : 'warn'}`} title={f === a.length ? 'Semua asesmen terkunci dan masuk rapor' : 'Asesmen yang belum dikunci tidak dicetak di rapor'}>{f}/{a.length} terkunci</span> : <span className="pill">-</span>
                      })()}</td>
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
  const arsip = useCol('arsip')
  const id = catatanId(rombel.tahunAjaran, semester, siswa.id)
  const awal = useCol('rapor').find((c) => c.id === id)
  const kur = getKurikulum(rombel.kurikulumId)
  const [c, setC] = useState<CatatanRapor>(awal ?? { id, tahunAjaran: rombel.tahunAjaran, semester, siswaId: siswa.id, rombelId: rombel.id, isian: {}, ekskul: [] })
  const set = (p: Partial<CatatanRapor>) => setC((o) => ({ ...o, ...p }))
  const auto = dataRapor(siswa, rombel, semester).hadir
  const sekolah = useSekolah()
  const [sibuk, setSibuk] = useState(false)
  const CAP: Record<string, string> = { BB: 'Belum Berkembang', MB: 'Mulai Berkembang', BSH: 'Berkembang Sesuai Harapan', BSB: 'Berkembang Sangat Baik' }
  const catatanAi = async () => {
    if (!sekolah.ai) return
    setSibuk(true)
    try {
      const d = dataRapor(siswa, rombel, semester)
      const nil = d.baris.filter((b) => b.hasil.nilai !== undefined)
      const rata = nil.length ? nil.reduce((a, b) => a + (b.hasil.nilai as number), 0) / nil.length : undefined
      const capaian = kur.naratif ? d.baris.map((b) => {
        const lembar = getState().nilai.find((n) => n.id === `${rombel.tahunAjaran}|${semester}|${rombel.id}|${b.mapel.id}`)
        const cp = String(lembar?.data[siswa.id]?.capaian ?? '')
        return cp ? { nama: b.mapel.nama, capaian: CAP[cp] ?? cp } : null
      }).filter((x): x is { nama: string; capaian: string } => !!x) : undefined
      const pr = promptCatatan({
        kelas: rombel.nama, semester, rataRata: rata,
        mapel: d.baris.map((b) => ({ nama: b.mapel.nama, nilai: b.hasil.nilai, kkm: b.mapel.kkm ?? 70 })),
        hadir: { sakit: c.sakitManual ?? d.hadir.sakit, izin: c.izinManual ?? d.hadir.izin, alpa: c.alpaManual ?? d.hadir.alpa },
        ekskul: c.ekskul.filter((e) => e.nama).map((e) => ({ nama: e.nama, predikat: e.predikat })), capaian, teksGuru: c.catatanWali,
        asesmen: asesmenSiswa(getState().arsip, rombel.tahunAjaran, semester, siswa.id).filter((x) => x.rekam.final && x.ringkas.predikat).map((x) => ({ nama: x.inst.nama, ringkas: `${x.ringkas.predikat}. ${x.ringkas.baris.map((b) => `${b.aspek} ${b.skor}/4`).join(', ')}` })),
      })
      if (!nil.length && !capaian?.length) throw new Error('Isi nilai/capaian mata pelajaran dulu agar catatan sesuai penilaian.')
      const t = await panggilAi(sekolah.ai, systemPrompt(sekolah.ai, 'catatan', kur.asal === 'Internasional'), pr + (sekolah.ai.humanize === false ? '' : variasiHint(siswa.id)), 700)
      set({ catatanWali: isiNama(t, siswa.namaPanggilan || siswa.nama.split(' ')[0]) })
      toast('Catatan AI dibuat. Periksa dan sunting sebelum disimpan.')
    } catch (e) { toast((e as Error).message) }
    setSibuk(false)
  }
  const numOrU = (v: string) => (v === '' ? undefined : Number(v))
  return (
    <Modal title={`Catatan Rapor · ${siswa.nama}`} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={async () => { await put('rapor', c); toast('Catatan rapor disimpan'); onClose() }}>Simpan</Btn></>}>
      {kur.isianRapor.some((x) => x.angka) && (() => {
        const ukur = arsip.filter((a) => a.register === 'tumbuh' && a.data.siswa === siswa.id).sort((a, b) => String(b.data.tanggal ?? '').localeCompare(String(a.data.tanggal ?? '')))[0]
        return ukur ? (
          <p className="small">Pengukuran terakhir ({String(ukur.data.tanggal ?? '')}): BB {ukur.data.bb ?? '-'} kg, TB {ukur.data.tb ?? '-'} cm, LK {ukur.data.lk ?? '-'} cm.{' '}
            <button type="button" className="link" onClick={() => set({ isian: { ...c.isian, bb: String(ukur.data.bb ?? ''), tb: String(ukur.data.tb ?? ''), lk: String(ukur.data.lk ?? '') } })}>Pakai data ini</button></p>
        ) : <p className="muted small">Data BB/TB dapat diambil otomatis bila dicatat di Administrasi Anak Didik → Pertumbuhan Anak.</p>
      })()}
      <div className="form-grid">
        {kur.isianRapor.map((x) => (
          <Field key={x.key} label={x.label} span={x.options || x.angka ? 1 : 3}>
            {x.angka
              ? <input type="number" min={0} step="0.1" value={c.isian[x.key] ?? ''} onChange={(e) => set({ isian: { ...c.isian, [x.key]: e.target.value } })} />
              : x.options
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
        {aiSiap(sekolah.ai) && <div className="span-3"><Btn icon="ai" onClick={catatanAi} disabled={sibuk} title="Susun catatan dari seluruh nilai/capaian, kehadiran, dan ekstrakurikuler">{sibuk ? 'Menyusun…' : 'Susun catatan dengan AI'}</Btn> <span className="muted small">Nama tidak dikirim ke AI. Hasil dapat disunting.</span></div>}
        <Field label="Keputusan (akhir tahun)" span={3}><input value={c.keputusan ?? ''} placeholder="mis. Naik ke kelas 5 / Lulus" onChange={(e) => set({ keputusan: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
