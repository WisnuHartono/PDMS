// Jembatan aman (contextIsolation) antara halaman dan proses utama: hanya fungsi simpan PDF.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('simas', {
  aiFetch: (req) => ipcRenderer.invoke('simas:ai', req),
  dav: (r) => ipcRenderer.invoke('simas:dav', r),
  pilihFolder: () => ipcRenderer.invoke('simas:pilih-folder'),
  folderTulis: (r) => ipcRenderer.invoke('simas:folder-tulis', r),
  folderDaftar: (d) => ipcRenderer.invoke('simas:folder-daftar', d),
  folderBaca: (r) => ipcRenderer.invoke('simas:folder-baca', r),
  simpanPdf: (nama) => ipcRenderer.invoke('simas:simpan-pdf', String(nama || 'Dokumen SIMAS.pdf')),
})
