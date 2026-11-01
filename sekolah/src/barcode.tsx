// Barcode Code 128 (set B) dan QR sebagai gambar.
import QRCode from 'qrcode'

// Pola modul (1 = bar, 0 = spasi) untuk nilai 0..106; indeks 106 = stop (13 modul termasuk bar penutup).
const POLA = ['11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000','11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100','11001001110','11011100100','11001110100','11101101110','11101001100','11100101100','11100100110','11101100100','11100110100','11100110010','11011011000','11011000110','11000110110','10100011000','10001011000','10001000110','10110001000','10001101000','10001100010','11010001000','11000101000','11000100010','10110111000','10110001110','10001101110','10111011000','10111000110','10001110110','11101110110','11010001110','11000101110','11011101000','11011100010','11011101110','11101011000','11101000110','11100010110','11101101000','11101100010','11100011010','11101111010','11001000010','11110001010','10100110000','10100001100','10010110000','10010000110','10000101100','10000100110','10110010000','10110000100','10011010000','10011000010','10000110100','10000110010','11000010010','11001010000','11110111010','11000010100','10001111010','10100111100','10010111100','10010011110','10111100100','10011110100','10011110010','11110100100','11110010100','11110010010','11011011110','11011110110','11110110110','10101111000','10100011110','10001011110','10111101000','10111100010','11110101000','11110100010','10111011110','10111101110','11101011110','11110101110','11010000100','11010010000','11010011100','1100011101011']
const START_B = 104
const STOP = 106

/** Nilai Code 128-B untuk teks ASCII 32..126; karakter lain diganti '?'. */
export function code128Nilai(teks: string): number[] {
  const kar = [...teks].map((ch) => { const c = ch.charCodeAt(0); return c >= 32 && c <= 126 ? c - 32 : '?'.charCodeAt(0) - 32 })
  const isi = [START_B, ...kar]
  const cek = isi.reduce((a, v, i) => a + v * (i === 0 ? 1 : i), 0) % 103
  return [...isi, cek, STOP]
}

export function code128Modul(teks: string): string {
  return code128Nilai(teks).map((v) => POLA[v]).join('')
}

/** Barcode Code 128 sebagai SVG vektor (tajam saat dicetak). */
export function Barcode128({ teks, tinggi = 40, modul = 1.6, className }: { teks: string; tinggi?: number; modul?: number; className?: string }) {
  const bits = code128Modul(teks)
  const lebar = (bits.length + 20) * modul
  const batang: JSX.Element[] = []
  for (let i = 0; i < bits.length; ) {
    if (bits[i] !== '1') { i++; continue }
    let j = i
    while (bits[j] === '1') j++
    batang.push(<rect key={i} x={(i + 10) * modul} y={0} width={(j - i) * modul} height={tinggi} />)
    i = j
  }
  return (
    <svg className={className} viewBox={`0 0 ${lebar} ${tinggi}`} width="100%" height={tinggi} preserveAspectRatio="none" role="img" aria-label={`Barcode ${teks}`} fill="#000">
      {batang}
    </svg>
  )
}

/** QR sebagai data URL PNG (koreksi galat M agar tetap terbaca bila label tergores/laminasi). */
export const qrUrl = (teks: string, lebar = 320) => QRCode.toDataURL(teks, { margin: 1, width: lebar, errorCorrectionLevel: 'M' })
