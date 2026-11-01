// Sinkronisasi otomatis: data selalu disimpan lokal lebih dulu (IndexedDB). Saat internet tersedia, keadaan terbaru
// (termasuk dokumen/lampiran dan foto) diunggah terenkripsi ke tujuan cloud. Saat offline, perubahan menunggu dan
// diunggah otomatis begitu koneksi kembali. Bentrok antarperangkat tidak ditimpa diam-diam.
import { useSyncExternalStore } from 'react'
import { cariBerkas, googleTerhubung, timpa, unduh } from './cloud'
import { exportTerenkripsi, getState, importJson, subscribe } from './store'
import type { CloudSetting } from './types'

export const NAMA_SINKRON = 'sinkron-simas.simas.json'
export type Fase = 'mati' | 'siap' | 'jalan' | 'offline' | 'tunda' | 'konflik' | 'gagal'
export interface StatusSinkron { fase: Fase; pesan: string; kotor: number; terakhir?: string }

const K = { kotor: 'simas.sync.kotor', remote: 'simas.sync.remote', terakhir: 'simas.sync.terakhir' }
const baca = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const tulis = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* abaikan */ } }

let status: StatusSinkron = { fase: 'mati', pesan: 'Sinkronisasi mati', kotor: Number(baca(K.kotor)) || 0, terakhir: baca(K.terakhir) ?? undefined }
const ls = new Set<() => void>()
const setStatus = (p: Partial<StatusSinkron>) => { status = { ...status, ...p }; ls.forEach((f) => f()) }
export const useStatusSinkron = () => useSyncExternalStore((f) => { ls.add(f); return () => ls.delete(f) }, () => status)

let versi = 0 // bertambah setiap ada perubahan data
let abaikan = false
let sibuk = false

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false
const kosong = () => { const s = getState(); return !s.siswa.length && !s.pegawai.length && !s.rombel.length && !s.arsip.length }
const siap = (c?: CloudSetting): c is CloudSetting => !!c?.sinkron && c.tujuan !== 'lokal' && (c.sandiOto?.length ?? 0) >= 12

function tandaiKotor() {
  versi++
  tulis(K.kotor, String(Date.now()))
  setStatus({ kotor: Number(baca(K.kotor)) || 1 })
}

async function infoRemote(c: CloudSetting) {
  const b = await cariBerkas(c, NAMA_SINKRON)
  return b?.waktu ? { waktu: b.waktu, ms: Date.parse(b.waktu) } : undefined
}

/** Ambil data dari cloud dan gantikan data perangkat ini. */
export async function ambilDariCloud(c: CloudSetting) {
  const r = await cariBerkas(c, NAMA_SINKRON)
  if (!r) throw new Error('Belum ada data sinkronisasi di cloud.')
  const teks = await unduh(c, r)
  abaikan = true
  try { await importJson(teks, c.sandiOto) } finally { abaikan = false }
  tulis(K.remote, r.waktu ?? null); tulis(K.kotor, null); tulis(K.terakhir, new Date().toISOString())
  setStatus({ fase: 'siap', pesan: 'Data diperbarui dari cloud', kotor: 0, terakhir: new Date().toISOString() })
}

/** Unggah data perangkat ini ke cloud (menimpa berkas sinkronisasi). */
export async function timpaCloud(c: CloudSetting) {
  const v = versi
  await timpa(c, NAMA_SINKRON, await exportTerenkripsi(c.sandiOto!), 'application/json')
  const r = await infoRemote(c)
  tulis(K.remote, r?.waktu ?? null)
  const sisa = v === versi ? 0 : status.kotor || 1
  if (!sisa) tulis(K.kotor, null)
  const now = new Date().toISOString(); tulis(K.terakhir, now)
  setStatus({ fase: 'siap', pesan: 'Tersinkron', kotor: sisa, terakhir: now })
}

/** Satu putaran sinkronisasi: periksa cloud, tarik bila perangkat bersih, unggah bila ada perubahan. */
export async function sinkronSekarang(cfg: CloudSetting | undefined, opsi: { paksaUnggah?: boolean } = {}) {
  const c = cfg
  if (!siap(c)) return setStatus({ fase: 'mati', pesan: cfg?.sinkron ? 'Lengkapi kata sandi (min. 12 karakter) dan tujuan cloud' : 'Sinkronisasi mati' })
  if (sibuk) return
  if (!online()) return setStatus({ fase: 'offline', pesan: status.kotor ? 'Offline: perubahan tersimpan lokal, diunggah saat online' : 'Offline: data tersimpan lokal' })
  if (c.tujuan === 'gdrive' && !googleTerhubung()) return setStatus({ fase: 'tunda', pesan: 'Sambungkan ulang Google Drive (izin berakhir)' })
  sibuk = true
  setStatus({ fase: 'jalan', pesan: 'Menyinkronkan…' })
  try {
    const remote = await infoRemote(c)
    const tercatat = baca(K.remote)
    const kotor = !!baca(K.kotor)
    const remoteBerubah = !!remote && (!tercatat || remote.ms > Date.parse(tercatat) + 2000)
    if (remoteBerubah && !opsi.paksaUnggah) {
      if (kotor || (!tercatat && !kosong())) return setStatus({ fase: 'konflik', pesan: 'Data di cloud berbeda dari data perangkat ini. Pilih salah satu.' })
      await ambilDariCloud(c); return
    }
    if (kotor || !remote || opsi.paksaUnggah) await timpaCloud(c)
    else setStatus({ fase: 'siap', pesan: 'Tersinkron', terakhir: status.terakhir })
  } catch (e) {
    setStatus({ fase: 'gagal', pesan: (e as Error).message })
  } finally { sibuk = false }
}

/** Mulai pemantauan: perubahan data → unggah setelah jeda; kembali online → unggah; periksa cloud berkala. */
export function mulaiSinkron(ambilCloud: () => CloudSetting | undefined): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const jadwal = (ms: number) => { clearTimeout(timer); timer = setTimeout(() => void sinkronSekarang(ambilCloud()), ms) }
  const unsub = subscribe(() => { if (abaikan || !siap(ambilCloud())) return; tandaiKotor(); jadwal(15000) })
  const on = () => void sinkronSekarang(ambilCloud())
  const off = () => { if (siap(ambilCloud())) setStatus({ fase: 'offline', pesan: status.kotor ? 'Offline: perubahan tersimpan lokal, diunggah saat online' : 'Offline: data tersimpan lokal' }) }
  window.addEventListener('online', on); window.addEventListener('offline', off)
  const tiap = setInterval(on, 5 * 60 * 1000)
  const awal = setTimeout(on, 2500)
  return () => { unsub(); clearTimeout(timer); clearTimeout(awal); clearInterval(tiap); window.removeEventListener('online', on); window.removeEventListener('offline', off) }
}

export const ubahStatus = setStatus
