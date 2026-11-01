// Proses utama Electron: membungkus hasil build web (dist/) menjadi aplikasi desktop Windows.
// Data disimpan di IndexedDB milik profil aplikasi (%APPDATA%/SIMAS Sekolah), terpisah dari browser.
const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

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
