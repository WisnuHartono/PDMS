import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { seedDemo } from './seed'
import { DEFAULT_SEKOLAH, getState, initStore, put } from './store'
import './styles.css'

function Welcome({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const go = async (demo: boolean) => {
    setBusy(true)
    if (demo) await seedDemo()
    else await put('sekolah', DEFAULT_SEKOLAH)
    onDone()
  }
  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1>Selamat datang di SIMAS</h1>
        <p>Sistem Informasi Manajemen Administrasi Sekolah untuk PAUD, TK, SD, SMP, dan SMA/SMK.</p>
        <div className="btn-row">
          <button className="btn btn-primary" disabled={busy} onClick={() => go(true)}>Coba dengan data contoh</button>
          <button className="btn btn-default" disabled={busy} onClick={() => go(false)}>Mulai dengan data kosong</button>
        </div>
        <p className="muted small">Data contoh dapat dihapus kapan saja dari menu Pengaturan.</p>
      </div>
    </div>
  )
}

function Root() {
  const [ready, setReady] = useState(getState().sekolah.length > 0)
  return ready ? <App /> : <Welcome onDone={() => setReady(true)} />
}

initStore().then(() => {
  createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
}).catch((e) => {
  document.getElementById('root')!.textContent = `Gagal membuka database: ${e}`
})
