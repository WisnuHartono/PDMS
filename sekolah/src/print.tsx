// Komponen bersama untuk dokumen cetak (kop surat, tanda tangan, rekap absensi).
import type { ReactNode } from 'react'
import { getSekolah } from './store'
import { STATUS_HADIR_LABEL, type Absensi, type StatusHadir } from './types'
import { BULAN, daysInMonth, fmtTanggal, isoDate, rekapAbsensi } from './util'

export function KopSurat({ judul, sub }: { judul?: string; sub?: ReactNode }) {
  const s = getSekolah()
  return (
    <div className="kop">
      <div className="kop-row">
        {s.logo ? <img src={s.logo} alt="" className="kop-logo" /> : <div className="kop-logo" />}
        <div className="kop-text">
          {s.yayasan && <div className="kop-yay">{s.yayasan}</div>}
          <div className="kop-nama">{s.nama}</div>
          <div className="kop-alamat">
            {[s.alamat, s.kelurahan, s.kecamatan, s.kabupaten, s.provinsi, s.kodePos].filter(Boolean).join(', ')}
            {s.telepon ? ` · Telp. ${s.telepon}` : ''}{s.email ? ` · ${s.email}` : ''}
          </div>
          {s.npsn && <div className="kop-alamat">NPSN: {s.npsn}</div>}
        </div>
        <div className="kop-logo" />
      </div>
      {judul && <h1 className="doc-title">{judul}</h1>}
      {sub && <div className="doc-sub">{sub}</div>}
    </div>
  )
}

export function TandaTangan({ kiri, kanan, tanggal }: { kiri?: { jabatan: string; nama?: string; nip?: string }; kanan?: { jabatan: string; nama?: string; nip?: string }; tanggal?: string }) {
  const s = getSekolah()
  const ttd = (x?: { jabatan: string; nama?: string; nip?: string }, top?: ReactNode) => (
    <div className="ttd">
      <div>{top ?? ' '}</div>
      <div>{x?.jabatan ?? ' '}</div>
      <div className="ttd-space" />
      <div className="ttd-nama">{x?.nama ?? (x ? '..............................' : ' ')}</div>
      {x?.nip !== undefined && <div>NIP. {x.nip || '-'}</div>}
    </div>
  )
  return (
    <div className="ttd-row">
      {ttd(kiri, kiri ? 'Mengetahui,' : undefined)}
      {ttd(kanan, `${s.kotaTtdRapor || s.kabupaten || ''}, ${fmtTanggal(tanggal ?? isoDate(new Date()))}`)}
    </div>
  )
}

export interface Orang { id: string; nama: string; sub?: string }

const KODE: Record<StatusHadir, string> = { H: '•', S: 'S', I: 'I', A: 'A', T: 'T', C: 'C', DL: 'D' }

/** Tabel rekap absensi bulanan: baris = orang, kolom = tanggal. Dipakai di layar dan saat cetak. */
export function RekapBulanan({ orang, lembar, tahun, bulan, kolomStatus }: { orang: Orang[]; lembar: Absensi[]; tahun: number; bulan: number; kolomStatus: StatusHadir[] }) {
  const n = daysInMonth(tahun, bulan)
  const hari = Array.from({ length: n }, (_, i) => i + 1)
  const byTgl = new Map(lembar.map((a) => [a.tanggal, a]))
  const dari = isoDate(new Date(tahun, bulan, 1))
  const sampai = isoDate(new Date(tahun, bulan, n))
  const rekap = rekapAbsensi(lembar, dari, sampai)
  const hariEfektif = hari.filter((d) => byTgl.has(isoDate(new Date(tahun, bulan, d)))).length
  return (
    <div className="table-wrap">
      <table className="rekap">
        <thead>
          <tr>
            <th rowSpan={2}>No</th><th rowSpan={2} className="l">Nama</th>
            <th colSpan={n}>Tanggal ({BULAN[bulan]} {tahun})</th>
            <th colSpan={kolomStatus.length}>Jumlah</th><th rowSpan={2}>% Hadir</th>
          </tr>
          <tr>
            {hari.map((d) => {
              const w = new Date(tahun, bulan, d).getDay()
              return <th key={d} className={w === 0 ? 'libur' : ''}>{d}</th>
            })}
            {kolomStatus.map((s) => <th key={s} title={STATUS_HADIR_LABEL[s]}>{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {orang.map((o, i) => {
            const r = rekap[o.id]
            const hadir = (r?.H ?? 0) + (r?.T ?? 0)
            return (
              <tr key={o.id}>
                <td>{i + 1}</td>
                <td className="l">{o.nama}{o.sub && <span className="muted"> {o.sub}</span>}</td>
                {hari.map((d) => {
                  const st = byTgl.get(isoDate(new Date(tahun, bulan, d)))?.data[o.id]?.status
                  const w = new Date(tahun, bulan, d).getDay()
                  return <td key={d} className={`c st-${st ?? ''} ${w === 0 ? 'libur' : ''}`}>{st ? KODE[st] : ''}</td>
                })}
                {kolomStatus.map((s) => <td key={s} className="c">{r?.[s] ?? 0}</td>)}
                <td className="c">{hariEfektif ? `${Math.round((hadir / hariEfektif) * 100)}%` : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="small muted">Keterangan: • Hadir, {kolomStatus.filter((s) => s !== 'H').map((s) => `${KODE[s]} ${STATUS_HADIR_LABEL[s]}`).join(', ')}. Hari efektif tercatat: {hariEfektif}.</p>
    </div>
  )
}
