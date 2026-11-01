// Sesi login aktif + logout otomatis saat tidak ada aktivitas.
import { useSyncExternalStore } from 'react'
import { logAudit, type Sesi } from './akun'

let sesi: Sesi | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export const getSesi = () => sesi
export function setSesi(s: Sesi | null) { sesi = s; emit() }
export function useSesi() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => sesi)
}

/** Keluar: catat, lalu muat ulang halaman agar kunci data terhapus dari memori. */
export async function keluar(alasan = 'Keluar') {
  if (sesi) await logAudit(sesi.akun.username, alasan, true).catch(() => undefined)
  sesi = null
  location.reload()
}

let timer: ReturnType<typeof setTimeout> | undefined
export function pasangIdle(menit: number) {
  const reset = () => {
    clearTimeout(timer)
    timer = setTimeout(() => keluar('Keluar otomatis (tidak ada aktivitas)'), menit * 60_000)
  }
  for (const e of ['mousemove', 'keydown', 'pointerdown', 'wheel', 'touchstart']) window.addEventListener(e, reset, { passive: true })
  reset()
}

export const boleh = (halaman: string) => !!sesi && (sesi.akun.peranId === 'admin' || sesi.peran.halaman.includes(halaman as never))
