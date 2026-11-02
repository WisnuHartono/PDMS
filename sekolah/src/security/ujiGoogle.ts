// Pengujian koneksi dan sinkronisasi akun Google, serta pembuat skrip pengaturan otomatis.
import { desktopGoogle, muatGis, ORIGIN_GOOGLE_DESKTOP, type ProfilGoogle } from './google'

export type StatusLangkah = 'ok' | 'gagal' | 'peringatan' | 'lewati'
export interface Langkah { id: string; judul: string; status: StatusLangkah; detail: string; saran?: string }

export const CLIENT_ID_RE = /^[\w-]+\.apps\.googleusercontent\.com$/i

/** Alasan yang dilaporkan Google Identity Services bila prompt tidak tampil → hasil uji. */
export function tafsirAlasanGis(alasan: string): Pick<Langkah, 'status' | 'detail' | 'saran'> {
  switch (alasan) {
    case 'invalid_client': case 'missing_client_id':
      return { status: 'gagal', detail: 'Google tidak mengenali Client ID ini.', saran: 'Salin ulang Client ID dari Google Cloud Console › Credentials (jenis Web application).' }
    case 'unregistered_origin':
      return { status: 'gagal', detail: 'Alamat aplikasi ini belum didaftarkan di Client ID.', saran: 'Tambahkan alamat aplikasi pada Authorized JavaScript origins, simpan, lalu tunggu beberapa menit.' }
    case 'secure_http_required':
      return { status: 'gagal', detail: 'Google hanya menerima alamat HTTPS (atau localhost).', saran: 'Buka aplikasi lewat https:// atau http://localhost.' }
    case 'browser_not_supported':
      return { status: 'gagal', detail: 'Browser ini tidak didukung layanan masuk Google.', saran: 'Gunakan Chrome, Edge, Firefox, atau Safari versi terbaru.' }
    case 'opt_out_or_no_session': case 'suppressed_by_user': case 'unknown_reason':
      return { status: 'ok', detail: 'Client ID dikenali dan alamat aplikasi diterima Google (belum ada sesi Google aktif di browser ini, itu normal).' }
    default:
      return { status: 'peringatan', detail: `Google menolak menampilkan prompt (${alasan}).` }
  }
}

export interface DepUji {
  online?: () => boolean
  ambil?: (url: string, init?: RequestInit) => Promise<Response>
  muat?: () => Promise<{ initialize: (c: { client_id: string; callback: () => void }) => void; prompt?: (cb: (n: GisMoment) => void) => void }>
  origin?: string
  /** True bila berjalan di aplikasi desktop (login lewat browser sistem). */
  desktop?: boolean
  tunggu?: number
}
interface GisMoment { isNotDisplayed?: () => boolean; getNotDisplayedReason?: () => string; isDisplayed?: () => boolean }

const ok = (id: string, judul: string, detail: string): Langkah => ({ id, judul, status: 'ok', detail })
const gagal = (id: string, judul: string, detail: string, saran?: string): Langkah => ({ id, judul, status: 'gagal', detail, saran })

