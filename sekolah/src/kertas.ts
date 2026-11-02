import type { Sekolah } from './types'

/** Ukuran kertas standar untuk semua cetakan (potret; lanskap = ditukar). */
export const KERTAS = {
  A3: { nama: 'A3', w: 297, h: 420 },
  A4: { nama: 'A4', w: 210, h: 297 },
  A5: { nama: 'A5', w: 148, h: 210 },
  B5: { nama: 'B5', w: 176, h: 250 },
  F4: { nama: 'F4 / Folio', w: 215, h: 330 },
  Letter: { nama: 'Letter', w: 216, h: 279 },
  Legal: { nama: 'Legal', w: 216, h: 356 },
} as const
export type IdKertas = keyof typeof KERTAS

/** Margin halaman cetak (mm): potret dan lanskap. Sisa halaman diisi isi dokumen, lalu otomatis pindah ke halaman berikutnya. */
export const MARGIN = { potret: { y: 14, x: 15 }, lanskap: { y: 10, x: 12 } }

export const kertasDari = (s: Pick<Sekolah, 'ukuranKertas'>) => KERTAS[(s.ukuranKertas ?? 'A4') as IdKertas] ?? KERTAS.A4
