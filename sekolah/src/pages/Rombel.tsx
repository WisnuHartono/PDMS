import { useMemo, useState } from 'react'
import { KURIKULUM, getKurikulum, kurikulumDefault } from '../curricula'
import { put, remove, useCol, useSekolah } from '../store'
import { JENJANG, TINGKAT_PER_JENJANG, type Jenjang, type JenisRombel, type Pembelajaran, type Rombel } from '../types'
import { Btn, Card, Empty, Field, Inp, Modal, PageHead, Sel, Tabs, tanya, toast } from '../ui'
import { namaPegawai, uid } from '../util'
import { bebanKln, jenisRombelTersedia, rombelUtama, validasiRombel } from '../validasi'

const JENIS_KET: Record<JenisRombel, string> = {
  Reguler: 'Rombel kelas biasa',
  'Kelas Rangkap': 'SD negeri yang ditetapkan Dinas: satu Rombel Induk + rombel anggota per tingkat; pembelajaran hanya di Rombel Induk',
  PJJ: 'SMA penyelenggara Pendidikan Jarak Jauh',
  Keaksaraan: 'PKBM/SKB: layanan keaksaraan dasar/lanjutan dengan tutor',
  'Kebekerjaan LN': 'SMK Program Kebekerjaan Luar Negeri: satu rombel per mapel (Bahasa Asing / Produktif / PJOK) per negara tujuan',
  Praktik: 'SMK: rombel praktik',
}

function Vld({ r, semua }: { r: Rombel; semua: Rombel[] }) {
  const siswa = useCol('siswa')
  const sekolah = useSekolah()
  const e = validasiRombel(r, semua, siswa, sekolah)
  const inv = e.filter((x) => x.level === 'invalid')
  const t = e.map((x) => `${x.level === 'invalid' ? '✗' : '!'} ${x.pesan}`).join('\n')
  return inv.length ? <span className="vld bad" title={t}>✗</span> : e.length ? <span className="vld warn" title={t}>!</span> : <span className="vld ok" title="Valid">✓</span>
}

