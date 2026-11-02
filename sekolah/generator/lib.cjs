// Pembuat & pemeriksa serial SIMAS. Formatnya harus identik dengan src/lisensi.ts di aplikasi.
const crypto = require('node:crypto')

const KUNCI_PUBLIK_HEX = '04db7fcbd1c1f5504b2daa88e172e92493e3f68e9e6792ad306fa3ba713afa073bc21bf577eca5f5972e71779764f84cdb8c418430ecabd6a0640702c682fb4256'
const ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const HARI_MS = 86_400_000
const EPOCH_HARI = Date.UTC(2024, 0, 1) / HARI_MS

function base32(b) {
  let bits = 0, val = 0, out = ''
  for (const x of b) { val = (val << 8) | x; bits += 8; while (bits >= 5) { out += ALFABET[(val >>> (bits - 5)) & 31]; bits -= 5 } }
  if (bits > 0) out += ALFABET[(val << (5 - bits)) & 31]
  return out
}
function dariBase32(s) {
  let bits = 0, val = 0
  const out = []
  for (const ch of s) {
    const i = ALFABET.indexOf(ch)
    if (i < 0) throw new Error('Serial memuat karakter yang tidak valid.')
    val = (val << 5) | i; bits += 5
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}
const kelompok = (s, n) => (s.match(new RegExp(`.{1,${n}}`, 'g')) || [s]).join('-')
const sha = (x) => crypto.createHash('sha256').update(x).digest()
const normalSerial = (s) => String(s).toUpperCase().replace(/^\s*SIMAS/, '').replace(/[^A-Z0-9]/g, '')
const normalKode = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '')

function bacaPayload(raw) {
  if (raw.length < 75 || raw[0] !== 1) throw new Error('Format serial tidak dikenal.')
  const n = raw[10]
  if (raw.length !== 11 + n + 64) throw new Error('Serial tidak lengkap atau rusak.')
  return {
    nama: raw.subarray(11, 11 + n).toString('utf8'),
    terbit: (raw[2] << 8) | raw[3], exp: (raw[4] << 8) | raw[5],
    bind: raw[1] & 1 ? raw.subarray(6, 10) : null,
    payload: raw.subarray(0, 11 + n), sig: raw.subarray(11 + n),
  }
}

/** Buat serial. kedaluwarsa: 'YYYY-MM-DD' (berlaku sampai akhir hari itu) atau kosong = permanen. */
function buatSerial({ nama, kodeInstalasi, kedaluwarsa, kunciPrivatPem, sekarang = Date.now() }) {
  const namaB = Buffer.from(String(nama).trim(), 'utf8')
  if (!namaB.length) throw new Error('Isi nama pemegang lisensi.')
  if (namaB.length > 30) throw new Error('Nama pemegang maksimal 30 karakter.')
  const terbit = Math.floor(sekarang / HARI_MS) - EPOCH_HARI
  let exp = 0
  if (kedaluwarsa) {
    const t = Date.parse(`${kedaluwarsa}T00:00:00Z`)
    if (Number.isNaN(t)) throw new Error('Tanggal berlaku tidak valid.')
    exp = Math.floor(t / HARI_MS) - EPOCH_HARI
    if (exp <= terbit) throw new Error('Tanggal berlaku harus setelah hari ini.')
    if (exp > 65535) throw new Error('Tanggal berlaku terlalu jauh.')
  }
  const kode = normalKode(kodeInstalasi || '')
  const head = Buffer.alloc(11)
  head[0] = 1; head[1] = kode ? 1 : 0
  head.writeUInt16BE(terbit, 2); head.writeUInt16BE(exp, 4)
  if (kode) { if (kode.length !== 16) throw new Error('Kode Instalasi harus 16 karakter (contoh ABCD-EFGH-JKLM-NPQR).'); sha(kode).copy(head, 6, 0, 4) }
  head[10] = namaB.length
  const payload = Buffer.concat([head, namaB])
  const sig = crypto.sign('sha256', payload, { key: kunciPrivatPem, dsaEncoding: 'ieee-p1363' })
  const raw = Buffer.concat([payload, sig])
  return { serial: `SIMAS-${kelompok(base32(raw), 5)}`, noSeri: kelompok(base32(sha(raw).subarray(0, 5)), 4), terbit, exp, terikat: !!kode }
}

function periksaSerial(teks, pubHex = KUNCI_PUBLIK_HEX) {
  const raw = dariBase32(normalSerial(teks))
  const p = bacaPayload(raw)
  const pub = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex'), Buffer.from(pubHex, 'hex')]), format: 'der', type: 'spki' })
  const ok = crypto.verify('sha256', p.payload, { key: pub, dsaEncoding: 'ieee-p1363' }, p.sig)
  return { valid: ok, nama: p.nama, terbit: new Date((p.terbit + EPOCH_HARI) * HARI_MS).toISOString().slice(0, 10), kedaluwarsa: p.exp ? new Date((p.exp + EPOCH_HARI) * HARI_MS).toISOString().slice(0, 10) : null, terikat: !!p.bind, noSeri: kelompok(base32(sha(raw).subarray(0, 5)), 4) }
}

function publikDariPrivat(pem) {
  const pub = crypto.createPublicKey(crypto.createPrivateKey(pem)).export({ type: 'spki', format: 'der' })
  return pub.subarray(pub.length - 65).toString('hex')
}

module.exports = { KUNCI_PUBLIK_HEX, buatSerial, periksaSerial, publikDariPrivat }
