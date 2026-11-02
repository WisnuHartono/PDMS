// Penyusunan data rapor + dokumen cetak rapor per siswa.
import { getKurikulum } from './curricula'
import { asesmenFinal } from './asesmen'
import { KopSurat } from './print'
import { getSekolah, getState } from './store'
import type { CatatanRapor, Rombel, Siswa } from './types'
import { bintang, usiaTahunBulan } from './narasiPaud'
import { fmtTanggal, namaPegawai, parseIso, rekapAbsensi, rentangSemester } from './util'

export function fase(r: Pick<Rombel, 'jenjang' | 'tingkat'>): string | undefined {
  const t = Number(r.tingkat)
  if (r.jenjang === 'PAUD' || r.jenjang === 'TK') return 'Fondasi'
  if (r.jenjang === 'SD') return t <= 2 ? 'A' : t <= 4 ? 'B' : 'C'
  if (r.jenjang === 'SMP') return 'D'
  if (r.jenjang === 'SMA' || r.jenjang === 'SMK') return t <= 10 ? 'E' : 'F'
  if (r.jenjang === 'PKBM') return r.tingkat.includes('Paket A') ? 'A–C' : r.tingkat.includes('Paket B') ? 'D' : r.tingkat.includes('Paket C') ? 'E–F' : undefined
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
  const asesmen = asesmenFinal(st.arsip, r.tahunAjaran, semester, siswa.id)
  return { kur, baris, catatan, hadir, asesmen }
}

