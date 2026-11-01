// Dokumen cetak untuk buku/register administrasi.
import { predikatSupervisi, type FieldDef, type RegisterDef } from './administrasi'
import { KopSurat, TandaTangan, pejabat } from './print'
import { getSekolah, getState } from './store'
import type { Arsip, NilaiArsip } from './types'
import { fmtTanggal, fmtTanggalHari, namaPegawai, today } from './util'

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
          <KopSurat jenis="surat" judul="LEMBAR DISPOSISI" />
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
          <TandaTangan kiri={{ jabatan: 'Yang menyerahkan', nama: sw ? `Orang tua/wali ${sw.nama}` : undefined }} kanan={pejabat('bendahara', 'Bendahara / Petugas')} tanggal={String(d.tanggal ?? today())} />
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
          <KopSurat jenis="surat" judul={`SURAT ${jenis.toUpperCase()}`} sub={`Nomor: ${f('nomor')}`} />
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
    case 'suratResmi': {
      const alinea = String(d.isi ?? '').split(/\n\s*\n|\n/).map((x) => x.trim()).filter(Boolean)
      const tujuan = String(d.tujuan ?? '')
      return (
        <div className="doc surat">
          <KopSurat jenis="surat" />
          <table className="ident surat-meta">
            <tbody>
              <tr><td style={{ width: 90 }}>Nomor</td><td>: {f('nomor')}</td></tr>
              <tr><td>Sifat</td><td>: {String(d.sifat || 'Biasa')}</td></tr>
              <tr><td>Lampiran</td><td>: {String(d.jmlLampiran || '-')}</td></tr>
              <tr><td>Perihal</td><td>: <b>{f('perihal')}</b></td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 14 }}>Yth. <b>{tujuan}</b><br />di tempat</p>
          <p>Dengan hormat,</p>
          {alinea.length ? alinea.map((a, i) => <p key={i} style={{ textIndent: 36 }}>{a}</p>) : <p style={{ textIndent: 36 }}>&nbsp;</p>}
          <p style={{ textIndent: 36 }}>Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.</p>
          <TandaTangan kanan={kepsek()} tanggal={String(d.tanggal ?? today())} />
          {d.tembusan && <p className="tembusan"><b>Tembusan:</b><br />{String(d.tembusan).split(/[;\n]/).map((t, i) => <span key={i}>{i + 1}. {t.trim()}<br /></span>)}</p>}
        </div>
      )
    }
    case 'undangan': {
      const hari = d.hari ? fmtTanggalHari(String(d.hari)) : ''
      return (
        <div className="doc surat">
          <KopSurat jenis="surat" />
          <table className="ident surat-meta">
            <tbody>
              <tr><td style={{ width: 90 }}>Nomor</td><td>: {f('nomor')}</td></tr>
              <tr><td>Lampiran</td><td>: -</td></tr>
              <tr><td>Perihal</td><td>: <b>Undangan {f('acara')}</b></td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 14 }}>Yth. <b>{String(d.kepada ?? '')}</b><br />di tempat</p>
          <p style={{ textIndent: 36 }}>Dengan hormat, sehubungan dengan akan dilaksanakannya <b>{f('acara')}</b> di {s.nama}, kami mengundang Bapak/Ibu untuk hadir pada:</p>
          <table className="ident" style={{ marginLeft: 36 }}>
            <tbody>
              <tr><td style={{ width: 130 }}>Hari, tanggal</td><td>: {hari}</td></tr>
              <tr><td>Waktu</td><td>: {d.jam ? `Pukul ${d.jam} WIB s.d. selesai` : '-'}</td></tr>
              <tr><td>Tempat</td><td>: {f('tempat') || s.nama}</td></tr>
              <tr><td style={{ verticalAlign: 'top' }}>Acara</td><td style={{ whiteSpace: 'pre-wrap' }}>: {f('agenda') || f('acara')}</td></tr>
            </tbody>
          </table>
          {d.catatan && <p style={{ textIndent: 36 }}>Catatan: {String(d.catatan)}.</p>}
          <p style={{ textIndent: 36 }}>Mengingat pentingnya acara tersebut, kami mohon kehadiran Bapak/Ibu tepat waktu. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.</p>
          <TandaTangan kanan={kepsek()} tanggal={String(d.tanggal ?? today())} />
        </div>
      )
    }
    case 'cuti': {
      const p = st.pegawai.find((x) => x.id === d.pegawai)
      const lama = d.mulai ? Math.max(1, Math.round((new Date(String(d.selesai || d.mulai)).getTime() - new Date(String(d.mulai)).getTime()) / 86400000) + 1) : 0
      const jenis = String(d.jenis ?? 'Cuti')
      const centang = (x: string) => <span key={x} style={{ marginRight: 16, whiteSpace: 'nowrap' }}>{jenis === x ? '☑' : '☐'} {x}</span>
      return (
        <div className="doc surat">
          <KopSurat jenis="surat" judul="FORMULIR PERMOHONAN CUTI / IZIN" />
          <p style={{ marginBottom: 4 }}>Kepada Yth. Kepala {s.nama}<br />di tempat</p>
          <p>Yang bertanda tangan di bawah ini:</p>
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 190 }}>Nama</td><td>: <b>{p ? namaPegawai(p) : ''}</b></td></tr>
              <tr><td>NIP / NUPTK</td><td>: {[p?.nip, p?.nuptk].filter(Boolean).join(' / ') || '-'}</td></tr>
              <tr><td>Jabatan</td><td>: {p?.jabatan ?? p?.jenis ?? ''}</td></tr>
              <tr><td>Status kepegawaian</td><td>: {p?.statusKepegawaian ?? '-'}</td></tr>
              <tr><td>Unit kerja</td><td>: {s.nama}</td></tr>
            </tbody>
          </table>
          <p>Dengan ini mengajukan permohonan:</p>
          <p style={{ lineHeight: 2 }}>{['Cuti tahunan', 'Cuti sakit', 'Cuti melahirkan', 'Cuti alasan penting', 'Izin', 'Dinas luar'].map(centang)}</p>
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 190 }}>Alasan</td><td>: {f('alasan')}</td></tr>
              <tr><td>Lamanya</td><td>: {lama ? `${lama} (${terbilang(lama)}) hari kerja` : '-'}</td></tr>
              <tr><td>Mulai tanggal</td><td>: {f('mulai')}</td></tr>
              <tr><td>Sampai dengan</td><td>: {f('selesai') || f('mulai')}</td></tr>
              <tr><td>Alamat selama cuti</td><td>: {f('alamatCuti') || p?.alamat || '-'}</td></tr>
              <tr><td>Telepon</td><td>: {f('telpCuti') || p?.telepon || '-'}</td></tr>
            </tbody>
          </table>
          <p>Demikian permohonan ini saya ajukan, atas perhatian dan persetujuan Bapak/Ibu saya ucapkan terima kasih.</p>
          <TandaTangan kanan={{ jabatan: 'Pemohon', nama: p ? namaPegawai(p) : undefined, nip: p?.nip ?? '' }} tanggal={String(d.mulai ?? today())} />
          <div className="box" style={{ marginTop: 14 }}>
            <div className="box-h">Pertimbangan dan keputusan atasan</div>
            <div className="box-b">
              <div>Catatan: {f('catatan') || '................................................................'}</div>
              <div style={{ marginTop: 6 }}>Keputusan: {['Disetujui', 'Ditolak'].map((x) => <span key={x} style={{ marginRight: 18 }}>{d.status === x ? '☑' : '☐'} {x}</span>)}</div>
            </div>
          </div>
          <TandaTangan kanan={{ ...kepsek(), jabatan: 'Kepala Sekolah' }} tanggal={String(d.mulai ?? today())} />
        </div>
      )
    }
    case 'suratTugas': {
      const p = st.pegawai.find((x) => x.id === d.pegawai)
      const k = kepsek()
      const waktu = d.mulai ? (d.selesai && d.selesai !== d.mulai ? `${fmtTanggal(String(d.mulai))} s.d. ${fmtTanggal(String(d.selesai))}` : fmtTanggal(String(d.mulai))) : '-'
      return (
        <div className="doc surat">
          <KopSurat jenis="surat" judul="SURAT TUGAS" sub={`Nomor: ${f('nomor')}`} />
          {d.dasar && <p>Dasar: {String(d.dasar)}.</p>}
          <p>Kepala {s.nama} menugaskan kepada:</p>
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 170 }}>Nama</td><td>: <b>{p ? namaPegawai(p) : ''}</b></td></tr>
              <tr><td>NIP / NUPTK</td><td>: {[p?.nip, p?.nuptk].filter(Boolean).join(' / ') || '-'}</td></tr>
              <tr><td>Jabatan</td><td>: {p?.jabatan ?? p?.jenis ?? ''}</td></tr>
            </tbody>
          </table>
          <p>Untuk melaksanakan tugas: <b>{f('kegiatan')}</b></p>
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 170 }}>Tempat</td><td>: {f('tempat') || '-'}</td></tr>
              <tr><td>Waktu</td><td>: {waktu}</td></tr>
            </tbody>
          </table>
          <p>Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab dan melaporkan hasilnya kepada Kepala Sekolah.</p>
          <TandaTangan kanan={k} tanggal={String(d.tanggal ?? today())} />
        </div>
      )
    }
    case 'suketPegawai': {
      const p = st.pegawai.find((x) => x.id === d.pegawai)
      const jenis = String(d.jenis ?? 'Keterangan Bekerja')
      const isi = jenis.includes('Kelakuan')
        ? `adalah benar bekerja di ${s.nama} dan selama bekerja yang bersangkutan berkelakuan baik serta tidak pernah terlibat pelanggaran disiplin berat.`
        : jenis.includes('Penghasilan')
          ? `adalah benar bekerja di ${s.nama} dengan penghasilan sebesar ${rp(d.penghasilan)} (${terbilang(Number(d.penghasilan) || 0)} rupiah) per bulan.`
          : `adalah benar bekerja di ${s.nama} sebagai ${p?.jabatan ?? p?.jenis ?? ''}${p?.statusKepegawaian ? ` dengan status ${p.statusKepegawaian}` : ''}${p?.tmt ? ` sejak ${fmtTanggal(p.tmt)}` : ''} sampai dengan surat ini dibuat.`
      return (
        <div className="doc surat">
          <KopSurat jenis="surat" judul={`SURAT ${jenis.toUpperCase()}`} sub={`Nomor: ${f('nomor')}`} />
          <p>Yang bertanda tangan di bawah ini Kepala {s.nama} menerangkan bahwa:</p>
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 200 }}>Nama</td><td>: <b>{p ? namaPegawai(p) : ''}</b></td></tr>
              <tr><td>NIP / NUPTK</td><td>: {[p?.nip, p?.nuptk].filter(Boolean).join(' / ') || '-'}</td></tr>
              <tr><td>Tempat, tanggal lahir</td><td>: {p?.tempatLahir ?? ''}{p?.tanggalLahir ? `, ${fmtTanggal(p.tanggalLahir)}` : ''}</td></tr>
              <tr><td>Jabatan</td><td>: {p?.jabatan ?? p?.jenis ?? ''}</td></tr>
              <tr><td>Alamat</td><td>: {p?.alamat ?? ''}</td></tr>
            </tbody>
          </table>
          <p>{isi}</p>
          {d.keperluan && <p>Surat keterangan ini dibuat untuk keperluan <b>{String(d.keperluan)}</b>.</p>}
          <p>Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
          <TandaTangan kanan={kepsek()} tanggal={String(d.tanggal ?? today())} />
        </div>
      )
    }
    case 'sk': {
      const butir = (v: NilaiArsip) => String(v ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
      const huruf = (i: number) => String.fromCharCode(97 + i)
      return (
        <div className="doc surat sk">
          <KopSurat jenis="surat" judul="KEPUTUSAN KEPALA SEKOLAH" sub={<>Nomor: {f('nomor')}<br />TENTANG<br /><b>{String(d.tentang ?? '').toUpperCase()}</b></>} />
          <p className="c"><b>KEPALA {s.nama.toUpperCase()}</b></p>
          <table className="ident sk-t"><tbody>
            <tr><td style={{ width: 100, verticalAlign: 'top' }}>Menimbang</td><td style={{ verticalAlign: 'top', width: 14 }}>:</td><td>
              {butir(d.menimbang).length ? butir(d.menimbang).map((x, i) => <div key={i} style={{ display: 'flex', gap: 8 }}><span>{huruf(i)}.</span><span>{x}</span></div>) : <i>-</i>}
            </td></tr>
            <tr><td style={{ verticalAlign: 'top' }}>Mengingat</td><td style={{ verticalAlign: 'top' }}>:</td><td>
              {butir(d.mengingat).length ? butir(d.mengingat).map((x, i) => <div key={i} style={{ display: 'flex', gap: 8 }}><span>{i + 1}.</span><span>{x}</span></div>) : <i>-</i>}
            </td></tr>
          </tbody></table>
          <p className="c"><b>MEMUTUSKAN</b></p>
          <table className="ident sk-t"><tbody>
            <tr><td style={{ width: 100, verticalAlign: 'top' }}>Menetapkan</td><td style={{ verticalAlign: 'top', width: 14 }}>:</td><td><b>{String(d.tentang ?? '').toUpperCase()}</b></td></tr>
            {(butir(d.menetapkan).length ? butir(d.menetapkan) : ['']).map((x, i) => {
              const ord = ['KESATU', 'KEDUA', 'KETIGA', 'KEEMPAT', 'KELIMA', 'KEENAM', 'KETUJUH', 'KEDELAPAN', 'KESEMBILAN', 'KESEPULUH'][i] ?? `KE-${i + 1}`
              return <tr key={i}><td style={{ verticalAlign: 'top' }}>{ord}</td><td style={{ verticalAlign: 'top' }}>:</td><td style={{ textAlign: 'justify' }}>{x}</td></tr>
            })}
          </tbody></table>
          {!butir(d.menetapkan).some((x) => /berlaku/i.test(x)) && <p>Keputusan ini berlaku sejak tanggal ditetapkan.</p>}
          <TandaTangan kanan={kepsek()} tanggal={String(d.tanggal ?? today())} />
        </div>
      )
    }
    case 'kuitansiUmum': {
      const jml = Number(d.jumlah) || 0
      return (
        <div className="doc kuitansi">
          <KopSurat judul="BUKTI PENGELUARAN KAS" sub={`No. ${f('noKw')}`} />
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 170 }}>Dibayarkan kepada</td><td>: <b>{f('penerima')}</b></td></tr>
              <tr><td>Uang sejumlah</td><td>: <i>{terbilang(jml).replace(/^./, (c) => c.toUpperCase())} rupiah</i></td></tr>
              <tr><td>Untuk pembayaran</td><td>: {f('uraian')}</td></tr>
              <tr><td>Sumber dana</td><td>: {f('sumber') || '-'}</td></tr>
              <tr><td>Kode kegiatan</td><td>: {f('kode') || '-'}</td></tr>
            </tbody>
          </table>
          <div className="kw-jml">{rp(jml)}</div>
          <div className="ttd-row ttd-tiga">
            <div className="ttd"><div>&nbsp;</div><div>Penerima</div><div className="ttd-space" /><div className="ttd-nama">{f('penerima')}</div></div>
            <div className="ttd"><div>&nbsp;</div><div>Bendahara</div><div className="ttd-space" /><div className="ttd-nama">{pejabat('bendahara').nama ?? '..............................'}</div></div>
            <div className="ttd"><div>{s.kotaTtdRapor || s.kabupaten || ''}, {fmtTanggal(String(d.tanggal ?? today()))}</div><div>Mengetahui, Kepala Sekolah</div><div className="ttd-space" /><div className="ttd-nama">{kepsek().nama ?? '..............................'}</div></div>
          </div>
        </div>
      )
    }
    case 'slipGaji': {
      const p = st.pegawai.find((x) => x.id === d.pegawai)
      const bersih = (Number(d.pokok) || 0) + (Number(d.tunjangan) || 0) - (Number(d.potongan) || 0)
      return (
        <div className="doc kuitansi">
          <KopSurat judul="SLIP GAJI / HONOR" sub={`Periode ${f('bulan')} ${d.tahun ?? ''}`} />
          <table className="ident">
            <tbody>
              <tr><td style={{ width: 170 }}>Nama</td><td>: <b>{p ? namaPegawai(p) : ''}</b></td></tr>
              <tr><td>NIP / NUPTK</td><td>: {[p?.nip, p?.nuptk].filter(Boolean).join(' / ') || '-'}</td></tr>
              <tr><td>Jabatan</td><td>: {p?.jabatan ?? p?.jenis ?? ''}</td></tr>
            </tbody>
          </table>
          <table className="nilai">
            <thead><tr><th>Komponen</th><th style={{ width: 160 }}>Jumlah</th></tr></thead>
            <tbody>
              <tr><td>Honor / gaji pokok</td><td className="r">{rp(d.pokok) || rp(0)}</td></tr>
              <tr><td>Tunjangan</td><td className="r">{rp(d.tunjangan) || rp(0)}</td></tr>
              <tr><td>Potongan</td><td className="r">({rp(d.potongan) || rp(0)})</td></tr>
              <tr><td><b>Diterima bersih</b></td><td className="r"><b>{rp(bersih)}</b></td></tr>
            </tbody>
          </table>
          <p><i>Terbilang: {terbilang(bersih).replace(/^./, (c) => c.toUpperCase())} rupiah</i></p>
          <TandaTangan kiri={{ jabatan: 'Penerima', nama: p ? namaPegawai(p) : undefined }} kanan={pejabat('bendahara', 'Bendahara')} tanggal={today()} />
        </div>
      )
    }
    case 'baHapus': {
      const k = kepsek()
      const hari = d.tanggal ? fmtTanggalHari(String(d.tanggal)) : ''
      return (
        <div className="doc surat">
          <KopSurat jenis="surat" judul="BERITA ACARA PENGHAPUSAN BARANG" sub={`Nomor: ${f('ba') || '........'}`} />
          <p style={{ textIndent: 36 }}>Pada hari ini, {hari}, bertempat di {s.nama}, kami yang bertanda tangan di bawah ini telah melakukan pemeriksaan dan menyatakan bahwa barang berikut perlu dihapuskan dari daftar inventaris sekolah:</p>
          <table className="nilai">
            <thead><tr><th style={{ width: 40 }}>No</th><th>Nama barang</th><th style={{ width: 70 }}>Jumlah</th><th style={{ width: 160 }}>Alasan penghapusan</th></tr></thead>
            <tbody><tr><td className="c">1</td><td>{f('barang')}</td><td className="c">{f('jumlah')}</td><td>{f('alasan')}</td></tr></tbody>
          </table>
          <p style={{ textIndent: 36 }}>Demikian berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>
          <TandaTangan kiri={{ ...pejabat('waka', 'Penanggung jawab sarpras') }} kanan={k} tanggal={String(d.tanggal ?? today())} />
        </div>
      )
    }
    case 'panggilanOrtu': {
      const sw = st.siswa.find((x) => x.id === d.siswa)
      const rb = st.rombel.find((r) => r.tahunAjaran === s.tahunAjaranAktif && sw && r.siswaIds.includes(sw.id))
      const ortu = sw?.ayah.nama || sw?.ibu.nama || sw?.wali.nama || ''
      return (
        <div className="doc surat">
          <KopSurat jenis="surat" judul="SURAT PANGGILAN ORANG TUA / WALI" />
          <table className="ident surat-meta">
            <tbody>
              <tr><td style={{ width: 90 }}>Perihal</td><td>: <b>Panggilan orang tua/wali murid</b></td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 12 }}>Yth. Bapak/Ibu <b>{ortu || 'Orang Tua/Wali'}</b><br />Orang tua/wali dari <b>{sw?.nama ?? ''}</b>{rb ? ` (kelas ${rb.nama})` : ''}<br />di tempat</p>
          <p style={{ textIndent: 36 }}>Dengan hormat, sehubungan dengan perkembangan dan pembinaan putra/putri Bapak/Ibu, kami mengharapkan kehadiran Bapak/Ibu di sekolah pada:</p>
          <table className="ident" style={{ marginLeft: 36 }}>
            <tbody>
              <tr><td style={{ width: 130 }}>Hari, tanggal</td><td>: {d.tglPanggil ? fmtTanggalHari(String(d.tglPanggil)) : '...............................'}</td></tr>
              <tr><td>Waktu</td><td>: {d.jamPanggil ? `Pukul ${d.jamPanggil} WIB` : '...............................'}</td></tr>
              <tr><td>Tempat</td><td>: {s.nama}</td></tr>
              <tr><td style={{ verticalAlign: 'top' }}>Keperluan</td><td style={{ whiteSpace: 'pre-wrap' }}>: {f('masalah') || 'Pembinaan dan konsultasi'}</td></tr>
            </tbody>
          </table>
          <p style={{ textIndent: 36 }}>Mengingat pentingnya hal tersebut, kami mohon Bapak/Ibu dapat hadir tepat waktu. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>
          <TandaTangan kiri={{ jabatan: 'Guru BK / Wali Kelas' }} kanan={kepsek()} tanggal={String(d.tanggal ?? today())} />
          <div className="box" style={{ marginTop: 14 }}><div className="box-h">Tanda terima orang tua/wali</div><div className="box-b">Surat ini telah diterima pada tanggal ............................ oleh ............................ (tanda tangan).</div></div>
        </div>
      )
    }
    default:
      return <div className="doc"><KopSurat judul={reg.nama.toUpperCase()} /><pre>{JSON.stringify(a.data, null, 1)}</pre></div>
  }
}
