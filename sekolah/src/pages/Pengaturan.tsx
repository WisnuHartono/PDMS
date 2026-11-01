import { useEffect, useRef, useState } from 'react'
import { KURIKULUM } from '../curricula'
import { seedDemo } from '../seed'
import { DEFAULT_SEKOLAH, exportJson, importJson, put, resetAll, useCol, useSekolah } from '../store'
import { JENJANG, type Sekolah } from '../types'
import { Btn, Card, Field, Inp, PageHead, Sel, toast } from '../ui'
import { download, fotoKecil, namaPegawai, readFileAsText, today } from '../util'

export default function Pengaturan() {
  const sekolah = useSekolah()
  const pegawai = useCol('pegawai')
  const [s, setS] = useState<Sekolah>(sekolah)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => setS(sekolah), [sekolah])
  const set = (p: Partial<Sekolah>) => setS((o) => ({ ...o, ...p }))
  const toggle = (j: (typeof JENJANG)[number]) => set({ jenjang: s.jenjang.includes(j) ? s.jenjang.filter((x) => x !== j) : [...s.jenjang, j] })

  return (
    <div>
      <PageHead title="Pengaturan" sub="Profil sekolah / yayasan, tahun ajaran, dan pengelolaan data">
        <Btn kind="primary" onClick={async () => { await put('sekolah', s); toast('Profil sekolah disimpan') }}>Simpan profil</Btn>
      </PageHead>
      <div className="grid-2">
        <Card title="Profil Sekolah">
          <div className="form-grid">
            <div className="foto-box span-1">
              {s.logo ? <img src={s.logo} alt="Logo" className="logo-prev" /> : <div className="logo-prev" />}
              <label className="btn btn-ghost">Pilih logo<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ logo: await fotoKecil(f, 240) }) }} /></label>
            </div>
            <Field label="Nama sekolah" span={2}><Inp obj={s} k="nama" set={set} /></Field>
            <Field label="Yayasan / instansi" span={2}><Inp obj={s} k="yayasan" set={set} /></Field>
            <Field label="NPSN"><Inp obj={s} k="npsn" set={set} /></Field>
            <Field label="NSS"><Inp obj={s} k="nss" set={set} /></Field>
            <Field label="Alamat" span={3}><Inp obj={s} k="alamat" set={set} /></Field>
            <Field label="Kelurahan/Desa"><Inp obj={s} k="kelurahan" set={set} /></Field>
            <Field label="Kecamatan"><Inp obj={s} k="kecamatan" set={set} /></Field>
            <Field label="Kabupaten/Kota"><Inp obj={s} k="kabupaten" set={set} /></Field>
            <Field label="Provinsi"><Inp obj={s} k="provinsi" set={set} /></Field>
            <Field label="Kode pos"><Inp obj={s} k="kodePos" set={set} /></Field>
            <Field label="Telepon"><Inp obj={s} k="telepon" set={set} /></Field>
            <Field label="Email"><Inp obj={s} k="email" set={set} /></Field>
            <Field label="Website" span={2}><Inp obj={s} k="website" set={set} /></Field>
          </div>
          <h4 className="sec">Jenjang yang diselenggarakan</h4>
          <div className="chips">{JENJANG.map((j) => <label key={j} className={`chip ${s.jenjang.includes(j) ? 'on' : ''}`}><input type="checkbox" checked={s.jenjang.includes(j)} onChange={() => toggle(j)} />{j}</label>)}</div>
        </Card>

        <div>
          <Card title="Tahun Ajaran & Rapor" className="mb">
            <div className="form-grid">
              <Field label="Tahun ajaran aktif"><Inp obj={s} k="tahunAjaranAktif" set={set} placeholder="2025/2026" /></Field>
              <Field label="Semester aktif"><select value={s.semesterAktif} onChange={(e) => set({ semesterAktif: Number(e.target.value) as 1 | 2 })}><option value={1}>1 (Ganjil)</option><option value={2}>2 (Genap)</option></select></Field>
              <Field label="Kepala sekolah"><Sel obj={s} k="kepalaSekolahId" set={set} empty="-" options={pegawai.filter((p) => p.aktif).map((p) => [p.id, namaPegawai(p)] as [string, string])} /></Field>
              <Field label="Kota (tanda tangan rapor)"><Inp obj={s} k="kotaTtdRapor" set={set} /></Field>
              <Field label="Tanggal rapor"><Inp obj={s} k="tanggalRapor" set={set} type="date" placeholder={today()} /></Field>
            </div>
          </Card>

          <Card title="Kurikulum Tersedia" className="mb">
            <ul className="kur-list">
              {KURIKULUM.map((k) => (
                <li key={k.id}><b>{k.nama}</b> <span className={`pill ${k.asal === 'Internasional' ? 'info' : ''}`}>{k.asal}</span><br /><span className="muted small">Jenjang {k.jenjang.join(', ')} · Komponen: {k.komponen.map((c) => c.label).join(', ')}</span></li>
              ))}
            </ul>
            <p className="muted small">Kurikulum dipilih per rombel. Kurikulum baru (mis. Cambridge, IB, atau kurikulum sekolah) dapat ditambahkan sebagai definisi di <code>src/curricula.ts</code> tanpa mengubah halaman lain.</p>
          </Card>

          <Card title="Data & Cadangan">
            <p className="muted small">Data tersimpan di perangkat ini (browser atau aplikasi Windows). Buat cadangan secara berkala dan simpan di tempat aman.</p>
            <div className="btn-row">
              <Btn icon="download" onClick={() => download(`simas-cadangan-${today()}.json`, exportJson())}>Unduh cadangan</Btn>
              <Btn icon="upload" onClick={() => fileRef.current?.click()}>Pulihkan dari cadangan</Btn>
              <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f || !confirm('Pulihkan akan MENGGANTI seluruh data saat ini. Lanjutkan?')) return
                try { await importJson(await readFileAsText(f)); toast('Data berhasil dipulihkan') } catch (err) { toast(`Gagal: ${(err as Error).message}`) }
              }} />
            </div>
            <div className="btn-row">
              <Btn onClick={async () => { if (confirm('Isi dengan data contoh? Data saat ini akan dihapus.')) { await seedDemo(); toast('Data contoh dimuat') } }}>Muat data contoh</Btn>
              <Btn kind="danger" onClick={async () => { if (confirm('Hapus SELURUH data? Tindakan ini tidak bisa dibatalkan.')) { await resetAll(); await put('sekolah', DEFAULT_SEKOLAH); toast('Semua data dihapus') } }}>Hapus semua data</Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
