// Jembatan aman (contextIsolation) antara halaman dan proses utama: hanya fungsi simpan PDF.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('simas', {
  aiFetch: (req) => ipcRenderer.invoke('simas:ai', req),
  dav: (r) => ipcRenderer.invoke('simas:dav', r),
  googleMasuk: (r) => ipcRenderer.invoke('simas:google-masuk', { clientId: String(r?.clientId || ''), nonce: String(r?.nonce || '') }),
  googleToken: (r) => ipcRenderer.invoke('simas:google-token', { clientId: String(r?.clientId || ''), scope: String(r?.scope || '') }),
  pilihFolder: () => ipcRenderer.invoke('simas:pilih-folder'),
  folderTulis: (r) => ipcRenderer.invoke('simas:folder-tulis', r),
  folderDaftar: (d) => ipcRenderer.invoke('simas:folder-daftar', d),
  folderBaca: (r) => ipcRenderer.invoke('simas:folder-baca', r),
  simpanPdf: (nama) => ipcRenderer.invoke('simas:simpan-pdf', String(nama || 'Dokumen SIMAS.pdf')),
})
