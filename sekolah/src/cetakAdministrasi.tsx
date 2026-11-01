// Dokumen cetak untuk buku/register administrasi.
import { predikatSupervisi, type FieldDef, type RegisterDef } from './administrasi'
import { KopSurat, TandaTangan, pejabat } from './print'
import { getSekolah, getState } from './store'
import type { Arsip, NilaiArsip } from './types'
import { fmtTanggal, namaPegawai, today } from './util'

const rp = (v: NilaiArsip) => (v === undefined || v === '' ? '' : `Rp ${Number(v).toLocaleString('id-ID')}`)

/** Nilai field dalam bentuk teks yang bisa dibaca (nama siswa, nama guru, tanggal, rupiah). */
export function labelNilai(f: FieldDef, v: NilaiArsip): string {
  if (v === undefined || v === '') return ''
  const st = getState()
  switch (f.t) {
    case 'date': return fmtTanggal(String(v))
    case 'rupiah': return rp(v)
    case 'number': return Number(v).toLocaleString('id-ID')
    case 'siswa': return st.siswa.find((s) => s.id === v)?.nama ?? '(terhapus)'
    case 'pegawai': { const p = st.pegawai.find((x) => x.id === v); return p ? namaPegawai(p) : '(terhapus)' }
    case 'rombel': return st.rombel.find((r) => r.id === v)?.nama ?? ''
    case 'mapel': return st.mapel.find((m) => m.id === v)?.nama ?? ''
    default: return String(v)
  }
}

const kepsek = () => ({ ...pejabat('kepsek'), nip: pejabat('kepsek').nip ?? '' })

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
export function terbilang(x: number): string {
  x = Math.floor(Math.abs(x))
  if (x < 12) return SATUAN[x]
  if (x < 20) return `${terbilang(x - 10)} belas`
  if (x < 100) return `${terbilang(Math.floor(x / 10))} puluh ${terbilang(x % 10)}`.trim()
  if (x < 200) return `seratus ${terbilang(x - 100)}`.trim()
  if (x < 1000) return `${terbilang(Math.floor(x / 100))} ratus ${terbilang(x % 100)}`.trim()
  if (x < 2000) return `seribu ${terbilang(x - 1000)}`.trim()
  if (x < 1e6) return `${terbilang(Math.floor(x / 1000))} ribu ${terbilang(x % 1000)}`.trim()
  if (x < 1e9) return `${terbilang(Math.floor(x / 1e6))} juta ${terbilang(x % 1e6)}`.trim()
  if (x < 1e12) return `${terbilang(Math.floor(x / 1e9))} miliar ${terbilang(x % 1e9)}`.trim()
  return `${terbilang(Math.floor(x / 1e12))} triliun ${terbilang(x % 1e12)}`.trim()
}

type Baris = { a: Arsip; d: Record<string, NilaiArsip>; saldo: number }