export default function RombelPage() {
  const sekolah = useSekolah()
  const rombel = useCol('rombel')
  const pegawai = useCol('pegawai')
  const [ta, setTa] = useState(sekolah.tahunAjaranAktif)
  const [edit, setEdit] = useState<Rombel | null>(null)
  const daftarTa = [...new Set([sekolah.tahunAjaranAktif, ...rombel.map((r) => r.tahunAjaran)])].sort().reverse()
  const semuaTa = rombel.filter((r) => r.tahunAjaran === ta)
  // Rombel anggota kelas rangkap ditampilkan tepat di bawah rombel induknya.
  const urut = (a: Rombel, b: Rombel) => JENJANG.indexOf(a.jenjang) - JENJANG.indexOf(b.jenjang) || a.nama.localeCompare(b.nama, 'id', { numeric: true })
  const atas = semuaTa.filter((r) => !r.indukId || !semuaTa.some((x) => x.id === r.indukId)).sort(urut)
  const list = atas.flatMap((r) => [r, ...semuaTa.filter((x) => x.indukId === r.id).sort(urut)])
  const kln = bebanKln(semuaTa)

  const naikKelas = async () => {
    const [y1] = ta.split('/').map(Number)
    const next = `${y1 + 1}/${y1 + 2}`
    if (rombel.some((r) => r.tahunAjaran === next)) return toast(`Rombel TA ${next} sudah ada`)
    if (!await tanya(`Buat rombel TA ${next} dengan menaikkan tingkat semua rombel TA ${ta}? Kelas tingkat akhir tidak disalin.`)) return
    const idBaru = new Map(list.map((r) => [r.id, uid()]))
    let n = 0
    for (const r of list) {
      const tingkat = TINGKAT_PER_JENJANG[r.jenjang]
      const i = tingkat.indexOf(r.tingkat)
      if (i < 0 || i === tingkat.length - 1) continue
      const t = tingkat[i + 1]
      await put('rombel', { ...r, id: idBaru.get(r.id)!, tahunAjaran: next, tingkat: t, nama: r.nama.replace(r.tingkat, t), indukId: r.indukId ? idBaru.get(r.indukId) : undefined })
      n++
    }
    toast(`${n} rombel dibuat untuk TA ${next}`)
    setTa(next)
  }
  const baru = (): Rombel => {
    const j = sekolah.jenjang[0] ?? 'SD'
    return { id: uid(), nama: '', jenjang: j, tingkat: TINGKAT_PER_JENJANG[j][0], tahunAjaran: ta, kurikulumId: kurikulumDefault(j), siswaIds: [], jenis: j === 'PKBM' ? 'Keaksaraan' : 'Reguler', pembelajaran: [] }
  }

  return (
    <div>
      <PageHead title="Kelas / Rombongan Belajar" sub="Rombel reguler, kelas rangkap, PJJ, keaksaraan, kebekerjaan luar negeri; wali kelas, anggota, dan pembelajaran">
        <Btn onClick={naikKelas}>Kenaikan kelas → TA berikutnya</Btn>
        <Btn icon="plus" kind="primary" onClick={() => setEdit(baru())}>Tambah Rombel</Btn>
      </PageHead>
      <Card title={`Rombel TA ${ta}`} actions={<select value={ta} onChange={(e) => setTa(e.target.value)} aria-label="Tahun ajaran">{daftarTa.map((t) => <option key={t}>{t}</option>)}</select>}>
        {list.length === 0 ? <Empty>Belum ada rombel untuk tahun ajaran ini.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th className="c" title="Hasil validasi">Vld</th><th>Rombel</th><th>Jenis</th><th className="c">Jenjang</th><th className="c">Tingkat</th><th>Wali Kelas / Tutor</th><th>Kurikulum</th><th className="num">Siswa</th><th className="num">Pembelajaran</th><th></th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const jp = (r.pembelajaran ?? []).reduce((a, p) => a + (p.jp || 0), 0)
                  return (
                    <tr key={r.id} onDoubleClick={() => setEdit(r)}>
                      <td className="c"><Vld r={r} semua={semuaTa} /></td>
                      <td>{r.indukId ? <span className="muted">└ </span> : null}<b>{r.nama}</b>{r.rombelInduk && <span className="pill info" style={{ marginLeft: 6 }}>Induk</span>}</td>
                      <td>{r.jenis && r.jenis !== 'Reguler' ? <span className="pill">{r.jenis}{r.kategoriMapel ? ` · ${r.kategoriMapel}` : ''}{r.negaraTujuan ? ` · ${r.negaraTujuan}` : ''}</span> : 'Reguler'}</td>
                      <td className="c">{r.jenjang}</td><td className="c">{r.tingkat}</td>
                      <td className="nowrap">{namaPegawai(pegawai.find((p) => p.id === r.waliKelasId)) || '-'}</td>
                      <td><span className="pill">{getKurikulum(r.kurikulumId).singkat}</span></td>
                      <td className="num">{r.siswaIds.length}</td>
                      <td className="num">{r.pembelajaran?.length ? `${r.pembelajaran.length} mapel · ${jp} JP` : '-'}</td>
                      <td className="row-actions">
                        <Btn icon="edit" kind="ghost" title="Ubah" onClick={() => setEdit(r)} />
                        <Btn icon="trash" kind="ghost" title="Hapus" onClick={async () => {
                          if (semuaTa.some((x) => x.indukId === r.id)) return toast('Hapus dulu rombel anggota dari rombel induk ini.')
                          if (await tanya(`Apakah Anda yakin ingin menghapus rombel ${r.nama}?`)) await remove('rombel', r.id)
                        }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">✓ valid · ! peringatan · ✗ invalid (arahkan kursor ke tanda untuk melihat rinciannya). Validasi lengkap ada di menu Validasi Data.</p>
      </Card>
      {kln.length > 0 && (
        <Card title="Beban belajar Kebekerjaan Luar Negeri (46 JP/minggu)" className="mt">
          <table className="tbl">
            <thead><tr><th>Negara tujuan</th><th className="num">Bahasa Asing</th><th className="num">Produktif</th><th className="num">PJOK</th><th className="num">Total</th><th>Ketentuan</th></tr></thead>
            <tbody>{kln.map((k) => (
              <tr key={k.negara}><td><b>{k.negara}</b></td><td className="num">{k.ba} JP ({Math.round((k.ba / 46) * 100)}%)</td><td className="num">{k.prod} JP</td><td className="num">{k.pjok} JP</td><td className="num">{k.total} JP</td>
                <td>{k.msg.length ? <span className="bad-t small">{k.msg.join(' ')}</span> : <span className="pill ok">Sesuai</span>}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
      {edit && <RombelForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function RombelForm({ initial, onClose }: { initial: Rombel; onClose: () => void }) {
  const sekolah = useSekolah()
  const siswa = useCol('siswa')
  const rombel = useCol('rombel')
  const pegawai = useCol('pegawai')
  const mapel = useCol('mapel')
  const [r, setR] = useState<Rombel>({ jenis: 'Reguler', pembelajaran: [], ...initial })
  const [tab, setTab] = useState<'data' | 'anggota' | 'pembelajaran'>('data')
  const [q, setQ] = useState('')
  const set = (p: Partial<Rombel>) => setR((o) => ({ ...o, ...p }))
  const jenis = r.jenis ?? 'Reguler'
  const semuaTa = rombel.filter((x) => x.tahunAjaran === r.tahunAjaran && x.id !== r.id)
  const tersedia = jenisRombelTersedia(sekolah, r.jenjang)
  const turunanRangkap = jenis === 'Kelas Rangkap' && !r.rombelInduk

  const diRombelLain = useMemo(() => {
    const m = new Map<string, string>()
    if (!rombelUtama(r)) return m
    for (const x of semuaTa) if (rombelUtama(x)) for (const id of x.siswaIds) m.set(id, x.nama)
    return m
  }, [semuaTa, r])

  const kandidat = siswa
    .filter((s) => s.status === 'Aktif' && s.jenjang === r.jenjang)
    .filter((s) => jenis !== 'Kebekerjaan LN' || (s.pesertaKln && (!r.negaraTujuan || s.negaraTujuan?.toLowerCase() === r.negaraTujuan.toLowerCase()) && (r.kategoriMapel !== 'Produktif' || !r.kompetensi || s.kompetensiKeahlian === r.kompetensi)))
    .filter((s) => !q || s.nama.toLowerCase().includes(q.toLowerCase()) || s.noInduk.includes(q))
    .sort((a, b) => a.nama.localeCompare(b.nama))

  const toggle = (id: string) => set({ siswaIds: r.siswaIds.includes(id) ? r.siswaIds.filter((x) => x !== id) : [...r.siswaIds, id] })
  const kurOk = KURIKULUM.filter((k) => k.jenjang.includes(r.jenjang))
  const mapelJenjang = mapel.filter((m) => m.jenjang.includes(r.jenjang)).sort((a, b) => a.urutan - b.urutan)
  const pb = r.pembelajaran ?? []
  const setPb = (i: number, p: Partial<Pembelajaran>) => set({ pembelajaran: pb.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const guru = pegawai.filter((p) => p.aktif && p.jenis === 'Guru')
  const masalah = validasiRombel(r, [...semuaTa, r], siswa, sekolah)

  const simpan = async () => {
    if (!r.nama.trim()) return toast('Nama rombel wajib diisi')
    const inv = masalah.filter((m) => m.level === 'invalid')
    if (inv.length && !await tanya(`Masih ada ${inv.length} isian berstatus Invalid. Simpan sebagai draf dan perbaiki nanti?`, 'Simpan')) return
    await put('rombel', r)
    toast('Rombel disimpan')
    onClose()
  }

  return (
    <Modal title={initial.nama ? `Rombel ${initial.nama}` : 'Rombel Baru'} onClose={onClose} wide footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={simpan}>Simpan</Btn></>}>
      <Tabs tabs={[['data', 'Data Rombel'], ['anggota', `Anggota (${r.siswaIds.length})`], ['pembelajaran', `Pembelajaran (${pb.length})`]]} value={tab} onChange={setTab} />
      {tab === 'data' && (
        <>
          <div className="form-grid">
            <Field label="Jenis rombel" span={2} hint={JENIS_KET[jenis]}>
              <select value={jenis} onChange={(e) => set({ jenis: e.target.value as JenisRombel, rombelInduk: undefined, indukId: undefined })}>
                {[...new Set([...tersedia, jenis])].map((j) => <option key={j} value={j}>{j}{!tersedia.includes(j) ? ' (belum ditetapkan)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Nama rombel *"><Inp obj={r} k="nama" set={set} placeholder={jenis === 'Kebekerjaan LN' ? 'mis. Bahasa Jepang' : 'mis. 7A, TK B, Rangkap A'} autoFocus /></Field>
            <Field label="Tahun ajaran"><Inp obj={r} k="tahunAjaran" set={set} placeholder="2025/2026" /></Field>
            <Field label="Jenjang"><select value={r.jenjang} onChange={(e) => { const j = e.target.value as Jenjang; set({ jenjang: j, tingkat: TINGKAT_PER_JENJANG[j][0], kurikulumId: kurikulumDefault(j), siswaIds: [], jenis: j === 'PKBM' ? 'Keaksaraan' : 'Reguler' }) }}>{JENJANG.map((j) => <option key={j}>{j}</option>)}</select></Field>
            <Field label="Tingkat"><Sel obj={r} k="tingkat" set={set} options={TINGKAT_PER_JENJANG[r.jenjang]} /></Field>
            <Field label={jenis === 'Keaksaraan' ? 'Tutor / pembimbing' : 'Wali kelas'} span={2}><Sel obj={r} k="waliKelasId" set={set} empty="-" options={pegawai.filter((p) => p.aktif && p.jenis === 'Guru').map((p) => [p.id, namaPegawai(p)] as [string, string])} /></Field>
            <Field label="Kurikulum" span={2} hint={getKurikulum(r.kurikulumId).asal === 'Internasional' ? 'Kurikulum internasional: nilai dan rapor memakai format kurikulum tersebut.' : 'Implementasi kurikulum di Beranda dihitung dari pilihan ini.'}>
              <Sel obj={r} k="kurikulumId" set={set} options={(kurOk.length ? kurOk : KURIKULUM).map((k) => [k.id, `${k.nama}${k.asal === 'Internasional' ? ' (Int.)' : ''}`] as [string, string])} />
            </Field>
            <Field label="Ruang"><Inp obj={r} k="ruang" set={set} /></Field>
            {jenis === 'Kelas Rangkap' && (
              <>
                <Field label="Sebagai Rombel Induk"><select value={r.rombelInduk ? '1' : ''} onChange={(e) => set({ rombelInduk: e.target.value === '1' || undefined, indukId: undefined })}><option value="1">Ya (pusat pembelajaran)</option><option value="">Tidak (rombel anggota)</option></select></Field>
                {!r.rombelInduk && <Field label="Rombel Induk *" span={2}><Sel obj={r} k="indukId" set={set} empty="- pilih -" options={semuaTa.filter((x) => x.rombelInduk).map((x) => [x.id, `${x.nama} (tingkat ${x.tingkat})`] as [string, string])} /></Field>}
              </>
            )}
            {jenis === 'Keaksaraan' && <Field label="Program / layanan *" span={2}><Sel obj={r} k="program" set={set} empty="-" options={['Keaksaraan Dasar', 'Keaksaraan Usaha Mandiri', 'Multikeaksaraan']} /></Field>}
            {jenis === 'Kebekerjaan LN' && (
              <>
                <Field label="Negara tujuan *"><Inp obj={r} k="negaraTujuan" set={set} placeholder="mis. Jepang" /></Field>
                <Field label="Kategori mapel *"><Sel obj={r} k="kategoriMapel" set={set} empty="-" options={['Bahasa Asing', 'Produktif', 'PJOK']} /></Field>
                {r.kategoriMapel === 'Produktif' && <Field label="Kompetensi keahlian *" span={2}><Inp obj={r} k="kompetensi" set={set} placeholder="mis. Teknik Kendaraan Ringan" /></Field>}
              </>
            )}
          </div>
          {masalah.length > 0 && (
            <ul className="errs small">{masalah.map((m, i) => <li key={i}><b>{m.level === 'invalid' ? 'Invalid' : 'Peringatan'}:</b> {m.pesan}</li>)}</ul>
          )}
        </>
      )}
      {tab === 'anggota' && (
        <>
          {jenis === 'Kebekerjaan LN' && <p className="muted small">Hanya peserta didik berstatus peserta Kebekerjaan LN{r.negaraTujuan ? ` dengan negara tujuan ${r.negaraTujuan}` : ''}{r.kategoriMapel === 'Produktif' && r.kompetensi ? ` dan kompetensi ${r.kompetensi}` : ''} yang dapat dipilih. Bahasa Asing dan PJOK boleh menggabungkan beberapa kompetensi, maksimal 36 peserta didik.</p>}
          {jenis === 'Kelas Rangkap' && <p className="muted small">Peserta didik tetap ditempatkan pada rombel sesuai tingkat kelasnya masing-masing.</p>}
          <div className="filters"><input placeholder="Cari siswa jenjang ini" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="pick-list">
            {kandidat.map((s) => {
              const lain = diRombelLain.get(s.id)
              return (
                <label key={s.id} className={r.siswaIds.includes(s.id) ? 'on' : ''}>
                  <input type="checkbox" checked={r.siswaIds.includes(s.id)} onChange={() => toggle(s.id)} />
                  <span>{s.nama}</span><span className="muted small">{s.noInduk}{s.kompetensiKeahlian ? ` · ${s.kompetensiKeahlian}` : ''}</span>
                  {lain && <em className="pill warn">di {lain}</em>}
                </label>
              )
            })}
            {!kandidat.length && <p className="muted">Tidak ada peserta didik yang memenuhi syarat untuk rombel ini.</p>}
          </div>
        </>
      )}
      {tab === 'pembelajaran' && (
        turunanRangkap ? <Empty>Pembelajaran kelas rangkap hanya diinput pada Rombel Induk.</Empty> : (
          <>
            <p className="muted small">Mata pelajaran yang diselenggarakan, guru pengampu, dan jam per minggu (dipakai untuk beban kerja guru dan validasi).{jenis === 'Kebekerjaan LN' ? ' Rombel Kebekerjaan LN hanya berisi satu mata pelajaran.' : ''}</p>
            <table className="tbl">
              <thead><tr><th>Mata pelajaran</th><th>Guru pengampu</th><th className="num">JP/minggu</th><th>No. SK mengajar</th><th></th></tr></thead>
              <tbody>
                {pb.map((p, i) => (
                  <tr key={i}>
                    <td><select value={p.mapelId} onChange={(e) => setPb(i, { mapelId: e.target.value })}>{mapelJenjang.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}{!mapelJenjang.some((m) => m.id === p.mapelId) && <option value={p.mapelId}>{mapel.find((m) => m.id === p.mapelId)?.nama ?? '-'}</option>}</select></td>
                    <td><select value={p.guruId ?? ''} onChange={(e) => setPb(i, { guruId: e.target.value || undefined })}><option value="">- belum -</option>{guru.map((g) => <option key={g.id} value={g.id}>{namaPegawai(g)}</option>)}</select></td>
                    <td className="num"><input type="number" min={0} max={60} style={{ width: 70 }} value={p.jp} onChange={(e) => setPb(i, { jp: Number(e.target.value) || 0 })} /></td>
                    <td><input value={p.skMengajar ?? ''} onChange={(e) => setPb(i, { skMengajar: e.target.value || undefined })} /></td>
                    <td><Btn icon="trash" kind="ghost" title="Hapus" onClick={() => set({ pembelajaran: pb.filter((_, j) => j !== i) })} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={2} className="r strong">Total</td><td className="num strong">{pb.reduce((a, p) => a + (p.jp || 0), 0)} JP</td><td colSpan={2} /></tr></tfoot>
            </table>
            <div className="btn-row">
              <Btn icon="plus" disabled={!mapelJenjang.length || (jenis === 'Kebekerjaan LN' && pb.length >= 1)} onClick={() => set({ pembelajaran: [...pb, { mapelId: mapelJenjang[0]?.id ?? '', jp: 2 }] })}>Tambah pembelajaran</Btn>
              {jenis !== 'Kebekerjaan LN' && !pb.length && mapelJenjang.length > 0 && (
                <Btn onClick={() => set({ pembelajaran: mapelJenjang.map((m) => ({ mapelId: m.id, jp: 2, guruId: guru.find((g) => g.mapelIds?.includes(m.id))?.id ?? (r.jenjang === 'SD' || r.jenjang === 'TK' || r.jenjang === 'PAUD' ? r.waliKelasId : undefined) })) })}>Isi semua mapel {r.jenjang}</Btn>
              )}
            </div>
          </>
        )
      )}
    </Modal>
  )
}
