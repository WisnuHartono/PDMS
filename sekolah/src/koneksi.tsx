import { useEffect, useState } from 'react'
import { useStatusSinkron } from './sinkron'

/** Status koneksi internet perangkat (mengikuti peristiwa online/offline browser). */
export function useOnline() {
  const [on, setOn] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false)
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false)
    window.addEventListener('online', a); window.addEventListener('offline', b)
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b) }
  }, [])
  return on
}

/** Lampu status: hijau berdenyut = online, merah berkedip = offline, biru = sedang sinkron, kuning = perlu tindakan. */
export function LampuKoneksi({ ringkas = false }: { ringkas?: boolean }) {
  const on = useOnline()
  const st = useStatusSinkron()
  const perlu = on && (st.fase === 'tunda' || st.fase === 'konflik' || st.fase === 'gagal')
  const kelas = !on ? 'off' : st.fase === 'jalan' ? 'sync' : perlu ? 'warn' : 'on'
  const label = !on ? 'Offline' : st.fase === 'jalan' ? 'Menyinkronkan' : perlu ? 'Perlu tindakan' : 'Online'
  const rinci = !on
    ? `Tidak ada koneksi internet. Data disimpan di perangkat${st.kotor ? ' dan perubahan akan diunggah otomatis saat online' : ''}.`
    : st.fase === 'mati' ? 'Terhubung ke internet. Sinkronisasi cloud belum diaktifkan.' : `Terhubung ke internet. ${st.pesan}`
  return (
    <span className={`lampu ${kelas}`} role="status" aria-live="polite" title={rinci}>
      <i className="lampu-dot" aria-hidden />
      {!ringkas && <span className="lampu-t">{label}</span>}
      <span className="sr-only">{rinci}</span>
    </span>
  )
}
