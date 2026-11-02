import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './icons'
import { exportTerenkripsi, put, useCol, useSekolah } from './store'
import { awalanBerkas, jatuhTempo, unggah } from './cloud'
import { mulaiSinkron, sinkronSekarang } from './sinkron'
import { LampuKoneksi } from './koneksi'
import { Avatar, Btn, KonfirmasiHost, Nav, ToastHost, useNav, type AsalNav, type PageId } from './ui'
import { PrintHost } from './PratinjauCetak'
import Validasi, { useValidasi } from './pages/Validasi'
import AkunPage, { ProfilSaya } from './pages/Akun'
import { boleh, keluar, useSesi } from './security/sesi'
import { namaPegawai } from './util'
import { terapkanTema } from './tema'
import { kertasDari, MARGIN } from './kertas'
import { BrandApp, LogoSekolah, tampilanDari, terapkanHuruf, terapkanTandaAir, tinggiBrand } from './logo'

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
  { id: 'asesmen', label: 'Asesmen Siswa', icon: 'asesmen', group: 'Penilaian' },
  { id: 'rapor', label: 'Cetak Rapor', icon: 'rapor', group: 'Penilaian' },
  { id: 'administrasi', label: 'Administrasi Sekolah', icon: 'administrasi', group: 'Administrasi' },
  { id: 'prasarana', label: 'Prasarana (Sarpras)', icon: 'prasarana', group: 'Administrasi' },
  { id: 'validasi', label: 'Validasi Data', icon: 'validasi', group: 'Sistem' },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'pengaturan', group: 'Sistem' },
  { id: 'akun', label: 'Akun & Keamanan', icon: 'kunci', group: 'Sistem' },
]

const Dashboard = lazy(() => import('./pages/Dashboard'))
const SiswaPage = lazy(() => import('./pages/Siswa'))
const PegawaiPage = lazy(() => import('./pages/Pegawai'))
const BukuInduk = lazy(() => import('./pages/BukuInduk'))
const RombelPage = lazy(() => import('./pages/Rombel'))
const MapelPage = lazy(() => import('./pages/Mapel'))
const EkskulPage = lazy(() => import('./pages/Ekskul'))
const AbsensiSiswa = lazy(() => import('./pages/AbsensiSiswa'))
const AbsensiPegawai = lazy(() => import('./pages/AbsensiPegawai'))
const Penilaian = lazy(() => import('./pages/Penilaian'))
const Rapor = lazy(() => import('./pages/Rapor'))
const Asesmen = lazy(() => import('./pages/Asesmen'))
const Pengaturan = lazy(() => import('./pages/Pengaturan'))
const Prasarana = lazy(() => import('./pages/Prasarana'))
const Administrasi = lazy(() => import('./pages/Administrasi'))

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
  asesmen: () => <Asesmen />,
  rapor: () => <Rapor />,
  prasarana: () => <Prasarana />,
  administrasi: () => <Administrasi />,
  validasi: () => <Validasi />,
  pengaturan: () => <Pengaturan />,
  akun: () => <AkunPage />,
}

