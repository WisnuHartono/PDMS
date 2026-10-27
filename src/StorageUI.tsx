import { useEffect, useState } from 'react'
import type { StorageMap, Settings } from './types'
import { actions, useApp } from './store'
import { DEST_LABEL, FILE_PRESETS, PRESETS, TOKENS, clearLocalRoot, folderSegments, fileNameFor, fsSupported, getWebdavPassword, localRootName, pickLocalRoot, setWebdavPassword, testWebdav } from './storage'
import { PwField, Collapse, notify } from './ui'
import { driveFolderUrl } from './drive'

export function StorageBadges({ m }: { m?: StorageMap }) {
  const icon = { local: '💾', drive: '☁', webdav: '🌐' } as const
  if (!m) return null
  return (
    <>
      {(['local', 'drive', 'webdav'] as const).map((k) => {
        const r = m[k]
        if (!r) return null
        const link = k === 'drive' && r.ok && (r as any).folderId ? driveFolderUrl((r as any).folderId) : undefined
        const body = <span className="pill" style={{ color: r.ok ? 'var(--ok)' : 'var(--danger)' }} title={r.ok ? r.path : r.error}>{icon[k]} {DEST_LABEL[k]} {r.ok ? '✓' : '✗'}</span>
        return link ? <a key={k} href={link} target="_blank" rel="noreferrer">{body}</a> : <span key={k}>{body} </span>
      })}
    </>
  )
}

