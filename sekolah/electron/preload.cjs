// Jembatan aman (contextIsolation) antara halaman dan proses utama: hanya fungsi simpan PDF.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('simas', {
  simpanPdf: (nama) => ipcRenderer.invoke('simas:simpan-pdf', String(nama || 'Dokumen SIMAS.pdf')),
})
