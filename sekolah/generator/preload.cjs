const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('gen', {
  status: () => ipcRenderer.invoke('gen:status'),
  buat: (r) => ipcRenderer.invoke('gen:buat', r),
  periksa: (s) => ipcRenderer.invoke('gen:periksa', s),
  riwayat: () => ipcRenderer.invoke('gen:riwayat'),
  simpanBerkas: (r) => ipcRenderer.invoke('gen:simpan', r),
  salin: (t) => ipcRenderer.invoke('gen:salin', String(t)),
  pilihKunci: () => ipcRenderer.invoke('gen:pilih-kunci'),
})
