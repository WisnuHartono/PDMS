import { useEffect, useMemo, useState } from 'react'
import { aiSiap, isiNama, panggilAi, promptAsesmen, systemPrompt, variasiHint } from '../ai'
import { INSTRUMEN_BAWAAN, SKALA, bacaRekam, catatRiwayat, deskriptor, idRekam, kelengkapan, labelSkor, REG_ASESMEN, ringkasan, semuaInstrumen, simpanInstrumen, tulisRekam, type Aspek, type Instrumen, type Rekam } from '../asesmen'
import { put, remove, useCol, useSekolah } from '../store'
import { useSesi } from '../security/sesi'
import type { Siswa } from '../types'
import { Btn, Card, Empty, Field, Modal, PageHead, tanya, toast } from '../ui'
import { today, uid } from '../util'

export default function Asesmen() {
  const sekolah = useSekolah()
  const rombel = useCol('rombel')
  const siswa = useCol('siswa')
  const arsip = useCol('arsip')
  const sesi = useSesi()
  const rombelAktif = rombel.filter((r) => r.tahunAjaran === sekolah.tahunAjaranAktif).sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true }))
  const [rid, setRid] = useState('')
  const [sem, setSem] = useState<1 | 2>(sekolah.semesterAktif)
  const [iid, setIid] = useState('sikap')
  const [drafts, setDrafts] = useState<Record<string, Rekam>>({})
  const [detail, setDetail] = useState<Siswa | null>(null)
  const [kelola, setKelola] = useState(false)
  const [pilih, setPilih] = useState(false)
  const [antrian, setAntrian] = useState<string[]>([])
  const [rubrik, setRubrik] = useState(false)
  const insts = useMemo(() => semuaInstrumen(arsip), [arsip])
  const inst = insts.find((i) => i.id === iid) ?? insts[0]
  const r = rombelAktif.find((x) => x.id === rid) ?? rombelAktif[0]
  const penilai = sesi?.akun.nama ?? '-'
  const bisaBuka = sesi?.akun.peranId === 'admin' || sesi?.akun.peranId === 'kepsek'
  useEffect(() => setDrafts({}), [r?.id, sem, inst?.id])

  if (!r || !inst) return <div><PageHead title="Asesmen Siswa" /><Empty>Belum ada rombel pada tahun ajaran aktif.</Empty></div>

  const anggota = r.siswaIds.map((i) => siswa.find((s) => s.id === i)).filter((s): s is Siswa => !!s).sort((a, b) => a.nama.localeCompare(b.nama))
  const arsipDari = (sid: string) => arsip.find((a) => a.id === idRekam(r.tahunAjaran, sem, inst.id, sid))
  const rekam = (sid: string) => drafts[sid] ?? bacaRekam(arsipDari(sid))
  const meta = (sid: string) => ({ ta: r.tahunAjaran, sem, rombelId: r.id, instrumenId: inst.id, siswaId: sid })

  const ubah = (sid: string, fn: (x: Rekam) => Rekam) => setDrafts((d) => ({ ...d, [sid]: fn(d[sid] ?? bacaRekam(arsipDari(sid))) }))
  const setSkor = (sid: string, key: string, v: number | undefined) => ubah(sid, (x) => { const skor = { ...x.skor }; if (v) skor[key] = v; else delete skor[key]; return { ...x, skor } })

  const simpanSiswa = async (sid: string, patch?: Partial<Rekam>) => {
    const lamaArsip = arsipDari(sid)
    const lama = bacaRekam(lamaArsip)
    const baru: Rekam = { ...rekam(sid), ...patch, penilai, tanggal: today() }
    baru.riwayat = catatRiwayat(lama, baru, penilai, inst.aspek)
    await put('arsip', tulisRekam(idRekam(r.tahunAjaran, sem, inst.id, sid), meta(sid), baru, lamaArsip))
    setDrafts((d) => { const n = { ...d }; delete n[sid]; return n })
  }
  const simpanSemua = async () => {
    const ids = Object.keys(drafts)
    for (const sid of ids) await simpanSiswa(sid)
    toast(ids.length ? `Asesmen ${ids.length} siswa disimpan` : 'Tidak ada perubahan')
  }
  const kunci = async (sid: string) => {
    const k = kelengkapan(inst, rekam(sid))
    if (!k.bisaFinal) return toast(k.terisi < k.total ? `Lengkapi dulu semua aspek (${k.terisi}/${k.total}).` : `Isi bukti/catatan untuk skor ekstrem: ${k.butuhBukti.join(', ')}.`)
    await simpanSiswa(sid, { final: true })
    toast('Asesmen dikunci dan akan masuk rapor')
  }
  const buka = async (sid: string) => {
    if (!bisaBuka) return toast('Hanya Administrator atau Kepala Sekolah yang dapat membuka kunci.')
    if (!(await tanya('Buka kunci asesmen ini? Perubahan setelahnya akan tercatat di riwayat.', 'Buka kunci'))) return
    await simpanSiswa(sid, { final: false })
  }
  const kunciSemua = async () => {
    let n = 0
    for (const s of anggota) { const x = rekam(s.id); if (!x.final && kelengkapan(inst, x).bisaFinal) { await simpanSiswa(s.id, { final: true }); n++ } }
    toast(n ? `${n} asesmen dikunci` : 'Tidak ada yang siap dikunci (lengkapi aspek dan bukti dulu).')
  }

  const mulai = (ids: string[]) => { const urut = anggota.filter((x) => ids.includes(x.id)); if (!urut.length) return toast('Pilih minimal satu siswa.'); setAntrian(urut.map((x) => x.id)); setDetail(urut[0]); setPilih(false) }
  const daftar = antrian.length ? antrian : anggota.map((x) => x.id)
  const idxDetail = detail ? daftar.indexOf(detail.id) : -1
  const pindah = (d: number) => { const t = anggota.find((x) => x.id === daftar[idxDetail + d]); if (t) setDetail(t) }

  const final = anggota.filter((s) => rekam(s.id).final).length
  const terisi = anggota.filter((s) => kelengkapan(inst, rekam(s.id)).terisi > 0).length
  const nDraft = Object.keys(drafts).length

  return (
    <div>
      <PageHead title="Asesmen Siswa" sub={`${inst.nama} · ${r.nama} · TA ${r.tahunAjaran} Semester ${sem} · hasil terkunci masuk rapor`}>
        <Btn kind="primary" icon="edit" onClick={() => setPilih(true)} disabled={!anggota.length}>Lakukan asesmen</Btn>
        <Btn icon="edit" onClick={() => setKelola(true)}>Kelola instrumen</Btn>
        <Btn icon="kunci" onClick={kunciSemua}>Kunci yang lengkap</Btn>
        <Btn onClick={simpanSemua} disabled={!nDraft}>{nDraft ? `Simpan (${nDraft})` : 'Tersimpan'}</Btn>
      </PageHead>
      <div className="filters bar">
        <select value={r.id} onChange={(e) => setRid(e.target.value)} aria-label="Rombel">{rombelAktif.map((x) => <option key={x.id} value={x.id}>{x.nama} ({x.jenjang})</option>)}</select>
        <select value={inst.id} onChange={(e) => setIid(e.target.value)} aria-label="Instrumen">{insts.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select>
        <select value={sem} onChange={(e) => setSem(Number(e.target.value) as 1 | 2)} aria-label="Semester"><option value={1}>Semester 1 (Ganjil)</option><option value={2}>Semester 2 (Genap)</option></select>
        <Btn kind="ghost" icon="help" onClick={() => setRubrik((x) => !x)}>{rubrik ? 'Tutup rubrik' : 'Lihat rubrik & cara menilai'}</Btn>
        <span className="muted small">{terisi}/{anggota.length} diisi · <b>{final}</b> terkunci</span>
      </div>

      {rubrik && <Rubrik inst={inst} />}

      <Card title={`${inst.nama}`} actions={<span className="muted small">{inst.ket}</span>}>
        {!anggota.length ? <Empty>Rombel ini belum memiliki anggota.</Empty> : (
          <div className="table-wrap">
            <table className="tbl asm-tbl">
              <thead>
                <tr>
                  <th className="num">No</th><th>Nama</th>
                  {inst.aspek.map((a) => <th key={a.key} className="c" title={a.perilaku}>{a.label.length > 22 ? `${a.label.slice(0, 20)}…` : a.label}</th>)}
                  <th className="c">Predikat</th><th className="c">Bukti</th><th className="c">Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {anggota.map((s, i) => {
                  const x = rekam(s.id)
                  const k = kelengkapan(inst, x)
                  const ring = ringkasan(inst, x)
                  return (
                    <tr key={s.id} className={x.final ? 'asm-final' : ''}>
                      <td className="num">{i + 1}</td><td className="nowrap"><b>{s.nama}</b></td>
                      {inst.aspek.map((a) => (
                        <td key={a.key} className="c">
                          <select className={`asm-sel sk-${x.skor[a.key] ?? 0}`} value={x.skor[a.key] ?? ''} disabled={x.final} title={x.skor[a.key] ? deskriptor(a, x.skor[a.key] as 1) : a.perilaku}
                            onChange={(e) => setSkor(s.id, a.key, e.target.value ? Number(e.target.value) : undefined)} aria-label={`${s.nama} ${a.label}`}>
                            <option value="">-</option>{SKALA.map((o) => <option key={o.n} value={o.n}>{o.n}</option>)}
                          </select>
                        </td>
                      ))}
                      <td className="c small">{ring.predikat ?? '-'}</td>
                      <td className="c">{k.butuhBukti.length ? <span className="pill warn" title={`Perlu bukti: ${k.butuhBukti.join(', ')}`}>{k.butuhBukti.length} perlu</span> : <span className="pill ok">OK</span>}</td>
                      <td className="c">{x.final ? <span className="pill ok">Terkunci</span> : drafts[s.id] ? <span className="pill warn">Belum disimpan</span> : <span className="pill">{k.terisi}/{k.total}</span>}</td>
                      <td className="row-actions">
                        <Btn kind="ghost" icon="edit" onClick={() => setDetail(s)}>Panduan</Btn>
                        {x.final ? <Btn kind="ghost" icon="kunci" title="Buka kunci" onClick={() => buka(s.id)} /> : <Btn kind="ghost" icon="validasi" title="Kunci agar masuk rapor" onClick={() => kunci(s.id)}>Kunci</Btn>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">Skala: {SKALA.map((s) => `${s.n} = ${s.label}`).join(' · ')}. Skor 1 dan 4 wajib disertai bukti/catatan observasi. Setiap perubahan mencatat penilai, tanggal, dan riwayat.</p>
      </Card>

      {detail && (
        <PanduanSiswa key={detail.id + inst.id} siswa={detail} inst={inst} kelas={r.nama} rekam={rekam(detail.id)} onChange={(fn) => ubah(detail.id, fn)}
          onSimpan={async () => { await simpanSiswa(detail.id); toast('Asesmen disimpan') }} onKunci={() => kunci(detail.id)} onClose={() => { setDetail(null); setAntrian([]) }}
          posisi={idxDetail >= 0 ? `Siswa ${idxDetail + 1} dari ${daftar.length}` : undefined}
          onSebelum={idxDetail > 0 ? () => pindah(-1) : undefined}
          onBerikut={idxDetail >= 0 && idxDetail < daftar.length - 1 ? async () => { if (!rekam(detail.id).final) await simpanSiswa(detail.id); pindah(1) } : undefined} />
      )}
      {pilih && <PilihSiswa anggota={anggota} final={(id) => rekam(id).final} terisi={(id) => kelengkapan(inst, rekam(id)).terisi} total={inst.aspek.length} onMulai={mulai} onClose={() => setPilih(false)} />}
      {kelola && <KelolaInstrumen onClose={() => setKelola(false)} onPilih={(id) => { setIid(id); setKelola(false) }} />}
    </div>
  )
}

function PilihSiswa({ anggota, final, terisi, total, onMulai, onClose }: { anggota: Siswa[]; final: (id: string) => boolean; terisi: (id: string) => number; total: number; onMulai: (ids: string[]) => void; onClose: () => void }) {
  const [sel, setSel] = useState<string[]>(() => anggota.filter((s) => !final(s.id)).map((s) => s.id))
  const [cari, setCari] = useState('')
  const tampil = anggota.filter((s) => s.nama.toLowerCase().includes(cari.toLowerCase()))
  const tog = (id: string) => setSel((x) => x.includes(id) ? x.filter((i) => i !== id) : [...x, id])
  return (
    <Modal title="Pilih siswa yang akan dinilai" onClose={onClose}
      footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={() => onMulai(sel)} disabled={!sel.length}>Mulai asesmen ({sel.length})</Btn></>}>
      <p className="muted small">Siswa dinilai satu per satu sesuai urutan daftar, dengan panduan rubrik tiap aspek. Yang sudah terkunci tidak dipilih otomatis.</p>
      <div className="row-actions">
        <input placeholder="Cari nama siswa…" value={cari} onChange={(e) => setCari(e.target.value)} />
        <Btn kind="ghost" onClick={() => setSel(anggota.filter((s) => !final(s.id)).map((s) => s.id))}>Yang belum selesai</Btn>
        <Btn kind="ghost" onClick={() => setSel(anggota.map((s) => s.id))}>Semua</Btn>
        <Btn kind="ghost" onClick={() => setSel([])}>Kosongkan</Btn>
      </div>
      <div className="table-wrap" style={{ maxHeight: 360, overflow: 'auto' }}>
        <table className="tbl"><tbody>
          {tampil.map((s) => (
            <tr key={s.id}>
              <td style={{ width: 32 }}><input type="checkbox" checked={sel.includes(s.id)} onChange={() => tog(s.id)} aria-label={s.nama} /></td>
              <td><b>{s.nama}</b></td>
              <td className="c">{final(s.id) ? <span className="pill ok">Terkunci</span> : <span className="pill">{terisi(s.id)}/{total}</span>}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </Modal>
  )
}

function Rubrik({ inst }: { inst: Instrumen }) {
  return (
    <Card title="Rubrik penilaian" className="mb">
      <ol className="panduan small">
        <li>Amati siswa selama satu semester dalam kegiatan belajar, bukan satu kejadian saja.</li>
        <li>Pilih skor 1–4 yang paling sesuai dengan deskriptor pada tabel. Bila ragu, pilih skor lebih rendah dan catat alasannya.</li>
        <li>Tulis bukti singkat (kejadian, tanggal, hasil karya). Skor 1 dan 4 wajib memiliki bukti.</li>
        <li>Setelah lengkap, kunci asesmen. Hanya asesmen terkunci yang dicetak di rapor.</li>
      </ol>
      <div className="table-wrap">
        <table className="tbl asm-rub">
          <thead><tr><th>Aspek</th>{SKALA.map((s) => <th key={s.n}>{s.n} · {s.label}</th>)}</tr></thead>
          <tbody>{inst.aspek.map((a) => <tr key={a.key}><td><b>{a.label}</b></td>{SKALA.map((s) => <td key={s.n} className="small">{deskriptor(a, s.n)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </Card>
  )
}

function PanduanSiswa({ siswa, inst, kelas, rekam, onChange, onSimpan, onKunci, onClose, posisi, onSebelum, onBerikut }: { posisi?: string; onSebelum?: () => void; onBerikut?: () => void; siswa: Siswa; inst: Instrumen; kelas: string; rekam: Rekam; onChange: (fn: (x: Rekam) => Rekam) => void; onSimpan: () => void; onKunci: () => void; onClose: () => void }) {
  const sekolah = useSekolah()
  const [ai, setAi] = useState(false)
  const k = kelengkapan(inst, rekam)
  const ring = ringkasan(inst, rekam)
  const kunci = rekam.final
  const narasiAi = async () => {
    if (!sekolah.ai) return
    setAi(true)
    try {
      if (!ring.baris.length) throw new Error('Isi skor dulu.')
      const pr = promptAsesmen({ instrumen: inst.nama, kelas, rata: ring.predikat, teksGuru: rekam.umum, aspek: ring.baris.map((b) => ({ nama: b.aspek, skor: b.skor, label: b.label, bukti: b.bukti })) })
      const t = await panggilAi(sekolah.ai, systemPrompt(sekolah.ai, 'asesmen'), pr + (sekolah.ai.humanize === false ? '' : variasiHint(siswa.id)))
      onChange((x) => ({ ...x, umum: isiNama(t, siswa.namaPanggilan || siswa.nama.split(' ')[0]) }))
      toast('Narasi AI dibuat. Periksa dan sunting.')
    } catch (e) { toast((e as Error).message) }
    setAi(false)
  }
  return (
    <Modal wide title={`${inst.nama} · ${siswa.nama}`} onClose={onClose}
      footer={<>{posisi && <span className="muted small">{posisi}</span>}<Btn onClick={onClose}>Tutup</Btn>{onSebelum && <Btn onClick={onSebelum}>← Sebelumnya</Btn>}<Btn onClick={onSimpan} disabled={kunci}>Simpan</Btn>{!kunci && <Btn icon="validasi" onClick={onKunci}>Kunci</Btn>}{onBerikut && <Btn kind="primary" onClick={onBerikut}>{kunci ? 'Berikutnya →' : 'Simpan & berikutnya →'}</Btn>}</>}>
      {kunci && <p className="pill ok">Terkunci{rekam.penilai ? ` · dinilai oleh ${rekam.penilai}` : ''}{rekam.tanggal ? ` · ${rekam.tanggal}` : ''}. Buka kunci dari tabel untuk mengubah.</p>}
      {inst.aspek.map((a: Aspek) => (
        <fieldset key={a.key} className="asm-aspek" disabled={kunci}>
          <legend><b>{a.label}</b></legend>
          <div className="asm-level">
            {SKALA.map((s) => (
              <label key={s.n} className={`asm-opt sk-${s.n} ${rekam.skor[a.key] === s.n ? 'on' : ''}`}>
                <input type="radio" name={`${inst.id}-${a.key}`} checked={rekam.skor[a.key] === s.n} onChange={() => onChange((x) => ({ ...x, skor: { ...x.skor, [a.key]: s.n } }))} />
                <b>{s.n} · {s.label}</b><span>{deskriptor(a, s.n)}</span>
              </label>
            ))}
          </div>
          <input className="asm-bukti" placeholder={rekam.skor[a.key] === 1 || rekam.skor[a.key] === 4 ? 'Bukti/catatan observasi (wajib untuk skor 1 dan 4)' : 'Bukti/catatan observasi (opsional)'} value={rekam.bukti[a.key] ?? ''}
            onChange={(e) => onChange((x) => ({ ...x, bukti: { ...x.bukti, [a.key]: e.target.value } }))} />
        </fieldset>
      ))}
      <div className="form-grid">
        <Field label="Narasi / catatan umum (tampil di rapor)" span={3}>
          <textarea rows={3} value={rekam.umum} disabled={kunci} onChange={(e) => onChange((x) => ({ ...x, umum: e.target.value }))} placeholder={ring.narasi || 'Isi skor untuk melihat saran narasi otomatis'} />
        </Field>
      </div>
      <div className="row-actions">
        {!kunci && ring.narasi && <Btn kind="ghost" icon="refresh" onClick={() => onChange((x) => ({ ...x, umum: ring.narasi }))}>Pakai saran otomatis</Btn>}
        {!kunci && aiSiap(sekolah.ai) && <Btn kind="ghost" icon="ai" disabled={ai} onClick={narasiAi}>{ai ? 'Menyusun…' : 'Narasi AI'}</Btn>}
        <span className="muted small">{k.terisi}/{k.total} aspek{k.butuhBukti.length ? ` · perlu bukti: ${k.butuhBukti.join(', ')}` : ''}{ring.predikat ? ` · ${ring.predikat} (rata-rata ${ring.rata?.toFixed(2)})` : ''}</span>
      </div>
      {rekam.riwayat.length > 0 && (
        <details className="asm-riwayat"><summary>Riwayat perubahan ({rekam.riwayat.length})</summary>
          <ul className="small">{[...rekam.riwayat].reverse().slice(0, 20).map((h, i) => <li key={i}>{new Date(h.t).toLocaleString('id-ID')} · {h.oleh} · {h.aspek}: {h.dari ? labelSkor(h.dari) : '-'} → {h.ke ? labelSkor(h.ke) : '-'}</li>)}</ul>
        </details>
      )}
    </Modal>
  )
}

function KelolaInstrumen({ onClose, onPilih }: { onClose: () => void; onPilih: (id: string) => void }) {
  const arsip = useCol('arsip')
  const sesi = useSesi()
  const kustom = semuaInstrumen(arsip).filter((i) => i.kustom)
  const [edit, setEdit] = useState<Instrumen | null>(null)
  const baru = () => setEdit({ id: `asi-${uid()}`, nama: '', ket: '', untuk: 'Kustom', kustom: true, aspek: [{ key: uid().slice(0, 6), label: '', perilaku: '' }] })
  const simpan = async () => {
    if (!edit) return
    const aspek = edit.aspek.filter((a) => a.label.trim())
    if (!edit.nama.trim() || !aspek.length) return toast('Isi nama instrumen dan minimal satu aspek.')
    await put('arsip', simpanInstrumen({ ...edit, aspek: aspek.map((a) => ({ ...a, perilaku: a.perilaku.trim() || a.label.trim().toLowerCase() })) }, arsip.find((a) => a.id === edit.id), sesi?.akun.nama))
    toast('Instrumen disimpan'); setEdit(null)
  }
  const setAspek = (i: number, p: Partial<Aspek>) => setEdit((e) => e && { ...e, aspek: e.aspek.map((a, j) => (j === i ? { ...a, ...p } : a)) })
  return (
    <Modal wide title={edit ? 'Instrumen kustom' : 'Kelola instrumen asesmen'} onClose={onClose}
      footer={edit ? <><Btn onClick={() => setEdit(null)}>Batal</Btn><Btn kind="primary" onClick={simpan}>Simpan instrumen</Btn></> : <Btn onClick={onClose}>Tutup</Btn>}>
      {!edit ? (
        <>
          <h4 className="sec">Instrumen bawaan</h4>
          <ul className="kur-list">{INSTRUMEN_BAWAAN.map((i) => <li key={i.id}><b>{i.nama}</b> <span className="pill">{i.untuk}</span> <button className="link" onClick={() => onPilih(i.id)}>Pakai</button><br /><span className="muted small">{i.ket} · {i.aspek.length} aspek</span></li>)}</ul>
          <h4 className="sec">Instrumen buatan sendiri</h4>
          <ul className="kur-list">
            {kustom.map((i) => (
              <li key={i.id}><b>{i.nama}</b> <button className="link" onClick={() => onPilih(i.id)}>Pakai</button> <button className="link" onClick={() => setEdit(i)}>Ubah</button>
                <button className="link" onClick={async () => { if (arsip.some((a) => a.register === REG_ASESMEN && a.data.instrumen === i.id)) return toast('Instrumen sudah dipakai menilai; tidak dapat dihapus.'); if (await tanya(`Hapus instrumen “${i.nama}”?`, 'Hapus')) await remove('arsip', i.id) }}>Hapus</button>
                <br /><span className="muted small">{i.ket || '-'} · {i.aspek.length} aspek</span></li>
            ))}
            {!kustom.length && <li className="muted small">Belum ada. Buat rubrik sendiri, mis. “Asesmen Membaca”, “Praktik IPA”, atau “Bimbingan Konseling”.</li>}
          </ul>
          <Btn icon="plus" onClick={baru}>Buat instrumen</Btn>
        </>
      ) : (
        <>
          <div className="form-grid g4">
            <Field label="Nama instrumen" span={2}><input value={edit.nama} onChange={(e) => setEdit({ ...edit, nama: e.target.value })} placeholder="mis. Asesmen Membaca" /></Field>
            <Field label="Keterangan" span={2}><input value={edit.ket} onChange={(e) => setEdit({ ...edit, ket: e.target.value })} /></Field>
          </div>
          <p className="muted small">Isi “perilaku yang diamati”; rubrik skor 1–4 disusun otomatis. Bila ingin deskriptor sendiri, isi keempat kolom level.</p>
          {edit.aspek.map((a, i) => (
            <div key={a.key} className="asm-edit">
              <div className="filters">
                <input placeholder={`Aspek ${i + 1}`} value={a.label} onChange={(e) => setAspek(i, { label: e.target.value })} />
                <input placeholder="Perilaku yang diamati, mis. membaca lancar dengan intonasi tepat" style={{ flex: 2 }} value={a.perilaku} onChange={(e) => setAspek(i, { perilaku: e.target.value })} />
                <Btn kind="ghost" icon="trash" onClick={() => setEdit({ ...edit, aspek: edit.aspek.filter((_, j) => j !== i) })} />
              </div>
              <details><summary className="small">Deskriptor level sendiri (opsional)</summary>
                <div className="form-grid g4">
                  {[0, 1, 2, 3].map((n) => <Field key={n} label={`Level ${n + 1} · ${SKALA[n].label}`}><textarea rows={2} value={a.level?.[n] ?? ''} placeholder={deskriptor({ ...a, level: undefined, perilaku: a.perilaku || '…' }, (n + 1) as 1)} onChange={(e) => { const l = [...(a.level ?? ['', '', '', ''])] as [string, string, string, string]; l[n] = e.target.value; setAspek(i, { level: l }) }} /></Field>)}
                </div>
              </details>
            </div>
          ))}
          <Btn icon="plus" onClick={() => setEdit({ ...edit, aspek: [...edit.aspek, { key: uid().slice(0, 6), label: '', perilaku: '' }] })}>Tambah aspek</Btn>
        </>
      )}
    </Modal>
  )
}
