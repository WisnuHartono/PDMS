import type { CSSProperties } from 'react'
import { BrandApp, tampilanDari, tinggiBrand } from '../logo'
import { LampuKoneksi } from '../koneksi'
import { getSesi } from '../security/sesi'
import { DAFTAR_TEMA, PRESET, varsTema, type NamaTema } from '../tema'
import type { Sekolah } from '../types'
import { Btn, Card, Field } from '../ui'
import { fotoKecil } from '../util'

const RESET_TEMA = { temaAksen: '', temaSudut: -1, temaBayangan: 'tema', temaSidebar: 'tema', temaLatar: '', headerMode: 'tema', headerGaris: 'tema', headerTeks: 'auto' } as const

function Mini({ t }: { t: ReturnType<typeof tampilanDari> }) {
  return (
    <div className="tm" style={varsTema(t) as CSSProperties}>
      <div className="tm-top"><i /><u /></div>
      <div className="tm-side"><i className="on" /><i /><i /><i /></div>
      <div className="tm-main"><div className="tm-card"><i className="a" /><i /><i /></div><span className="tm-btn" /></div>
    </div>
  )
}

export default function PanelTema({ s, set }: { s: Sekolah; set: (p: Partial<Sekolah>) => void }) {
  const t = tampilanDari(s)
  const admin = getSesi()?.akun.peranId === 'admin'
  const ubah = (p: Partial<typeof t>) => set({ tampilan: { ...s.tampilan, ...p } })
  const hv = varsTema(t) as CSSProperties
  const geser = (k: 'temaSudut' | 'headerSudut' | 'headerRedam', label: string, min: number, max: number, sat = '') => (
    <Field label={`${label}: ${t[k] < 0 ? 'bawaan tema' : t[k] + sat}`}>
      <input type="range" min={min} max={max} value={t[k] < 0 ? PRESET[t.tema].radius : t[k]} onChange={(e) => ubah({ [k]: Number(e.target.value) })} />
    </Field>
  )
  const warna = (k: 'temaAksen' | 'temaLatar' | 'headerWarna1' | 'headerWarna2', label: string, bawaan: string, bisaKosong = true) => (
    <Field label={label}>
      <div className="row-actions">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(t[k]) ? t[k] : bawaan} onChange={(e) => ubah({ [k]: e.target.value })} style={{ width: 52, height: 30, padding: 0 }} />
        {bisaKosong && t[k] && <Btn kind="ghost" onClick={() => ubah({ [k]: '' })}>Bawaan</Btn>}
      </div>
    </Field>
  )
  return (
    <>
      {!admin && <p className="small bad-t">Hanya Administrator yang dapat mengubah tema dan latar header. Pengaturan di bawah hanya dapat dilihat.</p>}
      <fieldset disabled={!admin} className="fs-plain">
        <Card title="Tema aplikasi" className="mb">
          <div className="tema-grid">
            {DAFTAR_TEMA.map((id: NamaTema) => (
              <button key={id} type="button" className={`tema-opsi ${t.tema === id ? 'on' : ''}`} onClick={() => ubah({ tema: id, ...RESET_TEMA })} aria-pressed={t.tema === id}>
                <Mini t={tampilanDari({ tampilan: { tema: id } })} />
                <b>{PRESET[id].nama}{t.tema === id ? ' · dipakai' : ''}</b>
                <small>{PRESET[id].ket}</small>
              </button>
            ))}
          </div>
          <p className="muted small">Memilih tema mengatur ulang penyesuaian warna di bawah ke bawaan tema tersebut. Tekan “Simpan pengaturan” di kanan atas untuk menerapkan ke seluruh aplikasi.</p>
        </Card>

        <Card title="Penyesuaian tema" className="mb">
          <div className="form-grid g4">
            {warna('temaAksen', 'Warna aksen (tombol, tautan, sorotan)', PRESET[t.tema].aksen)}
            {warna('temaLatar', 'Warna latar halaman', PRESET[t.tema].bg)}
            {geser('temaSudut', 'Sudut membulat', 0, 18, ' px')}
            <Field label="Bayangan kartu"><select value={t.temaBayangan} onChange={(e) => ubah({ temaBayangan: e.target.value as typeof t.temaBayangan })}><option value="tema">Ikuti tema</option><option value="ada">Ada</option><option value="tidak">Tanpa bayangan</option></select></Field>
            <Field label="Menu samping"><select value={t.temaSidebar} onChange={(e) => ubah({ temaSidebar: e.target.value as typeof t.temaSidebar })}><option value="tema">Ikuti tema</option><option value="gelap">Gelap</option><option value="terang">Terang</option></select></Field>
            {t.temaSudut >= 0 && <Field label=" "><Btn kind="ghost" onClick={() => ubah({ temaSudut: -1 })}>Sudut bawaan tema</Btn></Field>}
          </div>
        </Card>

        <Card title="Latar header (bilah atas)" className="mb">
          <div className="hdr-prev" style={{ ...hv, minHeight: tinggiBrand(t) }}>
            <BrandApp t={t} bawah={t.appTampilLampu ? <LampuKoneksi /> : undefined} />
            <span className="qsearch"><span className="small">Cari siswa / guru…</span></span>
          </div>
          <div className="form-grid g4">
            <Field label="Jenis latar" span={2}>
              <select value={t.headerMode} onChange={(e) => ubah({ headerMode: e.target.value as typeof t.headerMode })}>
                <option value="tema">Ikuti tema</option><option value="warna">Warna polos</option><option value="gradien">Gradien dua warna</option><option value="gambar">Gambar</option>
              </select>
            </Field>
            {(t.headerMode === 'warna' || t.headerMode === 'gradien') && warna('headerWarna1', t.headerMode === 'gradien' ? 'Warna awal' : 'Warna', '#0c2537', false)}
            {t.headerMode === 'gradien' && warna('headerWarna2', 'Warna akhir', '#1e3a8a', false)}
            {t.headerMode === 'gradien' && geser('headerSudut', 'Arah gradien', 0, 360, '°')}
            {t.headerMode === 'gambar' && (
              <>
                <Field label="Gambar latar" span={2}>
                  <div className="row-actions">
                    <label className="btn">Pilih gambar<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) ubah({ headerGambar: await fotoKecil(f, 1600) }) }} /></label>
                    {t.headerGambar && <Btn kind="ghost" onClick={() => ubah({ headerGambar: '' })}>Hapus</Btn>}
                  </div>
                </Field>
                {geser('headerRedam', 'Lapisan peredam', 0, 90, '%')}
              </>
            )}
            <Field label="Warna teks header"><select value={t.headerTeks} onChange={(e) => ubah({ headerTeks: e.target.value as typeof t.headerTeks })}><option value="auto">Otomatis (terbaca)</option><option value="terang">Terang</option><option value="gelap">Gelap</option></select></Field>
            <Field label="Garis bawah header"><select value={t.headerGaris} onChange={(e) => ubah({ headerGaris: e.target.value as typeof t.headerGaris })}><option value="tema">Ikuti tema</option><option value="ada">Ada</option><option value="tidak">Tanpa garis</option></select></Field>
          </div>
          <p className="muted small">Warna teks otomatis menyesuaikan terang/gelapnya latar. Untuk gambar, lapisan peredam menjaga tulisan tetap terbaca; gambar disimpan di dalam data terenkripsi.</p>
        </Card>
        <Btn kind="ghost" onClick={() => ubah({ tema: 'modern', ...RESET_TEMA })}>Kembalikan ke tema Modern bawaan</Btn>
      </fieldset>
    </>
  )
}
