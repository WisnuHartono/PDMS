import { useEffect, useRef, useState, type ReactNode } from 'react'
import { adaDesktop, daftar, googleTerhubung, hubungkanGoogle, jatuhTempo, KOSONG, pilihFolder, putusGoogle, unduh, unggah, uji, type BerkasCloud } from '../cloud'
import { MIME_XLSX, buatXlsx, buatZip, csvDari, susunLembar } from '../ekspor'
import { seedDemo } from '../seed'
import { DEFAULT_SEKOLAH, cadanganTerenkripsi, exportTerenkripsi, getState, importJson, put, resetAll, useSekolah } from '../store'
import type { CloudSetting, TujuanCadangan } from '../types'
import { Btn, Card, Field, toast, tanya } from '../ui'
import { download, fmtTanggal, readFileAsText, today } from '../util'

const TUJUAN: [TujuanCadangan, string, string][] = [
  ['lokal', 'Lokal (unduh berkas)', 'Berkas diunduh ke perangkat ini'],
  ['folder', 'Folder / sinkronisasi desktop', 'Folder Google Drive, OneDrive, Dropbox di Windows'],
  ['gdrive', 'Google Drive', 'Izin langsung ke akun Google (versi web)'],
  ['webdav', 'Cloud WebDAV', 'Nextcloud, ownCloud, Synology, Box, dll.'],
]
const NAMA_TUJUAN: Record<TujuanCadangan, string> = { lokal: 'perangkat ini', folder: 'folder', gdrive: 'Google Drive', webdav: 'server WebDAV' }

function KonfirmasiBtn({ label, tanya: q, onYa, danger }: { label: ReactNode; tanya: string; onYa: () => Promise<void>; danger?: boolean }) {
  const [siap, setSiap] = useState(false)
  useEffect(() => { if (!siap) return; const t = setTimeout(() => setSiap(false), 5000); return () => clearTimeout(t) }, [siap])
  return <Btn kind={danger || siap ? 'danger' : 'default'} onClick={async () => { if (!siap) return setSiap(true); setSiap(false); await onYa() }}>{siap ? q : label}</Btn>
}

