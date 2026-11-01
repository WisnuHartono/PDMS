// Penyusunan data rapor + dokumen cetak rapor per siswa.
import { getKurikulum } from './curricula'
import { KopSurat } from './print'
import { getSekolah, getState } from './store'
import type { CatatanRapor, Rombel, Siswa } from './types'
import { fmtTanggal, namaPegawai, rekapAbsensi, rentangSemester } from './util'

export function fase(r: Pick<Rombel, 'jenjang' | 'tingkat'>): string | undefined {
  const t = Number(r.tingkat)
  if (r.jenjang === 'PAUD' || r.jenjang === 'TK') return 'Fondasi'
  if (r.jenjang === 'SD') return t <= 2 ? 'A' : t <= 4 ? 'B' : 'C'
  if (r.jenjang === 'SMP') return 'D'
  if (r.jenjang === 'SMA' || r.jenjang === 'SMK') return t <= 10 ? 'E' : 'F'
  return undefined
}

export function catatanId(ta: string, sem: number, sid: string) {
  return `${ta}|${sem}|${sid}`
}

export function dataRapor(siswa: Siswa, r: Rombel, semester: 1 | 2) {
  const st = getState()
  const kur = getKurikulum(r.kurikulumId)
  const mapel = st.mapel.filter((m) => m.jenjang.includes(r.jenjang)).sort((a, b) => a.urutan - b.urutan)
  const baris = mapel.map((m) => {
    const lembar = st.nilai.find((n) => n.id === `${r.tahunAjaran}|${semester}|${r.id}|${m.id}`)
    const h = kur.hitung(lembar?.data[siswa.id], lembar?.tujuan ?? [], m.kkm ?? 70)
    return { mapel: m, hasil: h, ada: !!lembar?.data[siswa.id] }
  })
  const catatan: CatatanRapor | undefined = st.rapor.find((c) => c.id === catatanId(r.tahunAjaran, semester, siswa.id))
  const [dari, sampai] = rentangSemester(r.tahunAjaran, semester)
  const rek = rekapAbsensi(st.absensi, dari, sampai, (a) => a.jenis === 'siswa' && a.rombelId === r.id)[siswa.id]
  const hadir = {
    sakit: catatan?.sakitManual ?? rek?.S ?? 0,
    izin: catatan?.izinManual ?? rek?.I ?? 0,
    alpa: catatan?.alpaManual ?? rek?.A ?? 0,
  }
  return { kur, baris, catatan, hadir }
}

