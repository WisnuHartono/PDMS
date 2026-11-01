import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { EncryptedBackend, IndexedDbBackend } from './db'
import { Masuk, Pasang } from './pages/Login'
import { seedDemo } from './seed'
import { adaAkun, kebijakan, type Sesi } from './security/akun'
import { pasangIdle, setSesi } from './security/sesi'
import { DEFAULT_SEKOLAH, getState, initStore, put } from './store'
import './styles.css'

/** Buka data terenkripsi dengan kunci dari sesi login, lalu tampilkan aplikasi. */
async function bukaData(s: Sesi, demo = false) {
  await initStore(new EncryptedBackend(new IndexedDbBackend(), s.dek))
  if (demo) await seedDemo()
  else if (!getState().sekolah.length) await put('sekolah', DEFAULT_SEKOLAH)
  setSesi(s)
  pasangIdle((await kebijakan()).idleMenit)
}

function Root() {
  const [tahap, setTahap] = useState<'muat' | 'pasang' | 'masuk' | 'app'>('muat')
  const [galat, setGalat] = useState('')
  useEffect(() => {
    adaAkun().then((ada) => setTahap(ada ? 'masuk' : 'pasang')).catch((e) => setGalat(String(e)))
  }, [])
  const lanjut = (s: Sesi, demo?: boolean) => bukaData(s, demo).then(() => setTahap('app')).catch((e) => setGalat(`Gagal membuka data: ${e}`))
  if (galat) return <div className="welcome"><div className="welcome-card"><h1>Terjadi kesalahan</h1><p>{galat}</p></div></div>
  if (tahap === 'muat') return <div className="welcome" />
  if (tahap === 'pasang') return <Pasang onSelesai={(s, demo) => lanjut(s, demo)} />
  if (tahap === 'masuk') return <Masuk onMasuk={(s) => lanjut(s)} />
  return <App />
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
