import { useEffect, useMemo, useState } from 'react'
import { KopSurat, RekapBulanan, TandaTangan } from '../print'
import { getSekolah, put, useCol, useSekolah } from '../store'
import { STATUS_HADIR_LABEL, STATUS_HADIR_SISWA, type Absensi, type CatatanHadir, type StatusHadir } from '../types'
import { Btn, Card, Empty, PageHead, Tabs, printDoc, toast, tanya } from '../ui'
import { BULAN, daysInMonth, download, fmtTanggalHari, isoDate, namaPegawai, rekapAbsensi, toCsv, today } from '../util'

export default function AbsensiSiswa() {
  const [tab, setTab] = useState<'harian' | 'rekap'>('harian')
  return (
    <div>
      <PageHead title="Absensi Siswa" sub="Catat kehadiran harian per rombel dan cetak rekap bulanan" />
      <Tabs tabs={[['harian', 'Input Harian'], ['rekap', 'Rekap Bulanan']]} value={tab} onChange={setTab} />
      {tab === 'harian' ? <Harian /> : <Rekap />}
    </div>
  )
}

function useRombelAktif() {
  const sekolah = useSekolah()
  const rombel = useCol('rombel')
  return rombel.filter((r) => r.tahunAjaran === sekolah.tahunAjaranAktif).sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true }))
}