export function RaporDoc({ siswa, rombel, semester }: { siswa: Siswa; rombel: Rombel; semester: 1 | 2 }) {
  const s = getSekolah()
  const st = getState()
  const { kur, baris, catatan, hadir } = dataRapor(siswa, rombel, semester)
  const wali = st.pegawai.find((p) => p.id === rombel.waliKelasId)
  const kepsek = st.pegawai.find((p) => p.id === s.kepalaSekolahId)
  const intl = kur.asal === 'Internasional'
  const L = intl
    ? { nama: 'Student Name', nis: 'Student ID', kelas: 'Class', sem: 'Term', ta: 'Academic Year', absen: 'Attendance', sakit: 'Sick', izin: 'Excused', alpa: 'Unexcused', ekskul: 'Extracurricular', wali: 'Homeroom Teacher', catatan: "Homeroom Teacher's Comment", ortu: 'Parent / Guardian', kepsek: 'Principal', no: 'No', mapel: 'Subject', hari: 'day(s)' }
    : { nama: 'Nama Peserta Didik', nis: 'NIS / NISN', kelas: 'Kelas', sem: 'Semester', ta: 'Tahun Pelajaran', absen: 'Ketidakhadiran', sakit: 'Sakit', izin: 'Izin', alpa: 'Tanpa Keterangan', ekskul: 'Ekstrakurikuler', wali: 'Wali Kelas', catatan: 'Catatan Wali Kelas', ortu: 'Orang Tua / Wali', kepsek: 'Kepala Sekolah', no: 'No', mapel: kur.naratif ? 'Elemen Capaian Pembelajaran' : 'Mata Pelajaran', hari: 'hari' }
  const f = fase(rombel)
  const kelompok = [...new Set(baris.map((b) => b.mapel.kelompok ?? ''))]

  return (
    <div className="doc rapor">
      <KopSurat />
      <h1 className="doc-title">{kur.judulRapor}</h1>
      <table className="ident">
        <tbody>
          <tr><td>{L.nama}</td><td>: <b>{siswa.nama.toUpperCase()}</b></td><td>{L.kelas}</td><td>: {rombel.nama}{f && !intl ? ` (Fase ${f})` : ''}</td></tr>
          <tr><td>{L.nis}</td><td>: {siswa.noInduk}{siswa.nisn ? ` / ${siswa.nisn}` : ''}</td><td>{L.sem}</td><td>: {semester} ({semester === 1 ? (intl ? 'First' : 'Ganjil') : (intl ? 'Second' : 'Genap')})</td></tr>
          <tr><td>{intl ? 'School' : 'Sekolah'}</td><td>: {s.nama}</td><td>{L.ta}</td><td>: {rombel.tahunAjaran}</td></tr>
        </tbody>
      </table>

      <table className="nilai">
        <thead>
          <tr><th style={{ width: 30 }}>{L.no}</th><th>{L.mapel}</th>{kur.kolomRapor.map((k, i) => <th key={i} style={{ width: k.width }}>{k.label}</th>)}</tr>
        </thead>
        <tbody>
          {kelompok.map((kel) => {
            const rows = baris.filter((b) => (b.mapel.kelompok ?? '') === kel)
            return [
              kelompok.length > 1 && kel ? <tr key={`k-${kel}`} className="kel"><td colSpan={2 + kur.kolomRapor.length}>{kel}</td></tr> : null,
              ...rows.map((b) => (
                <tr key={b.mapel.id}>
                  <td className="c">{baris.indexOf(b) + 1}</td>
                  <td>{b.mapel.nama}</td>
                  {kur.kolomRapor.map((k, i) => <td key={i} className={k.align === 'center' ? 'c' : 'desc'}>{b.ada ? (k.get(b.hasil) ?? '') : ''}</td>)}
                </tr>
              )),
            ]
          })}
        </tbody>
      </table>

      {kur.isianRapor.map((x) => catatan?.isian[x.key] ? (
        <div key={x.key} className="box"><div className="box-h">{x.label}</div><div className="box-b">{catatan.isian[x.key]}</div></div>
      ) : null)}

      <div className="two">
        <table className="nilai">
          <thead><tr><th style={{ width: 30 }}>{L.no}</th><th>{L.ekskul}</th><th style={{ width: 70 }}>{intl ? 'Grade' : 'Predikat'}</th><th>{intl ? 'Note' : 'Keterangan'}</th></tr></thead>
          <tbody>
            {(catatan?.ekskul.length ? catatan.ekskul : [{ nama: '-', predikat: '', ket: '' }]).map((e, i) => (
              <tr key={i}><td className="c">{i + 1}</td><td>{e.nama}</td><td className="c">{e.predikat}</td><td>{e.ket}</td></tr>
            ))}
          </tbody>
        </table>
        <table className="nilai">
          <thead><tr><th colSpan={2}>{L.absen}</th></tr></thead>
          <tbody>
            <tr><td>{L.sakit}</td><td className="c">{hadir.sakit} {L.hari}</td></tr>
            <tr><td>{L.izin}</td><td className="c">{hadir.izin} {L.hari}</td></tr>
            <tr><td>{L.alpa}</td><td className="c">{hadir.alpa} {L.hari}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="box"><div className="box-h">{L.catatan}</div><div className="box-b">{catatan?.catatanWali || ' '}</div></div>
      {catatan?.keputusan && <div className="box"><div className="box-h">{intl ? 'Decision' : 'Keputusan'}</div><div className="box-b"><b>{catatan.keputusan}</b></div></div>}

      <div className="ttd-row three">
        <div className="ttd"><div>&nbsp;</div><div>{L.ortu}</div><div className="ttd-space" /><div className="ttd-nama">{siswa.wali.nama || siswa.ayah.nama || siswa.ibu.nama || '..............................'}</div></div>
        <div className="ttd"><div>&nbsp;</div><div>{L.kepsek}</div><div className="ttd-space" /><div className="ttd-nama">{kepsek ? namaPegawai(kepsek) : '..............................'}</div>{kepsek?.nip && <div>NIP. {kepsek.nip}</div>}</div>
        <div className="ttd"><div>{s.kotaTtdRapor || s.kabupaten || ''}, {fmtTanggal(s.tanggalRapor ?? new Date().toISOString().slice(0, 10))}</div><div>{L.wali}</div><div className="ttd-space" /><div className="ttd-nama">{wali ? namaPegawai(wali) : '..............................'}</div>{wali?.nip && <div>NIP. {wali.nip}</div>}</div>
      </div>
    </div>
  )
}
