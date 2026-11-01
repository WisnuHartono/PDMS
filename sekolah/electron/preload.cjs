// Jembatan aman (contextIsolation) antara halaman dan proses utama: hanya fungsi simpan PDF.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('simas', {
  aiFetch: (req) => ipcRenderer.invoke('simas:ai', req),
  simpanPdf: (nama) => ipcRenderer.invoke('simas:simpan-pdf', String(nama || 'Dokumen SIMAS.pdf')),
})
