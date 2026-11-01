import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { KopSurat, TandaTangan } from '../print'
import { getState, useCol } from '../store'
import { type Pegawai } from '../types'
import { Btn, Card, Empty, printDoc } from '../ui'
import { fmtTanggal, namaPegawai } from '../util'

const val = (v?: string | number) => (v === undefined || v === '' || v === null ? '-' : v)
const ttl = (p: Pegawai) => `${p.tempatLahir ?? '-'}, ${p.tanggalLahir ? fmtTanggal(p.tanggalLahir) : '-'}`

export function CetakRegisterPegawai(list: Pegawai[], judul: string) {
  printDoc(
    <div className="doc landscape">
      <KopSurat judul="BUKU INDUK GURU DAN PEGAWAI" sub={judul} />
      <RegisterPegawai list={list} />
    </div>,
  )
}

export function RegisterPegawai({ list, onPick }: { list: Pegawai[]; onPick?: (id: string) => void }) {
  return (
    <div className="table-wrap">
      <table className="tbl rekap-like">
        <thead><tr><th>No</th><th>Nama</th><th>L/P</th><th>Tempat, Tgl Lahir</th><th>NIP / NUPTK</th><th>Jabatan</th><th>Status</th><th>TMT</th><th>Pendidikan</th><th>Ket.</th></tr></thead>
        <tbody>
          {list.map((p, i) => (
            <tr key={p.id} className={onPick ? 'click' : ''} onClick={() => onPick?.(p.id)}>
              <td>{i + 1}</td><td><b>{namaPegawai(p)}</b></td><td>{p.jk}</td><td>{ttl(p)}</td>
              <td>{[p.nip, p.nuptk].filter(Boolean).join(' / ') || '-'}</td><td>{p.jabatan ?? p.jenis}</td><td>{p.statusKepegawaian ?? '-'}</td>
              <td>{p.tmt ? fmtTanggal(p.tmt) : '-'}</td><td>{[p.pendidikanTerakhir, p.jurusan].filter(Boolean).join(' ') || '-'}</td><td>{p.aktif ? 'Aktif' : 'Nonaktif'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LembarIndukPegawai({ p }: { p: Pegawai }) {
  const st = getState()
  const kepsek = st.pegawai.find((x) => x.id === st.sekolah[0]?.kepalaSekolahId)
  const akar = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const fit = () => {
      const d = akar.current; if (!d) return
      let m = 0
      d.querySelectorAll<HTMLElement>('.kvn .k').forEach((e) => { e.style.width = 'max-content'; m = Math.max(m, e.offsetWidth); e.style.width = '' })
      if (m) d.style.setProperty('--kolom-k', `${Math.ceil(m) + 4}px`)
    }
    fit(); document.fonts?.ready.then(fit).catch(() => undefined)
  })
  let no = 0
  const row = (l: string, v?: string | number, tebal = false) => { no += 1; return <Fragment key={l}><span className="n">{no}.</span><span className="k">{l}</span><span className="t">:</span><span className={`v ${tebal ? 'b' : ''}`}>{val(v)}</span></Fragment> }
  const mapel = (p.mapelIds ?? []).map((id) => st.mapel.find((m) => m.id === id)?.nama).filter(Boolean).join(', ')
  const tugas = st.rombel.flatMap((r) => [
    ...(r.waliKelasId === p.id ? [{ tahun: r.tahunAjaran, kelas: r.nama, tugas: 'Wali kelas', jp: '' as string | number }] : []),
    ...(r.pembelajaran ?? []).filter((x) => x.guruId === p.id).map((x) => ({ tahun: r.tahunAjaran, kelas: r.nama, tugas: `Guru ${st.mapel.find((m) => m.id === x.mapelId)?.nama ?? 'mata pelajaran'}`, jp: x.jp })),
  ]).sort((a, b) => a.tahun.localeCompare(b.tahun) || a.kelas.localeCompare(b.kelas))
  return (
    <div ref={akar} className="doc induk">
      <KopSurat judul="LEMBAR BUKU INDUK GURU DAN PEGAWAI" sub={`${p.jabatan ?? p.jenis} | Status: ${p.aktif ? 'Aktif' : 'Nonaktif'}`} />
      <h4 className="sec">A. Keterangan pribadi</h4>
      <div className="induk-top">
        <div className="kvn">
          {row('Nama lengkap', namaPegawai(p), true)}{row('Jenis kelamin', p.jk === 'L' ? 'Laki-laki' : 'Perempuan')}{row('Tempat, tanggal lahir', ttl(p))}
          {row('NIK', p.nik)}{row('Agama', p.agama)}{row('Alamat', p.alamat)}{row('No. HP', p.telepon)}{row('Email', p.email)}
        </div>
        <div className="pasfoto">{p.foto ? <img src={p.foto} alt="" /> : <span>Pas foto<br />3 × 4</span>}</div>
      </div>
      <h4 className="sec">B. Keterangan kepegawaian</h4>
      <div className="kvn">
        {row('NIP', p.nip)}{row('NUPTK', p.nuptk)}{row('Jenis GTK', p.jenis)}{row('Jabatan', p.jabatan)}
        {row('Status kepegawaian', p.statusKepegawaian)}{row('Terhitung mulai tanggal (TMT)', p.tmt ? fmtTanggal(p.tmt) : undefined)}
        {row('Tugas tambahan', p.tugasTambahan)}{row('Status saat ini', p.aktif ? 'Aktif' : 'Nonaktif')}
      </div>
      <h4 className="sec">C. Pendidikan dan sertifikasi</h4>
      <div className="kvn">
        {row('Pendidikan terakhir', p.pendidikanTerakhir)}{row('Jurusan / program studi', p.jurusan)}
        {row('No. sertifikat pendidik', p.noSertifikatPendidik)}{row('Tahun sertifikasi', p.tahunSertifikasi)}{row('Bidang sertifikasi', p.bidangSertifikasi)}
      </div>
      <h4 className="sec">D. Tugas mengajar</h4>
      <div className="kvn">{row('Mata pelajaran diampu', mapel)}</div>
      <table className="nilai">
        <thead><tr><th>Tahun Pelajaran</th><th>Kelas</th><th>Tugas</th><th className="c">JP / minggu</th></tr></thead>
        <tbody>
          {tugas.map((t, i) => <tr key={i}><td>{t.tahun}</td><td>{t.kelas}</td><td>{t.tugas}</td><td className="c">{t.jp === '' ? '-' : t.jp}</td></tr>)}
          {!tugas.length && <tr><td colSpan={4} className="c muted">Belum tercatat penugasan di rombel mana pun.</td></tr>}
        </tbody>
      </table>
      <TandaTangan kanan={{ jabatan: 'Kepala Sekolah', nama: kepsek ? namaPegawai(kepsek) : undefined, nip: kepsek?.nip ?? '' }} />
    </div>
  )
}

export default function BukuIndukPegawai() {
  const pegawai = useCol('pegawai')
  useCol('rombel'); useCol('mapel')
  const [tab, setTab] = useState<'register' | 'lembar'>('register')
  const [jenis, setJenis] = useState('')
  const [aktif, setAktif] = useState('')
  const [sel, setSel] = useState('')
  const list = pegawai.filter((p) => (!jenis || p.jenis === jenis) && (!aktif || (aktif === 'aktif') === p.aktif)).sort((a, b) => a.nama.localeCompare(b.nama))
  const p = pegawai.find((x) => x.id === sel) ?? list[0]
  const ket = [jenis || 'Semua GTK', aktif === 'aktif' ? 'Aktif' : aktif === 'nonaktif' ? 'Nonaktif' : ''].filter(Boolean).join(' · ')
  return (
    <>
      <div className="filters bar">
        <select value={tab} onChange={(e) => setTab(e.target.value as 'register' | 'lembar')} aria-label="Tampilan"><option value="register">Register</option><option value="lembar">Lembar induk per orang</option></select>
        <select value={jenis} onChange={(e) => setJenis(e.target.value)} aria-label="Jenis GTK"><option value="">Semua GTK</option>{['Guru', 'Tenaga Kependidikan', 'Yayasan'].map((j) => <option key={j}>{j}</option>)}</select>
        <select value={aktif} onChange={(e) => setAktif(e.target.value)} aria-label="Status"><option value="">Aktif & nonaktif</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select>
        {tab === 'lembar' && <select value={p?.id ?? ''} onChange={(e) => setSel(e.target.value)} aria-label="Pilih pegawai">{list.map((x) => <option key={x.id} value={x.id}>{namaPegawai(x)} ({x.jabatan ?? x.jenis})</option>)}</select>}
        <span className="grow" />
        {tab === 'register' ? <Btn icon="print" kind="primary" onClick={() => CetakRegisterPegawai(list, ket)}>Cetak register</Btn>
          : p && <Btn icon="print" kind="primary" onClick={() => printDoc(<LembarIndukPegawai p={p} />)}>Cetak lembar induk</Btn>}
      </div>
      {!list.length ? <Empty>Belum ada data guru atau pegawai.</Empty> : tab === 'register' ? (
        <Card title={`${list.length} entri buku induk GTK`}><RegisterPegawai list={list} onPick={(id) => { setSel(id); setTab('lembar') }} /></Card>
      ) : p ? <Card title={`Lembar Buku Induk · ${namaPegawai(p)}`}><div className="doc-preview"><LembarIndukPegawai p={p} /></div></Card> : null}
    </>
  )
}
