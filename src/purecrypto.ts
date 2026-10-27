// Cadangan kriptografi murni-JS untuk konteks tanpa WebCrypto (halaman HTTP / pratinjau non-aman).
// Hasilnya identik dengan WebCrypto sehingga hash tetap kompatibel di semua perangkat.
const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])
const W = new Int32Array(64)

function compress(h: Int32Array, w16: Int32Array | number[], out: Int32Array) {
  for (let i = 0; i < 16; i++) W[i] = w16[i]
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15], b = W[i - 2]
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10)
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0
  }
  let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7]
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
    const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0
    hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
  }
  out[0] = (h[0] + a) | 0; out[1] = (h[1] + b) | 0; out[2] = (h[2] + c) | 0; out[3] = (h[3] + d) | 0
  out[4] = (h[4] + e) | 0; out[5] = (h[5] + f) | 0; out[6] = (h[6] + g) | 0; out[7] = (h[7] + hh) | 0
}

const IV = () => new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])

function toWords(bytes: Uint8Array, len: number): Int32Array {
  const w = new Int32Array(16)
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << (24 - 8 * (i & 3))
  return w
}

/** PBKDF2-HMAC-SHA256 (satu blok keluaran 32 byte), dengan jeda agar UI tetap responsif. */
export async function pbkdf2Sha256(pw: Uint8Array, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  let key = pw
  if (key.length > 64) key = sha256(key)
  const ip = new Uint8Array(64).fill(0x36), op = new Uint8Array(64).fill(0x5c)
  key.forEach((b, i) => { ip[i] ^= b; op[i] ^= b })
  const iState = IV(), oState = IV()
  compress(IV(), toWords(ip, 64), iState)
  compress(IV(), toWords(op, 64), oState)

  // U1 = HMAC(pw, salt || 00000001)
  const msg = new Uint8Array(salt.length + 4)
  msg.set(salt); msg[msg.length - 1] = 1
  let st = Int32Array.from(iState)
  const full = Math.floor(msg.length / 64)
  for (let i = 0; i < full; i++) compress(st, toWords(msg.subarray(i * 64, i * 64 + 64), 64), st)
  const rest = msg.subarray(full * 64)
  const pad = new Uint8Array(rest.length + 1 + ((rest.length + 1 + 8 + 63) & ~63) - rest.length - 1)
  pad.set(rest); pad[rest.length] = 0x80
  const total = (64 + msg.length) * 8
  const dv = new DataView(pad.buffer); dv.setUint32(pad.length - 4, total >>> 0); dv.setUint32(pad.length - 8, Math.floor(total / 2 ** 32))
  for (let i = 0; i < pad.length; i += 64) compress(st, toWords(pad.subarray(i, i + 64), 64), st)

  const block = new Int32Array(16)
  const tmp = new Int32Array(8)
  block[8] = 0x80000000; block[15] = (64 + 32) * 8
  const outer = (u: Int32Array, dst: Int32Array) => {
    for (let i = 0; i < 8; i++) block[i] = u[i]
    compress(oState, block, dst)
  }
  let u = new Int32Array(8)
  outer(st, u)
  const t = Int32Array.from(u)
  for (let n = 1; n < iter; n++) {
    for (let i = 0; i < 8; i++) block[i] = u[i]
    compress(iState, block, tmp)
    outer(tmp, u)
    for (let i = 0; i < 8; i++) t[i] ^= u[i]
    if (n % 25000 === 0) await new Promise((r) => setTimeout(r, 0))
  }
  const out = new Uint8Array(32)
  const odv = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) odv.setInt32(i * 4, t[i])
  return out
}

function sha256(data: Uint8Array): Uint8Array {
  const h = IV()
  const padLen = (data.length + 9 + 63) & ~63
  const p = new Uint8Array(padLen)
  p.set(data); p[data.length] = 0x80
  const dv = new DataView(p.buffer)
  const bits = data.length * 8
  dv.setUint32(padLen - 4, bits >>> 0); dv.setUint32(padLen - 8, Math.floor(bits / 2 ** 32))
  for (let i = 0; i < padLen; i += 64) compress(h, toWords(p.subarray(i, i + 64), 64), h)
  const out = new Uint8Array(32), od = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) od.setInt32(i * 4, h[i])
  return out
}

function sha1(data: Uint8Array): Uint8Array {
  let h0 = 0x67452301, h1 = 0xefcdab89 | 0, h2 = 0x98badcfe | 0, h3 = 0x10325476, h4 = 0xc3d2e1f0 | 0
  const padLen = (data.length + 9 + 63) & ~63
  const p = new Uint8Array(padLen)
  p.set(data); p[data.length] = 0x80
  const dv = new DataView(p.buffer)
  const bits = data.length * 8
  dv.setUint32(padLen - 4, bits >>> 0); dv.setUint32(padLen - 8, Math.floor(bits / 2 ** 32))
  const w = new Int32Array(80)
  for (let o = 0; o < padLen; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4)
    for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31) }
    let a = h0, b = h1, c = h2, d = h3, e = h4
    for (let i = 0; i < 80; i++) {
      let f: number, k: number
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999 }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1 }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc | 0 }
      else { f = b ^ c ^ d; k = 0xca62c1d6 | 0 }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0
  }
  const out = new Uint8Array(20), od = new DataView(out.buffer)
  ;[h0, h1, h2, h3, h4].forEach((x, i) => od.setInt32(i * 4, x))
  return out
}

export function hmacSha1(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const k = key.length > 64 ? sha1(key) : key
  const ip = new Uint8Array(64 + msg.length), op = new Uint8Array(64 + 20)
  ip.fill(0x36, 0, 64); op.fill(0x5c, 0, 64)
  k.forEach((b, i) => { ip[i] ^= b; op[i] ^= b })
  ip.set(msg, 64)
  op.set(sha1(ip), 64)
  return sha1(op)
}
