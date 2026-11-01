import { useMemo, useState } from 'react'
import { Bars, Donut, LineChart, Meter, MultiDonut } from '../charts'
import { Icon } from '../icons'
import { getState, useCol, useSekolah } from '../store'
import { Avatar, Btn, Card, useNav } from '../ui'
import { BULAN, fmtTanggalHari, isoDate, namaPegawai, parseIso, today, umur } from '../util'
import { JENJANG, STATUS_HADIR_LABEL, type Absensi, type StatusHadir } from '../types'

const WIDGETS: [string, string][] = [
  ['ringkasan', 'Ringkasan Sekolah'],
  ['hadirSiswa', 'Kehadiran Siswa'],
  ['tren', 'Tren Kehadiran Siswa'],
  ['perKelas', 'Kehadiran per Kelas'],
  ['hadirPegawai', 'Kehadiran Guru & Pegawai'],
  ['jenjang', 'Peserta Didik per Jenjang'],
  ['nilai', 'Kelengkapan Nilai'],
  ['ultah', 'Ulang Tahun Bulan Ini'],
]

const WARNA: Record<StatusHadir, string> = { H: 'var(--ok)', S: 'var(--warn)', I: 'var(--info)', A: 'var(--bad)', T: 'var(--orange)', C: 'var(--muted)', DL: 'var(--violet)' }

function loadHidden(): string[] {
  try { return JSON.parse(localStorage.getItem('simas.hiddenWidgets') ?? '[]') } catch { return [] }
}

/** Hari ini, atau tanggal absensi terakhir bila hari ini belum ada data (mis. hari libur). */
function tanggalAwal() {
  const t = today()
  const tgl = getState().absensi.filter((a) => a.jenis === 'siswa' && a.tanggal <= t).map((a) => a.tanggal)
  if (!tgl.length || tgl.includes(t)) return t
  return tgl.sort()[tgl.length - 1]
}

