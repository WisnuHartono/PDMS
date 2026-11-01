// Komponen bersama untuk dokumen cetak (kop surat, tanda tangan, rekap absensi).
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { getSekolah, getState } from './store'
import { STATUS_HADIR_LABEL, type Absensi, type Sekolah, type StatusHadir } from './types'
import { BULAN, daysInMonth, fmtTanggal, isoDate, namaPegawai, rekapAbsensi } from './util'

const HURUF: Record<string, string> = {
  Times: "'Times New Roman', Times, serif",
  Arial: 'Arial, Helvetica, sans-serif',
  Bookman: "'Bookman Old Style', 'URW Bookman', Georgia, serif",
  Cambria: 'Cambria, Georgia, serif',
}

export function alamatLengkap(s: Sekolah) {
  const rtrw = s.rt || s.rw ? `RT ${s.rt || '-'}/RW ${s.rw || '-'}` : ''
  return [s.alamat, rtrw, s.dusun, s.kelurahan && `Kel. ${s.kelurahan}`, s.kecamatan && `Kec. ${s.kecamatan}`, s.kabupaten, s.provinsi, s.kodePos].filter(Boolean).join(', ')
}

export function kontakLengkap(s: Sekolah) {
  return [s.telepon && `Telp. ${s.telepon}`, s.fax && `Faks. ${s.fax}`, s.email && `Email: ${s.email}`, s.website && `Laman: ${s.website}`].filter(Boolean).join(' · ')
}

/** Kop surat sesuai pengaturan (Pengaturan → Kop Surat). `sekolah` dipakai untuk pratinjau sebelum disimpan. */
export type JenisKop = 'rapor' | 'surat' | 'adm'
export function KopSurat({ judul, sub, sekolah, jenis = 'adm' }: { judul?: string; sub?: ReactNode; sekolah?: Sekolah; jenis?: JenisKop }) {
  const s = sekolah ?? getSekolah()
  const k = s.kop ?? {}
  const baris = useRef<HTMLDivElement>(null)
  // Logo otomatis: tinggi & lebar logo = tinggi blok tulisan di sebelahnya
  useLayoutEffect(() => {
    const fit = () => {
      const r = baris.current; if (!r) return
      const h = r.querySelector<HTMLElement>('.kop-text')?.offsetHeight ?? 0
      if (!h) return
      r.querySelectorAll<HTMLElement>('.kop-logo.oto').forEach((e, i) => { const uk = Math.round(h * (i === 1 ? (k.skalaLogoKanan ?? 100) / 100 : 1)); e.style.width = `${uk}px`; e.style.height = `${uk}px` })
    }
    fit(); document.fonts?.ready.then(fit).catch(() => undefined)
  })
  const kiri = k.logoKiri || s.logo
  const kanan = k.logoKanan === 'sekolah' ? s.logo : k.logoKanan
  const dasar = k.ukuranLogo ?? 70
  const ukLogo = (jenis === 'rapor' ? k.ukuranLogoRapor : jenis === 'surat' ? k.ukuranLogoSurat : undefined) ?? dasar
  const ukKanan = Math.round(ukLogo * (k.skalaLogoKanan ?? 100) / 100)
  const id = [
    (k.tampilNpsn ?? true) && s.npsn && `NPSN: ${s.npsn}`,
    k.tampilNss && s.nss && `NSS: ${s.nss}`,
    k.tampilAkreditasi && s.akreditasi && `Terakreditasi ${s.akreditasi}`,
  ].filter(Boolean).join(' · ')
  const oto = !k.logoManual
  const gaya = (uk: number) => (oto ? undefined : { width: uk, height: uk })
  const logo = (src: string | undefined, uk: number) => src ? <img src={src} alt="" className={`kop-logo ${oto ? 'oto' : ''}`} style={gaya(uk)} /> : <div className={`kop-logo ${oto ? 'oto' : ''}`} style={gaya(uk)} />
  return (
    <div className="kop" style={k.huruf ? { fontFamily: HURUF[k.huruf] } : undefined}>
      <div ref={baris} className={`kop-row garis-${k.garis ?? 'ganda'}`}>
        {logo(kiri, ukLogo)}
        <div className="kop-text">
          {k.baris1 ? <div className="kop-yay">{k.baris1}</div> : !k.baris2 && s.yayasan ? <div className="kop-yay">{s.yayasan}</div> : null}
          {k.baris2 && <div className="kop-yay b">{k.baris2}</div>}
          <div className="kop-nama" style={{ fontSize: k.ukuranNama ? `${k.ukuranNama}pt` : undefined, color: k.warnaNama || undefined }}>{k.namaTampil || s.nama}</div>
          <div className="kop-alamat">{k.alamatTampil || alamatLengkap(s)}</div>
          {(k.kontakTampil || kontakLengkap(s)) && <div className="kop-alamat">{k.kontakTampil || kontakLengkap(s)}</div>}
          {id && <div className="kop-alamat">{id}</div>}
        </div>
        {logo(kanan, ukKanan)}
      </div>
      {judul && <h1 className="doc-title">{judul}</h1>}
      {sub && <div className="doc-sub">{sub}</div>}
    </div>
  )
}

type Ttd = { jabatan: string; nama?: string; nip?: string }

export function TandaTangan({ kiri, kanan, tanggal }: { kiri?: Ttd; kanan?: Ttd; tanggal?: string }) {
  const s = getSekolah()
  const ttd = (x?: Ttd, top?: ReactNode) => {
    if (!x) return <div className="ttd" />
    const digital = s.pakaiTtdDigital && /kepala sekolah/i.test(x.jabatan) && (s.ttdKepsek || s.stempel)
    return (
      <div className="ttd">
        <div>{top ?? ' '}</div>
        <div>{x.jabatan}</div>
        <div className="ttd-space">
          {digital && s.stempel && <img className="ttd-stempel" src={s.stempel} alt="" />}
          {digital && s.ttdKepsek && <img className="ttd-img" src={s.ttdKepsek} alt="" />}
        </div>
        <div className="ttd-nama">{x.nama ?? '..............................'}</div>
        {x.nip !== undefined && <div>NIP. {x.nip || '-'}</div>}
      </div>
    )
  }
  return (
    <div className="ttd-row">
      {ttd(kiri, kiri ? 'Mengetahui,' : undefined)}
      {ttd(kanan, `${s.kotaTtdRapor || s.kabupaten || ''}, ${fmtTanggal(tanggal ?? isoDate(new Date()))}`)}
    </div>
  )
}

/** Pejabat dari Pengaturan → Pejabat penandatangan. */
export function pejabat(peran: 'kepsek' | 'waka' | 'bendahara' | 'tu' | 'operator', jabatanDefault?: string): Ttd {
  const s = getSekolah()
  const id = { kepsek: s.kepalaSekolahId, waka: s.wakaKurikulumId, bendahara: s.bendaharaId, tu: s.kaTuId, operator: s.operatorId }[peran]
  const p = getState().pegawai.find((x) => x.id === id)
  const jab = jabatanDefault ?? { kepsek: 'Kepala Sekolah', waka: 'Wakil Kepala Sekolah Bidang Kurikulum', bendahara: 'Bendahara', tu: 'Kepala Tata Usaha', operator: 'Operator Sekolah' }[peran]
  return { jabatan: jab, nama: p ? namaPegawai(p) : undefined, nip: p ? p.nip ?? '' : undefined }
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
