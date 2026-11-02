// SIMAS Generator Serial: membuat serial lisensi bertanda tangan. Kunci privat dibaca dari berkas kunci-privat.pem
// di folder yang sama dengan aplikasi (jangan dibagikan; siapa pun yang memilikinya dapat membuat serial).
const { app, BrowserWindow, ipcMain, dialog, clipboard, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { buatSerial, periksaSerial, publikDariPrivat, KUNCI_PUBLIK_HEX } = require('./lib.cjs')

const folderApp = () => (app.isPackaged ? path.dirname(process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')) : __dirname)
const berkasKunci = () => [path.join(folderApp(), 'kunci-privat.pem'), path.join(app.getPath('userData'), 'kunci-privat.pem')].find((p) => fs.existsSync(p))
const berkasRiwayat = () => path.join(app.getPath('userData'), 'riwayat-serial.json')
const bacaRiwayat = () => { try { return JSON.parse(fs.readFileSync(berkasRiwayat(), 'utf8')) } catch { return [] } }

function statusKunci() {
  const p = berkasKunci()
  if (!p) return { ada: false, cari: path.join(folderApp(), 'kunci-privat.pem') }
  try {
    const pem = fs.readFileSync(p, 'utf8')
    return { ada: true, path: p, cocok: publikDariPrivat(pem) === KUNCI_PUBLIK_HEX }
  } catch (e) { return { ada: false, cari: p, galat: 'Berkas kunci tidak dapat dibaca.' } }
}

function jendela() {
  Menu.setApplicationMenu(null)
  const w = new BrowserWindow({ width: 900, height: 580, minWidth: 720, minHeight: 520, title: 'SIMAS Generator Serial', backgroundColor: '#eef2f6', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  w.loadFile(path.join(__dirname, 'index.html'))
}

const kunci = app.requestSingleInstanceLock()
if (!kunci) app.quit()
else {
  app.whenReady().then(() => {
    ipcMain.handle('gen:status', () => statusKunci())
    ipcMain.handle('gen:riwayat', () => bacaRiwayat())
    ipcMain.handle('gen:salin', (_e, t) => { clipboard.writeText(t); return true })
    ipcMain.handle('gen:pilih-kunci', async () => {
      const r = await dialog.showOpenDialog({ title: 'Pilih kunci-privat.pem', filters: [{ name: 'Kunci privat', extensions: ['pem'] }], properties: ['openFile'] })
      if (r.canceled || !r.filePaths[0]) return statusKunci()
      fs.copyFileSync(r.filePaths[0], path.join(app.getPath('userData'), 'kunci-privat.pem'))
      return statusKunci()
    })
    ipcMain.handle('gen:buat', (_e, r) => {
      try {
        const p = berkasKunci()
        if (!p) throw new Error('Berkas kunci-privat.pem tidak ditemukan.')
        const pem = fs.readFileSync(p, 'utf8')
        if (publikDariPrivat(pem) !== KUNCI_PUBLIK_HEX) throw new Error('Kunci privat ini tidak cocok dengan aplikasi SIMAS.')
        const h = buatSerial({ nama: r.nama, kodeInstalasi: r.kodeInstalasi, kedaluwarsa: r.kedaluwarsa || '', kunciPrivatPem: pem })
        const rw = bacaRiwayat()
        rw.unshift({ waktu: new Date().toISOString(), nama: String(r.nama).trim(), kodeInstalasi: r.kodeInstalasi || '', kedaluwarsa: r.kedaluwarsa || '', noSeri: h.noSeri, serial: h.serial, catatan: String(r.catatan || '').slice(0, 120) })
        fs.mkdirSync(path.dirname(berkasRiwayat()), { recursive: true })
        fs.writeFileSync(berkasRiwayat(), JSON.stringify(rw.slice(0, 2000), null, 1))
        return { ok: true, ...h }
      } catch (e) { return { ok: false, pesan: e.message } }
    })
    ipcMain.handle('gen:periksa', (_e, s) => { try { return { ok: true, ...periksaSerial(s) } } catch (e) { return { ok: false, pesan: e.message } } })
    ipcMain.handle('gen:simpan', async (_e, r) => {
      const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Simpan berkas lisensi', defaultPath: path.join(app.getPath('documents'), `${String(r.nama || 'lisensi').replace(/[\\/:*?"<>|]+/g, ' ')}.lisensi`), filters: [{ name: 'Lisensi SIMAS', extensions: ['lisensi'] }] })
      if (canceled || !filePath) return { ok: false }
      fs.writeFileSync(filePath, `${r.serial}\n`)
      return { ok: true, path: filePath }
    })
    jendela()
  })
  app.on('window-all-closed', () => app.quit())
}
