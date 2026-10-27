import type { RecoverySettings } from './types'

export type RecoveryChannel = 'email' | 'whatsapp'

export const defaultRecovery = (): RecoverySettings => ({ enabled: true, emailUrl: '', emailAuth: '', whatsappUrl: '', whatsappAuth: '', validMinutes: 30 })

export const recoveryOf = (r?: Partial<RecoverySettings>): RecoverySettings => ({ ...defaultRecovery(), ...r })

// Nomor WhatsApp dalam format internasional tanpa tanda + (0812... menjadi 62812...).
export function normalizePhone(p: string): string {
  const d = p.replace(/[^\d]/g, '')
  if (d.startsWith('0')) return '62' + d.slice(1)
  return d
}

export const channelReady = (r: RecoverySettings, c: RecoveryChannel) => !!(c === 'email' ? r.emailUrl : r.whatsappUrl).trim()

// Kirim lewat gateway (webhook) yang diatur administrator.
// Payload JSON: { channel, to, subject, message, app }. Header Authorization opsional.
export async function sendVia(r: RecoverySettings, channel: RecoveryChannel, to: string, subject: string, message: string, app: string, extra: Record<string, unknown> = {}): Promise<void> {
  const url = (channel === 'email' ? r.emailUrl : r.whatsappUrl).trim()
  const auth = (channel === 'email' ? r.emailAuth : r.whatsappAuth).trim()
  if (!url) throw new Error('Pengiriman ' + (channel === 'email' ? 'email' : 'WhatsApp') + ' belum diatur.')
  const body = JSON.stringify({ channel, to, subject, message, app, ...extra })
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body })
    if (!res.ok) throw new Error('Layanan pengirim menolak permintaan (HTTP ' + res.status + ').')
  } catch (e: any) {
    if (e instanceof TypeError) {
      // Kemungkinan diblokir CORS: coba kirim tanpa header khusus (respons tidak dapat dibaca).
      try { await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body }) } catch { throw new Error('Tidak dapat menghubungi layanan pengirim. Periksa URL dan koneksi.') }
      return
    }
    throw e
  }
}