export function RaporDoc({ siswa, rombel, semester }: { siswa: Siswa; rombel: Rombel; semester: 1 | 2 }) {
  const s = getSekolah()
  const st = getState()
  const { kur, baris, catatan, hadir, asesmen } = dataRapor(siswa, rombel, semester)
  const wali = st.pegawai.find((p) => p.id === rombel.waliKelasId)
  const kepsek = st.pegawai.find((p) => p.id === s.kepalaSekolahId)
  const intl = kur.asal === 'Internasional'
  const L = intl
    ? { nama: 'Student Name', nis: 'Student ID', kelas: 'Class', sem: 'Term', ta: 'Academic Year', absen: 'Attendance', sakit: 'Sick', izin: 'Excused', alpa: 'Unexcused', ekskul: 'Extracurricular', wali: 'Homeroom Teacher', catatan: "Homeroom Teacher's Comment", ortu: 'Parent / Guardian', kepsek: 'Principal', no: 'No', mapel: 'Subject', hari: 'day(s)' }
    : { nama: 'Nama Peserta Didik', nis: 'NIS / NISN', kelas: 'Kelas', sem: 'Semester', ta: 'Tahun Pelajaran', absen: 'Kehadiran / Ketidakhadiran', sakit: 'Sakit', izin: 'Izin', alpa: 'Tanpa Keterangan', ekskul: 'Ekstrakurikuler', wali: 'Wali Kelas', catatan: 'Catatan Wali Kelas', ortu: 'Orang Tua / Wali', kepsek: 'Kepala Sekolah', no: 'No', mapel: kur.naratif ? 'Elemen Capaian Pembelajaran' : 'Mata Pelajaran', hari: 'hari' }
  const f = fase(rombel)
  const kelompok = [...new Set(baris.map((b) => b.mapel.kelompok ?? ''))]

  return (
    <div className="doc rapor" data-footer={`Kelas ${rombel.nama} | ${siswa.nama} | ${siswa.noInduk}${siswa.nisn ? `/${siswa.nisn}` : ''}`}>
      <KopSurat jenis="rapor" />
      <h1 className="doc-title">{kur.judulRapor}</h1>
      <table className="ident">
        <tbody>
          <tr><td>{L.nama}</td><td>: <b>{siswa.nama.toUpperCase()}</b></td><td>{L.kelas}</td><td>: {rombel.nama}{f && !intl ? ` (Fase ${f})` : ''}</td></tr>
          <tr><td>{L.nis}</td><td>: {siswa.noInduk}{siswa.nisn ? ` / ${siswa.nisn}` : ''}</td><td>{L.sem}</td><td>: {semester} ({semester === 1 ? (intl ? 'First' : 'Ganjil') : (intl ? 'Second' : 'Genap')})</td></tr>
          <tr><td>{intl ? 'School' : 'Sekolah'}</td><td>: {s.nama}</td><td>{L.ta}</td><td>: {rombel.tahunAjaran}</td></tr>
          {kur.naratif && <tr><td>Usia</td><td>: {usiaTahunBulan(siswa.tanggalLahir, parseIso(s.tanggalRapor ?? new Date().toISOString().slice(0, 10))) || '-'}</td><td>Nama panggilan</td><td>: {siswa.namaPanggilan || '-'}</td></tr>}
        </tbody>
      </table>

      {kur.naratif ? (
        <>
          {baris.map((b) => (
            <div key={b.mapel.id} className="box paud-el">
              <div className="box-h" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{b.mapel.nama}</span>{b.ada && b.hasil.extra?.capaian ? <span style={{ whiteSpace: 'nowrap' }}><span className="bintang">{bintang(String(b.hasil.extra.capaian))}</span> {b.hasil.predikat}</span> : null}</div>
              <div className="box-b pre">
                {typeof b.hasil.extra?.foto === 'string' && <img src={b.hasil.extra.foto} alt="" className="paud-foto" />}
                {b.ada ? b.hasil.deskripsi : ' '}
              </div>
            </div>
          ))}
          {(catatan?.isian.bb || catatan?.isian.tb || catatan?.isian.lk) && (
            <table className="nilai" style={{ marginTop: 8 }}>
              <thead><tr><th colSpan={3}>Pertumbuhan Anak</th></tr><tr><th>Berat badan</th><th>Tinggi badan</th><th>Lingkar kepala</th></tr></thead>
              <tbody><tr>
                <td className="c">{catatan.isian.bb ? `${catatan.isian.bb} kg` : '-'}</td>
                <td className="c">{catatan.isian.tb ? `${catatan.isian.tb} cm` : '-'}</td>
                <td className="c">{catatan.isian.lk ? `${catatan.isian.lk} cm` : '-'}</td>
              </tr></tbody>
            </table>
          )}
        </>
      ) : (
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
      )}

      {kur.isianRapor.filter((x) => !x.angka).map((x) => catatan?.isian[x.key] ? (
        <div key={x.key} className="box"><div className="box-h">{x.label}</div><div className="box-b">{catatan.isian[x.key]}</div></div>
      ) : null)}

      {asesmen.map(({ inst, rekam, ringkas }) => (
        <div key={inst.id} className="asm-rapor">
          <table className="nilai">
            <thead>
              <tr><th colSpan={4} style={{ textAlign: 'left' }}>{intl ? 'Assessment' : 'Asesmen'}: {inst.nama}{ringkas.predikat ? ` — ${ringkas.predikat}` : ''}</th></tr>
              <tr><th style={{ width: 30 }}>{L.no}</th><th style={{ width: '24%' }}>{intl ? 'Aspect' : 'Aspek'}</th><th style={{ width: 90 }}>{intl ? 'Level' : 'Capaian'}</th><th>{intl ? 'Description & evidence' : 'Deskripsi dan bukti pengamatan'}</th></tr>
            </thead>
            <tbody>
              {ringkas.baris.map((b, i) => (
                <tr key={b.aspek}><td className="c">{i + 1}</td><td>{b.aspek}</td><td className="c">{b.skor} · {b.label}</td><td>{b.deskripsi}{b.bukti ? <i> {intl ? 'Evidence' : 'Bukti'}: {b.bukti}</i> : null}</td></tr>
              ))}
            </tbody>
          </table>
          {rekam.umum && <div className="asm-narasi">{rekam.umum}</div>}
          <div className="asm-meta">{intl ? 'Scale 1–4: Needs Guidance, Fair, Good, Excellent.' : 'Skala 1–4: Perlu Bimbingan, Cukup, Baik, Sangat Baik.'} {intl ? 'Assessed by' : 'Dinilai oleh'} {rekam.penilai ?? '-'}{rekam.tanggal ? `, ${fmtTanggal(rekam.tanggal)}` : ''}; {intl ? 'locked and verifiable.' : 'data terkunci dan dapat ditelusuri.'}</div>
        </div>
      ))}

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
        <div className="ttd"><div>&nbsp;</div><div>{L.wali}</div><div className="ttd-space" /><div className="ttd-nama">{wali ? namaPegawai(wali) : '..............................'}</div>{wali?.nip && <div>NIP. {wali.nip}</div>}</div>
        <div className="ttd"><div>{s.kotaTtdRapor || s.kabupaten || ''}, {fmtTanggal(s.tanggalRapor ?? new Date().toISOString().slice(0, 10))}</div><div>{L.kepsek}</div><div className="ttd-space" /><div className="ttd-nama">{kepsek ? namaPegawai(kepsek) : '..............................'}</div>{kepsek?.nip && <div>NIP. {kepsek.nip}</div>}</div>
      </div>
    </div>
  )
}