/** Uji berurutan konfigurasi integrasi Google. Berhenti di langkah yang membuat langkah berikutnya mustahil. */
export async function ujiKonfigurasi(c: { clientId: string; domain?: string }, d: DepUji = {}): Promise<Langkah[]> {
  const out: Langkah[] = []
  const origin = d.origin ?? globalThis.location?.origin ?? ''
  const clientId = c.clientId.trim()
  if (!clientId) return [gagal('client', 'Client ID', 'Client ID belum diisi.', 'Isi Client ID lalu coba lagi. Ikuti panduan di bawah bila belum punya.')]
  if (!CLIENT_ID_RE.test(clientId)) return [gagal('client', 'Format Client ID', 'Format tidak sesuai (harus berakhiran .apps.googleusercontent.com).', 'Salin Client ID lengkap dari Google Cloud Console.')]
  out.push(ok('client', 'Format Client ID', 'Format benar.'))
  if (c.domain?.trim() && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(c.domain.trim())) out.push({ id: 'domain', judul: 'Batas domain email', status: 'peringatan', detail: `"${c.domain}" bukan nama domain yang valid.`, saran: 'Contoh yang benar: sekolah.sch.id' })
  else out.push(ok('domain', 'Batas domain email', c.domain?.trim() ? `Hanya akun @${c.domain.trim().toLowerCase()} yang boleh dihubungkan.` : 'Tidak dibatasi (semua akun Google boleh dihubungkan).'))

  if (!(d.online ?? (() => globalThis.navigator?.onLine !== false))()) return [...out, gagal('internet', 'Koneksi internet', 'Perangkat sedang offline.', 'Sambungkan internet, lalu uji ulang. Login Google hanya bekerja saat online.')]
  out.push(ok('internet', 'Koneksi internet', 'Perangkat online.'))

  const batas = d.tunggu ?? 8000
  const dgnBatas = <T,>(p: Promise<T>, pesan: string) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error(pesan)), batas))])
  const ambil0 = d.ambil ?? ((u, i) => fetch(u, i))
  const ambil = (u: string, i?: RequestInit) => dgnBatas(ambil0(u, i), 'Tidak ada jawaban (waktu habis).')
  try { await ambil('https://accounts.google.com/gsi/client', { mode: 'no-cors' }); out.push(ok('layanan', 'Layanan Google terjangkau', 'accounts.google.com dapat diakses.')) } catch { return [...out, gagal('layanan', 'Layanan Google terjangkau', 'accounts.google.com tidak dapat diakses.', 'Periksa firewall/proxy sekolah: izinkan accounts.google.com dan www.googleapis.com.')] }
  try {
    const r = await ambil('https://www.googleapis.com/oauth2/v3/certs')
    const j = (await r.json()) as { keys?: unknown[] }
    out.push(j.keys?.length ? ok('kunci', 'Kunci verifikasi token', `${j.keys.length} kunci publik Google berhasil diambil (dipakai memeriksa tanda tangan token).`) : gagal('kunci', 'Kunci verifikasi token', 'Respons kunci Google kosong.'))
  } catch { out.push(gagal('kunci', 'Kunci verifikasi token', 'Tidak dapat mengambil kunci publik Google.', 'Izinkan www.googleapis.com di jaringan sekolah.')) }

  const desktop = d.desktop ?? !!desktopGoogle()
  if (desktop) {
    out.push(ok('origin', 'Alamat aplikasi', `Aplikasi desktop membuka login Google di browser sistem lewat ${ORIGIN_GOOGLE_DESKTOP}. Daftarkan alamat itu pada Authorized JavaScript origins.`))
    out.push({ id: 'prompt', judul: 'Client ID & alamat terdaftar', status: 'lewati', detail: 'Uji lengkap dilakukan saat Anda menekan tombol Google (browser akan terbuka).', saran: `Jika Google menolak dengan origin_mismatch, tambahkan ${ORIGIN_GOOGLE_DESKTOP} di Credentials › Authorized JavaScript origins.` })
    return out
  }
  if (/^https:\/\//.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) out.push(ok('origin', 'Alamat aplikasi', `${origin} — daftarkan alamat ini pada Authorized JavaScript origins.`))
  else out.push({ id: 'origin', judul: 'Alamat aplikasi', status: 'peringatan', detail: `Alamat saat ini (${origin || 'tidak diketahui'}) tidak dapat didaftarkan di Google.`, saran: 'Buka SIMAS lewat HTTPS (atau http://localhost), atau pakai aplikasi desktop terbaru yang membuka login Google di browser.' })

  let gis: Awaited<ReturnType<NonNullable<DepUji['muat']>>>
  try { gis = await dgnBatas((d.muat ?? muatGis)() as Promise<typeof gis>, 'Pustaka Google tidak termuat (waktu habis).'); out.push(ok('gis', 'Pustaka Google Identity Services', 'Berhasil dimuat.')) } catch (e) { return [...out, gagal('gis', 'Pustaka Google Identity Services', (e as Error).message, 'Periksa internet/firewall lalu ulangi.')] }
  if (!gis.prompt) return [...out, { id: 'prompt', judul: 'Client ID dikenali Google', status: 'lewati', detail: 'Pustaka tidak menyediakan uji prompt.' }]
  const hasil = await new Promise<Langkah>((res) => {
    const t = setTimeout(() => res({ id: 'prompt', judul: 'Client ID & alamat terdaftar', status: 'peringatan', detail: 'Google tidak memberi jawaban dalam batas waktu; tidak dapat dipastikan.', saran: 'Coba tombol Google di halaman Profil untuk uji nyata.' }), d.tunggu ?? 8000)
    try {
      gis.initialize({ client_id: clientId, callback: () => undefined })
      gis.prompt!((n) => {
        clearTimeout(t)
        if (n.isNotDisplayed?.()) res({ id: 'prompt', judul: 'Client ID & alamat terdaftar', ...tafsirAlasanGis(n.getNotDisplayedReason?.() ?? 'unknown_reason') })
        else res({ id: 'prompt', judul: 'Client ID & alamat terdaftar', status: 'ok', detail: 'Google menerima Client ID dan alamat aplikasi ini.' })
      })
    } catch (e) { clearTimeout(t); res(gagal('prompt', 'Client ID & alamat terdaftar', (e as Error).message)) }
  })
  out.push(hasil)
  return out
}

