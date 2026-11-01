import { useMemo, useState, type ReactNode } from 'react'
import { Icon } from './icons'
import { useCol, useSekolah } from './store'
import { Avatar, Nav, PrintHost, ToastHost, useNav, type PageId } from './ui'
import Dashboard from './pages/Dashboard'
import SiswaPage from './pages/Siswa'
import PegawaiPage from './pages/Pegawai'
import BukuInduk from './pages/BukuInduk'
import RombelPage from './pages/Rombel'
import MapelPage from './pages/Mapel'
import EkskulPage from './pages/Ekskul'
import AbsensiSiswa from './pages/AbsensiSiswa'
import AbsensiPegawai from './pages/AbsensiPegawai'
import Penilaian from './pages/Penilaian'
import Rapor from './pages/Rapor'
import Pengaturan from './pages/Pengaturan'
import Prasarana from './pages/Prasarana'
import { namaPegawai } from './util'

interface MenuItem { id: PageId; label: string; icon: string; group: string }

export const MENU: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Utama' },
  { id: 'siswa', label: 'Peserta Didik', icon: 'siswa', group: 'Data Induk' },
  { id: 'pegawai', label: 'Guru & Pegawai', icon: 'guru', group: 'Data Induk' },
  { id: 'induk', label: 'Buku Induk', icon: 'induk', group: 'Data Induk' },
  { id: 'rombel', label: 'Kelas / Rombel', icon: 'rombel', group: 'Akademik' },
  { id: 'mapel', label: 'Mata Pelajaran', icon: 'mapel', group: 'Akademik' },
  { id: 'ekskul', label: 'Ekstrakurikuler', icon: 'ekskul', group: 'Akademik' },
  { id: 'absensiSiswa', label: 'Absensi Siswa', icon: 'absensi', group: 'Kehadiran' },
  { id: 'absensiPegawai', label: 'Absensi Guru & Pegawai', icon: 'absenPegawai', group: 'Kehadiran' },
  { id: 'nilai', label: 'Penilaian', icon: 'nilai', group: 'Penilaian' },
  { id: 'rapor', label: 'Cetak Rapor', icon: 'rapor', group: 'Penilaian' },
  { id: 'prasarana', label: 'Prasarana (Sarpras)', icon: 'prasarana', group: 'Sarana Prasarana' },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'pengaturan', group: 'Sistem' },
]

const PAGES: Record<PageId, () => ReactNode> = {
  dashboard: () => <Dashboard />,
  siswa: () => <SiswaPage />,
  pegawai: () => <PegawaiPage />,
  induk: () => <BukuInduk />,
  rombel: () => <RombelPage />,
  mapel: () => <MapelPage />,
  ekskul: () => <EkskulPage />,
  absensiSiswa: () => <AbsensiSiswa />,
  absensiPegawai: () => <AbsensiPegawai />,
  nilai: () => <Penilaian />,
  rapor: () => <Rapor />,
  prasarana: () => <Prasarana />,
  pengaturan: () => <Pengaturan />,
}

