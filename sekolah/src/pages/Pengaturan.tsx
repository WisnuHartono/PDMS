import { useEffect, useState } from 'react'
import DataCadangan from './DataCadangan'
import { kodeSekolah } from '../administrasi'
import { KURIKULUM } from '../curricula'
import { Icon } from '../icons'
import { KopSurat, alamatLengkap, kontakLengkap } from '../print'
import { put, useCol, useSekolah } from '../store'
import { JENJANG, type KopSetting, type Sekolah } from '../types'
import { FONT_APP, FONT_DOK, LogoSekolah, tampilanDari } from '../logo'
import { AI_DEFAULT, PANDUAN, PENYEDIA, aiSiap, panggilAi } from '../ai'
import { Btn, Card, Field, Inp, Modal, PageHead, Sel, toast } from '../ui'
import { fotoKecil, namaPegawai, today } from '../util'

type Bagian = 'identitas' | 'lokasi' | 'pelengkap' | 'pejabat' | 'kop' | 'cetak' | 'kurikulum' | 'tampilan' | 'ai' | 'data'
const BAGIAN: [Bagian, string, string][] = [
  ['identitas', 'Identitas & Legalitas', 'Nama, NPSN, status, SK pendirian/izin, akreditasi, jenjang'],
  ['lokasi', 'Lokasi & Kontak', 'Alamat lengkap, koordinat, telepon, email, laman'],
  ['pelengkap', 'Data Pelengkap', 'Rekening, NPWP, listrik, internet, komite'],
  ['pejabat', 'Pejabat & Tanda Tangan', 'Penandatangan dokumen, TTD & stempel digital'],
  ['kop', 'Kop Surat', 'Logo, baris kop, garis, huruf, pratinjau'],
  ['cetak', 'Administrasi & Cetak', 'Tahun ajaran, rapor, nomor surat, ukuran kertas'],
  ['kurikulum', 'Kurikulum', 'Kurikulum yang tersedia'],
  ['tampilan', 'Tampilan & Logo', 'Ukuran, bentuk, bingkai, zoom logo dan nama di header'],
  ['ai', 'Integrasi AI', 'Penyusun narasi rapor: penyedia, kunci API, gaya'],
  ['data', 'Data & Cadangan', 'Ekspor Excel/CSV, cloud, cadangan terenkripsi, pulihkan'],
]

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

