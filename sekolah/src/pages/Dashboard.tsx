import { useEffect, useMemo, useRef, useState } from 'react'
import { boleh, useSesi } from '../security/sesi'
import { Bars, Donut, LineChart, Meter, MultiDonut } from '../charts'
import { Icon } from '../icons'
import { getState, useCol, useSekolah } from '../store'
import { Avatar, Btn, Card, useNav, type PageId } from '../ui'
import { KET_STATUS, klasifikasiKerusakan, pengajuanAktif, pillKerusakan } from '../prasarana'
import { alamatLengkap } from '../print'
import { LogoSekolah, tampilanDari } from '../logo'
import { BULAN, fmtTanggal, fmtTanggalHari, isoDate, namaPegawai, parseIso, today, umur } from '../util'
import { getKurikulum } from '../curricula'
import { implementasiKurikulum } from '../validasi'
import { useValidasi } from './Validasi'
import { JENJANG, STATUS_HADIR_LABEL, type Absensi, type StatusHadir } from '../types'

/** Angka yang berhitung naik saat tampil (dimatikan oleh pengaturan gerak browser). */
function Angka({ n }: { n: number }) {
  const [v, setV] = useState(0)
  const dari = useRef(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || n === dari.current) { setV(n); dari.current = n; return }
    const a = dari.current, t0 = performance.now(), dur = 700
    let raf = 0
    const f = (t: number) => { const k = Math.min(1, (t - t0) / dur); setV(Math.round(a + (n - a) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(f); else dari.current = n }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [n])
  return <>{v}</>
}

const AKSI: { id: PageId; label: string; ket: string; icon: string; warna: string }[] = [
  { id: 'absensiSiswa', label: 'Absensi Siswa', ket: 'Isi kehadiran hari ini', icon: 'absensi', warna: 'linear-gradient(135deg,#0f766e,#14b8a6)' },
  { id: 'nilai', label: 'Input Nilai', ket: 'Nilai & narasi AI', icon: 'nilai', warna: 'linear-gradient(135deg,#1d4ed8,#38bdf8)' },
  { id: 'rapor', label: 'Cetak Rapor', ket: 'Catatan & cetak', icon: 'rapor', warna: 'linear-gradient(135deg,#7c3aed,#c084fc)' },
  { id: 'siswa', label: 'Peserta Didik', ket: 'Data & mutasi', icon: 'siswa', warna: 'linear-gradient(135deg,#ea580c,#fbbf24)' },
  { id: 'administrasi', label: 'Administrasi', ket: 'Surat & dokumen', icon: 'administrasi', warna: 'linear-gradient(135deg,#be185d,#f472b6)' },
  { id: 'validasi', label: 'Validasi Data', ket: 'Periksa kelengkapan', icon: 'validasi', warna: 'linear-gradient(135deg,#15803d,#4ade80)' },
]

const sapaan = () => { const j = new Date().getHours(); return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam' }

const WIDGETS: [string, string][] = [
  ['profil', 'Profil & Informasi Sekolah'],
  ['ringkasan', 'Ringkasan Sekolah'],
  ['hadirSiswa', 'Kehadiran Siswa'],
  ['tren', 'Tren Kehadiran Siswa'],
  ['perKelas', 'Kehadiran per Kelas'],
  ['hadirPegawai', 'Kehadiran Guru & Pegawai'],
  ['jenjang', 'Peserta Didik per Jenjang'],
  ['nilai', 'Kelengkapan Nilai'],
  ['ultah', 'Ulang Tahun Bulan Ini'],
  ['sarpras', 'Prasarana (kondisi & pengajuan)'],
  ['kurikulum', 'Implementasi Kurikulum'],
  ['validasi', 'Status Validasi Data'],
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
  const ruang = useCol('ruang').filter((r) => !r.dihapus)
  const bangunan = useCol('bangunan').filter((b) => !b.dihapus)
  const pengajuan = useCol('pengajuan')
  const mapel = useCol('mapel')
  const absensi = useCol('absensi')
  const nilai = useCol('nilai')
  const [tgl, setTgl] = useState(tanggalAwal)
  const [hidden, setHidden] = useState<string[]>(loadHidden)
  const [menu, setMenu] = useState(false)
  const [, setTick] = useState(0)
  const temuan = useValidasi()
  const sesi = useSesi()

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

  const impl = implementasiKurikulum(rombel, sekolah.tahunAjaranAktif)
  const totImpl = impl.reduce((a, x) => a + x.rombel, 0) || 1
  const nInv = temuan.filter((t) => t.level === 'invalid').length
  const nWarn = temuan.length - nInv
  const katInv = [...new Set(temuan.filter((t) => t.level === 'invalid').map((t) => t.kategori))]

  const L = aktif.filter((s) => s.jk === 'L').length
  const P = aktif.length - L

  const nilaiKurang = rombelAktif.filter((r) => {
    const mp = mapel.filter((m) => m.jenjang.includes(r.jenjang)).length
    const isi = nilai.filter((n) => n.rombelId === r.id && n.tahunAjaran === sekolah.tahunAjaranAktif && n.semester === sekolah.semesterAktif && Object.keys(n.data).length > 0).length
    return mp > 0 && isi < mp
  }).length
  const belumDiabsen = tgl === today() ? Math.max(0, rombelAktif.length - absenSiswaHari.length) : 0
  const ultahHariIni = ultah.filter((u) => parseIso(u.tgl).getDate() === new Date().getDate()).length

  return (
    <div className="dash">
      <section className="hero">
        <div className="hero-top">
          <div>
            <h2>{sapaan()}, {sesi?.akun.nama.split(' ')[0] ?? 'Pengguna'}</h2>
            <p>{sekolah.nama} · TA {sekolah.tahunAjaranAktif} Semester {sekolah.semesterAktif === 1 ? 'Ganjil' : 'Genap'} · {fmtTanggalHari(today())}</p>
          </div>
          <div className="hero-chips">
            {belumDiabsen > 0 && boleh('absensiSiswa') && <button className="hchip kuning" onClick={() => nav.open('absensiSiswa')}><b>{belumDiabsen}</b> rombel belum diabsen</button>}
            {nilaiKurang > 0 && boleh('nilai') && <button className="hchip kuning" onClick={() => nav.open('nilai')}><b>{nilaiKurang}</b> rombel nilai belum lengkap</button>}
            {nInv > 0 ? <button className="hchip merah" onClick={() => nav.open('validasi')}><b>{nInv}</b> data invalid</button> : <button className="hchip hijau" onClick={() => nav.open('validasi')}>Data valid</button>}
            {ultahHariIni > 0 && <span className="hchip">🎂 <b>{ultahHariIni}</b> berulang tahun hari ini</span>}
          </div>
        </div>
      </section>
      <div className="aksi-cepat">
        {AKSI.filter((a) => boleh(a.id)).map((a, i) => (
          <button key={a.id} className="aksi" style={{ animationDelay: `${i * 50}ms` }} onClick={() => nav.open(a.id)}>
            <span className="aksi-ico" style={{ background: a.warna }}><Icon name={a.icon} size={18} /></span>
            <span><b>{a.label}</b><small>{a.ket}</small></span>
          </button>
        ))}
      </div>
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

      {show('profil') && (() => {
        const p = (id?: string) => namaPegawai(pegawai.find((x) => x.id === id)) || undefined
        const tgl = (t?: string) => (t ? fmtTanggal(t) : undefined)
        const gabung = (...a: (string | undefined | false)[]) => a.filter(Boolean).join(' · ') || undefined
        const kelompok: [string, string, [string, string | undefined][]][] = [
          ['Identitas', 'school', [
            ['NPSN', sekolah.npsn], ['NSS', sekolah.nss], ['Jenjang', sekolah.jenjang.join(', ')], ['Status', gabung(sekolah.statusSekolah, sekolah.statusOperasional)],
            ['Kepemilikan', sekolah.statusKepemilikan], ['Yayasan', sekolah.yayasan], ['Penyelenggaraan', sekolah.waktuPenyelenggaraan],
          ]],
          ['Legalitas & Akreditasi', 'validasi', [
            ['Akreditasi', gabung(sekolah.akreditasi, sekolah.akreditasiBerlaku && `berlaku s.d. ${sekolah.akreditasiBerlaku}`)], ['SK akreditasi', gabung(sekolah.skAkreditasi, tgl(sekolah.tglAkreditasi))],
            ['SK pendirian', gabung(sekolah.skPendirian, tgl(sekolah.tglSkPendirian))], ['Izin operasional', gabung(sekolah.skIzinOperasional, tgl(sekolah.tglSkIzinOperasional))],
          ]],
          ['Alamat & Kontak', 'map', [
            ['Alamat', alamatLengkap(sekolah) || undefined], ['Telepon / faks', gabung(sekolah.telepon, sekolah.fax)], ['Email', sekolah.email], ['Laman', sekolah.website],
            ['Koordinat', gabung(sekolah.lintang, sekolah.bujur)],
          ]],
          ['Pejabat Sekolah', 'pegawai', [
            ['Kepala sekolah', p(sekolah.kepalaSekolahId)], ['Wakil kurikulum', p(sekolah.wakaKurikulumId)], ['Bendahara', p(sekolah.bendaharaId)],
            ['Kepala TU', p(sekolah.kaTuId)], ['Operator', p(sekolah.operatorId)], ['Ketua komite', sekolah.ketuaKomite],
          ]],
          ['Tahun Ajaran & Data', 'rombel', [
            ['Tahun ajaran', `${sekolah.tahunAjaranAktif} · Semester ${sekolah.semesterAktif}`], ['Peserta didik aktif', String(aktif.length)], ['Guru / tendik', `${guru.length} / ${tendik.length}`],
            ['Rombel', String(rombelAktif.length)], ['Luas tanah', sekolah.luasTanahMilik ? `${sekolah.luasTanahMilik} m²` : undefined],
            ['Listrik / internet', gabung(sekolah.sumberListrik && `${sekolah.sumberListrik}${sekolah.dayaListrik ? ` ${sekolah.dayaListrik} VA` : ''}`, sekolah.aksesInternet)],
          ]],
        ]
        return (
          <Card title="Profil & Informasi Sekolah" className="mb" actions={boleh('pengaturan') ? <button className="icon-btn" title="Ubah di Pengaturan" onClick={() => nav.open('pengaturan')}><Icon name="edit" size={16} /></button> : undefined}>
            <div className="profil-sk">
              <div className="profil-id">
                <LogoSekolah logo={sekolah.logo} t={{ ...tampilanDari(sekolah), logoUkuran: 72, logoLatar: 'putih', logoBingkai: true }} />
                <div>
                  <b>{sekolah.nama}</b>
                  <span>{gabung(sekolah.npsn && `NPSN ${sekolah.npsn}`, sekolah.statusSekolah, sekolah.akreditasi && `Akreditasi ${sekolah.akreditasi}`) ?? ' '}</span>
                  {sekolah.statusOperasional && <span className={`pill ${sekolah.statusOperasional === 'Aktif' ? 'ok' : 'warn'}`}>{sekolah.statusOperasional}</span>}
                </div>
              </div>
              <div className="profil-grup">
                {kelompok.map(([judul, , baris]) => (
                  <section key={judul}>
                    <h5>{judul}</h5>
                    <dl>
                      {baris.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={v ? '' : 'kosong'}>{v ?? 'belum diisi'}</dd></div>)}
                    </dl>
                  </section>
                ))}
              </div>
            </div>
          </Card>
        )
      })()}

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
                <button className="kpi" onClick={() => nav.open('siswa')}><span>Peserta Didik Aktif</span><b><Angka n={aktif.length} /></b></button>
                <button className="kpi" onClick={() => nav.open('pegawai')}><span>Guru</span><b><Angka n={guru.length} /></b></button>
                <button className="kpi" onClick={() => nav.open('pegawai')}><span>Tenaga Kependidikan</span><b><Angka n={tendik.length} /></b></button>
                <button className="kpi" onClick={() => nav.open('rombel')}><span>Rombel {sekolah.tahunAjaranAktif}</span><b><Angka n={rombelAktif.length} /></b></button>
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
                    <tr key={r.id} className="klik" title="Buka absensi siswa" onClick={() => nav.open('absensiSiswa')}>
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
      {(show('kurikulum') || show('validasi')) && (
        <div className="grid-2">
          {show('kurikulum') && (
            <Card title={`Implementasi Kurikulum ${sekolah.tahunAjaranAktif}`} actions={<button className="icon-btn" title="Rombel" onClick={() => nav.open('rombel')}><Icon name="edit" size={16} /></button>}>
              <div className="muted right small">Dihitung otomatis dari data rombel</div>
              <table className="mini">
                <thead><tr><th>Kurikulum</th><th>Jenjang</th><th className="num">Rombel</th><th className="num">Peserta Didik</th><th style={{ width: '30%' }}></th></tr></thead>
                <tbody>
                  {impl.map((x) => (
                    <tr key={x.kurikulumId}>
                      <td><b>{getKurikulum(x.kurikulumId).nama}</b></td>
                      <td>{x.jenjang.join(', ')}</td>
                      <td className="num">{x.rombel}</td>
                      <td className="num">{x.siswa}</td>
                      <td><Meter pct={(x.rombel / totImpl) * 100} color="var(--accent)" /></td>
                    </tr>
                  ))}
                  {!impl.length && <tr><td colSpan={5} className="muted">Belum ada rombel pada tahun ajaran aktif.</td></tr>}
                </tbody>
              </table>
            </Card>
          )}
          {show('validasi') && (
            <Card title="Status Validasi Data" actions={<button className="icon-btn" title="Validasi data" onClick={() => nav.open('validasi')}><Icon name="validasi" size={16} /></button>}>
              <div className="stat-row">
                <div><span>Invalid</span><b className="bad-t">{nInv}</b></div>
                <div><span>Peringatan</span><b className="warn-t">{nWarn}</b></div>
                <div><span>Status</span><b className={nInv ? 'bad-t' : 'ok-t'}>{nInv ? 'Belum valid' : 'Valid'}</b></div>
              </div>
              {katInv.length > 0 && <p className="small">Perlu diperbaiki: {katInv.join(', ')}</p>}
              <p className="small muted">Validasi terakhir: {sekolah.validasiTerakhir ? new Date(sekolah.validasiTerakhir).toLocaleString('id-ID') : 'belum pernah'}</p>
              <Btn kind="ghost" onClick={() => nav.open('validasi')}>Buka Validasi Data</Btn>
            </Card>
          )}
        </div>
      )}
      {show('sarpras') && (
        <div className="grid-3">
          {([['Kondisi Ruang', ruang], ['Kondisi Bangunan', bangunan]] as const).map(([judul, list]) => (
            <Card key={judul} title={judul} actions={<button className="icon-btn" title="Prasarana" onClick={() => nav.open('prasarana')}><Icon name="edit" size={16} /></button>}>
              <ul className="progress-list">
                {['Tidak ada kerusakan', 'Rusak Ringan', 'Rusak Sedang', 'Rusak Berat', 'Rusak Total'].map((k) => {
                  const n = list.filter((x) => klasifikasiKerusakan(x.bobotKerusakan) === k).length
                  return n ? <li key={k}><div><b>{k}</b><em className={`pill ${pillKerusakan(k)}`}>{n}</em></div><Meter pct={(n / list.length) * 100} color={pillKerusakan(k) === 'ok' ? 'var(--ok)' : pillKerusakan(k) === 'warn' ? 'var(--warn)' : 'var(--bad)'} /></li> : null
                })}
                {!list.length && <li className="muted">Belum ada data.</li>}
              </ul>
            </Card>
          ))}
          <Card title="Pengajuan Perubahan Prasarana">
            {(() => {
              const aktif = pengajuanAktif(pengajuan)
              const tarik = pengajuan.filter((p) => p.status === 'Disetujui' && !p.tarikData)
              const terakhir = [...pengajuan].sort((a, b) => b.dibuat.localeCompare(a.dibuat)).slice(0, 4)
              return (
                <>
                  {aktif && <p className="small"><span className="pill warn">Aktif</span> {aktif.nama} ({aktif.status})</p>}
                  {tarik.length > 0 && <p className="small"><span className="pill warn">Perlu Realisasi</span> {tarik.length} pengajuan disetujui</p>}
                  <ul className="people">
                    {terakhir.map((p) => <li key={p.id}><div><b>{p.nama}</b><span className="muted">{p.objek} · {p.jenis}</span></div><em className={`pill ${KET_STATUS[p.status].pill}`}>{p.status}</em></li>)}
                    {!terakhir.length && <li className="muted">Belum ada pengajuan.</li>}
                  </ul>
                </>
              )
            })()}
          </Card>
        </div>
      )}
    </div>
  )
}
