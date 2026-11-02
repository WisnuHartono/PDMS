import { useEffect, useState } from 'react'
import { KopSurat, RekapBulanan, TandaTangan } from '../print'
import { getSekolah, put, useCol } from '../store'
import { STATUS_HADIR_LABEL, STATUS_HADIR_PEGAWAI, type CatatanHadir, type JenisPegawai, type StatusHadir } from '../types'
import { Avatar, Btn, Card, Empty, PageHead, Tabs, printDoc, toast } from '../ui'
import { BULAN, fmtTanggalHari, namaPegawai, today } from '../util'

const jamSekarang = () => new Date().toTimeString().slice(0, 5)

export default function AbsensiPegawai() {
  const [tab, setTab] = useState<'harian' | 'rekap'>('harian')
  return (
    <div>
      <PageHead title="Absensi Guru & Pegawai" sub="Kehadiran pendidik, tenaga kependidikan, dan pegawai yayasan" />
      <Tabs tabs={[['harian', 'Input Harian'], ['rekap', 'Rekap Bulanan']]} value={tab} onChange={setTab} />
      {tab === 'harian' ? <Harian /> : <Rekap />}
    </div>
  )
}

function Harian() {
  const pegawai = useCol('pegawai')
  const absensi = useCol('absensi')
  const [tgl, setTgl] = useState(today())
  const [jenis, setJenis] = useState('')
  const id = `pegawai|${tgl}|pegawai`
  const ada = absensi.find((a) => a.id === id)
  const [data, setData] = useState<Record<string, CatatanHadir>>({})
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setData(ada?.data ?? {}); setDirty(false) }, [id, ada])

  const list = pegawai.filter((p) => p.aktif && (!jenis || p.jenis === jenis)).sort((a, b) => a.nama.localeCompare(b.nama))
  if (!pegawai.length) return <Empty>Belum ada data guru / pegawai.</Empty>

  const upd = (pid: string, patch: Partial<CatatanHadir>) => {
    setData((d) => ({ ...d, [pid]: { ...d[pid], ...patch, status: patch.status ?? d[pid]?.status ?? 'H' } }))
    setDirty(true)
  }
  const simpan = async () => {
    await put('absensi', { id, jenis: 'pegawai', tanggal: tgl, data })
    setDirty(false)
    toast(`Absensi pegawai ${fmtTanggalHari(tgl)} disimpan`)
  }
  const isToday = tgl === today()

  return (
    <Card title={fmtTanggalHari(tgl)} actions={
      <div className="filters">
        <select value={jenis} onChange={(e) => setJenis(e.target.value)}><option value="">Semua</option>{(['Guru', 'Tenaga Kependidikan', 'Yayasan'] as JenisPegawai[]).map((j) => <option key={j}>{j}</option>)}</select>
        <input type="date" value={tgl} onChange={(e) => e.target.value && setTgl(e.target.value)} />
        <Btn kind="primary" onClick={simpan} disabled={!dirty}>{ada && !dirty ? 'Tersimpan' : 'Simpan'}</Btn>
      </div>
    }>
      <div className="table-wrap">
        <table className="tbl att-tbl">
          <thead><tr><th></th><th>Nama</th><th>Jabatan</th><th>Status</th><th>Jam masuk</th><th>Jam pulang</th><th>Keterangan</th></tr></thead>
          <tbody>
            {list.map((p) => {
              const c = data[p.id]
              return (
                <tr key={p.id}>
                  <td><Avatar nama={p.nama} foto={p.foto} size={28} /></td>
                  <td className="nowrap"><b>{namaPegawai(p)}</b><br /><span className="muted small">{p.jenis}</span></td>
                  <td className="nowrap">{p.jabatan}</td>
                  <td>
                    <select className={`st-sel st-${c?.status ?? ''}`} value={c?.status ?? ''} onChange={(e) => e.target.value ? upd(p.id, { status: e.target.value as StatusHadir }) : (setData((d) => { const n = { ...d }; delete n[p.id]; return n }), setDirty(true))} aria-label={`Status ${p.nama}`}>
                      <option value="">— belum —</option>
                      {STATUS_HADIR_PEGAWAI.map((s) => <option key={s} value={s}>{STATUS_HADIR_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="nowrap">
                    <input type="time" value={c?.masuk ?? ''} onChange={(e) => upd(p.id, { masuk: e.target.value })} />
                    {isToday && !c?.masuk && <Btn kind="ghost" onClick={() => upd(p.id, { masuk: jamSekarang(), status: c?.status ?? 'H' })}>Sekarang</Btn>}
                  </td>
                  <td className="nowrap">
                    <input type="time" value={c?.pulang ?? ''} onChange={(e) => upd(p.id, { pulang: e.target.value })} />
                    {isToday && c?.masuk && !c?.pulang && <Btn kind="ghost" onClick={() => upd(p.id, { pulang: jamSekarang() })}>Sekarang</Btn>}
                  </td>
                  <td><input value={c?.ket ?? ''} placeholder="-" onChange={(e) => upd(p.id, { ket: e.target.value })} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Rekap() {
  const pegawai = useCol('pegawai')
  const absensi = useCol('absensi')
  const now = new Date()
  const [bln, setBln] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [y, m] = bln.split('-').map(Number)
  const lembar = absensi.filter((a) => a.jenis === 'pegawai' && a.tanggal.startsWith(bln))
  const orang = pegawai.filter((p) => p.aktif).sort((a, b) => a.nama.localeCompare(b.nama)).map((p) => ({ id: p.id, nama: namaPegawai(p), sub: p.jabatan ? `(${p.jabatan})` : undefined }))
  const kolom: StatusHadir[] = ['H', 'T', 'S', 'I', 'C', 'DL', 'A']
  const s = getSekolah()
  const kepsek = pegawai.find((p) => p.id === s.kepalaSekolahId)
  const cetak = () => printDoc(
    <div className="doc landscape">
      <KopSurat judul="REKAP KEHADIRAN GURU DAN PEGAWAI" sub={`${BULAN[m - 1]} ${y}`} />
      <RekapBulanan orang={orang} lembar={lembar} tahun={y} bulan={m - 1} kolomStatus={kolom} />
      <TandaTangan kanan={{ jabatan: 'Kepala Sekolah', nama: kepsek ? namaPegawai(kepsek) : undefined, nip: kepsek?.nip ?? '' }} />
    </div>,
  )
  return (
    <Card title={`Rekap ${BULAN[m - 1]} ${y}`} actions={
      <div className="filters">
        <input type="month" value={bln} onChange={(e) => e.target.value && setBln(e.target.value)} />
        <Btn icon="print" kind="primary" onClick={cetak}>Cetak</Btn>
      </div>
    }>
      <RekapBulanan orang={orang} lembar={lembar} tahun={y} bulan={m - 1} kolomStatus={kolom} />
    </Card>
  )
}