export default function Pengaturan() {
  const sekolah = useSekolah()
  const pegawai = useCol('pegawai')
  const [s, setS] = useState<Sekolah>(sekolah)
  const [bagian, setBagian] = useState<Bagian>('identitas')
  const [ubah, setUbah] = useState(false)
  const [jenisPrev, setJenisPrev] = useState<'rapor' | 'surat' | 'adm'>('rapor')
  useEffect(() => { setS(sekolah); setUbah(false) }, [sekolah])
  const set = (p: Partial<Sekolah>) => { setS((o) => ({ ...o, ...p })); setUbah(true) }
  const setKop = (p: Partial<KopSetting>) => set({ kop: { ...s.kop, ...p } })
  const simpan = async () => { await put('sekolah', s); setUbah(false); toast('Pengaturan sekolah disimpan') }
  const peg = pegawai.filter((p) => p.aktif).map((p) => [p.id, `${namaPegawai(p)}${p.jabatan ? ` · ${p.jabatan}` : ''}`] as [string, string])
  const gambar = (onPick: (url: string) => void, maks = 320) => async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(await fotoKecil(f, maks)) }
  const toggle = (j: (typeof JENJANG)[number]) => set({ jenjang: s.jenjang.includes(j) ? s.jenjang.filter((x) => x !== j) : [...s.jenjang, j] })
  const info = BAGIAN.find((b) => b[0] === bagian)!

  return (
    <div className="setelan">
      <PageHead title="Pengaturan Sekolah" sub="Profil lengkap satuan pendidikan, kop surat, penandatangan, dan pengaturan administrasi">
        {ubah && <span className="pill warn">Belum disimpan</span>}
        <Btn onClick={() => { setS(sekolah); setUbah(false) }} disabled={!ubah}>Batalkan</Btn>
        <Btn kind="primary" onClick={simpan} disabled={!ubah}>Simpan pengaturan</Btn>
      </PageHead>

      <div className="setelan-grid">
        <nav className="setelan-nav" aria-label="Bagian pengaturan">
          <div className="setelan-id">
            {s.logo ? <img src={s.logo} alt="" /> : <span className="setelan-logo"><Icon name="school" size={22} /></span>}
            <div><b>{s.nama}</b><small>NPSN {s.npsn || '-'} · {s.jenjang.join(', ')}</small></div>
          </div>
          {BAGIAN.map(([id, l, ket]) => (
            <button key={id} className={bagian === id ? 'on' : ''} onClick={() => setBagian(id)} aria-current={bagian === id ? 'page' : undefined}>
              <span>{l}</span><small>{ket}</small>
            </button>
          ))}
        </nav>

        <div className="setelan-isi">
          <h3 className="setelan-h">{info[1]}<small>{info[2]}</small></h3>

          {bagian === 'identitas' && (
            <>
              <Card title="Identitas satuan pendidikan" className="mb">
                <div className="ident-row">
                  <div className="logo-col">
                    {s.logo ? <img src={s.logo} alt="Logo sekolah" className="logo-prev" /> : <div className="logo-prev" />}
                    <label className="btn btn-ghost">Pilih logo<input type="file" accept="image/*" hidden onChange={gambar((logo) => set({ logo }), 240)} /></label>
                    {s.logo && <button className="link small" onClick={() => set({ logo: undefined })}>Hapus logo</button>}
                  </div>
                  <div className="form-grid g6">
                    <Field label="Nama sekolah *" span={4}><Inp obj={s} k="nama" set={set} /></Field>
                    <Field label="NPSN"><Inp obj={s} k="npsn" set={set} inputMode="numeric" maxLength={8} /></Field>
                    <Field label="NSS"><Inp obj={s} k="nss" set={set} /></Field>
                    <Field label="Yayasan / instansi induk" span={4}><Inp obj={s} k="yayasan" set={set} /></Field>
                    <Field label="Status sekolah"><Sel obj={s} k="statusSekolah" set={set} options={['Negeri', 'Swasta']} empty="-" /></Field>
                    <Field label="Kepemilikan"><Sel obj={s} k="statusKepemilikan" set={set} options={['Pemerintah Pusat', 'Pemerintah Daerah', 'Yayasan', 'Lainnya']} empty="-" /></Field>
                    <Field label="Status operasional" span={2}><Sel obj={s} k="statusOperasional" set={set} options={['Aktif', 'Tutup sementara', 'Tutup']} empty="-" /></Field>
                    <Field label="Waktu penyelenggaraan" span={2}><Sel obj={s} k="waktuPenyelenggaraan" set={set} options={['Pagi', 'Siang', 'Pagi/6 hari', 'Pagi/5 hari', 'Kombinasi']} empty="-" /></Field>
                    <Field label="Manajemen Berbasis Sekolah" span={2}><Sel obj={s} k="mbs" set={set} options={['Ya', 'Tidak']} empty="-" /></Field>
                  </div>
                </div>
              </Card>
              <Card title="Legalitas & akreditasi" className="mb">
                <div className="form-grid g6">
                  <Field label="No. SK pendirian" span={2}><Inp obj={s} k="skPendirian" set={set} /></Field>
                  <Field label="Tgl SK pendirian"><Inp obj={s} k="tglSkPendirian" set={set} type="date" /></Field>
                  <Field label="No. SK izin operasional" span={2}><Inp obj={s} k="skIzinOperasional" set={set} /></Field>
                  <Field label="Tgl SK izin"><Inp obj={s} k="tglSkIzinOperasional" set={set} type="date" /></Field>
                  <Field label="Akreditasi"><Sel obj={s} k="akreditasi" set={set} options={['A', 'B', 'C', 'Belum terakreditasi']} empty="-" /></Field>
                  <Field label="No. SK akreditasi" span={3}><Inp obj={s} k="skAkreditasi" set={set} /></Field>
                  <Field label="Tgl SK akreditasi"><Inp obj={s} k="tglAkreditasi" set={set} type="date" /></Field>
                  <Field label="Berlaku sampai"><Inp obj={s} k="akreditasiBerlaku" set={set} type="date" /></Field>
                </div>
              </Card>
              <Card title="Jenjang & penetapan khusus">
                <div className="field-l">Jenjang yang diselenggarakan</div>
                <div className="chips" style={{ margin: '4px 0 10px' }}>{JENJANG.map((j) => <label key={j} className={`chip ${s.jenjang.includes(j) ? 'on' : ''}`}><input type="checkbox" checked={s.jenjang.includes(j)} onChange={() => toggle(j)} />{j}</label>)}</div>
                <div className="form-grid g3">
                  <Field label="Kelas Rangkap (SD negeri)" hint="No. SK Dinas"><input value={s.flag?.kelasRangkap ?? ''} onChange={(e) => set({ flag: { ...s.flag, kelasRangkap: e.target.value || undefined } })} /></Field>
                  <Field label="Penyelenggara PJJ (SMA)" hint="No. Kepdirjen Dikmen Diksus"><input value={s.flag?.pjj ?? ''} onChange={(e) => set({ flag: { ...s.flag, pjj: e.target.value || undefined } })} /></Field>
                  <Field label="Kebekerjaan Luar Negeri (SMK)" hint="No. Kepdirjen Dikmen Diksus"><input value={s.flag?.kln ?? ''} onChange={(e) => set({ flag: { ...s.flag, kln: e.target.value || undefined } })} /></Field>
                </div>
                <p className="muted small">Jenis rombel khusus baru bisa dipilih di menu Rombel setelah nomor SK penetapannya diisi.</p>
              </Card>
            </>
          )}

          {bagian === 'lokasi' && (
            <>
              <Card title="Alamat" className="mb">
                <div className="form-grid g6">
                  <Field label="Jalan / alamat" span={4}><Inp obj={s} k="alamat" set={set} /></Field>
                  <Field label="RT"><Inp obj={s} k="rt" set={set} /></Field>
                  <Field label="RW"><Inp obj={s} k="rw" set={set} /></Field>
                  <Field label="Dusun"><Inp obj={s} k="dusun" set={set} /></Field>
                  <Field label="Kelurahan / desa"><Inp obj={s} k="kelurahan" set={set} /></Field>
                  <Field label="Kecamatan"><Inp obj={s} k="kecamatan" set={set} /></Field>
                  <Field label="Kabupaten / kota"><Inp obj={s} k="kabupaten" set={set} /></Field>
                  <Field label="Provinsi"><Inp obj={s} k="provinsi" set={set} /></Field>
                  <Field label="Kode pos"><Inp obj={s} k="kodePos" set={set} inputMode="numeric" maxLength={5} /></Field>
                  <Field label="Lintang (mis. -6.8915)" span={2}><Inp obj={s} k="lintang" set={set} /></Field>
                  <Field label="Bujur (mis. 107.6107)" span={2}><Inp obj={s} k="bujur" set={set} /></Field>
                  <Field label="Peta" span={2}>{s.lintang && s.bujur ? <a className="link" href={`https://www.google.com/maps?q=${s.lintang},${s.bujur}`} target="_blank" rel="noreferrer">Buka lokasi di Google Maps</a> : <span className="muted small">Isi lintang & bujur</span>}</Field>
                </div>
                <p className="muted small">Ditampilkan di kop: {alamatLengkap(s) || '-'}</p>
              </Card>
              <Card title="Kontak">
                <div className="form-grid g6">
                  <Field label="Telepon" span={2}><Inp obj={s} k="telepon" set={set} /></Field>
                  <Field label="Faksimile" span={2}><Inp obj={s} k="fax" set={set} /></Field>
                  <Field label="Email" span={2}><Inp obj={s} k="email" set={set} type="email" /></Field>
                  <Field label="Laman / website" span={3}><Inp obj={s} k="website" set={set} /></Field>
                  <Field label="Media sosial (Instagram, Facebook, YouTube)" span={3}><Inp obj={s} k="mediaSosial" set={set} placeholder="@sekolah" /></Field>
                </div>
              </Card>
            </>
          )}

          {bagian === 'pelengkap' && (
            <>
              <Card title="Rekening sekolah & perpajakan" className="mb">
                <div className="form-grid g6">
                  <Field label="Nama bank" span={2}><Inp obj={s} k="bank" set={set} /></Field>
                  <Field label="Cabang / KCP" span={2}><Inp obj={s} k="cabangBank" set={set} /></Field>
                  <Field label="Nomor rekening" span={2}><Inp obj={s} k="noRekening" set={set} /></Field>
                  <Field label="Rekening atas nama" span={2}><Inp obj={s} k="atasNamaRekening" set={set} /></Field>
                  <Field label="NPWP" span={2}><Inp obj={s} k="npwp" set={set} /></Field>
                  <Field label="Nama wajib pajak" span={2}><Inp obj={s} k="namaWajibPajak" set={set} /></Field>
                </div>
              </Card>
              <Card title="Sarana pendukung & kelembagaan">
                <div className="form-grid g6">
                  <Field label="Luas tanah milik (m²)" span={2}><Inp obj={s} k="luasTanahMilik" set={set} type="number" /></Field>
                  <Field label="Sumber listrik" span={2}><Sel obj={s} k="sumberListrik" set={set} options={['PLN', 'PLN & Diesel', 'Diesel', 'Tenaga Surya', 'Tidak ada']} empty="-" /></Field>
                  <Field label="Daya listrik (VA)" span={2}><Inp obj={s} k="dayaListrik" set={set} type="number" /></Field>
                  <Field label="Akses internet" span={3}><Sel obj={s} k="aksesInternet" set={set} options={['Fiber optik', 'Kabel/ADSL', 'Seluler 4G/5G', 'Satelit', 'Tidak ada']} empty="-" /></Field>
                  <Field label="Ketua komite sekolah" span={3}><Inp obj={s} k="ketuaKomite" set={set} /></Field>
                </div>
              </Card>
            </>
          )}

          {bagian === 'pejabat' && (
            <>
              <Card title="Pejabat penandatangan dokumen" className="mb">
                <div className="form-grid g3">
                  <Field label="Kepala sekolah"><Sel obj={s} k="kepalaSekolahId" set={set} empty="-" options={peg} /></Field>
                  <Field label="Wakil kepala bidang kurikulum"><Sel obj={s} k="wakaKurikulumId" set={set} empty="-" options={peg} /></Field>
                  <Field label="Bendahara sekolah"><Sel obj={s} k="bendaharaId" set={set} empty="-" options={peg} /></Field>
                  <Field label="Kepala tata usaha"><Sel obj={s} k="kaTuId" set={set} empty="-" options={peg} /></Field>
                  <Field label="Operator sekolah"><Sel obj={s} k="operatorId" set={set} empty="-" options={peg} /></Field>
                  <Field label="Kota tempat penandatanganan"><Inp obj={s} k="kotaTtdRapor" set={set} placeholder={s.kabupaten} /></Field>
                </div>
                <p className="muted small">Nama dan NIP pejabat otomatis muncul di kolom tanda tangan rapor, buku kas, kuitansi, surat, dan laporan.</p>
              </Card>
              <Card title="Tanda tangan & stempel digital (opsional)">
                <div className="ttd-set">
                  <ImgSlot label="Tanda tangan kepala sekolah" hint="PNG latar transparan" src={s.ttdKepsek} onPick={gambar((ttdKepsek) => set({ ttdKepsek }), 400)} onHapus={() => set({ ttdKepsek: undefined })} />
                  <ImgSlot label="Stempel sekolah" hint="PNG latar transparan" src={s.stempel} onPick={gambar((stempel) => set({ stempel }), 300)} onHapus={() => set({ stempel: undefined })} />
                  <div className="ttd-opsi">
                    <label className="chk"><input type="checkbox" checked={!!s.pakaiTtdDigital} onChange={(e) => set({ pakaiTtdDigital: e.target.checked })} /> Cantumkan tanda tangan & stempel pada kolom Kepala Sekolah di semua cetakan</label>
                    <p className="muted small">Gunakan hanya untuk dokumen yang memang boleh ditandatangani secara digital. Untuk dokumen resmi, tetap gunakan tanda tangan basah sesuai ketentuan.</p>
                  </div>
                </div>
              </Card>
            </>
          )}

          {bagian === 'kop' && (
            <div className="kop-set">
              <Card title="Isi kop surat">
                <div className="form-grid g2">
                  <ImgSlot label="Logo kiri" hint="Kosong = logo sekolah" src={s.kop?.logoKiri || s.logo} onPick={gambar((logoKiri) => setKop({ logoKiri }), 240)} onHapus={s.kop?.logoKiri ? () => setKop({ logoKiri: undefined }) : undefined} />
                  <div className="field">
                    <span className="field-l">Logo kanan</span>
                    <div className="radio-row">
                      <label><input type="radio" checked={!s.kop?.logoKanan} onChange={() => setKop({ logoKanan: undefined })} /> Tanpa logo</label>
                      <label><input type="radio" checked={s.kop?.logoKanan === 'sekolah'} onChange={() => setKop({ logoKanan: 'sekolah' })} /> Logo sekolah</label>
                      <label className="btn btn-ghost">Unggah logo lain<input type="file" accept="image/*" hidden onChange={gambar((logoKanan) => setKop({ logoKanan }), 240)} /></label>
                    </div>
                    {s.kop?.logoKanan && s.kop.logoKanan !== 'sekolah' && <img src={s.kop.logoKanan} alt="" className="logo-prev sm" />}
                  </div>
                  <Field label="Baris 1" span={2} hint="mis. PEMERINTAH KABUPATEN BANDUNG atau nama yayasan"><input value={s.kop?.baris1 ?? ''} placeholder={s.yayasan} onChange={(e) => setKop({ baris1: e.target.value || undefined })} /></Field>
                  <Field label="Baris 2" span={2} hint="mis. DINAS PENDIDIKAN (dicetak tebal)"><input value={s.kop?.baris2 ?? ''} onChange={(e) => setKop({ baris2: e.target.value || undefined })} /></Field>
                  <Field label="Nama sekolah pada kop" span={2}><input value={s.kop?.namaTampil ?? ''} placeholder={s.nama} onChange={(e) => setKop({ namaTampil: e.target.value || undefined })} /></Field>
                  <Field label="Baris alamat" span={2} hint="Kosongkan untuk memakai alamat lengkap otomatis"><input value={s.kop?.alamatTampil ?? ''} placeholder={alamatLengkap(s)} onChange={(e) => setKop({ alamatTampil: e.target.value || undefined })} /></Field>
                  <Field label="Baris kontak" span={2} hint="Kosongkan untuk telepon, email, dan laman otomatis"><input value={s.kop?.kontakTampil ?? ''} placeholder={kontakLengkap(s)} onChange={(e) => setKop({ kontakTampil: e.target.value || undefined })} /></Field>
                </div>
                <div className="field-l" style={{ marginTop: 6 }}>Identitas yang ditampilkan</div>
                <div className="radio-row">
                  <label className="chk"><input type="checkbox" checked={s.kop?.tampilNpsn ?? true} onChange={(e) => setKop({ tampilNpsn: e.target.checked })} /> NPSN</label>
                  <label className="chk"><input type="checkbox" checked={!!s.kop?.tampilNss} onChange={(e) => setKop({ tampilNss: e.target.checked })} /> NSS</label>
                  <label className="chk"><input type="checkbox" checked={!!s.kop?.tampilAkreditasi} onChange={(e) => setKop({ tampilAkreditasi: e.target.checked })} /> Akreditasi</label>
                </div>
                <h4 className="sec">Tampilan</h4>
                <div className="form-grid g4">
                  <Field label="Huruf"><select value={s.kop?.huruf ?? 'Times'} onChange={(e) => setKop({ huruf: e.target.value as KopSetting['huruf'] })}>{['Times', 'Arial', 'Bookman', 'Cambria'].map((h) => <option key={h}>{h}</option>)}</select></Field>
                  <Field label="Garis bawah kop"><select value={s.kop?.garis ?? 'ganda'} onChange={(e) => setKop({ garis: e.target.value as KopSetting['garis'] })}><option value="ganda">Garis ganda</option><option value="tebal-tipis">Tebal + tipis</option><option value="tunggal">Tunggal</option><option value="tanpa">Tanpa garis</option></select></Field>
                  <Field label="Ukuran nama (pt)"><input type="number" min={12} max={26} value={s.kop?.ukuranNama ?? 17} onChange={(e) => setKop({ ukuranNama: Number(e.target.value) || undefined })} /></Field>
                  <Field label="Warna nama"><input type="color" value={s.kop?.warnaNama ?? '#000000'} onChange={(e) => setKop({ warnaNama: e.target.value === '#000000' ? undefined : e.target.value })} /></Field>
                  <Field label=" "><Btn onClick={() => set({ kop: undefined })}>Kembalikan bawaan</Btn></Field>
                </div>
                <h4 className="sec">Ukuran logo per dokumen</h4>
                <label className="chk"><input type="checkbox" checked={!s.kop?.logoManual} onChange={(e) => setKop({ logoManual: !e.target.checked })} /> Logo otomatis proporsional mengikuti tinggi tulisan kop (disarankan)</label>
                <div className="form-grid g4" style={s.kop?.logoManual ? undefined : { opacity: 0.5, pointerEvents: 'none' }}>
                  {(['rapor', 'surat', 'adm'] as const).map((j) => {
                    const key = j === 'rapor' ? 'ukuranLogoRapor' : j === 'surat' ? 'ukuranLogoSurat' : 'ukuranLogo'
                    const val = (s.kop?.[key] as number | undefined) ?? (j === 'adm' ? 70 : s.kop?.ukuranLogo ?? 70)
                    const nama = j === 'rapor' ? 'Rapor' : j === 'surat' ? 'Surat' : 'Administrasi'
                    return (
                      <Field key={j} label={`${nama}: ${val} px`} hint={j === 'adm' ? 'Register, buku induk, rekap, kuitansi, laporan' : j === 'surat' ? 'Surat dan disposisi' : undefined}>
                        <input type="range" min={30} max={160} value={val} onChange={(e) => { setJenisPrev(j); setKop({ [key]: Number(e.target.value) } as Partial<KopSetting>) }} />
                      </Field>
                    )
                  })}
                  <Field label={`Logo kanan: ${s.kop?.skalaLogoKanan ?? 100}%`} hint="Skala terhadap logo kiri"><input type="range" min={50} max={150} value={s.kop?.skalaLogoKanan ?? 100} onChange={(e) => setKop({ skalaLogoKanan: Number(e.target.value) })} /></Field>
                </div>
              </Card>
              <Card title="Pratinjau kop" className="kop-prev-card" actions={<select value={jenisPrev} onChange={(e) => setJenisPrev(e.target.value as typeof jenisPrev)} aria-label="Pratinjau sebagai"><option value="rapor">Rapor</option><option value="surat">Surat</option><option value="adm">Administrasi lain</option></select>}>
                <div className="kop-prev"><div className="doc"><KopSurat sekolah={s} jenis={jenisPrev} judul="CONTOH JUDUL DOKUMEN" sub="Nomor: 001/421/SHB/XI/2026" /></div></div>
                <p className="muted small">Kop ini dipakai di semua cetakan: rapor, buku induk, surat, register administrasi, kuitansi, dan laporan.</p>
              </Card>
            </div>
          )}

          {bagian === 'cetak' && (
            <>
              <Card title="Tahun ajaran & rapor" className="mb">
                <div className="form-grid g4">
                  <Field label="Tahun ajaran aktif"><Inp obj={s} k="tahunAjaranAktif" set={set} placeholder="2025/2026" /></Field>
                  <Field label="Semester aktif"><select value={s.semesterAktif} onChange={(e) => set({ semesterAktif: Number(e.target.value) as 1 | 2 })}><option value={1}>1 (Ganjil)</option><option value={2}>2 (Genap)</option></select></Field>
                  <Field label="Tanggal rapor"><Inp obj={s} k="tanggalRapor" set={set} type="date" placeholder={today()} /></Field>
                  <Field label="Kota tanda tangan"><Inp obj={s} k="kotaTtdRapor" set={set} placeholder={s.kabupaten} /></Field>
                </div>
              </Card>
              <Card title="Penomoran surat" className="mb">
                <div className="form-grid g4">
                  <Field label="Kode / singkatan sekolah"><Inp obj={s} k="kodeSurat" set={set} placeholder={s.npsn || 'SKL'} /></Field>
                  <Field label="Contoh nomor surat keluar" span={2}><div className="contoh-no">001/421/{kodeSekolah(s)}/{ROMAWI[new Date().getMonth()]}/{new Date().getFullYear()}</div></Field>
                </div>
                <p className="muted small">Kode kosong = NPSN. Format: nomor urut / kode klasifikasi / kode sekolah / bulan (romawi) / tahun. Nomor urut otomatis per tahun di buku Surat Keluar dan Surat Keterangan.</p>
              </Card>
              <Card title="Kertas cetak">
                <div className="radio-row">
                  <label className={`opsi-kertas ${s.ukuranKertas !== 'F4' ? 'on' : ''}`}><input type="radio" checked={s.ukuranKertas !== 'F4'} onChange={() => set({ ukuranKertas: 'A4' })} /><b>A4</b><small>210 × 297 mm</small></label>
                  <label className={`opsi-kertas ${s.ukuranKertas === 'F4' ? 'on' : ''}`}><input type="radio" checked={s.ukuranKertas === 'F4'} onChange={() => set({ ukuranKertas: 'F4' })} /><b>F4 / Folio</b><small>215 × 330 mm</small></label>
                </div>
                <p className="muted small">Berlaku untuk pratinjau, cetak, dan Simpan PDF.</p>
              </Card>
            </>
          )}

          {bagian === 'kurikulum' && (
            <Card title="Kurikulum tersedia">
              <ul className="kur-list">
                {KURIKULUM.map((k) => (
                  <li key={k.id}><b>{k.nama}</b> <span className={`pill ${k.asal === 'Internasional' ? 'info' : ''}`}>{k.asal}</span><br /><span className="muted small">Jenjang {k.jenjang.join(', ')} · Komponen: {k.komponen.map((c) => c.label).join(', ')}</span></li>
                ))}
              </ul>
              <p className="muted small">Kurikulum dipilih per rombel. Implementasinya dihitung otomatis dari data rombel (lihat Beranda).</p>
            </Card>
          )}

          {bagian === 'tampilan' && <PanelTampilan s={s} set={set} />}

          {bagian === 'ai' && <PanelAi s={s} set={set} />}

          {bagian === 'data' && <DataCadangan />}
        </div>
      </div>
    </div>
  )
}

