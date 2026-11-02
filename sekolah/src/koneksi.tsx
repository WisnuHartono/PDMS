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

/** Waktu tempuh (ms) ke internet: mengukur permintaan kecil tiap 15 detik selama aplikasi terlihat.
 *  'ukur' = sedang mengukur, 'gagal' = tidak ada server yang menjawab (mis. diblokir firewall/sandbox). */
export function usePing(aktif: boolean): number | 'ukur' | 'gagal' {
  const [ms, setMs] = useState<number | 'ukur' | 'gagal'>('ukur')
  useEffect(() => {
    if (!aktif) { setMs('ukur'); return }
    let batal = false
    const SERVER = ['https://www.gstatic.com/generate_204', 'https://www.google.com/generate_204', 'https://1.1.1.1/cdn-cgi/trace', 'https://www.cloudflare.com/cdn-cgi/trace']
    const ukur = async () => {
      if (document.visibilityState === 'hidden') return
      const kontrol = new AbortController()
      const batas = setTimeout(() => kontrol.abort(), 5000)
      const t0 = performance.now()
      try {
        // yang paling cepat menjawab dipakai
        await Promise.any(SERVER.map((u) => fetch(`${u}?t=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: kontrol.signal })))
        if (!batal) setMs(Math.max(1, Math.round(performance.now() - t0)))
      } catch { if (!batal) setMs('gagal') }
      clearTimeout(batas); kontrol.abort()
    }
    ukur()
    const id = setInterval(ukur, 15_000)
    const online = () => ukur()
    window.addEventListener('online', online)
    return () => { batal = true; clearInterval(id); window.removeEventListener('online', online) }
  }, [aktif])
  return ms
}

/** Lampu status: hijau berdenyut = online, merah berkedip = offline, biru = sedang sinkron, kuning = perlu tindakan. */
export function LampuKoneksi({ ringkas = false }: { ringkas?: boolean }) {
  const on = useOnline()
  const st = useStatusSinkron()
  const ping = usePing(on)
  const mutu = typeof ping !== 'number' ? '' : ping < 120 ? 'bagus' : ping < 350 ? 'sedang' : 'lambat'
  const perlu = on && (st.fase === 'tunda' || st.fase === 'konflik' || st.fase === 'gagal')
  const kelas = !on ? 'off' : st.fase === 'jalan' ? 'sync' : perlu ? 'warn' : 'on'
  const label = !on ? 'Offline' : st.fase === 'jalan' ? 'Menyinkronkan' : perlu ? 'Perlu tindakan' : 'Online'
  const rinci = !on
    ? `Tidak ada koneksi internet. Data disimpan di perangkat${st.kotor ? ' dan perubahan akan diunggah otomatis saat online' : ''}.`
    : st.fase === 'mati' ? `Terhubung ke internet${typeof ping === 'number' ? ` (waktu tempuh ${ping} ms)` : ''}. Sinkronisasi cloud belum diaktifkan.` : `Terhubung ke internet${typeof ping === 'number' ? ` (waktu tempuh ${ping} ms)` : ''}. ${st.pesan}`
  return (
    <span className={`lampu ${kelas}`} role="status" aria-live="polite" title={rinci}>
      <i className="lampu-dot" aria-hidden />
      {!ringkas && <span className="lampu-t">{label}</span>}
      {on && <span className={`lampu-ms ${mutu} ${ping === 'gagal' ? 'gagal' : ''}`} title={ping === 'gagal' ? 'Waktu tempuh tidak dapat diukur: tidak ada server uji yang menjawab (mungkin diblokir firewall).' : 'Waktu tempuh ke internet (ping)'}>{typeof ping === 'number' ? ping : ping === 'ukur' ? '…' : '–'} ms</span>}
      <span className="sr-only">{rinci}</span>
    </span>
  )
}
