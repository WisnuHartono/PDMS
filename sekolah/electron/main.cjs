// Proses utama Electron: membungkus hasil build web (dist/) menjadi aplikasi desktop Windows.
// Data disimpan di IndexedDB milik profil aplikasi (%APPDATA%/SIMAS Sekolah), terpisah dari browser.
const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { mulaiMasukGoogle } = require('./google-masuk.cjs')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const DIST = path.join(__dirname, '..', 'dist')

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    title: 'SIMAS - Administrasi Sekolah',
    backgroundColor: '#eef2f6',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  })
  win.loadURL('app://simas/index.html')
  // Tautan luar dibuka di browser bawaan.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) { if (w.isMinimized()) w.restore(); w.focus() }
  })

  // Simpan dokumen yang sedang dipratinjau menjadi PDF A4 (memakai CSS cetak yang sama dengan printer).
  ipcMain.handle('simas:simpan-pdf', async (e, nama) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const aman = String(nama).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Simpan dokumen sebagai PDF',
      defaultPath: path.join(app.getPath('documents'), aman.endsWith('.pdf') ? aman : `${aman}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { ok: false, batal: true }
    try {
      const pdf = await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4' })
      await fs.writeFile(filePath, pdf)
      shell.showItemInFolder(filePath)
      return { ok: true, path: filePath }
    } catch (err) {
      return { ok: false, pesan: `Gagal menyimpan PDF: ${err.message}` }
    }
  })

  // Panggilan API AI dari proses utama (bebas CORS). Hanya HTTPS, atau HTTP ke komputer sendiri (model lokal).
  ipcMain.handle('simas:ai', async (_e, req) => {
    try {
      const u = new URL(String(req?.url))
      const lokal = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
      if (!(u.protocol === 'https:' || (u.protocol === 'http:' && lokal))) return { status: 0, text: 'Alamat API harus HTTPS.' }
      const body = String(req.body ?? '')
      if (body.length > 200000) return { status: 0, text: 'Permintaan terlalu besar.' }
      const headers = {}
      for (const [k, v] of Object.entries(req.headers ?? {})) headers[String(k)] = String(v)
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 90000)
      try {
        const res = await net.fetch(u.toString(), { method: 'POST', headers, body, signal: ctl.signal })
        return { status: res.status, text: (await res.text()).slice(0, 500000) }
      } finally { clearTimeout(t) }
    } catch (err) {
      return { status: 0, text: err && err.name === 'AbortError' ? 'Waktu habis menunggu AI.' : `Tidak dapat terhubung: ${err.message}` }
    }
  })

  // ---- Penyimpanan cadangan: folder di perangkat dan WebDAV (bebas CORS) ----
  const folderOk = async (dir) => {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return false
    try { return (await fs.stat(dir)).isDirectory() } catch { return false }
  }
  const urai = async (dir, sub, buat) => {
    if (!(await folderOk(dir))) return null
    const seg = String(sub || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)
    if (!seg || seg === '.' || seg === '..') return dir
    const d = path.join(dir, seg)
    if (buat) await fs.mkdir(d, { recursive: true })
    return (await folderOk(d)) ? d : buat ? null : undefined
  }
  const namaOk = (n) => typeof n === 'string' && n === path.basename(n) && /^[\w.\- ()]+$/.test(n) && n.length < 160 && /\.(simas\.json|xlsx|zip|csv)$/i.test(n)
  // Masuk Google lewat browser sistem (Google tidak menerima alamat app://).
  ipcMain.handle('simas:google-masuk', (e, r) => mulaiMasukGoogle({ clientId: r?.clientId, nonce: r?.nonce, bukaBrowser: (u) => shell.openExternal(u) }))

  ipcMain.handle('simas:pilih-folder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = await dialog.showOpenDialog(win, { title: 'Pilih folder penyimpanan cadangan', properties: ['openDirectory', 'createDirectory'] })
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
  })
  ipcMain.handle('simas:folder-tulis', async (_e, r) => {
    try {
      const dir = await urai(r?.dir, r?.sub, true)
      if (!dir) return { ok: false, pesan: 'Folder tujuan tidak ditemukan.' }
      if (!namaOk(r.nama)) return { ok: false, pesan: 'Nama berkas tidak valid.' }
      const buf = Buffer.from(String(r.b64 ?? ''), 'base64')
      if (buf.length > 400 * 1024 * 1024) return { ok: false, pesan: 'Berkas terlalu besar.' }
      await fs.writeFile(path.join(dir, r.nama), buf)
      const keep = Number(r.simpan)
      if (keep >= 1 && /\.simas\.json$/i.test(r.nama)) {
        const awal = String(r.awalan || 'simas').replace(/[^\w-]+/g, '').slice(0, 40) || 'simas'
        const lama = (await fs.readdir(dir)).filter((f) => f.startsWith(`${awal}-cadangan-`) && /\.simas\.json$/i.test(f))
        const info = await Promise.all(lama.map(async (f) => ({ f, t: (await fs.stat(path.join(dir, f))).mtimeMs })))
        info.sort((a, b) => b.t - a.t)
        for (const x of info.slice(keep)) await fs.unlink(path.join(dir, x.f)).catch(() => {})
      }
      return { ok: true }
    } catch (err) { return { ok: false, pesan: `Gagal menulis: ${err.message}` } }
  })
  ipcMain.handle('simas:folder-daftar', async (_e, req) => {
    try {
      const induk = typeof req === 'string' ? req : req?.dir
      if (!(await folderOk(induk))) return { ok: false, pesan: 'Folder tidak ditemukan.' }
      const dir = await urai(induk, typeof req === 'string' ? '' : req?.sub, false)
      if (dir === undefined) return { ok: true, berkas: [] }
      if (!dir) return { ok: false, pesan: 'Folder tidak ditemukan.' }
      const out = []
      for (const f of await fs.readdir(dir)) {
        if (!namaOk(f)) continue
        const st = await fs.stat(path.join(dir, f))
        if (st.isFile()) out.push({ nama: f, ukuran: st.size, waktu: st.mtime.toISOString() })
      }
      out.sort((a, b) => b.waktu.localeCompare(a.waktu))
      return { ok: true, berkas: out.slice(0, 100) }
    } catch (err) { return { ok: false, pesan: err.message } }
  })
  ipcMain.handle('simas:folder-baca', async (_e, r) => {
    try {
      const dir = await urai(r?.dir, r?.sub, false)
      if (!dir || !namaOk(r.nama)) return { ok: false, pesan: 'Berkas tidak valid.' }
      const file = path.join(dir, r.nama)
      if ((await fs.stat(file)).size > 400 * 1024 * 1024) return { ok: false, pesan: 'Berkas terlalu besar.' }
      return { ok: true, teks: await fs.readFile(file, 'utf8') }
    } catch (err) { return { ok: false, pesan: err.message } }
  })
  ipcMain.handle('simas:dav', async (_e, req) => {
    try {
      const u = new URL(String(req?.url))
      const lokal = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
      if (!(u.protocol === 'https:' || (u.protocol === 'http:' && lokal))) return { status: 0, text: 'Alamat WebDAV harus HTTPS.' }
      const method = String(req.method).toUpperCase()
      if (!['PUT', 'GET', 'MKCOL', 'PROPFIND'].includes(method)) return { status: 0, text: 'Metode tidak diizinkan.' }
      const headers = {}
      for (const [k, v] of Object.entries(req.headers ?? {})) headers[String(k)] = String(v)
      const body = req.bodyB64 ? Buffer.from(String(req.bodyB64), 'base64') : req.body !== undefined ? String(req.body) : undefined
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 120000)
      try {
        const res = await net.fetch(u.toString(), { method, headers, body, signal: ctl.signal })
        return { status: res.status, text: (await res.text()).slice(0, 400 * 1024 * 1024) }
      } finally { clearTimeout(t) }
    } catch (err) { return { status: 0, text: `Tidak dapat terhubung: ${err.message}` } }
  })

  app.whenReady().then(() => {
    protocol.handle('app', (req) => {
      const { pathname } = new URL(req.url)
      const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html'
      const file = path.normalize(path.join(DIST, rel))
      if (!file.startsWith(DIST)) return new Response('Forbidden', { status: 403 })
      return net.fetch(pathToFileURL(file).toString())
    })
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Berkas', submenu: [{ role: 'reload', label: 'Muat ulang' }, { type: 'separator' }, { role: 'quit', label: 'Keluar' }] },
      { label: 'Tampilan', submenu: [{ role: 'zoomIn', label: 'Perbesar' }, { role: 'zoomOut', label: 'Perkecil' }, { role: 'resetZoom', label: 'Ukuran normal' }, { role: 'togglefullscreen', label: 'Layar penuh' }, { type: 'separator' }, { role: 'toggleDevTools', label: 'Developer tools' }] },
    ]))
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  })

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