function ImgSlot({ label, hint, src, onPick, onHapus }: { label: string; hint?: string; src?: string; onPick: (e: React.ChangeEvent<HTMLInputElement>) => void; onHapus?: () => void }) {
  return (
    <div className="field img-slot">
      <span className="field-l">{label}</span>
      <div className="img-slot-b">
        {src ? <img src={src} alt="" className="logo-prev sm" /> : <div className="logo-prev sm" />}
        <div>
          <label className="btn">Pilih gambar<input type="file" accept="image/*" hidden onChange={onPick} /></label>
          {onHapus && src && <button className="link small" onClick={onHapus}>Hapus</button>}
          {hint && <small className="muted">{hint}</small>}
        </div>
      </div>
    </div>
  )
}

function PanelAi({ s, set }: { s: Sekolah; set: (p: Partial<Sekolah>) => void }) {
  const a = { ...AI_DEFAULT, ...s.ai }
  const ubah = (p: Partial<typeof a>) => set({ ai: { ...a, ...p } })
  const [lihat, setLihat] = useState(false)
  const [uji, setUji] = useState<{ ok: boolean; pesan: string } | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [panduan, setPanduan] = useState(false)
  const pg = PANDUAN[a.penyedia]
  const pilih = (v: typeof a.penyedia) => ubah({ penyedia: v, endpoint: PENYEDIA[v].endpoint, model: PENYEDIA[v].model })
  const tes = async () => {
    setSibuk(true); setUji(null)
    try {
      const t = await panggilAi({ ...a, aktif: true }, 'Jawab singkat dalam bahasa Indonesia.', 'Balas dengan satu kalimat pendek: "Koneksi AI berhasil."', 60)
      setUji({ ok: true, pesan: t })
    } catch (e) { setUji({ ok: false, pesan: (e as Error).message }) }
    setSibuk(false)
  }
  return (
    <>
      <Card title="Penyusun narasi dengan AI" className="mb">
        <label className="cek"><input type="checkbox" checked={a.aktif} onChange={(e) => ubah({ aktif: e.target.checked })} /> Aktifkan tombol “Narasi AI” pada Penilaian dan Catatan Rapor</label>
        <div className="form-grid g4">
          <Field label="Penyedia" span={2}>
            <select value={a.penyedia} onChange={(e) => pilih(e.target.value as typeof a.penyedia)}>
              {(Object.keys(PENYEDIA) as (keyof typeof PENYEDIA)[]).map((k) => <option key={k} value={k}>{PENYEDIA[k].nama}</option>)}
            </select>
          </Field>
          <Field label="Model" span={2} hint="Contoh: claude-sonnet-5-5, gemini-2.5-flash, gpt-4o-mini"><input value={a.model} onChange={(e) => ubah({ model: e.target.value })} /></Field>
          <Field label="Alamat API" span={4}><input value={a.endpoint} onChange={(e) => ubah({ endpoint: e.target.value })} /></Field>
          <Field label="Kunci API" span={3} hint={a.penyedia === 'kompatibel' ? 'Boleh kosong untuk model lokal (Ollama).' : undefined}>
            <input type={lihat ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={a.apiKey} placeholder={a.penyedia === 'gemini' ? 'AIza...' : 'sk-...'} onChange={(e) => ubah({ apiKey: e.target.value.trim() })} />
          </Field>
          <Field label=" "><Btn onClick={() => setLihat(!lihat)}>{lihat ? 'Sembunyikan' : 'Tampilkan'}</Btn></Field>
          <Field label="Gaya narasi" span={2}>
            <select value={a.gaya} onChange={(e) => ubah({ gaya: e.target.value as typeof a.gaya })}>
              <option value="ringkas">Ringkas (2 kalimat)</option><option value="standar">Standar (3-4 kalimat)</option><option value="rinci">Rinci (5-6 kalimat)</option>
            </select>
          </Field>
          <Field label="Humanize" span={2} hint="Gaya tulisan alami seperti guru, variasi kalimat, tanpa frasa klise."><div className="radio-row"><input type="checkbox" checked={a.humanize !== false} onChange={(e) => ubah({ humanize: e.target.checked })} /> Aktif (disarankan)</div></Field>
          <Field label="Instruksi tambahan (opsional)" span={4} hint="Mis. “gunakan sapaan Ananda”, “hindari kata menguasai”."><input value={a.instruksi ?? ''} maxLength={400} onChange={(e) => ubah({ instruksi: e.target.value })} /></Field>
        </div>
        <div className="row-actions">
          <Btn icon="refresh" onClick={tes} disabled={sibuk || !(a.apiKey || a.penyedia === 'kompatibel') || !a.model}>{sibuk ? 'Menguji…' : 'Uji koneksi'}</Btn>
          {uji && <span className={`pill ${uji.ok ? 'ok' : 'bad'}`} role="status">{uji.ok ? `Berhasil: ${uji.pesan}` : uji.pesan}</span>}
          <Btn icon="help" onClick={() => setPanduan(true)}>Panduan integrasi</Btn>
          {!aiSiap(s.ai) && a.aktif && <span className="muted small">Lengkapi model dan kunci API, lalu simpan.</span>}
        </div>
        <p className="muted small">Simpan pengaturan (tombol di atas) setelah mengubah. Pengujian memakai nilai di layar.</p>
      </Card>
      {panduan && (
        <Modal title={`Panduan integrasi · ${pg.judul}`} onClose={() => setPanduan(false)} footer={<><a className="btn" href={pg.tautan} target="_blank" rel="noopener noreferrer">{pg.tautanLabel}</a><Btn kind="primary" onClick={() => setPanduan(false)}>Mengerti</Btn></>}>
          <p className="muted small">Panduan mengikuti penyedia yang sedang dipilih. Ganti penyedia untuk melihat panduan lainnya.</p>
          <ol className="panduan">{pg.langkah.map((l, i) => <li key={i}>{l}</li>)}</ol>
          <h4 className="sec">Catatan</h4>
          <ul className="panduan">{pg.catatan.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Modal>
      )}
      <Card title="Privasi & cara kerja">
        <ul className="kur-list">
          <li><b>Nama murid tidak dikirim.</b> Yang dikirim hanya nama mata pelajaran, tujuan pembelajaran, skor/capaian, kehadiran, dan ekskul. Nama diisi kembali di perangkat ini.</li>
          <li><b>Selaras dengan nilai.</b> Kategori (sangat baik, baik, cukup, belum tuntas) dihitung lokal terhadap KKM/KKTP, lalu AI hanya merangkai kalimat. Hasil selalu dapat disunting sebelum disimpan.</li>
          <li><b>Kunci API</b> disimpan di perangkat ini dan ikut cadangan terenkripsi. Biaya pemakaian ditagihkan oleh penyedia ke akun Anda. Jika AI gagal, narasi otomatis lokal tetap tersedia.</li>
          <li>Pada aplikasi Windows, panggilan dilakukan lewat proses utama aplikasi (tanpa batasan CORS). Versi web dapat diblokir browser untuk sebagian penyedia.</li>
        </ul>
      </Card>
    </>
  )
}

function PanelTampilan({ s, set }: { s: Sekolah; set: (p: Partial<Sekolah>) => void }) {
  const t = tampilanDari(s)
  const ubah = (p: Partial<typeof t>) => set({ tampilan: { ...s.tampilan, ...p } })
  const geser = (k: keyof typeof t, label: string, min: number, max: number, sat = '', step = 1) => (
    <Field label={`${label}: ${t[k]}${sat}`}>
      <input type="range" min={min} max={max} step={step} value={Number(t[k])} onChange={(e) => ubah({ [k]: Number(e.target.value) } as Partial<typeof t>)} />
    </Field>
  )
  const legal = [s.npsn && `NPSN ${s.npsn}`, s.statusSekolah, s.akreditasi && `Akreditasi ${s.akreditasi}`].filter(Boolean).join(' · ')
  return (
    <>
      <Card title="Pratinjau header" className="mb">
        <div className="tampil-prev" style={{ minHeight: Math.max(60, t.logoUkuran + 16) }}>
          <div className="top-sekolah" style={{ borderLeft: 0 }}>
            <LogoSekolah logo={s.logo} t={t} />
            {t.tampilNama && <div className="who"><b className="sk-nama" style={{ fontSize: t.namaUkuran }}>{s.nama || 'Nama Sekolah'}</b>{t.tampilLegalitas && <span className="sk-legal">{legal || 'NPSN · Status · Akreditasi'}</span>}</div>}
          </div>
        </div>
      </Card>
      <Card title="Logo" className="mb">
        <div className="form-grid g4">
          <Field label="Gambar logo" span={2}>
            <div className="row-actions">
              <label className="btn">Pilih gambar<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) set({ logo: await fotoKecil(f, 512) }) }} /></label>
              {s.logo && <Btn kind="ghost" icon="trash" onClick={() => set({ logo: undefined })}>Hapus</Btn>}
            </div>
          </Field>
          <Field label="Bentuk">
            <select value={t.logoBentuk} onChange={(e) => ubah({ logoBentuk: e.target.value as typeof t.logoBentuk })}>
              <option value="sudut">Sudut membulat</option><option value="lingkaran">Lingkaran</option><option value="kotak">Kotak</option><option value="tanpa">Tanpa bingkai latar</option>
            </select>
          </Field>
          <Field label="Latar">
            <select value={t.logoLatar} onChange={(e) => ubah({ logoLatar: e.target.value as typeof t.logoLatar })}>
              <option value="putih">Putih</option><option value="kaca">Kaca (transparan)</option><option value="transparan">Tanpa latar</option>
            </select>
          </Field>
          {geser('logoUkuran', 'Ukuran', 32, 96, ' px')}
          {geser('logoZoom', 'Zoom', 50, 250, '%')}
          {geser('logoGeserX', 'Geser kiri/kanan', -50, 50, '%')}
          {geser('logoGeserY', 'Geser atas/bawah', -50, 50, '%')}
          <Field label="Isi gambar">
            <select value={t.logoIsi} onChange={(e) => ubah({ logoIsi: e.target.value as typeof t.logoIsi })}>
              <option value="contain">Utuh (tanpa terpotong)</option><option value="cover">Penuh (dipotong)</option>
            </select>
          </Field>
          <Field label="Bingkai putih"><div className="radio-row"><input type="checkbox" checked={t.logoBingkai} onChange={(e) => ubah({ logoBingkai: e.target.checked })} /> Tampilkan</div></Field>
          <Field label="Bayangan"><div className="radio-row"><input type="checkbox" checked={t.logoBayangan} onChange={(e) => ubah({ logoBayangan: e.target.checked })} /> Tampilkan</div></Field>
        </div>
      </Card>
      <Card title="Huruf dokumen cetak" className="mb">
        <div className="form-grid g4">
          <Field label="Jenis huruf dokumen" span={2}>
            <select value={t.dokFont} onChange={(e) => ubah({ dokFont: e.target.value })}>
              {Object.entries(FONT_DOK).map(([k, v]) => <option key={k} value={k}>{v.nama}</option>)}
            </select>
          </Field>
          {geser('dokUkuran', 'Ukuran huruf dasar', 9, 14, ' pt', 0.5)}
          {geser('dokJarak', 'Jarak baris (x0,01)', 110, 180, '', 5)}
        </div>
        <div className="huruf-prev" style={{ fontFamily: FONT_DOK[t.dokFont]?.css, fontSize: `${t.dokUkuran}pt`, lineHeight: t.dokJarak / 100 }}>
          <b style={{ fontSize: `${t.dokUkuran + 1.5}pt` }}>LEMBAR BUKU INDUK PESERTA DIDIK</b>
          <div className="huruf-baris"><span>Nama lengkap</span><span>:</span><b>Raka Nugroho</b></div>
          <div className="huruf-baris"><span>Tempat, tanggal lahir</span><span>:</span><b>Bandung, 1 Juni 2021</b></div>
          <div>Ananda menunjukkan perkembangan yang baik dalam kegiatan belajar sehari-hari.</div>
        </div>
        <p className="muted small">Berlaku seragam di rapor, buku induk, surat, dan semua administrasi. Kop surat tetap memakai pilihan hurufnya sendiri di bagian Kop Surat; label inventaris selalu Arial agar mudah dipindai.</p>
      </Card>
      <Card title="Huruf aplikasi" className="mb">
        <div className="form-grid g4">
          <Field label="Jenis huruf aplikasi" span={2}>
            <select value={t.appFont} onChange={(e) => ubah({ appFont: e.target.value })}>
              {Object.entries(FONT_APP).map(([k, v]) => <option key={k} value={k}>{v.nama}</option>)}
            </select>
          </Field>
          {geser('appUkuran', 'Ukuran huruf aplikasi', 12, 17, ' px')}
        </div>
        <p className="muted small">Perubahan huruf berlaku setelah menekan “Simpan pengaturan”. Font yang tidak terpasang di komputer akan diganti font cadangan terdekat.</p>
      </Card>
      <Card title="Nama & legalitas di header">
        <div className="form-grid g4">
          <Field label="Nama sekolah"><div className="radio-row"><input type="checkbox" checked={t.tampilNama} onChange={(e) => ubah({ tampilNama: e.target.checked })} /> Tampilkan</div></Field>
          <Field label="Baris legalitas"><div className="radio-row"><input type="checkbox" checked={t.tampilLegalitas} disabled={!t.tampilNama} onChange={(e) => ubah({ tampilLegalitas: e.target.checked })} /> Tampilkan</div></Field>
          {geser('namaUkuran', 'Ukuran nama', 13, 26, ' px')}
          <Field label=" "><Btn icon="refresh" onClick={() => set({ tampilan: undefined })} disabled={!s.tampilan}>Kembalikan standar</Btn></Field>
        </div>
        <p className="muted small">Tinggi header menyesuaikan ukuran logo. Perubahan berlaku setelah menekan “Simpan pengaturan”. Logo untuk kop surat diatur terpisah di bagian Kop Surat.</p>
      </Card>
    </>
  )
}