export default function App() {
  const [tabs, setTabs] = useState<PageId[]>(['dashboard'])
  const [active, setActive] = useState<PageId>('dashboard')
  const [expanded, setExpanded] = useState(false)
  const sekolah = useSekolah()
  const pegawai = useCol('pegawai')
  const kepsek = pegawai.find((p) => p.id === sekolah.kepalaSekolahId)

  const nav = useMemo(() => ({
    open: (p: PageId) => {
      setTabs((t) => (t.includes(p) ? t : [...t, p]))
      setActive(p)
    },
  }), [])

  const close = (p: PageId) => {
    setTabs((t) => {
      const next = t.filter((x) => x !== p)
      if (active === p) setActive(next[Math.max(0, t.indexOf(p) - 1)] ?? 'dashboard')
      return next
    })
  }

  const label = (p: PageId) => MENU.find((m) => m.id === p)?.label ?? p
  let lastGroup = ''

  return (
    <Nav.Provider value={nav}>
      <div className={`shell ${expanded ? 'expanded' : ''}`}>
        <header className="topbar">
          <button className="icon-btn light" onClick={() => setExpanded((e) => !e)} aria-label="Menu"><Icon name="menu" /></button>
          <div className="brand">
            <span className="brand-mark"><Icon name="school" size={22} /></span>
            <div>
              <b>SIMAS</b><span className="brand-sub">Administrasi Sekolah · v0.1</span>
            </div>
          </div>
          <div className="topbar-fill" />
          <QuickSearch />
          <button className="icon-btn light" title="Bantuan" onClick={() => nav.open('pengaturan')}><Icon name="help" /></button>
          <div className="who">
            <b>{sekolah.nama}</b>
            <span>TA {sekolah.tahunAjaranAktif} · Semester {sekolah.semesterAktif === 1 ? 'Ganjil' : 'Genap'}</span>
          </div>
          {sekolah.logo ? <img className="avatar" src={sekolah.logo} alt="" style={{ width: 38, height: 38 }} /> : <Avatar nama={kepsek ? namaPegawai(kepsek) : sekolah.nama} size={38} />}
        </header>

        <nav className="sidebar" aria-label="Menu utama">
          {MENU.map((m) => {
            const showGroup = expanded && m.group !== lastGroup
            lastGroup = m.group
            return (
              <div key={m.id}>
                {showGroup && <div className="side-group">{m.group}</div>}
                <button className={`side-item ${active === m.id ? 'on' : ''}`} onClick={() => nav.open(m.id)} title={m.label}>
                  <Icon name={m.icon} size={22} />
                  <span className="side-label">{m.label}</span>
                </button>
              </div>
            )
          })}
        </nav>

        <div className="tabbar" role="tablist">
          {tabs.map((t) => (
            <div key={t} className={`tab ${active === t ? 'on' : ''}`} role="tab" aria-selected={active === t} onClick={() => setActive(t)}>
              <span>{label(t)}</span>
              {t !== 'dashboard' && (
                <button className="tab-x" aria-label={`Tutup ${label(t)}`} onClick={(e) => { e.stopPropagation(); close(t) }}><Icon name="close" size={13} /></button>
              )}
            </div>
          ))}
          <div className="tab-count">{tabs.length}</div>
        </div>

        <main className="content">
          {tabs.map((t) => (
            <div key={t} className="page" hidden={t !== active}>{PAGES[t]()}</div>
          ))}
        </main>
      </div>
      <ToastHost />
      <PrintHost />
    </Nav.Provider>
  )
}

function QuickSearch() {
  const [q, setQ] = useState('')
  const siswa = useCol('siswa')
  const pegawai = useCol('pegawai')
  const hasil = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    return [
      ...siswa.filter((x) => x.nama.toLowerCase().includes(s) || x.noInduk.includes(s) || x.nisn?.includes(s)).slice(0, 6).map((x) => ({ id: x.id, t: x.nama, d: `Peserta didik · ${x.noInduk} · ${x.jenjang}`, page: 'siswa' as PageId })),
      ...pegawai.filter((x) => x.nama.toLowerCase().includes(s) || x.nip?.includes(s)).slice(0, 4).map((x) => ({ id: x.id, t: namaPegawai(x), d: `${x.jenis} · ${x.jabatan ?? ''}`, page: 'pegawai' as PageId })),
    ]
  }, [q, siswa, pegawai])
  return (
    <SearchBox q={q} setQ={setQ} hasil={hasil} />
  )
}

function SearchBox({ q, setQ, hasil }: { q: string; setQ: (s: string) => void; hasil: { id: string; t: string; d: string; page: PageId }[] }) {
  const navc = useNav()
  return (
    <div className="qsearch">
      <Icon name="search" size={18} />
      <input className="qs" placeholder="Cari siswa / guru…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pencarian cepat" />
      {hasil.length > 0 && (
        <div className="qsearch-res">
          {hasil.map((h) => (
            <button key={h.id} onClick={() => { navc.open(h.page); setQ('') }}>
              <b>{h.t}</b><span>{h.d}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
