// Info perangkat & IP untuk log aktivitas.
// Aplikasi ini tanpa server, jadi perangkat dibaca dari browser, sedangkan IP publik hanya bisa diketahui lewat layanan luar (opsional, dimatikan bawaan).

export interface DeviceInfo { browser: string; os: string; type: 'Desktop' | 'HP' | 'Tablet'; label: string }

export function parseUA(ua: string): DeviceInfo {
  const m = (r: RegExp) => ua.match(r)?.[1]
  const major = (v?: string) => (v ? v.split('.')[0] : '')
  let browser = 'Browser'
  let v: string | undefined
  if ((v = m(/(?:Edg|EdgA|EdgiOS)\/([\d.]+)/))) browser = 'Edge ' + major(v)
  else if ((v = m(/(?:OPR|Opera)\/([\d.]+)/))) browser = 'Opera ' + major(v)
  else if ((v = m(/SamsungBrowser\/([\d.]+)/))) browser = 'Samsung Internet ' + major(v)
  else if ((v = m(/(?:Firefox|FxiOS)\/([\d.]+)/))) browser = 'Firefox ' + major(v)
  else if ((v = m(/(?:Chrome|CriOS)\/([\d.]+)/))) browser = 'Chrome ' + major(v)
  else if ((v = m(/Version\/([\d.]+).*Safari/))) browser = 'Safari ' + major(v)
  let os = 'OS tidak dikenal'
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11'
  else if (/Windows NT 6\.3/.test(ua)) os = 'Windows 8.1'
  else if (/Windows NT 6\.1/.test(ua)) os = 'Windows 7'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if ((v = m(/Android ([\d.]+)/))) os = 'Android ' + major(v)
  else if (/Android/.test(ua)) os = 'Android'
  else if ((v = m(/(?:iPhone|iPad|iPod).*OS ([\d_]+)/))) os = 'iOS ' + major(v.replace(/_/g, '.'))
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/CrOS/.test(ua)) os = 'ChromeOS'
  else if (/Linux/.test(ua)) os = 'Linux'
  const type: DeviceInfo['type'] = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'Tablet' : /Mobi|iPhone|iPod|Android/.test(ua) ? 'HP' : 'Desktop'
  return { browser, os, type, label: `${browser} · ${os} · ${type}` }
}

let cached: string | undefined
/** Ringkasan perangkat saat ini, mis. "Chrome 130 · Windows 10/11 · Desktop". */
export function deviceLabel(): string {
  if (cached === undefined) cached = typeof navigator === 'undefined' ? '' : parseUA(navigator.userAgent).label
  return cached
}

// IP publik: hanya diambil bila administrator mengaktifkannya (permintaan ke api.ipify.org membocorkan IP ke layanan itu).
let ip: string | undefined
let inflight = false
export const currentIp = () => ip
export function refreshIp(enabled: boolean) {
  if (!enabled) { ip = undefined; return }
  if (ip || inflight || typeof fetch === 'undefined') return
  inflight = true
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 6000)
  fetch('https://api.ipify.org?format=json', { signal: ctl.signal, cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => { if (typeof j?.ip === 'string' && /^[0-9a-fA-F:.]{3,45}$/.test(j.ip)) ip = j.ip })
    .catch(() => {})
    .finally(() => { clearTimeout(t); inflight = false })
}
