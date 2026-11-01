import { Fragment, useState } from 'react'
import { getKurikulum } from '../curricula'
import { KopSurat, TandaTangan } from '../print'
import { getState, useCol } from '../store'
import { JENJANG, type Siswa } from '../types'
import { Btn, Card, Empty, PageHead, Tabs, printDoc } from '../ui'
import { fmtTanggal, namaPegawai } from '../util'
import { SiswaForm } from './Siswa'

export default function BukuInduk() {
  const siswa = useCol('siswa')
  useCol('nilai'); useCol('rombel')
  const [tab, setTab] = useState<'register' | 'lembar'>('register')
  const [sel, setSel] = useState<string>('')
  const [jenjang, setJenjang] = useState('')
  const [edit, setEdit] = useState<Siswa | null>(null)
  const list = siswa.filter((s) => !jenjang || s.jenjang === jenjang).sort((a, b) => a.noInduk.localeCompare(b.noInduk))
  const s = siswa.find((x) => x.id === sel) ?? list[0]

  const cetakRegister = () => printDoc(
    <div className="doc landscape">
      <KopSurat judul="BUKU INDUK PESERTA DIDIK" sub={jenjang ? `Jenjang ${jenjang}` : 'Semua jenjang'} />
      <Register list={list} />
    </div>,
  )

  return (
    <div>
      <PageHead title="Buku Induk" sub="Register induk peserta didik dan lembar buku induk per siswa (termasuk alumni dan mutasi)">
        {tab === 'register' ? <Btn icon="print" kind="primary" onClick={cetakRegister}>Cetak register</Btn>
          : s && <><Btn icon="edit" onClick={() => setEdit(s)}>Ubah data</Btn><Btn icon="print" kind="primary" onClick={() => printDoc(<LembarInduk s={s} />)}>Cetak lembar induk</Btn></>}
      </PageHead>
      <Tabs tabs={[['register', 'Register Buku Induk'], ['lembar', 'Lembar Induk Siswa']]} value={tab} onChange={setTab} />
      <div className="filters bar">
        <select value={jenjang} onChange={(e) => setJenjang(e.target.value)}><option value="">Semua jenjang</option>{JENJANG.map((j) => <option key={j}>{j}</option>)}</select>
        {tab === 'lembar' && (
          <select value={s?.id ?? ''} onChange={(e) => setSel(e.target.value)} aria-label="Pilih siswa">{list.map((x) => <option key={x.id} value={x.id}>{x.noInduk} · {x.nama} ({x.status})</option>)}</select>
        )}
      </div>
      {!list.length ? <Empty>Belum ada peserta didik.</Empty> : tab === 'register' ? (
        <Card title={`${list.length} entri buku induk`}>
          <Register list={list} onPick={(id) => { setSel(id); setTab('lembar') }} />
        </Card>
      ) : s ? (
        <Card title={`Lembar Buku Induk · ${s.nama}`}><div className="doc-preview"><LembarInduk s={s} /></div></Card>
      ) : null}
      {edit && <SiswaForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function Register({ list, onPick }: { list: Siswa[]; onPick?: (id: string) => void }) {
  return (
    <div className="table-wrap">
      <table className="tbl rekap-like">
        <thead><tr><th>No Induk</th><th>NISN</th><th>Nama</th><th>L/P</th><th>Tempat, Tgl Lahir</th><th>Nama Orang Tua</th><th>Tgl Masuk</th><th>Asal Sekolah</th><th>Status</th><th>Tgl Keluar</th><th>Ket.</th></tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id} className={onPick ? 'click' : ''} onClick={() => onPick?.(s.id)}>
              <td>{s.noInduk}</td><td>{s.nisn}</td><td><b>{s.nama}</b></td><td>{s.jk}</td>
              <td>{s.tempatLahir}{s.tanggalLahir ? `, ${fmtTanggal(s.tanggalLahir)}` : ''}</td>
              <td>{s.ayah.nama || s.ibu.nama || s.wali.nama}</td>
              <td>{s.tanggalMasuk ? fmtTanggal(s.tanggalMasuk) : ''}</td><td>{s.asalSekolah ?? s.pindahanDari}</td>
              <td>{s.status}</td><td>{s.tanggalKeluar ? fmtTanggal(s.tanggalKeluar) : ''}</td><td>{s.alasanKeluar ?? s.melanjutkanKe}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const row = (l: string, v?: string | number) => <Fragment key={l}><span className="k">{l}</span><span className="t">:</span><span className="v">{v === undefined || v === '' ? '-' : v}</span></Fragment>

export function LembarInduk({ s }: { s: Siswa }) {
  const st = getState()
  const kepsek = st.pegawai.find((p) => p.id === st.sekolah[0]?.kepalaSekolahId)
  const riwayat = st.rombel.filter((r) => r.siswaIds.includes(s.id)).sort((a, b) => a.tahunAjaran.localeCompare(b.tahunAjaran))
  return (
    <div className="doc induk">
      <KopSurat judul="LEMBAR BUKU INDUK PESERTA DIDIK" />
      <div className="induk-top">
        <div className="kvg">
            {row('Nomor Induk / NISN', `${s.noInduk || '-'} / ${s.nisn || '-'}`)}
            {row('NIK', s.nik)}
        </div>
        <div className="pasfoto">{s.foto ? <img src={s.foto} alt="" /> : <span>Pas foto<br />3 x 4</span>}</div>
      </div>
      <h4 className="sec">A. Keterangan Tentang Diri Peserta Didik</h4>
      <div className="kvg">
        {row('Nama lengkap', s.nama)}{row('Nama panggilan', s.namaPanggilan)}{row('Jenis kelamin', s.jk === 'L' ? 'Laki-laki' : 'Perempuan')}
        {row('Tempat, tanggal lahir', `${s.tempatLahir ?? '-'}, ${fmtTanggal(s.tanggalLahir)}`)}{row('Agama', s.agama)}{row('Kewarganegaraan', s.kewarganegaraan)}
        {row('Anak ke- / jumlah saudara', `${s.anakKe ?? '-'} / ${s.jumlahSaudara ?? '-'}`)}{row('Bahasa sehari-hari', s.bahasaRumah)}
        {row('Alamat / telepon', `${s.alamat ?? '-'}${s.telepon ? ` / ${s.telepon}` : ''}`)}{row('Tinggal dengan', s.tinggalDengan)}
      </div>
      <h4 className="sec">B. Keterangan Kesehatan</h4>
      <div className="kvg">
        {row('Golongan darah', s.golDarah)}{row('Tinggi / berat badan', `${s.tinggiBadan ?? '-'} cm / ${s.beratBadan ?? '-'} kg`)}{row('Penyakit yang pernah diderita', s.riwayatPenyakit)}
      </div>
      <h4 className="sec">C. Keterangan Orang Tua / Wali</h4>
      <table className="nilai"><thead><tr><th></th><th>Ayah</th><th>Ibu</th><th>Wali</th></tr></thead><tbody>
        {(['nama', 'pekerjaan', 'pendidikan', 'telepon', 'alamat'] as const).map((k) => (
          <tr key={k}><td className="lbl">{k[0].toUpperCase() + k.slice(1)}</td><td>{s.ayah[k] ?? ''}</td><td>{s.ibu[k] ?? ''}</td><td>{s.wali[k] ?? ''}</td></tr>
        ))}
      </tbody></table>
      <h4 className="sec">D. Riwayat Pendidikan</h4>
      <div className="kvg">
        {row('Diterima di sekolah ini', `${fmtTanggal(s.tanggalMasuk)}${s.diterimaDiKelas ? `, kelas ${s.diterimaDiKelas}` : ''}`)}
        {row('Asal sekolah / no. ijazah', `${s.asalSekolah ?? '-'} / ${s.noIjazahAsal ?? '-'}`)}
        {s.pindahanDari && row('Pindahan dari / alasan', `${s.pindahanDari} / ${s.alasanPindah ?? '-'}`)}
      </div>
      <h4 className="sec">E. Perkembangan Belajar</h4>
      <table className="nilai">
        <thead><tr><th>Tahun Pelajaran</th><th>Kelas</th><th>Wali Kelas</th><th>Kurikulum</th><th className="c">Rata-rata Smt 1</th><th className="c">Rata-rata Smt 2</th></tr></thead>
        <tbody>
          {riwayat.map((r) => {
            const kur = getKurikulum(r.kurikulumId)
            const rata = (sem: number) => {
              const v = st.nilai.filter((n) => n.rombelId === r.id && n.semester === sem && n.data[s.id]).map((n) => {
                const m = st.mapel.find((x) => x.id === n.mapelId)
                return kur.hitung(n.data[s.id], n.tujuan, m?.kkm ?? 70).nilai
              }).filter((x): x is number => x !== undefined)
              return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : kur.naratif ? 'naratif' : '-'
            }
            return <tr key={r.id}><td>{r.tahunAjaran}</td><td>{r.nama}</td><td>{namaPegawai(st.pegawai.find((p) => p.id === r.waliKelasId)) || '-'}</td><td>{kur.singkat}</td><td className="c">{rata(1)}</td><td className="c">{rata(2)}</td></tr>
          })}
          {!riwayat.length && <tr><td colSpan={6} className="c muted">Belum tercatat di rombel mana pun.</td></tr>}
        </tbody>
      </table>
      <h4 className="sec">F. Meninggalkan Sekolah</h4>
      <div className="kvg">
        {row('Status', s.status)}{row('Tanggal', s.tanggalKeluar ? fmtTanggal(s.tanggalKeluar) : '-')}{row('Alasan / pindah ke', s.alasanKeluar)}
        {row('No. ijazah', s.noIjazah)}{row('Melanjutkan ke', s.melanjutkanKe)}
      </div>
      {s.catatan && <><h4 className="sec">G. Catatan</h4><p>{s.catatan}</p></>}
      <TandaTangan kanan={{ jabatan: 'Kepala Sekolah', nama: kepsek ? namaPegawai(kepsek) : undefined, nip: kepsek?.nip ?? '' }} />
    </div>
  )
}

