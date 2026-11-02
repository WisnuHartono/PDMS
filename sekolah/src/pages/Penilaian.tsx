import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getKurikulum, type Baris } from '../curricula'
import { aiSiap, isiNama, variasiHint, jalankanBatch, panggilAi, promptMapel, promptPaud, systemPrompt } from '../ai'
import { tpScores } from '../curricula'
import { buatNarasi, bintang, kelompokUsia, type Capaian } from '../narasiPaud'
import { put, useCol, useSekolah } from '../store'
import type { LembarNilai } from '../types'
import { Btn, Card, Empty, PageHead, toast } from '../ui'
import { fotoKecil, parseIso } from '../util'

export default function Penilaian() {
  const sekolah = useSekolah()
  const rombel = useCol('rombel')
  const mapel = useCol('mapel')
  const siswa = useCol('siswa')
  const nilai = useCol('nilai')
  const arsip = useCol('arsip')
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
  const [varian, setVarian] = useState<Record<string, number>>({})
  const [sibukAi, setSibukAi] = useState<Record<string, boolean>>({})
  const [progAi, setProgAi] = useState('')
  useEffect(() => {
    setTujuan(ada?.tujuan ?? [])
    setData(ada?.data ?? {})
    setDirty(false)
  }, [id, ada])

  if (!rombelAktif.length) return <div><PageHead title="Penilaian" /><Empty>Belum ada rombel pada tahun ajaran aktif.</Empty></div>
  if (!r || !m) return <div><PageHead title="Penilaian" /><Empty>Belum ada mata pelajaran untuk jenjang {r?.jenjang}. Tambahkan di menu Mata Pelajaran.</Empty></div>

  const anggota = r.siswaIds.map((i) => siswa.find((s) => s.id === i)).filter((s): s is NonNullable<typeof s> => !!s).sort((a, b) => a.nama.localeCompare(b.nama))
  const pakaiTujuan = kur.komponen.some((k) => k.perTujuan) || !!kur.naratif
  const tglRapor = parseIso(sekolah.tanggalRapor ?? new Date().toISOString().slice(0, 10))
  const bank = arsip.filter((a) => a.register === 'bank-narasi')
  const narasiUntuk = (sid: string, variasi = 0) => {
    const sw = siswa.find((x) => x.id === sid)
    const c = data[sid]?.capaian as Capaian | undefined
    if (!sw || !c) return undefined
    return buatNarasi({ nama: sw.namaPanggilan || sw.nama.split(' ')[0], namaMapel: m.nama, capaian: c, tujuan, usia: kelompokUsia(sw.tanggalLahir, tglRapor), bank, variasi, seed: sw.id })
  }
  const narasiSemua = () => {
    let n = 0
    setData((d) => {
      const out = { ...d }
      for (const sw of anggota) {
        if (!out[sw.id]?.capaian || String(out[sw.id]?.deskripsi ?? '').trim()) continue
        const t = narasiUntuk(sw.id)
        if (t) { out[sw.id] = { ...out[sw.id], deskripsi: t }; n++ }
      }
      return out
    })
    setDirty(true)
    setTimeout(() => toast(n ? `${n} narasi dibuat. Periksa dan sunting sebelum disimpan.` : 'Tidak ada baris kosong yang sudah diberi capaian.'), 0)
  }

  const aiOn = aiSiap(sekolah.ai)
  const kunciTeks = kur.komponen.find((k) => k.type === 'text')?.key
  const CAP: Record<string, string> = { BB: 'Belum Berkembang (BB)', MB: 'Mulai Berkembang (MB)', BSH: 'Berkembang Sesuai Harapan (BSH)', BSB: 'Berkembang Sangat Baik (BSB)' }
  /** Skor siap-kirim untuk satu murid; undefined bila belum ada data nilai/capaian. */
  const promptAi = (sid: string) => {
    const sw = siswa.find((x) => x.id === sid)
    const row = data[sid]
    if (!sw || !row || !kunciTeks) return undefined
    const lama = String(row[kunciTeks] ?? '')
    if (kur.naratif) {
      const c = String(row.capaian ?? '')
      if (!c) return undefined
      return promptPaud({ mapel: m.nama, capaian: CAP[c] ?? c, tujuan, usia: kelompokUsia(sw.tanggalLahir, tglRapor), teksGuru: lama })
    }
    const tp = tpScores(row, tujuan)
    const lain = kur.komponen.filter((k) => k.type === 'number' && !k.perTujuan).map((k) => ({ label: k.label, nilai: row[k.key] })).filter((x): x is { label: string; nilai: number } => typeof x.nilai === 'number')
    if (!tp.length && !lain.length) return undefined
    const h = kur.hitung(row, tujuan, kkm)
    return promptMapel({ mapel: m.nama, kelas: r.nama, jenjang: r.jenjang, kurikulum: kur.nama, kkm, tujuan: tp.map((x) => ({ tp: x.t, nilai: x.v })), komponenLain: lain, nilaiAkhir: h.nilai, predikat: h.predikat, teksGuru: lama })
  }
  const narasiAi = async (sid: string) => {
    const sw = siswa.find((x) => x.id === sid)
    const pr = promptAi(sid)
    if (!sw || !pr || !kunciTeks || !sekolah.ai) throw new Error(kur.naratif ? 'Pilih capaian dulu.' : 'Isi nilai dulu.')
    const t = await panggilAi(sekolah.ai, systemPrompt(sekolah.ai, kur.naratif ? 'paud' : 'mapel', kur.asal === 'Internasional'), pr + (sekolah.ai.humanize === false ? '' : variasiHint(sid)))
    setCell(sid, kunciTeks, isiNama(t, sw.namaPanggilan || sw.nama.split(' ')[0]))
  }
  const narasiAiSatu = async (sid: string) => {
    setSibukAi((x) => ({ ...x, [sid]: true }))
    try { await narasiAi(sid); toast('Narasi AI dibuat. Periksa dan sunting sebelum disimpan.') } catch (e) { toast((e as Error).message) }
    setSibukAi((x) => ({ ...x, [sid]: false }))
  }
  const narasiAiSemua = async () => {
    const target = anggota.filter((sw) => promptAi(sw.id) && !String(data[sw.id]?.[kunciTeks ?? ''] ?? '').trim())
    if (!target.length) return toast('Tidak ada baris kosong yang sudah memiliki nilai/capaian.')
    setProgAi(`0/${target.length}`)
    const { gagal, galat } = await jalankanBatch(target, (sw) => narasiAi(sw.id), 3, (n) => setProgAi(`${n}/${target.length}`))
    setProgAi('')
    toast(gagal ? `${target.length - gagal} narasi dibuat, ${gagal} gagal: ${galat}` : `${target.length} narasi AI dibuat. Periksa dan sunting sebelum disimpan.`)
  }

  const gantiModeDesk = (sid: string, mode: 'otomatis' | 'ai' | 'manual', teksSaatIni?: string) => {
    setData((d) => ({ ...d, [sid]: { ...d[sid], modeDesk: mode } }))
    setDirty(true)
    if (mode === 'ai') void narasiAiSatu(sid)
    if (mode === 'manual' && kunciTeks && !String(data[sid]?.[kunciTeks] ?? '').trim() && teksSaatIni) setCell(sid, kunciTeks, teksSaatIni)
  }
  const setCell = (sid: string, key: string, v: string | number | undefined) => {
    setData((d) => {
      const o = { ...d[sid], [key]: v }
      if (!kur.naratif && key === kunciTeks && typeof v === 'string' && v.trim() && o.modeDesk !== 'ai') o.modeDesk = 'manual'
      return { ...d, [sid]: o }
    })
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
        {aiOn && kunciTeks && <Btn icon="ai" onClick={narasiAiSemua} disabled={!!progAi} title="Susun narasi dengan AI untuk baris yang masih kosong, berdasarkan nilai/capaian">{progAi ? `Narasi AI ${progAi}` : 'Narasi AI (yang kosong)'}</Btn>}
        {kur.naratif && <Btn icon="edit" onClick={narasiSemua} title="Isi narasi untuk anak yang capaiannya sudah dipilih tetapi narasinya masih kosong">Buat narasi yang kosong</Btn>}
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
                  {kur.naratif && <th>Bantuan narasi & foto kegiatan</th>}
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
                            <AutoArea rows={kur.naratif ? 2 : 1} lang="id" style={{ width: c.width ?? 240 }} value={String(row?.[c.key] ?? '')} onChange={(e) => setCell(s.id, c.key, e.target.value)} aria-label={`${s.nama} ${c.title}`} />
                          )}
                        </td>
                      ))}
                      {!kur.naratif && <td className={`c strong ${h.nilai !== undefined && h.nilai < kkm ? 'bad-t' : ''}`}>{h.nilai ?? '-'}</td>}
                      {kur.kolomRapor.some((k) => /^(pred\.?|grade|capaian)$/i.test(k.label)) && <td className="c">{h.predikat ?? '-'}{h.extra?.predKet ? ` / ${h.extra.predKet}` : ''}</td>}
                      {!kur.naratif && <td className="small desc">{h.deskripsi || <span className="muted">-</span>}
                        {(
                          <div className="desc-mode">
                            <select value={String(row?.modeDesk ?? 'otomatis')} aria-label={`Mode deskripsi ${s.nama}`} title="Cara mengisi deskripsi rapor"
                              onChange={(e) => gantiModeDesk(s.id, e.target.value as 'otomatis' | 'ai' | 'manual', h.deskripsi)}>
                              <option value="otomatis">Otomatis (bank data)</option>
                              {aiOn && kunciTeks && <option value="ai">Narasi AI</option>}
                              {kunciTeks && <option value="manual">Manual</option>}
                            </select>
                            {(row?.modeDesk ?? 'otomatis') === 'otomatis' && <Btn kind="ghost" icon="refresh" title="Pilih variasi kalimat lain dari bank data" onClick={() => setCell(s.id, 'variasiDesk', (typeof row?.variasiDesk === 'number' ? row.variasiDesk : 0) + 1)}>Variasi</Btn>}
                            {row?.modeDesk === 'ai' && <Btn kind="ghost" icon="ai" disabled={!promptAi(s.id) || sibukAi[s.id]} title="Susun ulang dengan AI dari nilai per TP" onClick={() => narasiAiSatu(s.id)}>{sibukAi[s.id] ? '…' : 'Ulangi AI'}</Btn>}
                          </div>
                        )}</td>}
                      {kur.naratif && (
                        <td className="small">
                          {typeof row?.capaian === 'string' && <div className="bintang" title={String(row.capaian)}>{bintang(row.capaian)}</div>}
                          <Btn kind="ghost" icon="refresh" disabled={!row?.capaian} title={row?.capaian ? 'Susun narasi dari capaian, tujuan pembelajaran, usia, dan bank narasi' : 'Pilih capaian dulu'}
                            onClick={() => { const v = (varian[s.id] ?? 0) + 1; setVarian((x) => ({ ...x, [s.id]: v })); const t = narasiUntuk(s.id, v); if (t) setCell(s.id, 'deskripsi', t) }}>Narasi</Btn>
                          {aiOn && <Btn kind="ghost" icon="ai" disabled={!row?.capaian || sibukAi[s.id]} title="Susun narasi dengan AI dari capaian dan tujuan" onClick={() => narasiAiSatu(s.id)}>{sibukAi[s.id] ? '…' : 'AI'}</Btn>}
                          {typeof row?.foto === 'string'
                            ? <div><img src={row.foto} alt="Foto kegiatan" className="paud-foto" /><Btn kind="ghost" icon="trash" onClick={() => setCell(s.id, 'foto', undefined)}>Foto</Btn></div>
                            : <label className="btn btn-ghost" title="Foto kegiatan untuk rapor"><input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCell(s.id, 'foto', await fotoKecil(f, 640)); e.target.value = '' }} />+ Foto</label>}
                        </td>
                      )}
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

/** Kotak isian yang tingginya otomatis mengikuti isi (tanpa gulir), paragraf rata kanan-kiri. */
function AutoArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }, [props.value, props.style])
  return <textarea ref={ref} className="auto-area" {...props} />
}
