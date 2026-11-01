import { useEffect, useRef, useState, type ReactNode } from 'react'
import { adaDesktop, adaPilihFolder, awalanBerkas, daftar, folderSiap, izinkanFolder, googleTerhubung, hubungkanGoogle, jatuhTempo, KOSONG, pilihFolder, putusGoogle, unduh, unggah, uji, type BerkasCloud } from '../cloud'
import { MIME_XLSX, buatXlsx, buatZip, csvDari, susunLembar } from '../ekspor'
import { ambilDariCloud, sinkronSekarang, timpaCloud, useStatusSinkron } from '../sinkron'
import { LampuKoneksi } from '../koneksi'
import { seedDemo } from '../seed'
import { DEFAULT_SEKOLAH, cadanganTerenkripsi, exportTerenkripsi, getState, importJson, put, resetAll, useSekolah } from '../store'
import type { CloudSetting, TujuanCadangan } from '../types'
import { Btn, Card, Field, toast, tanya } from '../ui'
import { download, fmtTanggal, readFileAsText, today } from '../util'

const TUJUAN: [TujuanCadangan, string, string][] = [
  ['lokal', 'Unduhan browser (tanpa cloud)', 'Berkas diunduh ke perangkat ini'],
  ['folder', 'Folder di perangkat (pilih lokasi)', 'Folder lokal, flashdisk, atau folder sinkron Google Drive/OneDrive/Dropbox'],
  ['gdrive', 'Google Drive (versi web)', 'Izin langsung ke akun Google (versi web)'],
  ['webdav', 'WebDAV (Nextcloud, dll.)', 'Nextcloud, ownCloud, Synology, Box, dll.'],
]

function KonfirmasiBtn({ label, tanya: q, onYa, danger }: { label: ReactNode; tanya: string; onYa: () => Promise<void>; danger?: boolean }) {
  const [siap, setSiap] = useState(false)
  useEffect(() => { if (!siap) return; const t = setTimeout(() => setSiap(false), 5000); return () => clearTimeout(t) }, [siap])
  return <Btn kind={danger || siap ? 'danger' : 'default'} onClick={async () => { if (!siap) return setSiap(true); setSiap(false); await onYa() }}>{siap ? q : label}</Btn>
}