export function StorageSettings() {
  const { state } = useApp()
  const s = state.settings
  const st = s.storage
  const [root, setRoot] = useState<string | undefined>()
  const [pw, setPw] = useState(getWebdavPassword())
  const [msg, setMsg] = useState('')
  useEffect(() => { localRootName().then(setRoot) }, [])
  const set = (p: Partial<Settings['storage']>) => actions.updateSettings({ storage: { ...st, ...p } })
  const isPreset = PRESETS.some(([t]) => t === st.pathTemplate)
  const sample = (() => {
    const p = state.projects[0], d = state.documents[0]
    if (!p || !d) return `PRJ-001 - Nama Proyek/Elektrikal/Datasheet/PRJ-001-0001-Nama Dokumen-IFR.pdf`
    const r = d.revisions.at(-1) || { rev: 'A', status: 'IFR', issuedDate: '' }
    return [...folderSegments(s, p, d, r), fileNameFor(s, p, d, r, r === d.revisions.at(-1) && d.revisions.at(-1)?.fileName ? d.revisions.at(-1)!.fileName! : 'nama-file.pdf')].join('/')
  })()

  const dest = (checked: boolean, on: (v: boolean) => void, title: string, body: React.ReactNode) => (
    <div className="dest">
      <label className="dest-h"><input type="checkbox" checked={checked} onChange={(e) => on(e.target.checked)} /><b>{title}</b></label>
      <div className="dest-b">{body}</div>
    </div>
  )

  return (
    <Collapse id="penyimpanan-file" title="Penyimpanan File" cls="scard">
      <p className="muted" style={{ margin: '0 0 8px' }}>File yang diunggah (revisi dan lampiran kontrak) otomatis disimpan ke semua tujuan aktif, dalam folder berdasarkan proyek, disiplin, dan jenis dokumen.</p>

      <div className="dests">
        {dest(st.local, (v) => set({ local: v }), '💾 Folder di komputer', <>
          <span className="muted">{fsSupported() ? (root ? <>Folder utama: <b>{root}</b></> : 'Belum ada folder dipilih.') : 'Browser ini tidak mendukung (pakai Chrome/Edge di komputer); ZIP terstruktur tetap bisa diunduh di halaman Berkas.'}</span>
          {fsSupported() && <>
            <button className="auto sec sm" onClick={async () => { try { setRoot(await pickLocalRoot()) } catch (e: any) { if (e?.name !== 'AbortError') notify(e.message + '\n(Jika aplikasi dibuka di dalam pratinjau/iframe, buka dalam tab sendiri.)') } }}>{root ? 'Ganti' : 'Pilih folder'}</button>
            {root && <button className="auto sec sm" onClick={async () => { await clearLocalRoot(); setRoot(undefined) }}>Lepas</button>}
          </>}
        </>)}
        {dest(st.drive, (v) => set({ drive: v }), '☁ Google Drive', <span className="muted">Dibuat otomatis di folder <b>DocControl</b> pada Drive (hubungkan akun Google di atas).</span>)}
        {dest(st.webdav.enabled, (v) => set({ webdav: { ...st.webdav, enabled: v } }), '🌐 WebDAV', <span className="muted">Nextcloud, ownCloud, Synology, NAS kantor, dll.</span>)}
      </div>
      {st.webdav.enabled && (
        <div className="wd">
          <label>URL folder WebDAV<input value={st.webdav.url} onChange={(e) => set({ webdav: { ...st.webdav, url: e.target.value.trim() } })} placeholder="https://cloud.contoh.com/remote.php/dav/files/user/DocControl" /></label>
          <div className="row">
            <label>Username<input value={st.webdav.username} onChange={(e) => set({ webdav: { ...st.webdav, username: e.target.value } })} autoComplete="off" /></label>
            <PwField label="Kata sandi aplikasi" value={pw} onChange={(e) => { setPw(e.target.value); setWebdavPassword(e.target.value) }} autoComplete="new-password" />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="auto sec sm" onClick={async () => { setMsg('Menguji...'); try { setMsg(await testWebdav(s)) } catch (e: any) { setMsg('Gagal: ' + (e.message || e) + ' (server harus mengizinkan CORS untuk alamat aplikasi ini)') } }}>Uji koneksi</button>
            <span className={msg.startsWith('Gagal') ? 'err' : 'ok'}>{msg}</span>
            <span className="muted" style={{ fontSize: 12 }}>Sandi hanya disimpan di perangkat ini. Gunakan sandi/token aplikasi, bukan sandi utama.</span>
          </div>
        </div>
      )}

      <h3 style={{ margin: '12px 0 6px' }}>Struktur folder & nama file</h3>
      <div className="pat">
        <div className="pat-h">Struktur folder</div>
        <div className="pat-r">
          <select value={isPreset ? st.pathTemplate : '__custom'} onChange={(e) => e.target.value !== '__custom' && set({ pathTemplate: e.target.value })}>
            {PRESETS.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
            <option value="__custom">Kustom...</option>
          </select>
          <input value={st.pathTemplate} onChange={(e) => set({ pathTemplate: e.target.value })} title="Pisahkan tingkat folder dengan /" />
        </div>
        <div className="chips"><span className="muted">Tambah tingkat folder:</span>{TOKENS.filter(([t]) => !['{rev}', '{name}'].includes(t)).map(([t, l]) => <button key={t} type="button" className="chip" onClick={() => set({ pathTemplate: (st.pathTemplate ? st.pathTemplate + '/' : '') + t })}>+ {l}</button>)}</div>
        <div className="pat-h" style={{ marginTop: 10 }}>Nama file <span className="muted">(ekstensi file asli otomatis ditambahkan)</span></div>
        <div className="pat-r">
          <select value={FILE_PRESETS.some(([t]) => t === st.fileTemplate) ? st.fileTemplate : '__custom'} onChange={(e) => e.target.value !== '__custom' && set({ fileTemplate: e.target.value })}>
            {FILE_PRESETS.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
            <option value="__custom">Kustom...</option>
          </select>
          <input value={st.fileTemplate} onChange={(e) => set({ fileTemplate: e.target.value })} />
        </div>
        <div className="chips"><span className="muted">Tambah ke nama file:</span>{TOKENS.filter(([t]) => !['{project}', '{category}', '{discipline}'].includes(t)).map(([t, l]) => <button key={t} type="button" className="chip" onClick={() => set({ fileTemplate: st.fileTemplate + (st.fileTemplate ? '-' : '') + t })}>+ {l}</button>)}</div>
      </div>
      <div style={{ fontSize: 12, marginTop: 6 }}><span className="muted">Contoh:</span> <code style={{ wordBreak: 'break-all' }}>{sample}</code></div>
      <details className="guide" style={{ marginTop: 6 }}>
        <summary>Token pola & catatan</summary>
        <div className="muted" style={{ fontSize: 12 }}>Token: {TOKENS.map(([t, l]) => <span key={t}><code>{t}</code> {l}; </span>)}</div>
        <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>Perubahan pola hanya berlaku untuk file yang diunggah berikutnya. Gunakan "Kirim ulang" di halaman Berkas untuk menyalin file lama ke struktur baru.</p>
      </details>
    </Collapse>
  )
}