function TabelDaftar({ reg, rows, saldoAwal }: { reg: RegisterDef; rows: Baris[]; saldoAwal?: number }) {
  const kolom = reg.fields.filter((f) => f.daftar)
  const sum = (k: string) => rows.reduce((s, r) => s + (Number(r.d[k]) || 0), 0)
  const dijumlah = (k: string) => reg.total?.includes(k) || (reg.kas && (k === reg.kas.masuk || k === reg.kas.keluar))
  const angka = (f?: FieldDef) => f?.t === 'rupiah' || f?.t === 'number'
  return (
    <table className="nilai">
      <thead><tr><th style={{ width: 28 }}>No</th>{kolom.map((f) => <th key={f.k}>{f.l}</th>)}{reg.kolomHitung?.map((k) => <th key={k.k}>{k.l}</th>)}{reg.kas && <th>Saldo</th>}</tr></thead>
      <tbody>
        {reg.kas && saldoAwal !== undefined && saldoAwal !== 0 && <tr><td /><td colSpan={kolom.length + (reg.kolomHitung?.length ?? 0)}>Saldo awal</td><td className="r">{rp(saldoAwal)}</td></tr>}
        {rows.map((r, i) => (
          <tr key={r.a.id}>
            <td className="c">{i + 1}</td>
            {kolom.map((f) => <td key={f.k} className={angka(f) ? 'r' : ''}>{labelNilai(f, r.d[f.k])}</td>)}
            {reg.kolomHitung?.map((k) => <td key={k.k} className={k.rupiah ? 'r' : 'c'}>{k.rupiah ? rp(r.d[k.k]) : String(r.d[k.k] ?? '')}</td>)}
            {reg.kas && <td className="r">{rp(r.saldo)}</td>}
          </tr>
        ))}
      </tbody>
      {(reg.total?.length || reg.kas) && (
        <tfoot>
          <tr>
            <td />
            {kolom.map((f, i) => <td key={f.k} className="r"><b>{i === 0 ? 'Jumlah' : dijumlah(f.k) ? (f.t === 'rupiah' ? rp(sum(f.k)) : sum(f.k).toLocaleString('id-ID')) : ''}</b></td>)}
            {reg.kolomHitung?.map((k) => <td key={k.k} className="r"><b>{reg.total?.includes(k.k) ? (k.rupiah ? rp(sum(k.k)) : sum(k.k)) : ''}</b></td>)}
            {reg.kas && <td className="r"><b>{rp(rows.length ? rows[rows.length - 1].saldo : saldoAwal)}</b></td>}
          </tr>
        </tfoot>
      )}
    </table>
  )
}

export function CetakDaftar({ reg, rows, saldoAwal, periode, kelompok }: { reg: RegisterDef; rows: Baris[]; saldoAwal?: number; periode?: string; kelompok?: string }) {
  const sub = [periode && `Periode: ${periode}`, kelompok].filter(Boolean).join(' · ')
  const bendahara = reg.kas ? pejabat('bendahara') : undefined
  // Kartu Inventaris Ruang: satu halaman per ruang.
  if (reg.kelompokCetak) {
    const k = reg.kelompokCetak.k
    const grup = [...new Set(rows.map((r) => String(r.d[k] || 'Tanpa ruang')))].sort()
    return (
      <>
        {grup.map((g) => (
          <div key={g} className="doc">
            <KopSurat judul={reg.kelompokCetak!.judul} sub={`Ruang: ${g}`} />
            <TabelDaftar reg={reg} rows={rows.filter((r) => String(r.d[k] || 'Tanpa ruang') === g)} />
            <TandaTangan kiri={kepsek()} kanan={{ jabatan: 'Penanggung Jawab Ruang' }} />
          </div>
        ))}
      </>
    )
  }
  return (
    <div className="doc landscape">
      <KopSurat judul={reg.nama.toUpperCase()} sub={sub || undefined} />
      <TabelDaftar reg={reg} rows={rows} saldoAwal={saldoAwal} />
      <TandaTangan kiri={kepsek()} kanan={bendahara ?? { jabatan: 'Petugas' }} />
    </div>
  )
}

