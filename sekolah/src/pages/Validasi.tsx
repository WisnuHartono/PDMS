import { useMemo, useState } from 'react'
import { KopSurat, TandaTangan } from '../print'
import { getState, put, useCol, useSekolah } from '../store'
import { Btn, Card, Empty, PageHead, printDoc, toast, useNav } from '../ui'
import { fmtTanggal, namaPegawai } from '../util'
import { jalankanValidasi, type Temuan } from '../validasi'

const KATEGORI = ['Satuan Pendidikan', 'Peserta Didik', 'GTK', 'Rombongan Belajar', 'Sarpras', 'Administrasi']

export function useValidasi() {
  const sekolah = useSekolah()
  const siswa = useCol('siswa'), pegawai = useCol('pegawai'), rombel = useCol('rombel'), mapel = useCol('mapel')
  const tanah = useCol('tanah'), bangunan = useCol('bangunan'), ruang = useCol('ruang'), arsip = useCol('arsip')
  return useMemo(() => jalankanValidasi({ sekolah, siswa, pegawai, rombel, mapel, tanah, bangunan, ruang, arsip }), [sekolah, siswa, pegawai, rombel, mapel, tanah, bangunan, ruang, arsip])
}

export default function Validasi() {
  const hasil = useValidasi()
  const sekolah = useSekolah()
  const nav = useNav()
  const [kat, setKat] = useState('')
  const [lvl, setLvl] = useState<'' | 'invalid' | 'peringatan'>('')
  const inv = hasil.filter((t) => t.level === 'invalid').length
  const warn = hasil.length - inv
  const tampil = hasil.filter((t) => (!kat || t.kategori === kat) && (!lvl || t.level === lvl)).sort((a, b) => (a.level === b.level ? 0 : a.level === 'invalid' ? -1 : 1))
  const tandai = async () => { await put('sekolah', { ...sekolah, validasiTerakhir: new Date().toISOString() }); toast(inv ? `Validasi selesai: ${inv} invalid, ${warn} peringatan` : 'Validasi selesai: tidak ada data invalid') }

  return (
    <div>
      <PageHead title="Validasi Data" sub="Pemeriksaan kelengkapan dan kewajaran data. Selesaikan data Invalid sebelum dipakai untuk laporan.">
        <Btn icon="print" onClick={() => printDoc(<LaporanValidasi hasil={hasil} />)}>Cetak laporan</Btn>
        <Btn icon="refresh" kind="primary" onClick={tandai}>Validasi sekarang</Btn>
      </PageHead>
      <div className="vld-ring">
        <button className={`vld-box ${inv ? 'bad' : 'ok'} ${lvl === 'invalid' ? 'on' : ''}`} onClick={() => setLvl(lvl === 'invalid' ? '' : 'invalid')}><b>{inv}</b><span>Invalid</span><small>harus diperbaiki</small></button>
        <button className={`vld-box warn ${lvl === 'peringatan' ? 'on' : ''}`} onClick={() => setLvl(lvl === 'peringatan' ? '' : 'peringatan')}><b>{warn}</b><span>Peringatan</span><small>perlu diperhatikan</small></button>
        <div className={`vld-box ${inv ? '' : 'ok'}`}><b>{inv ? '✗' : '✓'}</b><span>{inv ? 'Belum valid' : 'Valid'}</span><small>{sekolah.validasiTerakhir ? `Terakhir ${new Date(sekolah.validasiTerakhir).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Validasi berjalan otomatis setiap ada perubahan'}</small></div>
      </div>
      <div className="filters bar">
        <select value={kat} onChange={(e) => setKat(e.target.value)} aria-label="Kategori"><option value="">Semua kategori</option>{KATEGORI.map((k) => <option key={k}>{k} ({hasil.filter((t) => t.kategori === k).length})</option>)}</select>
      </div>
      <Card title={`${tampil.length} temuan`}>
        {!tampil.length ? <Empty>Tidak ada temuan. Data sudah memenuhi ketentuan.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Status</th><th>Kategori</th><th>Data</th><th>Keterangan</th><th></th></tr></thead>
              <tbody>{tampil.map((t, i) => (
                <tr key={i}>
                  <td><span className={`pill ${t.level === 'invalid' ? 'bad' : 'warn'}`}>{t.level === 'invalid' ? 'Invalid' : 'Peringatan'}</span></td>
                  <td className="nowrap">{t.kategori}</td><td><b>{t.objek}</b></td><td>{t.pesan}</td>
                  <td><Btn kind="ghost" icon="chevR" onClick={() => nav.open(t.page)}>Perbaiki</Btn></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function LaporanValidasi({ hasil }: { hasil: Temuan[] }) {
  const s = getState().sekolah[0]
  const k = getState().pegawai.find((p) => p.id === s?.kepalaSekolahId)
  return (
    <div className="doc">
      <KopSurat judul="LAPORAN HASIL VALIDASI DATA" sub={`Tanggal ${fmtTanggal(new Date().toISOString().slice(0, 10))} · TA ${s?.tahunAjaranAktif ?? ''}`} />
      <p>Invalid: <b>{hasil.filter((t) => t.level === 'invalid').length}</b> · Peringatan: <b>{hasil.filter((t) => t.level === 'peringatan').length}</b></p>
      <table className="nilai">
        <thead><tr><th>No</th><th>Status</th><th>Kategori</th><th>Data</th><th>Keterangan</th></tr></thead>
        <tbody>{hasil.map((t, i) => <tr key={i}><td className="c">{i + 1}</td><td>{t.level === 'invalid' ? 'Invalid' : 'Peringatan'}</td><td>{t.kategori}</td><td>{t.objek}</td><td>{t.pesan}</td></tr>)}</tbody>
      </table>
      {!hasil.length && <p>Seluruh data valid.</p>}
      <TandaTangan kiri={{ jabatan: 'Operator Sekolah' }} kanan={{ jabatan: 'Kepala Sekolah', nama: k ? namaPegawai(k) : undefined, nip: k?.nip ?? '' }} />
    </div>
  )
}