/** Uji sinkron akun (tanpa mengubah data): bandingkan profil Google yang sudah terverifikasi dengan akun SIMAS. */
export function ujiSinkronAkun(akun: { nama: string; email?: string; foto?: string; google?: { sub: string; email: string } }, g: ProfilGoogle, cfg: { domain?: string }): Langkah[] {
  const out: Langkah[] = [ok('token', 'Token Google', `Tanda tangan, Client ID, masa berlaku, nonce, dan email terverifikasi lolos (${g.email}).`)]
  const dom = cfg.domain?.trim().toLowerCase()
  const domEmail = g.email.split('@')[1]
  out.push(dom && domEmail !== dom && g.domain?.toLowerCase() !== dom ? gagal('domain', 'Domain email', `Akun @${domEmail} tidak termasuk domain yang diizinkan (@${dom}).`, 'Pakai akun Google sekolah, atau ubah batas domain di Google & Email.') : ok('domain', 'Domain email', dom ? `Sesuai batas @${dom}.` : 'Tidak dibatasi.'))
  if (!akun.google) out.push({ id: 'tautan', judul: 'Tautan akun', status: 'peringatan', detail: 'Akun SIMAS ini belum terhubung ke Google.', saran: 'Tekan tombol Google di bagian "Hubungkan" untuk menautkan.' })
  else if (akun.google.sub !== g.sub) out.push(gagal('tautan', 'Tautan akun', `Akun Google ini (${g.email}) berbeda dengan yang terhubung (${akun.google.email}).`, 'Masuk dengan akun Google yang sama, atau putuskan dan hubungkan ulang.'))
  else out.push(ok('tautan', 'Tautan akun', 'Identitas Google sama dengan yang terhubung.'))
  const ubah: string[] = []
  if (g.nama && g.nama !== akun.nama) ubah.push(`nama: "${akun.nama}" → "${g.nama}"`)
  if (g.email !== (akun.email ?? '').toLowerCase()) ubah.push(`email: "${akun.email ?? '-'}" → "${g.email}"`)
  if (g.foto && !akun.foto) ubah.push('foto profil akan diisi dari Google')
  out.push(ubah.length ? { id: 'sinkron', judul: 'Hasil sinkron (percobaan)', status: 'peringatan', detail: `Bila disinkronkan, akan berubah: ${ubah.join('; ')}.`, saran: 'Pengujian ini tidak mengubah data. Tekan "Sinkron" pada tombol Google bila setuju.' } : ok('sinkron', 'Hasil sinkron (percobaan)', 'Profil sudah sama dengan akun Google; tidak ada yang perlu diubah.'))
  return out
}

export interface KonfigBerkas { aktif: boolean; clientId: string; domain?: string }
export function bacaKonfigBerkas(teks: string): KonfigBerkas {
  let j: Partial<KonfigBerkas>
  try { j = JSON.parse(teks) } catch { throw new Error('Berkas bukan JSON yang valid.') }
  const clientId = String(j.clientId ?? '').trim()
  if (!CLIENT_ID_RE.test(clientId)) throw new Error('Client ID di berkas tidak valid.')
  const domain = j.domain ? String(j.domain).trim().toLowerCase() : undefined
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error('Domain di berkas tidak valid.')
  return { aktif: j.aktif !== false, clientId, domain }
}