/** Cetak satu catatan: lembar disposisi, kuitansi, surat keterangan, hasil supervisi, notulen. */
export function CetakItem({ reg, a, d }: { reg: RegisterDef; a: Arsip; d: Record<string, NilaiArsip> }) {
  const s = getSekolah()
  const st = getState()
  const f = (k: string) => labelNilai(reg.fields.find((x) => x.k === k) ?? { k, l: k }, d[k])
  switch (reg.cetak) {
    case 'disposisi':
      return (
        <div className="doc">
          <KopSurat judul="LEMBAR DISPOSISI" />
          <table className="nilai form-cetak">
            <tbody>
              <tr><td style={{ width: '25%' }}>Surat dari</td><td colSpan={3}>{f('pengirim')}</td></tr>
              <tr><td>Nomor surat</td><td>{f('nomor')}</td><td style={{ width: '18%' }}>Diterima tgl.</td><td>{f('tglTerima')}</td></tr>
              <tr><td>Tanggal surat</td><td>{f('tglSurat')}</td><td>No. agenda</td><td>{f('agenda')}</td></tr>
              <tr><td>Perihal</td><td colSpan={3}>{f('perihal')}</td></tr>
              <tr><td>Sifat</td><td colSpan={3}>{['Biasa', 'Penting', 'Segera', 'Rahasia'].map((x) => <span key={x} style={{ marginRight: 18 }}>{d.sifat === x ? '☑' : '☐'} {x}</span>)}</td></tr>
              <tr><td>Diteruskan kepada</td><td colSpan={3} style={{ height: 50 }}>{f('kepada')}</td></tr>
              <tr><td>Isi disposisi</td><td colSpan={3} style={{ height: 120, verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{f('disposisi')}</td></tr>
            </tbody>
          </table>
          <TandaTangan kanan={kepsek()} />
        </div>
      )
    case 'kuitansi': {
      const sw = st.siswa.find((x) => x.id === d.siswa)
      const jml = Number(d.jumlah) || 0
      return (
        <div className="doc kuitansi">
          <KopSurat judul="KUITANSI PEMBAYARAN" sub={`No. ${f('noKw')}`} />
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 170 }}>Telah terima dari</td><td>: Orang tua/wali {sw?.nama ?? ''}{sw ? ` (NIS ${sw.noInduk})` : ''}</td></tr>
              <tr><td>Uang sejumlah</td><td>: <i>{terbilang(jml).replace(/^./, (c) => c.toUpperCase())} rupiah</i></td></tr>
              <tr><td>Untuk pembayaran</td><td>: {f('jenis')}{d.periode ? ` ${d.periode}` : ''}</td></tr>
              <tr><td>Metode</td><td>: {f('metode') || 'Tunai'}</td></tr>
            </tbody>
          </table>
          <div className="kw-jml">{rp(jml)}</div>
          <TandaTangan kanan={pejabat('bendahara', 'Bendahara / Petugas')} tanggal={String(d.tanggal ?? today())} />
        </div>
      )
    }
    case 'suket': {
      const sw = st.siswa.find((x) => x.id === d.siswa)
      const rb = st.rombel.find((r) => r.tahunAjaran === s.tahunAjaranAktif && sw && r.siswaIds.includes(sw.id))
      const k = kepsek()
      const jenis = String(d.jenis ?? 'Keterangan Aktif Belajar')
      const isi = jenis.includes('Pindah')
        ? `benar telah tercatat sebagai peserta didik di ${s.nama} dan mengajukan pindah sekolah. Kami tidak berkeberatan atas kepindahan yang bersangkutan.`
        : jenis.includes('Kelakuan')
          ? `adalah peserta didik ${s.nama} yang selama menjadi peserta didik berkelakuan baik dan tidak pernah terlibat pelanggaran berat tata tertib sekolah.`
          : `benar-benar tercatat sebagai peserta didik aktif di ${s.nama} pada Tahun Pelajaran ${s.tahunAjaranAktif}${rb ? `, kelas ${rb.nama}` : ''}.`
      return (
        <div className="doc surat">
          <KopSurat judul={`SURAT ${jenis.toUpperCase()}`} sub={`Nomor: ${f('nomor')}`} />
          <p>Yang bertanda tangan di bawah ini Kepala {s.nama} menerangkan bahwa:</p>
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 200 }}>Nama</td><td>: <b>{sw?.nama ?? ''}</b></td></tr>
              <tr><td>NIS / NISN</td><td>: {sw?.noInduk ?? ''}{sw?.nisn ? ` / ${sw.nisn}` : ''}</td></tr>
              <tr><td>Tempat, tanggal lahir</td><td>: {sw?.tempatLahir ?? ''}{sw?.tanggalLahir ? `, ${fmtTanggal(sw.tanggalLahir)}` : ''}</td></tr>
              <tr><td>Nama orang tua/wali</td><td>: {sw?.ayah.nama || sw?.ibu.nama || sw?.wali.nama || ''}</td></tr>
              <tr><td>Alamat</td><td>: {sw?.alamat ?? ''}</td></tr>
            </tbody>
          </table>
          <p>{isi}</p>
          {d.keperluan && <p>Surat keterangan ini dibuat untuk keperluan <b>{String(d.keperluan)}</b>.</p>}
          <p>Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
          <TandaTangan kanan={k} tanggal={String(d.tanggal ?? today())} />
        </div>
      )
    }
    case 'supervisi': {
      const v = Number(d.nilai) || 0
      return (
        <div className="doc">
          <KopSurat judul="HASIL SUPERVISI AKADEMIK" />
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 170 }}>Nama guru</td><td>: {f('guru')}</td></tr>
              <tr><td>Kelas / mapel</td><td>: {f('rombel')} {d.mapel ? `/ ${f('mapel')}` : ''}</td></tr>
              <tr><td>Tanggal supervisi</td><td>: {f('tanggal')}</td></tr>
            </tbody>
          </table>
          <table className="nilai">
            <thead><tr><th>No</th><th>Aspek</th><th style={{ width: 90 }}>Skor</th></tr></thead>
            <tbody>
              <tr><td className="c">1</td><td>Perencanaan pembelajaran (modul ajar/RPP)</td><td className="c">{f('perencanaan')}</td></tr>
              <tr><td className="c">2</td><td>Pelaksanaan pembelajaran</td><td className="c">{f('pelaksanaan')}</td></tr>
              <tr><td className="c">3</td><td>Asesmen / penilaian</td><td className="c">{f('penilaian')}</td></tr>
              <tr><td /><td><b>Nilai akhir</b></td><td className="c"><b>{v || '-'}</b></td></tr>
              <tr><td /><td><b>Predikat</b> (91–100 Amat Baik, 81–90 Baik, 71–80 Cukup, ≤70 Kurang)</td><td className="c"><b>{predikatSupervisi(v)}</b></td></tr>
            </tbody>
          </table>
          <div className="box"><div className="box-h">Temuan / kekuatan</div><div className="box-b">{f('temuan') || ' '}</div></div>
          <div className="box"><div className="box-h">Rekomendasi tindak lanjut</div><div className="box-b">{f('tindak') || ' '}</div></div>
          <TandaTangan kiri={{ jabatan: 'Guru yang disupervisi', nama: f('guru') || undefined }} kanan={{ ...kepsek(), jabatan: 'Kepala Sekolah / Supervisor' }} tanggal={String(d.tanggal ?? today())} />
        </div>
      )
    }
    case 'notulen':
      return (
        <div className="doc">
          <KopSurat judul="NOTULEN RAPAT" sub={f('jenis')} />
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 170 }}>Hari, tanggal</td><td>: {f('tanggal')}{d.jam ? `, pukul ${d.jam}` : ''}</td></tr>
              <tr><td>Tempat</td><td>: {f('tempat')}</td></tr>
              <tr><td>Pimpinan rapat</td><td>: {f('pimpinan')}</td></tr>
              <tr><td>Peserta</td><td>: {f('peserta')}</td></tr>
            </tbody>
          </table>
          <div className="box"><div className="box-h">Agenda</div><div className="box-b pre">{f('agenda')}</div></div>
          <div className="box"><div className="box-h">Hasil / keputusan rapat</div><div className="box-b pre">{f('hasil') || ' '}</div></div>
          <TandaTangan kiri={{ jabatan: 'Pimpinan Rapat', nama: f('pimpinan') || undefined }} kanan={{ jabatan: 'Notulis', nama: f('notulis') || undefined }} tanggal={String(d.tanggal ?? today())} />
        </div>
      )
    default:
      return <div className="doc"><KopSurat judul={reg.nama.toUpperCase()} /><pre>{JSON.stringify(a.data, null, 1)}</pre></div>
  }
}