const ukuran = (n?: number) => (n === undefined ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default function DataCadangan() {
  const sekolah = useSekolah()
  const tersimpan: CloudSetting = { ...KOSONG, ...sekolah.cloud }
  const [c, setC] = useState<CloudSetting>(tersimpan)
  const [gOk, setGOk] = useState(googleTerhubung())
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

  return (
    <>
      <Card title="Ekspor database ke Excel / CSV" className="mb">
        <p className="muted small">Seluruh data ({lembar.length} lembar, {jmlBaris.toLocaleString('id-ID')} baris) diekspor sebagai tabel: satu lembar per jenis data (peserta didik, GTK, rombel, nilai, buku administrasi, dst.). Foto, logo, dan kunci API tidak ikut. Berkas Excel/CSV <b>tidak terenkripsi</b> — simpan di tempat aman dan jangan dibagikan sembarangan karena memuat data pribadi.</p>
        <div className="filters">
          <Btn icon="download" kind="primary" onClick={() => { download(`simas-database-${today()}.xlsx`, new Blob([buatXlsx(lembar) as BlobPart], { type: MIME_XLSX }), MIME_XLSX); toast('Berkas Excel diunduh') }}>Unduh Excel (.xlsx)</Btn>
          <Btn icon="download" onClick={() => { download(`simas-csv-${today()}.zip`, new Blob([buatZip(lembar.map((l) => ({ nama: `${l.nama}.csv`, isi: csvDari(l, pemisah) }))) as BlobPart], { type: 'application/zip' }), 'application/zip'); toast('ZIP berisi CSV per lembar diunduh') }}>Unduh semua CSV (.zip)</Btn>
          {adaCloud && <Btn icon="upload" disabled={!!sibuk} onClick={() => jalan('xlsx', async () => toast(await kirim(`simas-database-${today()}.xlsx`, buatXlsx(lembar), MIME_XLSX)))}>{sibuk === 'xlsx' ? 'Mengirim…' : `Kirim Excel ke ${NAMA_TUJUAN[c.tujuan]}`}</Btn>}
        </div>
        <div className="filters" style={{ marginTop: 8 }}>
          <select value={lembarDipilih} onChange={(e) => setLembarDipilih(e.target.value)} aria-label="Lembar untuk CSV tunggal">
            <option value="">Satu lembar saja (CSV)…</option>
            {lembar.map((l) => <option key={l.nama} value={l.nama}>{l.nama} ({l.baris.length})</option>)}
          </select>
          <Btn disabled={!lembarDipilih} onClick={() => { const l = lembar.find((x) => x.nama === lembarDipilih); if (l) download(`${l.nama}-${today()}.csv`, csvDari(l, pemisah), 'text/csv;charset=utf-8') }}>Unduh CSV</Btn>
          <select value={pemisah} onChange={(e) => setPemisah(e.target.value as ';' | ',')} aria-label="Pemisah kolom CSV">
            <option value=";">Pemisah titik koma (Excel Indonesia)</option>
            <option value=",">Pemisah koma</option>
          </select>
        </div>
      </Card>

      <Card title="Lokasi penyimpanan & integrasi cloud" className="mb">
        <p className="muted small">Database aktif selalu tersimpan lokal di perangkat ini agar cepat dan tetap bisa dipakai tanpa internet. Pilih ke mana <b>cadangan</b> (dan ekspor Excel) disimpan. Cadangan terenkripsi dengan kata sandi Anda sebelum meninggalkan perangkat, sehingga penyedia cloud tidak dapat membacanya.</p>
        <div className="chips">
          {TUJUAN.map(([id, l, ket]) => (
            <label key={id} className={`chip ${c.tujuan === id ? 'on' : ''}`} title={ket}>
              <input type="radio" name="tujuan" checked={c.tujuan === id} onChange={() => ubah({ tujuan: id })} />{l}
            </label>
          ))}
        </div>

        {c.tujuan === 'lokal' && <div className="notice">Cadangan diunduh sebagai berkas biasa. Pindahkan sendiri ke flashdisk atau cloud. Untuk penyimpanan online otomatis pilih salah satu opsi lain.</div>}

        {c.tujuan === 'folder' && (
          <div className="notice">
            <b>Cara termudah memakai Google Drive / OneDrive / Dropbox di Windows</b>
            <ol className="small">
              <li>Pasang aplikasi desktopnya (mis. <i>Google Drive untuk desktop</i>) dan masuk dengan akun sekolah. Layanan itu membuat folder yang otomatis tersinkron ke cloud.</li>
              <li>Tekan <b>Pilih folder</b> di bawah dan arahkan ke folder tersebut (atau subfolder di dalamnya).</li>
              <li>Setiap cadangan yang disimpan SIMAS akan langsung naik ke cloud oleh aplikasi sinkronisasi — tanpa kata sandi akun diberikan ke SIMAS.</li>
            </ol>
            {adaDesktop()
              ? <div className="filters"><Btn onClick={async () => { const p = await pilihFolder(); if (p) ubah({ folder: p }) }}>Pilih folder…</Btn><code>{c.folder || 'belum dipilih'}</code></div>
              : <p className="small bad-t">Pemilihan folder hanya tersedia di aplikasi Windows. Di versi web gunakan Google Drive atau WebDAV.</p>}
          </div>
        )}

        {c.tujuan === 'gdrive' && (
          <div className="notice">
            <b>Menghubungkan Google Drive (sekali saja)</b>
            <ol className="small">
              <li>Buka <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">Google Cloud Console</a> dan buat proyek (mis. “SIMAS Sekolah”).</li>
              <li>Menu <i>APIs &amp; Services › Library</i>, aktifkan <b>Google Drive API</b>.</li>
              <li><i>OAuth consent screen</i>: pilih <b>External</b>, isi nama aplikasi, lalu tambahkan email Anda di <i>Test users</i>.</li>
              <li><i>Credentials › Create credentials › OAuth client ID</i>, jenis <b>Web application</b>. Pada <i>Authorized JavaScript origins</i> isikan: <code>{globalThis.location?.origin}</code></li>
              <li>Salin <b>Client ID</b> ke kolom di bawah, simpan, lalu tekan <b>Hubungkan Google Drive</b> dan setujui izin pada jendela Google.</li>
            </ol>
            <p className="small">Izin yang diminta hanya <code>drive.file</code>: SIMAS hanya melihat folder “SIMAS Cadangan” yang dibuatnya sendiri, bukan seluruh isi Drive Anda. Token izin hanya disimpan di memori dan hilang saat aplikasi ditutup. Di aplikasi Windows, gunakan opsi “Folder / sinkronisasi desktop”.</p>
            <Field label="OAuth Client ID" span={4}><input value={c.gClientId ?? ''} onChange={(e) => ubah({ gClientId: e.target.value })} placeholder="1234567890-abc.apps.googleusercontent.com" /></Field>
            <div className="filters">
              <Btn kind="primary" disabled={!c.gClientId || !!sibuk} onClick={() => jalan('g', async () => { await simpanC(); await hubungkanGoogle(c.gClientId!); setGOk(true); toast('Google Drive terhubung') })}>{gOk ? 'Hubungkan ulang' : 'Hubungkan Google Drive'}</Btn>
              {gOk && <><em className="pill ok">Terhubung</em><Btn kind="ghost" onClick={() => { putusGoogle(); setGOk(false); toast('Izin Google dicabut') }}>Putuskan</Btn></>}
            </div>
          </div>
        )}

        {c.tujuan === 'webdav' && (
          <div className="notice">
            <b>Menghubungkan penyimpanan WebDAV</b>
            <ol className="small">
              <li><b>Nextcloud / ownCloud:</b> alamat <code>https://server-anda/remote.php/dav/files/NAMA-PENGGUNA/</code>. Buat <i>kata sandi aplikasi</i> di Pengaturan › Keamanan agar kata sandi utama tidak dipakai.</li>
              <li><b>Synology / QNAP / Box / layanan lain:</b> aktifkan WebDAV di layanan tersebut dan salin alamatnya (harus <code>https://</code>).</li>
              <li>Isi alamat, nama pengguna, dan kata sandi, simpan, lalu tekan <b>Uji koneksi</b>. SIMAS membuat folder “SIMAS Cadangan” otomatis.</li>
            </ol>
            <div className="form-grid four">
              <Field label="Alamat WebDAV" span={4}><input value={c.davUrl ?? ''} onChange={(e) => ubah({ davUrl: e.target.value })} placeholder="https://cloud.contoh.sch.id/remote.php/dav/files/admin/" /></Field>
              <Field label="Nama pengguna" span={2}><input value={c.davUser ?? ''} onChange={(e) => ubah({ davUser: e.target.value })} autoComplete="off" /></Field>
              <Field label="Kata sandi / kata sandi aplikasi" span={2}><input type="password" value={c.davSandi ?? ''} onChange={(e) => ubah({ davSandi: e.target.value })} autoComplete="new-password" /></Field>
            </div>
            <p className="small muted">Di versi web, server harus mengizinkan CORS; aplikasi Windows tidak memerlukannya.</p>
          </div>
        )}

        <div className="filters" style={{ marginTop: 8 }}>
          <Btn kind="primary" disabled={!berubah} onClick={async () => { await simpanC(); toast('Lokasi penyimpanan disimpan') }}>Simpan lokasi</Btn>
          {(c.tujuan === 'webdav' || c.tujuan === 'folder' || (c.tujuan === 'gdrive' && gOk)) && (
            <Btn disabled={!!sibuk} onClick={() => jalan('uji', async () => { await simpanC(); toast(await uji(c)) })}>{sibuk === 'uji' ? 'Menguji…' : 'Uji koneksi'}</Btn>
          )}
        </div>
      </Card>

      <Card title="Cadangan terenkripsi & pemulihan" className="mb">
        <p className="muted small">Cadangan dienkripsi (Argon2id + AES-256-GCM) dengan kata sandi cadangan. Simpan kata sandi ini terpisah dari berkasnya; tanpa kata sandi, cadangan tidak dapat dipulihkan.</p>
        <div className="filters">
          <input type="password" placeholder="Kata sandi cadangan (min. 12 karakter)" value={sandi} onChange={(e) => setSandi(e.target.value)} autoComplete="new-password" aria-label="Kata sandi cadangan" style={{ width: 300 }} />
          <Btn icon="download" kind="primary" disabled={sandi.length < 12 || !!sibuk} onClick={() => jalan('cad', async () => {
            const hasil = await kirim(`simas-cadangan-${today()}.simas.json`, await exportTerenkripsi(sandi), 'application/json')
            if (c.tujuan !== 'lokal') await put('sekolah', { ...sekolah, cloud: { ...c, terakhir: new Date().toISOString(), hasilTerakhir: 'Manual: berhasil' } })
            toast(`Cadangan dibuat. ${hasil}`)
          })}>{sibuk === 'cad' ? 'Menyimpan…' : c.tujuan === 'lokal' ? 'Unduh cadangan' : `Simpan cadangan ke ${NAMA_TUJUAN[c.tujuan]}`}</Btn>
        </div>
        <div className="filters" style={{ marginTop: 8 }}>
          <Btn icon="upload" onClick={() => fileRef.current?.click()}>Pulihkan dari berkas…</Btn>
          {adaCloud && <Btn icon="upload" disabled={!!sibuk} onClick={() => jalan('daftar', async () => setPilihan(await daftar(c)))}>{sibuk === 'daftar' ? 'Membaca…' : `Pulihkan dari ${NAMA_TUJUAN[c.tujuan]}…`}</Btn>}
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (f) await pulihkan(await readFileAsText(f))
          }} />
        </div>
        {pilihan && (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            {pilihan.length === 0 ? <p className="muted small">Belum ada cadangan di {NAMA_TUJUAN[c.tujuan]}.</p> : (
              <table className="tbl"><thead><tr><th>Berkas</th><th>Waktu</th><th>Ukuran</th><th /></tr></thead><tbody>
                {pilihan.map((b) => (
                  <tr key={b.id}><td>{b.nama}</td><td className="nowrap">{b.waktu ? fmtTanggal(b.waktu.slice(0, 10)) : '-'}</td><td>{ukuran(b.ukuran)}</td>
                    <td className="row-actions"><Btn kind="ghost" disabled={!!sibuk} onClick={() => jalan('unduh', async () => { await pulihkan(await unduh(c, b)); setPilihan(null) })}>Pulihkan</Btn></td></tr>
                ))}
              </tbody></table>
            )}
          </div>
        )}
      </Card>

      <Card title="Cadangan otomatis" className="mb">
        {c.tujuan !== 'folder' && c.tujuan !== 'webdav'
          ? <p className="muted small">Cadangan otomatis tersedia untuk tujuan <b>Folder / sinkronisasi desktop</b> dan <b>WebDAV</b>. Google Drive memerlukan persetujuan interaktif setiap sesi, jadi cadangannya dibuat manual (SIMAS akan mengingatkan di sini).</p>
          : <>
            <p className="muted small">SIMAS membuat cadangan terenkripsi otomatis saat aplikasi dibuka bila sudah waktunya. Kata sandi cadangan disimpan di perangkat ini (ikut terlindungi bersama data aplikasi) agar proses berjalan tanpa Anda mengetik ulang.</p>
            <div className="form-grid four">
              <Field label="Jadwal" span={1}><select value={c.otomatis ?? 'mati'} onChange={(e) => ubah({ otomatis: e.target.value as CloudSetting['otomatis'] })}><option value="mati">Mati</option><option value="harian">Setiap hari</option><option value="mingguan">Setiap minggu</option></select></Field>
              <Field label="Kata sandi cadangan otomatis (min. 12)" span={2}><input type="password" value={c.sandiOto ?? ''} onChange={(e) => ubah({ sandiOto: e.target.value })} autoComplete="new-password" /></Field>
              {c.tujuan === 'folder' && <Field label="Simpan terbaru" span={1}><input type="number" min={1} max={100} value={c.simpanTerbaru ?? 10} onChange={(e) => ubah({ simpanTerbaru: Math.max(1, Number(e.target.value) || 10) })} /></Field>}
            </div>
            <Btn kind="primary" disabled={!berubah} onClick={async () => { await simpanC(); toast('Pengaturan cadangan otomatis disimpan') }}>Simpan</Btn>
            {c.otomatis !== 'mati' && (c.sandiOto?.length ?? 0) < 12 && <p className="small bad-t">Isi kata sandi minimal 12 karakter agar cadangan otomatis berjalan.</p>}
          </>}
        <p className="small muted" style={{ marginTop: 6 }}>Cadangan terakhir: {tersimpan.terakhir ? `${fmtTanggal(tersimpan.terakhir.slice(0, 10))} · ${tersimpan.hasilTerakhir ?? ''}` : 'belum ada'}{jatuhTempo(tersimpan) ? ' · akan dijalankan segera' : ''}</p>
      </Card>

      <Card title="Data contoh & penghapusan">
        <div className="btn-row">
          <KonfirmasiBtn label="Muat data contoh" tanya="Klik lagi: data saat ini diganti data contoh" onYa={async () => { await seedDemo(); toast('Data contoh dimuat') }} />
          <KonfirmasiBtn danger label="Hapus semua data" tanya="Klik lagi untuk menghapus SELURUH data" onYa={async () => { await resetAll(); await put('sekolah', DEFAULT_SEKOLAH); toast('Semua data dihapus') }} />
        </div>
      </Card>
    </>
  )

  async function pulihkan(teks: string) {
    if (cadanganTerenkripsi(teks) && !sandi) return toast('Isi kata sandi cadangan terlebih dahulu.')
    if (!await tanya('Pulihkan akan MENGGANTI seluruh data saat ini. Lanjutkan?')) return
    try { await importJson(teks, sandi); toast('Data berhasil dipulihkan') } catch (err) { toast(`Gagal: ${(err as Error).message}`) }
  }
}
