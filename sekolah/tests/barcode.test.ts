import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { describe, expect, it } from 'vitest'
import { code128Modul, code128Nilai } from '../src/barcode'

// Pola acuan dihasilkan oleh pustaka python-barcode (Code 128) untuk memverifikasi encoder.
const ACUAN: Record<string, string> = {
  "PAUD-ID-012": "110100100001110111011010100011000110111011101011000100010011011100110001000101011000100010011011100100111011001001110011011001110010110111000101100011101011",
  "SHB-INV-001": "110100100001101110100011000101000100010110001001101110011000100010101110001101110101100010011011100100111011001001110110010011100110101011110001100011101011",
  "A": "1101001000010100011000100010110001100011101011",
  "Kursi 4A/02": "110100100001011000111010011110010100100111101011110010010000110100110110011001100100111010100011000101110011001001110110011001110010111101010001100011101011"
}

describe('Code 128-B', () => {
  for (const [teks, bits] of Object.entries(ACUAN)) it(`cocok dengan acuan: ${teks}`, () => expect(code128Modul(teks)).toBe(bits))
  it('struktur nilai: start, data, cek, stop', () => {
    const v = code128Nilai('A')
    expect(v).toEqual([104, 33, (104 + 33) % 103, 106])
  })
  it('QR berisi nomor inventaris dan dapat dibaca kembali (jsQR)', () => {
    for (const teks of ['SHB-INV-001', '20212345-INV-012/03']) {
      const q = QRCode.create(teks, { errorCorrectionLevel: 'M' })
      const n = q.modules.size, skala = 6, tepi = 4, w = (n + tepi * 2) * skala
      const data = new Uint8ClampedArray(w * w * 4).fill(255)
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules.get(y, x)) {
        for (let dy = 0; dy < skala; dy++) for (let dx = 0; dx < skala; dx++) { const i = (((y + tepi) * skala + dy) * w + (x + tepi) * skala + dx) * 4; data[i] = data[i + 1] = data[i + 2] = 0 }
      }
      expect(jsQR(data, w, w)?.data).toBe(teks)
    }
  })
})