/** Skrip bantu: membuat proyek Google Cloud, mengaktifkan API, membuka halaman yang perlu diisi, lalu menghasilkan berkas konfigurasi. */
export function skripPengaturan(os: 'bash' | 'powershell', o: { origin: string; domain?: string }): string {
  const origin = /^https?:\/\/[\w.:-]+$/.test(o.origin) ? o.origin : 'https://alamat-aplikasi-anda'
  const dom0 = (o.domain ?? '').trim().toLowerCase()
  const dom = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(dom0) ? dom0 : ''
  if (os === 'powershell') return `# Skrip bantu integrasi Google untuk SIMAS (Windows PowerShell)
# Butuh: Google Cloud CLI (https://cloud.google.com/sdk/docs/install). Skrip ini TIDAK menyimpan kata sandi apa pun.
$ErrorActionPreference = 'Stop'
$Origin = '${origin}'
$Domain = '${dom}'
$ProjectId = Read-Host 'ID proyek Google Cloud (huruf kecil, 6-30 karakter, mis. simas-sekolah-123)'
gcloud auth login
gcloud projects create $ProjectId --name='SIMAS Sekolah'
if ($LASTEXITCODE -ne 0) { Write-Host 'Proyek sudah ada atau tidak dapat dibuat; dilanjutkan dengan proyek tersebut.' }
gcloud config set project $ProjectId
gcloud services enable drive.googleapis.com people.googleapis.com
Write-Host ''
Write-Host 'LANGKAH MANUAL (Google tidak mengizinkan pembuatan Client ID lewat skrip):'
Write-Host "1) Layar persetujuan OAuth: https://console.cloud.google.com/apis/credentials/consent?project=$ProjectId"
Write-Host '   Pilih External (atau Internal untuk Google Workspace), isi nama aplikasi dan email, tambahkan email Anda sebagai Test user.'
Write-Host "2) Buat Client ID: https://console.cloud.google.com/apis/credentials/oauthclient?project=$ProjectId"
Write-Host '   Jenis: Web application. Authorized JavaScript origins:' $Origin
Start-Process "https://console.cloud.google.com/apis/credentials/consent?project=$ProjectId"
Read-Host 'Tekan Enter setelah layar persetujuan selesai'
Start-Process "https://console.cloud.google.com/apis/credentials/oauthclient?project=$ProjectId"
do { $ClientId = (Read-Host 'Tempel Client ID (….apps.googleusercontent.com)').Trim() } until ($ClientId -match '^[\\w-]+\\.apps\\.googleusercontent\\.com$')
$cfg = @{ aktif = $true; clientId = $ClientId }
if ($Domain) { $cfg.domain = $Domain }
$cfg | ConvertTo-Json | Set-Content -Encoding UTF8 'simas-google.json'
Write-Host 'Selesai. Di SIMAS: Akun & Keamanan > Google & Email > Impor konfigurasi, pilih simas-google.json, lalu Uji koneksi.'
`
  return `#!/usr/bin/env bash
# Skrip bantu integrasi Google untuk SIMAS (Linux/macOS/WSL)
# Butuh: Google Cloud CLI (https://cloud.google.com/sdk/docs/install). Skrip ini TIDAK menyimpan kata sandi apa pun.
set -euo pipefail
ORIGIN='${origin}'
DOMAIN='${dom}'
read -r -p 'ID proyek Google Cloud (huruf kecil, 6-30 karakter, mis. simas-sekolah-123): ' PROJECT_ID
gcloud auth login
gcloud projects create "$PROJECT_ID" --name='SIMAS Sekolah' || echo 'Proyek sudah ada atau tidak dapat dibuat; dilanjutkan dengan proyek tersebut.'
gcloud config set project "$PROJECT_ID"
gcloud services enable drive.googleapis.com people.googleapis.com
echo
echo 'LANGKAH MANUAL (Google tidak mengizinkan pembuatan Client ID lewat skrip):'
echo "1) Layar persetujuan OAuth: https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo '   Pilih External (atau Internal untuk Google Workspace), isi nama aplikasi dan email, tambahkan email Anda sebagai Test user.'
echo "2) Buat Client ID: https://console.cloud.google.com/apis/credentials/oauthclient?project=$PROJECT_ID"
echo "   Jenis: Web application. Authorized JavaScript origins: $ORIGIN"
(xdg-open "https://console.cloud.google.com/apis/credentials/oauthclient?project=$PROJECT_ID" || open "https://console.cloud.google.com/apis/credentials/oauthclient?project=$PROJECT_ID") >/dev/null 2>&1 || true
while true; do
  read -r -p 'Tempel Client ID (....apps.googleusercontent.com): ' CLIENT_ID
  [[ "$CLIENT_ID" =~ ^[A-Za-z0-9_-]+\\.apps\\.googleusercontent\\.com$ ]] && break
  echo 'Format tidak sesuai, coba lagi.'
done
if [ -n "$DOMAIN" ]; then
  printf '{"aktif":true,"clientId":"%s","domain":"%s"}\\n' "$CLIENT_ID" "$DOMAIN" > simas-google.json
else
  printf '{"aktif":true,"clientId":"%s"}\\n' "$CLIENT_ID" > simas-google.json
fi
echo 'Selesai. Di SIMAS: Akun & Keamanan > Google & Email > Impor konfigurasi, pilih simas-google.json, lalu Uji koneksi.'
`
}
