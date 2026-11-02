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

/** Waktu tempuh (ms) ke internet: mengukur permintaan kecil tiap 15 detik selama aplikasi terlihat. null = belum/tidak terukur. */
export function usePing(aktif: boolean) {
  const [ms, setMs] = useState<number | null>(null)
  useEffect(() => {
    if (!aktif) { setMs(null); return }
    let batal = false
    const ukur = async () => {
      if (document.visibilityState === 'hidden') return
      const t0 = performance.now(), kontrol = new AbortController()
      const batas = setTimeout(() => kontrol.abort(), 4000)
      try {
        await fetch(`https://www.gstatic.com/generate_204?t=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: kontrol.signal })
        if (!batal) setMs(Math.max(1, Math.round(performance.now() - t0)))
      } catch { if (!batal) setMs(null) }
      clearTimeout(batas)
    }
    ukur()
    const id = setInterval(ukur, 15_000)
    return () => { batal = true; clearInterval(id) }
  }, [aktif])
  return ms
}

/** Lampu status: hijau berdenyut = online, merah berkedip = offline, biru = sedang sinkron, kuning = perlu tindakan. */
export function LampuKoneksi({ ringkas = false }: { ringkas?: boolean }) {
  const on = useOnline()
  const st = useStatusSinkron()
  const ping = usePing(on)
  const mutu = ping === null ? '' : ping < 120 ? 'bagus' : ping < 350 ? 'sedang' : 'lambat'
  const perlu = on && (st.fase === 'tunda' || st.fase === 'konflik' || st.fase === 'gagal')
  const kelas = !on ? 'off' : st.fase === 'jalan' ? 'sync' : perlu ? 'warn' : 'on'
  const label = !on ? 'Offline' : st.fase === 'jalan' ? 'Menyinkronkan' : perlu ? 'Perlu tindakan' : 'Online'
  const rinci = !on
    ? `Tidak ada koneksi internet. Data disimpan di perangkat${st.kotor ? ' dan perubahan akan diunggah otomatis saat online' : ''}.`
    : st.fase === 'mati' ? `Terhubung ke internet${ping !== null ? ` (waktu tempuh ${ping} ms)` : ''}. Sinkronisasi cloud belum diaktifkan.` : `Terhubung ke internet${ping !== null ? ` (waktu tempuh ${ping} ms)` : ''}. ${st.pesan}`
  return (
    <span className={`lampu ${kelas}`} role="status" aria-live="polite" title={rinci}>
      <i className="lampu-dot" aria-hidden />
      {!ringkas && <span className="lampu-t">{label}</span>}
      {on && ping !== null && <span className={`lampu-ms ${mutu}`} title="Waktu tempuh ke internet (ping)">{ping} ms</span>}
      <span className="sr-only">{rinci}</span>
    </span>
  )
}