function geserHari(tgl: string, n: number) {
  const d = parseIso(tgl)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

export default function Dashboard() {
  const nav = useNav()
  const sekolah = useSekolah()
  const siswa = useCol('siswa')
  const pegawai = useCol('pegawai')
  const rombel = useCol('rombel')
  const mapel = useCol('mapel')
  const absensi = useCol('absensi')
  const nilai = useCol('nilai')
  const [tgl, setTgl] = useState(tanggalAwal)
  const [hidden, setHidden] = useState<string[]>(loadHidden)
  const [menu, setMenu] = useState(false)
  const [, setTick] = useState(0)

  const toggle = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]
    setHidden(next)
    try { localStorage.setItem('simas.hiddenWidgets', JSON.stringify(next)) } catch { /* abaikan */ }
  }
  const show = (id: string) => !hidden.includes(id)

  const aktif = siswa.filter((s) => s.status === 'Aktif')
  const guru = pegawai.filter((p) => p.aktif && p.jenis === 'Guru')
  const tendik = pegawai.filter((p) => p.aktif && p.jenis !== 'Guru')
  const rombelAktif = rombel.filter((r) => r.tahunAjaran === sekolah.tahunAjaranAktif)

  const absenSiswaHari = useMemo(() => absensi.filter((a) => a.jenis === 'siswa' && a.tanggal === tgl), [absensi, tgl])
  const hitung = (lembar: Absensi[]) => {
    const c: Record<StatusHadir, number> = { H: 0, S: 0, I: 0, A: 0, T: 0, C: 0, DL: 0 }
    for (const a of lembar) for (const x of Object.values(a.data)) c[x.status]++
    return c
  }
  const cs = hitung(absenSiswaHari)
  const totalTercatat = Object.values(cs).reduce((a, b) => a + b, 0)
  const hadir = cs.H + cs.T

  const tren = useMemo(() => {
    const tanggal = [...new Set(absensi.filter((a) => a.jenis === 'siswa' && a.tanggal <= tgl).map((a) => a.tanggal))].sort().slice(-7)
    return tanggal.map((t) => {
      const c = hitung(absensi.filter((a) => a.jenis === 'siswa' && a.tanggal === t))
      const tot = Object.values(c).reduce((a, b) => a + b, 0)
      const d = parseIso(t)
      return { x: `${d.getDate()}/${d.getMonth() + 1}`, y: tot ? Math.round(((c.H + c.T) / tot) * 100) : 0 }
    })
  }, [absensi, tgl])

  const absenPeg = absensi.find((a) => a.jenis === 'pegawai' && a.tanggal === tgl)
  const cp = hitung(absenPeg ? [absenPeg] : [])
  const pegAktif = pegawai.filter((p) => p.aktif)
  const belumAbsen = pegAktif.filter((p) => !absenPeg?.data[p.id])

  const perJenjang = JENJANG.map((j) => ({ label: j, v: aktif.filter((s) => s.jenjang === j).length })).filter((x) => x.v > 0 || sekolah.jenjang.includes(x.label as never))

  const bulanIni = new Date().getMonth()
  const ultah = [
    ...aktif.filter((s) => s.tanggalLahir && parseIso(s.tanggalLahir).getMonth() === bulanIni).map((s) => ({ id: s.id, nama: s.nama, tgl: s.tanggalLahir!, ket: `Siswa · ${s.jenjang}` })),
    ...pegAktif.filter((p) => p.tanggalLahir && parseIso(p.tanggalLahir).getMonth() === bulanIni).map((p) => ({ id: p.id, nama: namaPegawai(p), tgl: p.tanggalLahir!, ket: p.jabatan ?? p.jenis })),
  ].sort((a, b) => parseIso(a.tgl).getDate() - parseIso(b.tgl).getDate())

  const L = aktif.filter((s) => s.jk === 'L').length
  const P = aktif.length - L

  return (
    <div className="dash">
      <div className="toolbar">
        <div className="dropdown">
          <Btn icon="plus" kind="primary" onClick={() => setMenu((m) => !m)}>Widget</Btn>
          {menu && (
            <div className="dropdown-menu" onMouseLeave={() => setMenu(false)}>
              {WIDGETS.map(([id, l]) => (
                <label key={id}><input type="checkbox" checked={show(id)} onChange={() => toggle(id)} /> {l}</label>
              ))}
            </div>
          )}
        </div>
        <div className="datenav">
          <button className="icon-btn" onClick={() => setTgl(geserHari(tgl, -1))} aria-label="Hari sebelumnya"><Icon name="chevL" size={16} /></button>
          <input type="date" value={tgl} onChange={(e) => e.target.value && setTgl(e.target.value)} />
          <button className="icon-btn" onClick={() => setTgl(geserHari(tgl, 1))} aria-label="Hari berikutnya"><Icon name="chevR" size={16} /></button>
          <span className="muted">{fmtTanggalHari(tgl)}</span>
        </div>
      </div>

      <div className="grid-3">
        {show('ringkasan') && (
          <Card title="Ringkasan Sekolah" onRefresh={() => setTick((t) => t + 1)}>
            <div className="summary">
              <div className="summary-donut">
                <MultiDonut parts={[{ v: L, color: 'var(--accent)', label: 'L' }, { v: P, color: 'var(--pink)', label: 'P' }]} />
                <div className="legend">
                  <span><i style={{ background: 'var(--accent)' }} />Laki-laki <b>{L}</b></span>
                  <span><i style={{ background: 'var(--pink)' }} />Perempuan <b>{P}</b></span>
                </div>
              </div>
              <div className="kpis">
                <button className="kpi" onClick={() => nav.open('siswa')}><span>Peserta Didik Aktif</span><b>{aktif.length}</b></button>
                <button className="kpi" onClick={() => nav.open('pegawai')}><span>Guru</span><b>{guru.length}</b></button>
                <button className="kpi" onClick={() => nav.open('pegawai')}><span>Tenaga Kependidikan</span><b>{tendik.length}</b></button>
                <button className="kpi" onClick={() => nav.open('rombel')}><span>Rombel {sekolah.tahunAjaranAktif}</span><b>{rombelAktif.length}</b></button>
              </div>
            </div>
          </Card>
        )}

        {show('hadirSiswa') && (
          <Card title="Kehadiran Siswa" actions={<button className="icon-btn" title="Isi absensi" onClick={() => nav.open('absensiSiswa')}><Icon name="edit" size={16} /></button>}>
            {totalTercatat === 0 ? (
              <div className="empty small">Belum ada absensi siswa pada tanggal ini.<br /><Btn kind="ghost" onClick={() => nav.open('absensiSiswa')}>Isi absensi</Btn></div>
            ) : (
              <div className="att">
                <Donut value={hadir} total={totalTercatat} label="hadir" />
                <ul className="att-list">
                  {(['H', 'T', 'S', 'I', 'A'] as StatusHadir[]).map((s) => (
                    <li key={s}><i style={{ background: WARNA[s] }} />{STATUS_HADIR_LABEL[s]}<b>{cs[s]}</b><em className={`pill ${s === 'A' ? 'bad' : s === 'H' ? 'ok' : ''}`}>{Math.round((cs[s] / totalTercatat) * 100)}%</em></li>
                  ))}
                </ul>
              </div>
            )}
            <p className="foot muted">{absenSiswaHari.length} dari {rombelAktif.length} rombel sudah diabsen</p>
          </Card>
        )}

        {show('tren') && (
          <Card title="Tren Kehadiran Siswa">
            <div className="muted right small">7 hari sekolah terakhir (% hadir)</div>
            {tren.length ? <LineChart points={tren} max={100} suffix="%" /> : <div className="empty small">Belum ada data.</div>}
          </Card>
        )}
      </div>

      <div className="grid-2">
        {show('perKelas') && (
          <Card title={`Kehadiran per Kelas`}>
            <div className="muted right small">{fmtTanggalHari(tgl)}</div>
            <table className="mini">
              <thead><tr><th>Rombel</th><th>Wali Kelas</th><th className="num">Hadir</th><th className="num">S/I/A</th><th style={{ width: '35%' }}></th></tr></thead>
              <tbody>
                {rombelAktif.map((r) => {
                  const a = absenSiswaHari.find((x) => x.rombelId === r.id)
                  const c = hitung(a ? [a] : [])
                  const tot = r.siswaIds.length || 1
                  const pct = ((c.H + c.T) / tot) * 100
                  return (
                    <tr key={r.id}>
                      <td><b>{r.nama}</b> <span className="muted">{r.jenjang}</span></td>
                      <td>{namaPegawai(pegawai.find((p) => p.id === r.waliKelasId)) || '-'}</td>
                      <td className="num">{a ? `${c.H + c.T}/${r.siswaIds.length}` : '-'}</td>
                      <td className="num">{a ? `${c.S}/${c.I}/${c.A}` : '-'}</td>
                      <td>{a ? <Meter pct={pct} color={pct < 80 ? 'var(--bad)' : 'var(--ok)'} /> : <span className="pill warn">Belum diabsen</span>}</td>
                    </tr>
                  )
                })}
                {!rombelAktif.length && <tr><td colSpan={5} className="muted">Belum ada rombel pada tahun ajaran aktif.</td></tr>}
              </tbody>
            </table>
          </Card>
        )}

        {show('hadirPegawai') && (
          <Card title="Kehadiran Guru & Pegawai" actions={<button className="icon-btn" title="Isi absensi" onClick={() => nav.open('absensiPegawai')}><Icon name="edit" size={16} /></button>}>
            <div className="stat-row">
              <div><span>Hadir</span><b className="ok-t">{cp.H + cp.T}</b></div>
              <div><span>Terlambat</span><b className="orange-t">{cp.T}</b></div>
              <div><span>Sakit/Izin/Cuti/DL</span><b>{cp.S + cp.I + cp.C + cp.DL}</b></div>
              <div><span>Alpa</span><b className="bad-t">{cp.A}</b></div>
              <div><span>Belum absen</span><b className="warn-t">{belumAbsen.length}</b></div>
            </div>
            <div className="bar-split">
              <div style={{ flex: cp.H + cp.T, background: 'var(--ok)' }} />
              <div style={{ flex: cp.S + cp.I + cp.C + cp.DL, background: 'var(--warn)' }} />
              <div style={{ flex: cp.A, background: 'var(--bad)' }} />
              <div style={{ flex: belumAbsen.length, background: 'var(--track)' }} />
            </div>
            {belumAbsen.length > 0 && (
              <p className="small muted">Belum absen: {belumAbsen.slice(0, 6).map((p) => p.nama).join(', ')}{belumAbsen.length > 6 ? `, +${belumAbsen.length - 6} lainnya` : ''}</p>
            )}
          </Card>
        )}
      </div>

      <div className="grid-3">
        {show('jenjang') && (
          <Card title="Peserta Didik per Jenjang">
            <Bars data={perJenjang.map((x, i) => ({ ...x, color: ['var(--accent)', 'var(--info)', 'var(--ok)', 'var(--orange)', 'var(--violet)', 'var(--pink)'][i % 6] }))} />
          </Card>
        )}

        {show('nilai') && (
          <Card title={`Kelengkapan Nilai Smt ${sekolah.semesterAktif}`} actions={<button className="icon-btn" title="Penilaian" onClick={() => nav.open('nilai')}><Icon name="edit" size={16} /></button>}>
            <ul className="progress-list">
              {rombelAktif.map((r) => {
                const mp = mapel.filter((m) => m.jenjang.includes(r.jenjang))
                const isi = nilai.filter((n) => n.rombelId === r.id && n.tahunAjaran === sekolah.tahunAjaranAktif && n.semester === sekolah.semesterAktif && Object.keys(n.data).length > 0).length
                const pct = mp.length ? (isi / mp.length) * 100 : 0
                return (
                  <li key={r.id}>
                    <div><b>{r.nama}</b><span className="muted">{isi}/{mp.length} mapel</span><em className={`pill ${pct >= 100 ? 'ok' : pct > 0 ? 'warn' : 'bad'}`}>{Math.round(pct)}%</em></div>
                    <Meter pct={pct} color={pct >= 100 ? 'var(--ok)' : pct > 0 ? 'var(--warn)' : 'var(--bad)'} />
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {show('ultah') && (
          <Card title={`Ulang Tahun ${BULAN[bulanIni]}`}>
            <ul className="people">
              {ultah.slice(0, 8).map((u) => (
                <li key={u.id}><Avatar nama={u.nama} size={28} /><div><b>{u.nama}</b><span className="muted">{u.ket}</span></div><em>{parseIso(u.tgl).getDate()} {BULAN[bulanIni].slice(0, 3)} · {(umur(u.tgl) ?? 0) + 1} th</em></li>
              ))}
              {!ultah.length && <li className="muted">Tidak ada yang berulang tahun bulan ini.</li>}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