const adaFolderWebOk = !adaDesktop()
const ukuran = (n?: number) => (n === undefined ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default function DataCadangan() {
  const sekolah = useSekolah()
  const st = useStatusSinkron()
  const tersimpan: CloudSetting = { ...KOSONG, ...sekolah.cloud }
  const [c, setC] = useState<CloudSetting>(tersimpan)
  const [gOk, setGOk] = useState(googleTerhubung())
  const [izinFolder, setIzinFolder] = useState(true)
  useEffect(() => { if (tersimpan.tujuan === 'folder') void folderSiap(tersimpan).then(setIzinFolder) }, [tersimpan.tujuan, tersimpan.folder, st.fase])
  const [sibuk, setSibuk] = useState('')
  const [sandi, setSandi] = useState('')
  const [pilihan, setPilihan] = useState<BerkasCloud[] | null>(null)
  const [lembarDipilih, setLembarDipilih] = useState('')
  const [pemisah, setPemisah] = useState<';' | ','>(';')
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setC({ ...KOSONG, ...sekolah.cloud }) }, [sekolah.cloud])
  const ubah = (p: Partial<CloudSetting>) => setC((o) => ({ ...o, ...p }))
  const berubah = JSON.stringify(c) !== JSON.stringify(tersimpan)
  const simpanC = async (p: Partial<CloudSetting> = {}) => { await put('sekolah', { ...sekolah, cloud: { ...c, ...p } }); }
  const jalan = async (nama: string, f: () => Promise<void>) => {
    setSibuk(nama)
    try { await f() } catch (e) { toast(`Gagal: ${(e as Error).message}`) } finally { setSibuk('') }
  }
  const lembar = susunLembar(getState())
  const adaCloud = c.tujuan !== 'lokal'
  const jmlBaris = lembar.reduce((s, l) => s + l.baris.length, 0)

  const kirim = async (nama: string, isi: string | Uint8Array, mime: string) => {
    if (c.tujuan === 'lokal') { download(nama, typeof isi === 'string' ? isi : new Blob([isi as BlobPart], { type: mime }), mime); return 'Berkas diunduh' }
    return unggah(c, nama, isi, mime)
  }

  const kunci = sandi || c.sandiOto || ''
  const tampilFase = { mati: '', siap: 'ok', jalan: 'warn', offline: 'warn', tunda: 'warn', konflik: 'bad', gagal: 'bad' }[st.fase]
  const lokasiLengkap = c.tujuan === 'webdav' ? !!(c.davUrl && c.davUser) : c.tujuan === 'folder' ? !!c.folder : c.tujuan === 'gdrive' ? !!c.gClientId : false

  return (
    <div className="dc">
      <Card title="Sinkronisasi otomatis & lokasi cloud" className="mb">
        <div className="dc-status">
          <LampuKoneksi />
          <em className={`pill ${tampilFase}`}>{{ mati: 'Mati', siap: 'Tersinkron', jalan: 'Menyinkronkan', offline: 'Offline', tunda: 'Menunggu izin', konflik: 'Bentrok data', gagal: 'Gagal' }[st.fase]}</em>
          <span className="small">{st.pesan}{st.kotor ? ' · ada perubahan belum terunggah' : ''}{st.terakhir ? ` · terakhir ${new Date(st.terakhir).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</span>
          <span className="dc-sp" />
          {c.sinkron && <Btn disabled={!!sibuk || st.fase === 'jalan'} onClick={() => sinkronSekarang(tersimpan)}>Sinkronkan sekarang</Btn>}
          {c.tujuan === 'folder' && !izinFolder && adaFolderWebOk && <Btn kind="primary" onClick={async () => { if (await izinkanFolder()) { setIzinFolder(true); void sinkronSekarang(tersimpan) } else toast('Izin folder ditolak') }}>Izinkan akses folder</Btn>}
          {c.tujuan === 'gdrive' && gOk === false && c.gClientId && <Btn kind="primary" onClick={() => jalan('g', async () => { await simpanC(); await hubungkanGoogle(c.gClientId!); setGOk(true); void sinkronSekarang(tersimpan) })}>Hubungkan Google Drive</Btn>}
        </div>
        {st.fase === 'konflik' && (
          <div className="notice warn dc-konflik">
            <span>Data di cloud berbeda dari data perangkat ini (mis. diubah dari perangkat lain). Pilih mana yang dipakai — yang tidak dipilih akan tertimpa.</span>
            <Btn disabled={!!sibuk} onClick={async () => { if (await tanya('Ganti data di perangkat ini dengan data dari cloud?', 'Ganti')) jalan('ambil', async () => { await ambilDariCloud(tersimpan); toast('Data diperbarui dari cloud') }) }}>Pakai data cloud</Btn>
            <Btn kind="danger" disabled={!!sibuk} onClick={async () => { if (await tanya('Timpa data di cloud dengan data perangkat ini?', 'Timpa')) jalan('timpa', async () => { await timpaCloud(tersimpan); toast('Cloud diperbarui dari perangkat ini') }) }}>Pakai data perangkat ini</Btn>
          </div>
        )}
        <div className="form-grid four dc-form">
          <Field label="Tujuan cloud" span={1}>
            <select value={c.tujuan} onChange={(e) => ubah({ tujuan: e.target.value as TujuanCadangan, ...(e.target.value === 'lokal' ? { sinkron: false } : {}) })}>
              {TUJUAN.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
          </Field>
          {c.tujuan === 'webdav' && <>
            <Field label="Alamat WebDAV (https)" span={2}><input value={c.davUrl ?? ''} onChange={(e) => ubah({ davUrl: e.target.value })} placeholder="https://cloud.contoh.sch.id/remote.php/dav/files/admin/" /></Field>
            <Field label="Pengguna" span={1}><input value={c.davUser ?? ''} onChange={(e) => ubah({ davUser: e.target.value })} autoComplete="off" /></Field>
            <Field label="Kata sandi aplikasi" span={1}><input type="password" value={c.davSandi ?? ''} onChange={(e) => ubah({ davSandi: e.target.value })} autoComplete="new-password" /></Field>
          </>}
          {c.tujuan === 'gdrive' && <Field label="OAuth Client ID Google" span={3}><input value={c.gClientId ?? ''} onChange={(e) => ubah({ gClientId: e.target.value })} placeholder="1234567890-abc.apps.googleusercontent.com" /></Field>}
          {c.tujuan === 'folder' && <>
            <Field label="Folder penyimpanan lokal" span={2}>
              {adaPilihFolder()
                ? <div className="filters"><Btn onClick={() => jalan('pf', async () => { const p = await pilihFolder(); if (p) { ubah({ folder: p }); setIzinFolder(true) } })}>Pilih folder…</Btn><code className="small dc-path" title={c.folder}>{c.folder || 'belum dipilih'}</code></div>
                : <span className="small bad-t">Browser ini belum mendukung pilih folder (pakai Chrome/Edge atau aplikasi Windows).</span>}
            </Field>
            <Field label="Subfolder (opsional)" span={1}><input value={c.subfolder ?? ''} onChange={(e) => ubah({ subfolder: e.target.value })} placeholder="mis. SIMAS 2026" /></Field>
            <Field label="Awalan nama berkas" span={1}><input value={c.awalan ?? ''} onChange={(e) => ubah({ awalan: e.target.value.replace(/[^\w-]+/g, '') })} placeholder="simas" /></Field>
          </>}
          {c.tujuan !== 'lokal' && <>
            <Field label="Kata sandi enkripsi (min. 12 karakter)" span={2}><input type="password" value={c.sandiOto ?? ''} onChange={(e) => ubah({ sandiOto: e.target.value })} autoComplete="new-password" placeholder="Dipakai mengunci data sebelum dikirim" /></Field>
            <Field label="Sinkronisasi otomatis" span={1}><label className="dc-cek"><input type="checkbox" checked={!!c.sinkron} disabled={(c.sandiOto?.length ?? 0) < 12 || !lokasiLengkap} onChange={(e) => ubah({ sinkron: e.target.checked })} /> Aktif saat online</label></Field>
          </>}
        </div>
        <div className="filters">
          <Btn kind="primary" disabled={!berubah} onClick={async () => { await simpanC(); toast('Pengaturan disimpan') }}>Simpan</Btn>
          {(c.tujuan === 'webdav' || c.tujuan === 'folder' || (c.tujuan === 'gdrive' && gOk)) && <Btn disabled={!!sibuk} onClick={() => jalan('uji', async () => { await simpanC(); toast(await uji(c)) })}>{sibuk === 'uji' ? 'Menguji…' : 'Uji koneksi'}</Btn>}
          {c.tujuan === 'gdrive' && gOk && <><em className="pill ok">Google terhubung</em><Btn kind="ghost" onClick={() => { putusGoogle(); setGOk(false); toast('Izin Google dicabut') }}>Putuskan</Btn></>}
          {c.tujuan === 'gdrive' && !gOk && <Btn disabled={!c.gClientId || !!sibuk} onClick={() => jalan('g', async () => { await simpanC(); await hubungkanGoogle(c.gClientId!); setGOk(true); toast('Google Drive terhubung') })}>Hubungkan Google Drive</Btn>}
        </div>
        <details className="dc-det">
          <summary>Cara kerja &amp; panduan penyambungan</summary>
          <p className="small"><b>Cara kerja.</b> Data selalu tersimpan lebih dulu di perangkat ini, sehingga aplikasi tetap bisa dipakai tanpa internet. Saat online, setiap perubahan (data, dokumen/lampiran, foto) diunggah otomatis ±15 detik kemudian, terenkripsi dengan kata sandi di atas, sehingga penyedia cloud tidak dapat membacanya. Perubahan saat offline menunggu dan diunggah otomatis begitu koneksi kembali. SIMAS memeriksa cloud tiap 5 menit dan saat dibuka: bila perangkat ini tidak punya perubahan tertunda, data terbaru dari cloud diambil; bila keduanya berubah, SIMAS tidak menimpa diam-diam dan meminta Anda memilih. Akun login tidak ikut disinkronkan.</p>
          {c.tujuan === 'lokal' && <p className="small">Pilih tujuan cloud di atas untuk mengaktifkan sinkronisasi. Dengan “Lokal”, cadangan hanya diunduh sebagai berkas.</p>}
          {c.tujuan === 'folder' && <ol className="small"><li>Tekan “Pilih folder…” dan tentukan lokasi bebas: folder biasa, flashdisk/hard disk eksternal, atau folder jaringan. Subfolder dan awalan nama berkas bisa disesuaikan.</li><li>Ingin otomatis naik ke cloud? Pilih folder di dalam <i>Google Drive untuk desktop</i>, OneDrive, atau Dropbox; aplikasi sinkronisasinya yang mengunggah, tanpa SIMAS mengetahui sandi akun Anda.</li><li>Di browser (Chrome/Edge) izin akses folder berlaku per sesi dan perlu disetujui lagi saat dibuka ulang (tombol “Izinkan akses folder”). Aplikasi Windows tidak memerlukannya.</li></ol>}
          {c.tujuan === 'gdrive' && <>
            <ol className="small">
              <li>Buka <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">Google Cloud Console</a>, buat proyek (mis. “SIMAS Sekolah”).</li>
              <li><i>APIs &amp; Services › Library</i>: aktifkan <b>Google Drive API</b>.</li>
              <li><i>OAuth consent screen</i>: <b>External</b>, isi nama aplikasi, tambahkan email Anda di <i>Test users</i>.</li>
              <li><i>Credentials › OAuth client ID › Web application</i>; di <i>Authorized JavaScript origins</i> isi <code>{globalThis.location?.origin}</code>.</li>
              <li>Salin <b>Client ID</b> ke kolom di atas, simpan, lalu “Hubungkan Google Drive” dan setujui izin.</li>
            </ol>
            <p className="small">Izin hanya <code>drive.file</code>: SIMAS hanya melihat folder “SIMAS Cadangan” buatannya sendiri. Token izin disimpan di memori dan berakhir ±1 jam atau saat aplikasi ditutup; sinkronisasi menunggu sampai Anda menyambungkan ulang. Di aplikasi Windows gunakan “Folder / sinkronisasi desktop”.</p>
          </>}
          {c.tujuan === 'webdav' && <ol className="small">
            <li><b>Nextcloud / ownCloud:</b> alamat <code>https://server-anda/remote.php/dav/files/NAMA-PENGGUNA/</code>; buat <i>kata sandi aplikasi</i> di Pengaturan › Keamanan.</li>
            <li><b>Synology / QNAP / Box / lainnya:</b> aktifkan WebDAV dan salin alamat <code>https://</code>-nya.</li>
            <li>Isi alamat, pengguna, sandi; simpan; “Uji koneksi”. Folder “SIMAS Cadangan” dibuat otomatis. Di versi web server harus mengizinkan CORS (aplikasi Windows tidak memerlukannya).</li>
          </ol>}
        </details>
      </Card>

      <div className="dc-grid">
        <Card title="Ekspor ke Excel / CSV">
          <p className="muted small">{lembar.length} lembar · {jmlBaris.toLocaleString('id-ID')} baris, satu lembar per jenis data/buku administrasi. Foto, logo, kunci API tidak ikut. <b>Tidak terenkripsi</b> — simpan di tempat aman.</p>
          <div className="filters">
            <Btn icon="download" kind="primary" onClick={() => { download(`${awalanBerkas(c)}-database-${today()}.xlsx`, new Blob([buatXlsx(lembar) as BlobPart], { type: MIME_XLSX }), MIME_XLSX); toast('Berkas Excel diunduh') }}>Excel (.xlsx)</Btn>
            <Btn icon="download" onClick={() => { download(`${awalanBerkas(c)}-csv-${today()}.zip`, new Blob([buatZip(lembar.map((l) => ({ nama: `${l.nama}.csv`, isi: csvDari(l, pemisah) }))) as BlobPart], { type: 'application/zip' }), 'application/zip'); toast('ZIP berisi CSV diunduh') }}>Semua CSV (.zip)</Btn>
            {adaCloud && <Btn icon="upload" disabled={!!sibuk} onClick={() => jalan('xlsx', async () => toast(await kirim(`${awalanBerkas(c)}-database-${today()}.xlsx`, buatXlsx(lembar), MIME_XLSX)))}>{sibuk === 'xlsx' ? 'Mengirim…' : 'Kirim Excel ke cloud'}</Btn>}
          </div>
          <div className="filters dc-gap">
            <select value={lembarDipilih} onChange={(e) => setLembarDipilih(e.target.value)} aria-label="Lembar untuk CSV tunggal">
              <option value="">Satu lembar (CSV)…</option>
              {lembar.map((l) => <option key={l.nama} value={l.nama}>{l.nama} ({l.baris.length})</option>)}
            </select>
            <Btn disabled={!lembarDipilih} onClick={() => { const l = lembar.find((x) => x.nama === lembarDipilih); if (l) download(`${l.nama}-${today()}.csv`, csvDari(l, pemisah), 'text/csv;charset=utf-8') }}>CSV</Btn>
            <select value={pemisah} onChange={(e) => setPemisah(e.target.value as ';' | ',')} aria-label="Pemisah kolom CSV"><option value=";">Titik koma (Excel ID)</option><option value=",">Koma</option></select>
          </div>
        </Card>

        <Card title="Cadangan terenkripsi & pemulihan">
          <p className="muted small">Argon2id + AES-256-GCM. Tanpa kata sandi, cadangan tidak dapat dipulihkan{c.sandiOto ? '; kosongkan kolom bila ingin memakai kata sandi enkripsi di atas' : ''}.</p>
          <div className="filters">
            <input type="password" placeholder={c.sandiOto ? 'Kata sandi (kosong = sandi di atas)' : 'Kata sandi cadangan (min. 12)'} value={sandi} onChange={(e) => setSandi(e.target.value)} autoComplete="new-password" aria-label="Kata sandi cadangan" style={{ width: 230 }} />
            <Btn icon="download" kind="primary" disabled={kunci.length < 12 || !!sibuk} onClick={() => jalan('cad', async () => {
              const hasil = await kirim(`${awalanBerkas(c)}-cadangan-${today()}.simas.json`, await exportTerenkripsi(kunci), 'application/json')
              if (c.tujuan !== 'lokal') await put('sekolah', { ...sekolah, cloud: { ...c, terakhir: new Date().toISOString(), hasilTerakhir: 'Manual: berhasil' } })
              toast(`Cadangan dibuat. ${hasil}`)
            })}>{sibuk === 'cad' ? 'Menyimpan…' : c.tujuan === 'lokal' ? 'Unduh cadangan' : 'Simpan ke cloud'}</Btn>
            <Btn icon="upload" onClick={() => fileRef.current?.click()}>Pulihkan dari berkas</Btn>
            {adaCloud && <Btn icon="upload" disabled={!!sibuk} onClick={() => jalan('daftar', async () => setPilihan(await daftar(c)))}>{sibuk === 'daftar' ? 'Membaca…' : 'Pulihkan dari cloud'}</Btn>}
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await pulihkan(await readFileAsText(f)) }} />
          </div>
          {pilihan && (
            <div className="table-wrap dc-gap">
              {pilihan.length === 0 ? <p className="muted small">Belum ada cadangan di cloud.</p> : (
                <table className="tbl"><thead><tr><th>Berkas</th><th>Waktu</th><th>Ukuran</th><th /></tr></thead><tbody>
                  {pilihan.map((b) => (
                    <tr key={b.id}><td>{b.nama}</td><td className="nowrap">{b.waktu ? fmtTanggal(b.waktu.slice(0, 10)) : '-'}</td><td>{ukuran(b.ukuran)}</td>
                      <td className="row-actions"><Btn kind="ghost" disabled={!!sibuk} onClick={() => jalan('unduh', async () => { await pulihkan(await unduh(c, b)); setPilihan(null) })}>Pulihkan</Btn></td></tr>
                  ))}
                </tbody></table>
              )}
            </div>
          )}
          <div className="filters dc-gap">
            <label className="small">Cadangan berkala:&nbsp;
              <select value={c.otomatis ?? 'mati'} disabled={c.tujuan !== 'folder' && c.tujuan !== 'webdav'} onChange={(e) => ubah({ otomatis: e.target.value as CloudSetting['otomatis'] })}><option value="mati">Mati</option><option value="harian">Harian</option><option value="mingguan">Mingguan</option></select>
            </label>
            {c.tujuan === 'folder' && <label className="small">Simpan terbaru&nbsp;<input type="number" min={1} max={100} style={{ width: 60 }} value={c.simpanTerbaru ?? 10} onChange={(e) => ubah({ simpanTerbaru: Math.max(1, Number(e.target.value) || 10) })} /></label>}
            <Btn disabled={!berubah} onClick={async () => { await simpanC(); toast('Disimpan') }}>Simpan</Btn>
          </div>
          <p className="small muted">Cadangan berkala (riwayat berkas bertanggal) hanya untuk Folder/WebDAV dan memakai kata sandi enkripsi di atas. Terakhir: {tersimpan.terakhir ? `${fmtTanggal(tersimpan.terakhir.slice(0, 10))} · ${tersimpan.hasilTerakhir ?? ''}` : 'belum ada'}{jatuhTempo(tersimpan) ? ' · segera dijalankan' : ''}</p>
        </Card>
      </div>

      <Card title="Data contoh & penghapusan" className="mt">
        <div className="btn-row">
          <KonfirmasiBtn label="Muat data contoh" tanya="Klik lagi: data saat ini diganti data contoh" onYa={async () => { await seedDemo(); toast('Data contoh dimuat') }} />
          <KonfirmasiBtn danger label="Hapus semua data" tanya="Klik lagi untuk menghapus SELURUH data" onYa={async () => { await resetAll(); await put('sekolah', DEFAULT_SEKOLAH); toast('Semua data dihapus') }} />
        </div>
      </Card>
    </div>
  )

  async function pulihkan(teks: string) {
    if (cadanganTerenkripsi(teks) && !kunci) return toast('Isi kata sandi cadangan terlebih dahulu.')
    if (!await tanya('Pulihkan akan MENGGANTI seluruh data saat ini. Lanjutkan?')) return
    try { await importJson(teks, kunci); toast('Data berhasil dipulihkan') } catch (err) { toast(`Gagal: ${(err as Error).message}`) }
  }
}
