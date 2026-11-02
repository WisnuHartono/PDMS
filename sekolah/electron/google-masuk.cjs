// Masuk Google untuk aplikasi desktop: Google tidak menerima alamat app://, jadi tombol Google ditampilkan oleh
// halaman lokal http://localhost:<port> yang dibuka di browser sistem. Kredensial (ID token) dikirim balik ke
// proses ini lewat 127.0.0.1 dan diverifikasi sepenuhnya oleh aplikasi (tanda tangan, Client ID, nonce, masa berlaku).
const http = require('node:http')
const crypto = require('node:crypto')

const PORT = 47831
const CLIENT_RE = /^[\w-]+\.apps\.googleusercontent\.com$/i
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const SCOPE_BOLEH = ['https://www.googleapis.com/auth/drive.file']

function halaman(clientId, nonce, state, jenis = 'id', scope = '') {
  const cfg = JSON.stringify({ clientId, nonce, state, jenis, scope }).replace(/</g, '\\u003c')
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Masuk dengan Google · SIMAS</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<style>body{font-family:Segoe UI,system-ui,sans-serif;background:#eef2f6;display:grid;place-items:center;min-height:100vh;margin:0}
.k{background:#fff;border-radius:12px;padding:28px 32px;box-shadow:0 4px 18px rgba(0,0,0,.12);text-align:center;max-width:360px}
h1{font-size:18px;margin:0 0 6px}p{color:#445;font-size:14px;margin:6px 0 16px}#s{font-size:14px;margin-top:14px}.e{color:#b3261e}.o{color:#157347}</style></head>
<body><div class="k"><h1>${jenis === 'token' ? 'Izinkan akses Google Drive' : 'Masuk dengan Google'}</h1><p>${jenis === 'token' ? 'SIMAS hanya meminta akses ke berkas yang dibuatnya sendiri (folder SIMAS Cadangan). Tekan tombol, pilih akun, lalu setujui.' : 'Pilih akun Google Anda. Setelah berhasil, kembali ke aplikasi SIMAS.'}</p><div id="b" style="display:flex;justify-content:center"></div><div id="s"></div><p style="font-size:12px;color:#667;margin:14px 0 0">Client ID yang dipakai:<br><code>${esc(clientId.slice(0, 13))}…${esc(clientId.slice(-26))}</code></p></div>
<script>const C=${cfg};const s=document.getElementById('s');
function kirim(r){fetch('/kredensial/'+C.state,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(C.jenis==='token'?{access_token:r.access_token,expires_in:r.expires_in,error:r.error,error_description:r.error_description}:{credential:r.credential})})
 .then(x=>x.ok?(s.className='o',s.textContent='Berhasil. Anda dapat menutup halaman ini dan kembali ke SIMAS.'):Promise.reject()).catch(()=>{s.className='e';s.textContent='Gagal mengirim ke aplikasi SIMAS. Tutup halaman ini lalu ulangi dari aplikasi.'})}
const sc=document.createElement('script');sc.src='https://accounts.google.com/gsi/client';sc.async=true;
sc.onload=()=>{if(C.jenis==='token'){const tc=google.accounts.oauth2.initTokenClient({client_id:C.clientId,scope:C.scope,callback:kirim,error_callback:e=>{s.className='e';s.textContent='Izin tidak diberikan: '+(e.message||e.type||'dibatalkan')}});
  const bt=document.createElement('button');bt.textContent='Berikan izin Google Drive';bt.style.cssText='font:600 14px Segoe UI,sans-serif;padding:10px 18px;border-radius:999px;border:1px solid #888;background:#fff;cursor:pointer';bt.onclick=()=>tc.requestAccessToken({prompt:'consent'});document.getElementById('b').appendChild(bt)}
 else{google.accounts.id.initialize({client_id:C.clientId,nonce:C.nonce,callback:kirim,auto_select:false});
 google.accounts.id.renderButton(document.getElementById('b'),{theme:'outline',size:'large',text:'continue_with',shape:'pill',locale:'id',width:280})}};
sc.onerror=()=>{s.className='e';s.textContent='Tidak dapat memuat layanan Google. Periksa koneksi internet.'};document.head.appendChild(sc)</script></body></html>`
}

let aktif = null
/** Mulai satu sesi masuk. Mengembalikan {ok, credential} atau {ok:false, pesan}. */
function mulaiMasukGoogle({ clientId, nonce, bukaBrowser, port = PORT, batasMs = 180000, jenis = 'id', scope = '' }) {
  if (!CLIENT_RE.test(String(clientId))) return Promise.resolve({ ok: false, pesan: 'Client ID Google tidak valid.' })
  if (jenis === 'token' ? !SCOPE_BOLEH.includes(scope) : !/^[0-9a-f]{16,64}$/i.test(String(nonce))) return Promise.resolve({ ok: false, pesan: 'Permintaan tidak valid.' })
  if (aktif) aktif.batal('Sesi masuk Google sebelumnya dibatalkan.')
  const state = crypto.randomBytes(18).toString('hex')
  return new Promise((selesai) => {
    let tuntas = false
    const server = http.createServer((req, res) => {
      const bukan = (kode) => { res.writeHead(kode, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end() }
      const host = String(req.headers.host || '')
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return bukan(400) // tolak DNS rebinding
      if (req.method === 'GET' && req.url === `/masuk/${state}`) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
        return res.end(halaman(clientId, nonce, state, jenis, scope))
      }
      if (req.method === 'POST' && req.url === `/kredensial/${state}`) {
        let body = ''
        req.on('data', (d) => { body += d; if (body.length > 20000) req.destroy() })
        req.on('end', () => {
          try {
            const j = JSON.parse(body)
            if (jenis === 'token') {
              if (typeof j.access_token !== 'string' || !j.access_token || j.access_token.length > 4096) {
                res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok')
                return akhir({ ok: false, pesan: String(j.error_description || j.error || 'Izin Google ditolak.').slice(0, 200) })
              }
              res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok')
              return akhir({ ok: true, access_token: j.access_token, expires_in: Number(j.expires_in) > 0 ? Number(j.expires_in) : 3600 })
            }
            const { credential } = j
            if (typeof credential !== 'string' || credential.split('.').length !== 3) return bukan(400)
            res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok')
            akhir({ ok: true, credential })
          } catch { bukan(400) }
        })
        return
      }
      bukan(404)
    })
    const akhir = (hasil) => { if (tuntas) return; tuntas = true; clearTimeout(t); aktif = null; setTimeout(() => server.close(), 300); selesai(hasil) }
    const t = setTimeout(() => akhir({ ok: false, pesan: 'Waktu habis menunggu login Google. Coba lagi.' }), batasMs)
    aktif = { batal: (pesan) => akhir({ ok: false, pesan }) }
    server.on('error', (e) => akhir({ ok: false, pesan: e.code === 'EADDRINUSE' ? `Port ${port} sedang dipakai program lain. Tutup program itu lalu coba lagi.` : `Tidak dapat memulai server lokal: ${e.message}` }))
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port
      Promise.resolve(bukaBrowser(`http://localhost:${p}/masuk/${state}`)).catch(() => akhir({ ok: false, pesan: 'Tidak dapat membuka browser.' }))
    })
  })
}
module.exports = { mulaiMasukGoogle, halaman, PORT, esc, SCOPE_BOLEH }
