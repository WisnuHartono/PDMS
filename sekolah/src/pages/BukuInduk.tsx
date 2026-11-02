import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { getKurikulum } from '../curricula'
import { KopSurat, TandaTangan } from '../print'
import { getState, useCol } from '../store'
import { JENJANG, type Siswa } from '../types'
import { Btn, Card, Empty, PageHead, Tabs, printDoc } from '../ui'
import { fmtTanggal, namaPegawai } from '../util'
import { SiswaForm } from './Siswa'
import BukuIndukPegawai from './BukuIndukPegawai'

export default function BukuInduk() {
  const [kat, setKat] = useState<'siswa' | 'pegawai'>('siswa')
  return (
    <div>
      <PageHead title="Buku Induk" sub="Register dan lembar induk peserta didik serta guru & pegawai (termasuk alumni, mutasi, dan nonaktif)" />
      <Tabs tabs={[['siswa', 'Peserta Didik'], ['pegawai', 'Guru & Pegawai']]} value={kat} onChange={setKat} />
      {kat === 'siswa' ? <BukuIndukSiswa /> : <BukuIndukPegawai />}
    </div>
  )
}

function BukuIndukSiswa() {
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
      <PageHead title="Peserta Didik" sub="Register induk dan lembar buku induk per siswa">
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

const val = (v?: string | number) => (v === undefined || v === '' || v === null ? '-' : v)

export function LembarInduk({ s }: { s: Siswa }) {
  const st = getState()
  const kepsek = st.pegawai.find((p) => p.id === st.sekolah[0]?.kepalaSekolahId)
  const riwayat = st.rombel.filter((r) => r.siswaIds.includes(s.id)).sort((a, b) => a.tahunAjaran.localeCompare(b.tahunAjaran))
  const kelas = riwayat[riwayat.length - 1]?.nama
  const akar = useRef<HTMLDivElement>(null)
  // Kolom label selebar label terpanjang di seluruh dokumen, sehingga titik dua rapat dan sejajar di semua bagian
  useLayoutEffect(() => {
    const fit = () => {
      const d = akar.current; if (!d) return
      // Bagian A–C berbagi satu lebar kolom, bagian F dan H berbagi lebar lain sesuai label terpanjangnya
      const lebar = (k: Element) => { let m = 0; k.querySelectorAll<HTMLElement>('.k').forEach((e) => { e.style.width = 'max-content'; m = Math.max(m, e.offsetWidth); e.style.width = '' }); return m }
      ;['1', '2'].forEach((g) => {
        const grup = Array.from(d.querySelectorAll<HTMLElement>(`.kvn[data-grup="${g}"]`))
        const mg = Math.max(0, ...grup.map(lebar))
        if (mg) grup.forEach((k) => k.style.setProperty('--kolom-k', `${Math.ceil(mg) + 4}px`))
      })
    }
    fit(); document.fonts?.ready.then(fit).catch(() => undefined)
  })
  let no = 0
  const row = (l: string, v?: string | number, tebal = false) => { no += 1; return <Fragment key={l}><span className="n">{no}.</span><span className="k">{l}</span><span className="t">:</span><span className={`v ${tebal ? 'b' : ''}`}>{val(v)}</span></Fragment> }
  const ortu = (k: keyof NonNullable<Siswa['ayah']>) => [s.ayah[k], s.ibu[k]].map(String)
  const tglLahir = s.tanggalLahir ? fmtTanggal(s.tanggalLahir) : '-'
  const wali = s.wali.nama || s.wali.pekerjaan || s.wali.telepon
  return (
    <div ref={akar} className="doc induk">
      <KopSurat judul="LEMBAR BUKU INDUK PESERTA DIDIK" sub={`${kelas ? `Kelas ${kelas} | ` : ''}Status: ${s.status}`} />
      <h4 className="sec">A. Keterangan tentang anak</h4>
      <div className="induk-top">
        <div className="kvn" data-grup="1">
          {row('Nama lengkap', s.nama, true)}{row('Nama panggilan', s.namaPanggilan)}{row('Jenis kelamin', s.jk === 'L' ? 'Laki-laki' : 'Perempuan')}
          {row('Tempat, tanggal lahir', `${s.tempatLahir ?? '-'}, ${tglLahir}`)}{row('NIK', s.nik)}{row('NISN / NIPD', `${s.nisn || '-'} / ${s.noInduk || '-'}`)}
          {row('Agama', s.agama)}{row('Kewarganegaraan', s.kewarganegaraan)}{row('Status dalam keluarga', s.statusKeluarga)}
          {row('Anak ke-', s.anakKe)}{row('Jumlah saudara', s.jumlahSaudara)}{row('Bahasa sehari-hari', s.bahasaRumah)}
        </div>
        <div className="pasfoto">{s.foto ? <img src={s.foto} alt="" /> : <span>Pas foto<br />3 × 4</span>}</div>
      </div>
      <h4 className="sec">B. Keterangan tempat tinggal</h4>
      <div className="kvn" data-grup="1">
        {row('Alamat', s.alamat)}{row('Kelurahan/desa, kecamatan', [s.kelurahan, s.kecamatan].filter(Boolean).join(', '))}
        {row('Kabupaten/kota, provinsi, kode pos', [s.kabupaten, s.provinsi, s.kodePos].filter(Boolean).join(', '))}
        {row('Tinggal bersama', s.tinggalDengan)}{row('Jarak dan transportasi ke sekolah', [s.jarakSekolah, s.transportasi].filter(Boolean).join(', '))}
        {row('No. HP orang tua', s.ayah.telepon || s.ibu.telepon || s.wali.telepon || s.telepon)}
      </div>
      <h4 className="sec">C. Keterangan kesehatan</h4>
      <div className="kvn" data-grup="1">
        {row('Golongan darah', s.golDarah)}{row('Berat / tinggi badan', `${s.beratBadan ?? '-'} kg / ${s.tinggiBadan ?? '-'} cm`)}
        {row('Penyakit yang pernah diderita', s.riwayatPenyakit)}{row('Kebutuhan khusus', s.kebutuhanKhusus)}
      </div>
      <h4 className="sec">D. Keterangan orang tua kandung</h4>
      <table className="nilai ortu"><thead><tr><th>Keterangan</th><th>Ayah</th><th>Ibu</th></tr></thead><tbody>
        {([['Nama', 'nama'], ['NIK', 'nik'], ['Tahun lahir', 'tahunLahir'], ['Pendidikan terakhir', 'pendidikan'], ['Pekerjaan', 'pekerjaan'], ['No. HP', 'telepon']] as const).map(([l, k]) => (
          <tr key={k}><td>{l}</td><td>{val(ortu(k)[0] === 'undefined' ? undefined : ortu(k)[0])}</td><td>{val(ortu(k)[1] === 'undefined' ? undefined : ortu(k)[1])}</td></tr>
        ))}
      </tbody></table>
      <h4 className="sec">E. Keterangan wali</h4>
      {wali ? (
        <div className="kvn">
          {row('Nama', s.wali.nama)}{row('NIK', s.wali.nik)}{row('Pendidikan terakhir', s.wali.pendidikan)}{row('Pekerjaan', s.wali.pekerjaan)}{row('No. HP', s.wali.telepon)}{row('Alamat', s.wali.alamat)}
        </div>
      ) : <p className="ket">Tidak ada wali (diasuh orang tua kandung).</p>}
      <h4 className="sec">F. Riwayat pendidikan</h4>
      <div className="kvn" data-grup="2">
        {row('Tanggal diterima', s.tanggalMasuk ? fmtTanggal(s.tanggalMasuk) : undefined)}{row('Diterima di kelompok', s.diterimaDiKelas)}
        {row('Status penerimaan', s.jenisPendaftaran)}{row('Asal sekolah', s.asalSekolah)}
        {s.noIjazahAsal && row('No. ijazah asal', s.noIjazahAsal)}
        {s.pindahanDari && row('Pindahan dari', s.pindahanDari)}{s.alasanPindah && row('Alasan pindah', s.alasanPindah)}
        {row('Kelas saat ini', kelas)}
      </div>
      <h4 className="sec">G. Perkembangan belajar</h4>
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
      <h4 className="sec">H. Meninggalkan sekolah</h4>
      <div className="kvn" data-grup="2">
        {row('Status', s.status)}{row('Tanggal', s.tanggalKeluar ? fmtTanggal(s.tanggalKeluar) : '-')}{row('Alasan / pindah ke', s.alasanKeluar)}
        {row('No. ijazah', s.noIjazah)}{row('Melanjutkan ke', s.melanjutkanKe)}
      </div>
      {s.catatan && <><h4 className="sec">I. Catatan</h4><p>{s.catatan}</p></>}
      <TandaTangan kanan={{ jabatan: 'Kepala Sekolah', nama: kepsek ? namaPegawai(kepsek) : undefined, nip: kepsek?.nip ?? '' }} />
    </div>
  )
}