function Harian() {
  const rombel = useRombelAktif()
  const siswa = useCol('siswa')
  const absensi = useCol('absensi')
  const [rid, setRid] = useState('')
  const [tgl, setTgl] = useState(today())
  const r = rombel.find((x) => x.id === rid) ?? rombel[0]
  const id = r ? `siswa|${tgl}|${r.id}` : ''
  const ada = absensi.find((a) => a.id === id)
  const [data, setData] = useState<Record<string, CatatanHadir>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setData(ada?.data ?? {})
    setDirty(false)
  }, [id, ada])

  const anggota = useMemo(() => (r ? r.siswaIds.map((i) => siswa.find((s) => s.id === i)).filter(Boolean).sort((a, b) => a!.nama.localeCompare(b!.nama)) : []), [r, siswa])

  if (!rombel.length) return <Empty>Belum ada rombel di tahun ajaran aktif. Buat rombel terlebih dahulu di menu Kelas / Rombel.</Empty>

  const setSt = (sid: string, status: StatusHadir) => { setData((d) => ({ ...d, [sid]: { ...d[sid], status } })); setDirty(true) }
  const semuaHadir = () => { setData(Object.fromEntries(anggota.map((s) => [s!.id, { status: 'H' as StatusHadir, ket: data[s!.id]?.ket }]))); setDirty(true) }
  const simpan = async () => {
    const belum = anggota.filter((s) => !data[s!.id])
    if (belum.length && !await tanya(`${belum.length} siswa belum diisi. Simpan tetap?`)) return
    const doc: Absensi = { id, jenis: 'siswa', tanggal: tgl, rombelId: r!.id, data }
    await put('absensi', doc)
    setDirty(false)
    toast(`Absensi ${r!.nama} ${fmtTanggalHari(tgl)} disimpan`)
  }
  const jml = (s: StatusHadir) => Object.values(data).filter((x) => x.status === s).length

  return (
    <Card title={`${r!.nama} · ${fmtTanggalHari(tgl)}`} actions={
      <div className="filters">
        <select value={r!.id} onChange={(e) => setRid(e.target.value)}>{rombel.map((x) => <option key={x.id} value={x.id}>{x.nama} ({x.jenjang})</option>)}</select>
        <input type="date" value={tgl} onChange={(e) => e.target.value && setTgl(e.target.value)} />
      </div>
    }>
      <div className="att-bar">
        {STATUS_HADIR_SISWA.map((s) => <span key={s} className={`pill st-${s}`}>{STATUS_HADIR_LABEL[s]}: {jml(s)}</span>)}
        <span className="muted">Belum diisi: {anggota.length - Object.keys(data).filter((k) => r!.siswaIds.includes(k)).length}</span>
        <div className="topbar-fill" />
        <Btn onClick={semuaHadir}>Tandai semua hadir</Btn>
        <Btn kind="primary" onClick={simpan} disabled={!dirty}>{ada && !dirty ? 'Tersimpan' : 'Simpan'}</Btn>
      </div>
      <div className="table-wrap">
        <table className="tbl att-tbl">
          <thead><tr><th className="num">No</th><th>Nama</th><th>NIS</th>{STATUS_HADIR_SISWA.map((s) => <th key={s} className="c" title={STATUS_HADIR_LABEL[s]}>{s}</th>)}<th>Keterangan</th></tr></thead>
          <tbody>
            {anggota.map((s, i) => (
              <tr key={s!.id}>
                <td className="num">{i + 1}</td><td><b>{s!.nama}</b></td><td>{s!.noInduk}</td>
                {STATUS_HADIR_SISWA.map((st) => (
                  <td key={st} className="c">
                    <label className={`radio st-${st} ${data[s!.id]?.status === st ? 'on' : ''}`}>
                      <input type="radio" name={`h-${s!.id}`} checked={data[s!.id]?.status === st} onChange={() => setSt(s!.id, st)} aria-label={`${s!.nama} ${STATUS_HADIR_LABEL[st]}`} />{st}
                    </label>
                  </td>
                ))}
                <td><input value={data[s!.id]?.ket ?? ''} placeholder="-" onChange={(e) => { setData((d) => ({ ...d, [s!.id]: { status: d[s!.id]?.status ?? 'H', ket: e.target.value } })); setDirty(true) }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Rekap() {
  const rombel = useRombelAktif()
  const siswa = useCol('siswa')
  const absensi = useCol('absensi')
  const pegawai = useCol('pegawai')
  const now = new Date()
  const [rid, setRid] = useState('')
  const [bln, setBln] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const r = rombel.find((x) => x.id === rid) ?? rombel[0]
  if (!r) return <Empty>Belum ada rombel.</Empty>
  const [y, m] = bln.split('-').map(Number)
  const lembar = absensi.filter((a) => a.jenis === 'siswa' && a.rombelId === r.id && a.tanggal.startsWith(bln))
  const orang = r.siswaIds.map((i) => siswa.find((s) => s.id === i)).filter(Boolean).sort((a, b) => a!.nama.localeCompare(b!.nama)).map((s) => ({ id: s!.id, nama: s!.nama }))
  const kolom: StatusHadir[] = ['H', 'S', 'I', 'A', 'T']
  const wali = pegawai.find((p) => p.id === r.waliKelasId)
  const kepsek = pegawai.find((p) => p.id === getSekolah().kepalaSekolahId)

  const cetak = () => printDoc(
    <div className="doc landscape">
      <KopSurat judul="REKAP ABSENSI SISWA" sub={<>Rombel <b>{r.nama}</b> · {BULAN[m - 1]} {y} · Tahun Ajaran {r.tahunAjaran}</>} />
      <RekapBulanan orang={orang} lembar={lembar} tahun={y} bulan={m - 1} kolomStatus={kolom} />
      <TandaTangan kiri={{ jabatan: 'Kepala Sekolah', nama: kepsek ? namaPegawai(kepsek) : undefined, nip: kepsek?.nip ?? '' }} kanan={{ jabatan: 'Wali Kelas', nama: wali ? namaPegawai(wali) : undefined, nip: wali?.nip ?? '' }} />
    </div>,
  )
  const csv = () => {
    const n = daysInMonth(y, m - 1)
    const rek = rekapAbsensi(lembar, `${bln}-01`, `${bln}-${String(n).padStart(2, '0')}`)
    const head = ['No', 'Nama', ...Array.from({ length: n }, (_, i) => String(i + 1)), ...kolom]
    const rows = orang.map((o, i) => [String(i + 1), o.nama, ...Array.from({ length: n }, (_, d) => lembar.find((a) => a.tanggal === isoDate(new Date(y, m - 1, d + 1)))?.data[o.id]?.status ?? ''), ...kolom.map((k) => String(rek[o.id]?.[k] ?? 0))])
    download(`absensi-${r.nama}-${bln}.csv`, toCsv([head, ...rows]), 'text/csv')
  }
  return (
    <Card title={`Rekap ${r.nama} · ${BULAN[m - 1]} ${y}`} actions={
      <div className="filters">
        <select value={r.id} onChange={(e) => setRid(e.target.value)}>{rombel.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select>
        <input type="month" value={bln} onChange={(e) => e.target.value && setBln(e.target.value)} />
        <Btn icon="download" onClick={csv}>CSV</Btn>
        <Btn icon="print" kind="primary" onClick={cetak}>Cetak</Btn>
      </div>
    }>
      <RekapBulanan orang={orang} lembar={lembar} tahun={y} bulan={m - 1} kolomStatus={kolom} />
    </Card>
  )
}