export default function App() {
  const [active, setActive] = useState<PageId>('dashboard')
  const [expanded, setExpanded] = useState(false)
  const [menuAkun, setMenuAkun] = useState(false)
  const sesi = useSesi()!
  const [profil, setProfil] = useState(!!sesi.peran.wajib2fa && !sesi.akun.totpEnc)
  const sekolah = useSekolah()
  // Ukuran kertas cetak (Pengaturan → Administrasi & Cetak): A3, A4, A5, B5, F4/Folio, Letter, Legal.
  // Dokumen yang melebihi satu halaman otomatis dibagi ke halaman berikutnya dengan margin yang sama.
  useEffect(() => {
    const k = kertasDari(sekolah)
    const r = document.documentElement
    r.dataset.kertas = String(sekolah.ukuranKertas ?? 'A4')
    r.style.setProperty('--kw', `${k.w}mm`); r.style.setProperty('--kh', `${k.h}mm`)
    r.style.setProperty('--kw-l', `${k.h}mm`); r.style.setProperty('--kh-l', `${k.w}mm`)
    let st = document.getElementById('simas-kertas')
    if (!st) { st = document.createElement('style'); st.id = 'simas-kertas'; document.head.appendChild(st) }
    st.textContent = `@page { size: ${k.w}mm ${k.h}mm; margin: ${MARGIN.potret.y}mm ${MARGIN.potret.x}mm ${MARGIN.potret.b}mm; } @page landscape { size: ${k.h}mm ${k.w}mm; margin: ${MARGIN.lanskap.y}mm ${MARGIN.lanskap.x}mm ${MARGIN.lanskap.b}mm; } @page label { size: ${k.w}mm ${k.h}mm; margin: 0; }`
  }, [sekolah.ukuranKertas])
  const jmlInvalid = useValidasi().filter((t) => t.level === 'invalid').length
  const tm = tampilanDari(sekolah)
  useEffect(() => { terapkanHuruf(tampilanDari({ tampilan: sekolah.tampilan })) }, [sekolah.tampilan])
  useEffect(() => { const t = tampilanDari({ tampilan: sekolah.tampilan }); void terapkanTandaAir(sekolah.logo, t.tandaAir, t.tandaAirUkuran, t.tandaAirOpasitas, kertasDari(sekolah)) }, [sekolah.logo, sekolah.tampilan, sekolah.ukuranKertas])
  // Cadangan otomatis terenkripsi (folder / WebDAV) saat aplikasi dibuka bila sudah waktunya
  const [otoJalan, setOtoJalan] = useState(false)
  useEffect(() => {
    const c = sekolah.cloud
    if (otoJalan || !c || !jatuhTempo(c)) return
    setOtoJalan(true)
    void (async () => {
      let hasil: string
      try { await unggah(c, `${awalanBerkas(c)}-cadangan-${new Date().toISOString().slice(0, 10)}.simas.json`, await exportTerenkripsi(c.sandiOto!), 'application/json'); hasil = 'Otomatis: berhasil' }
      catch (e) { hasil = `Otomatis: gagal (${(e as Error).message})` }
      await put('sekolah', { ...sekolah, cloud: { ...c, terakhir: hasil.includes('berhasil') ? new Date().toISOString() : c.terakhir, hasilTerakhir: hasil } })
    })()
  }, [sekolah, otoJalan])
  // Sinkronisasi otomatis ke cloud (saat online) dengan penyimpanan lokal sebagai sumber utama
  const cloudRef = useRef(sekolah.cloud)
  cloudRef.current = sekolah.cloud
  useEffect(() => mulaiSinkron(() => cloudRef.current), [])
  useEffect(() => { void sinkronSekarang(sekolah.cloud) }, [sekolah.cloud?.sinkron, sekolah.cloud?.tujuan, sekolah.cloud?.sandiOto])
  useEffect(() => { terapkanTema(tampilanDari({ tampilan: sekolah.tampilan })) }, [sekolah.tampilan])
  const tinggiTop = Math.max(60, tm.logoUkuran + 16, tinggiBrand(tm))
  useEffect(() => { document.title = `${tm.appNama || 'SIMAS'} - ${tm.appSub || 'Administrasi Sekolah'}` }, [tm.appNama, tm.appSub])
  const menu = MENU.filter((m) => boleh(m.id))

  const [asal, setAsal] = useState<AsalNav | null>(null)
  const nav = useMemo(() => ({
    open: (p: PageId, dari?: AsalNav) => { if (boleh(p)) { setActive(p); setAsal(dari ?? null) } },
  }), [])

  let lastGroup = ''
  const halaman = boleh(active) ? active : 'dashboard'

  return (
    <Nav.Provider value={nav}>
      <div className={`shell ${expanded ? 'expanded' : ''}`} style={{ '--top-h': `${tinggiTop}px` } as import('react').CSSProperties}>
        <header className="topbar">
          <button className="icon-btn light" onClick={() => setExpanded((e) => !e)} aria-label="Menu"><Icon name="menu" /></button>
          <BrandApp t={tm} bawah={tm.appTampilLampu ? <LampuKoneksi /> : undefined} />
          <div className="topbar-fill" />
          <QuickSearch />
          <div className="top-sekolah" title={[`TA ${sekolah.tahunAjaranAktif} Semester ${sekolah.semesterAktif === 1 ? 'Ganjil' : 'Genap'}`, sekolah.jenjang.join(' · '), sekolah.alamat].filter(Boolean).join(' · ')}>
            <LogoSekolah logo={sekolah.logo} t={tm} />
            {tm.tampilNama && (
              <div className="who">
                <b className="sk-nama" style={{ fontSize: tm.namaUkuran }}>{sekolah.nama}</b>
                {tm.tampilLegalitas && <span className="sk-legal">{[sekolah.npsn && `NPSN ${sekolah.npsn}`, sekolah.statusSekolah, sekolah.akreditasi && `Akreditasi ${sekolah.akreditasi}`, sekolah.skIzinOperasional && `SK Izin ${sekolah.skIzinOperasional}`].filter(Boolean).join(' · ') || sekolah.jenjang.join(' · ')}</span>}
              </div>
            )}
          </div>
          <div className="akun-wrap">
            <button className="akun-btn" onClick={() => setMenuAkun((x) => !x)} aria-haspopup="menu" aria-expanded={menuAkun}>
              <Avatar nama={sesi.akun.nama} foto={sesi.akun.foto} size={34} />
              <div className="who">
                <b>{sesi.akun.nama}</b>
                <span>{sesi.peran.nama}</span>
              </div>
              <span className="caret">▾</span>
            </button>
            {menuAkun && (
              <div className="akun-menu" role="menu" onMouseLeave={() => setMenuAkun(false)}>
                <div className="akun-menu-h">
                  <Avatar nama={sesi.akun.nama} foto={sesi.akun.foto} size={40} />
                  <div><b>{sesi.akun.nama}</b><span>@{sesi.akun.username} · {sesi.peran.nama}</span>
                    <span>{sesi.akun.totpEnc ? '🔒 Verifikasi 2 langkah aktif' : '⚠ Verifikasi 2 langkah belum aktif'}</span></div>
                </div>
                <button role="menuitem" onClick={() => { setProfil(true); setMenuAkun(false) }}>Profil & keamanan akun</button>
                {boleh('akun') && <button role="menuitem" onClick={() => { nav.open('akun'); setMenuAkun(false) }}>Kelola akun pengguna</button>}
                {boleh('pengaturan') && <button role="menuitem" onClick={() => { nav.open('pengaturan'); setMenuAkun(false) }}>Pengaturan sekolah</button>}
                <button role="menuitem" className="keluar" onClick={() => keluar()}>Keluar</button>
              </div>
            )}
          </div>
        </header>

        <nav className="sidebar" aria-label="Menu utama">
          {menu.map((m) => {
            const showGroup = expanded && m.group !== lastGroup
            lastGroup = m.group
            return (
              <div key={m.id}>
                {showGroup && <div className="side-group">{m.group}</div>}
                <button className={`side-item ${halaman === m.id ? 'on' : ''}`} onClick={() => nav.open(m.id)} title={m.label} aria-current={halaman === m.id ? 'page' : undefined}>
                  <Icon name={m.icon} size={22} />
                  <span className="side-label">{m.label}</span>
                  {m.id === 'validasi' && jmlInvalid > 0 && <span className="side-badge" title={`${jmlInvalid} data invalid`} aria-hidden="true">{jmlInvalid > 99 ? '99+' : jmlInvalid}</span>}
                </button>
              </div>
            )
          })}
        </nav>

        <main className="content">
          <div key={halaman} className="page">
            {asal && (
              <div className="back-bar">
                <Btn icon="chevL" onClick={() => { asal.onBack?.(); nav.open(asal.page) }}>Kembali</Btn>
                <span className="muted small">ke {asal.label}</span>
              </div>
            )}
            <Suspense fallback={<div className="muted" style={{ padding: 24 }}>Memuat…</div>}>{PAGES[halaman]()}</Suspense>
          </div>
        </main>
      </div>
      {profil && <ProfilSaya onClose={() => setProfil(false)} />}
      <ToastHost />
      <KonfirmasiHost />
      <PrintHost />
    </Nav.Provider>
  )
}

function QuickSearch() {
  const [q, setQ] = useState('')
  const siswa = useCol('siswa')
  const pegawai = useCol('pegawai')
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector<HTMLInputElement>('input.qs')?.focus() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
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
      <input className="qs" placeholder="Cari siswa / guru…  (Ctrl K)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pencarian cepat" />
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
