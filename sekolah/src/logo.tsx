import { MARGIN } from './kertas'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './icons'
import type { Sekolah, TampilanSetting } from './types'

export const TAMPILAN_DEFAULT: Required<TampilanSetting> = {
  logoUkuran: 42, logoBentuk: 'sudut', logoLatar: 'putih', logoBingkai: false, logoBayangan: false, logoIsi: 'contain',
  logoZoom: 100, logoGeserX: 0, logoGeserY: 0, namaUkuran: 17, tampilLegalitas: true, tampilNama: true,
  dokFont: 'times', dokUkuran: 11.5, dokJarak: 135, tandaAir: true, tandaAirUkuran: 55, tandaAirOpasitas: 8, appFont: 'segoe', appUkuran: 14,
  appNama: 'SIMAS', appSub: 'Administrasi Sekolah', appLogo: '', appLogoUkuran: 48, appLogoBentuk: 'sudut', appLogoLatar: 'kuning',
  appNamaUkuran: 19, appSubUkuran: 11, appNamaFont: 'segoe', appNamaTebal: true, appNamaWarna: '', appNamaSpasi: 2,
  appTampilSub: true, appTampilVersi: true, appTampilLampu: true,
  tema: 'modern', temaAksen: '', temaSudut: -1, temaBayangan: 'tema', temaSidebar: 'tema', temaLatar: '',
  headerMode: 'tema', headerWarna1: '#0c2537', headerWarna2: '#1e3a8a', headerSudut: 100, headerGambar: '', headerRedam: 35, headerTeks: 'auto', headerGaris: 'tema',
}
export const tampilanDari = (s: Pick<Sekolah, 'tampilan'>): Required<TampilanSetting> => ({ ...TAMPILAN_DEFAULT, ...Object.fromEntries(Object.entries(s.tampilan ?? {}).filter(([, v]) => v !== undefined)) })

/** Logo sekolah dengan kustomisasi ukuran, bentuk, latar, bingkai, zoom, dan geser. */
export function LogoSekolah({ logo, t }: { logo?: string; t: Required<TampilanSetting> }) {
  const radius = t.logoBentuk === 'lingkaran' ? '50%' : t.logoBentuk === 'kotak' ? 0 : t.logoBentuk === 'tanpa' ? 6 : Math.round(t.logoUkuran * 0.2)
  const latar = t.logoBentuk === 'tanpa' || t.logoLatar === 'transparan' ? 'transparent' : t.logoLatar === 'kaca' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.95)'
  const st: CSSProperties = {
    width: t.logoUkuran, height: t.logoUkuran, borderRadius: radius, background: latar,
    border: t.logoBingkai ? '2px solid rgba(255,255,255,0.85)' : undefined,
    boxShadow: t.logoBayangan ? '0 4px 14px rgba(0,0,0,0.35)' : undefined,
  }
  return (
    <span className="logo-sk" style={st}>
      {logo
        ? <img src={logo} alt="" draggable={false} style={{ objectFit: t.logoIsi, transform: `translate(${t.logoGeserX}%, ${t.logoGeserY}%) scale(${t.logoZoom / 100})`, padding: t.logoBentuk === 'tanpa' || t.logoIsi === 'cover' ? 0 : '8%' }} />
        : <Icon name="school" size={Math.round(t.logoUkuran * 0.5)} />}
    </span>
  )
}

export const VERSI_APP = 'v0.4'

/** Nama + logo aplikasi (pojok kiri atas); `bawah` ditampilkan tepat di bawahnya (mis. lampu status koneksi). */
export function BrandApp({ t, bawah }: { t: Required<TampilanSetting>; bawah?: ReactNode }) {
  const r = t.appLogoBentuk === 'lingkaran' ? '50%' : t.appLogoBentuk === 'kotak' ? 0 : t.appLogoBentuk === 'tanpa' ? 4 : Math.round(t.appLogoUkuran * 0.28)
  const latar = t.appLogoBentuk === 'tanpa' || t.appLogoLatar === 'transparan' ? 'transparent' : t.appLogoLatar === 'putih' ? '#fff' : t.appLogoLatar === 'kaca' ? 'rgba(255,255,255,.22)' : '#fbbf24'
  const sub = [t.appTampilSub ? t.appSub : '', t.appTampilVersi ? VERSI_APP : ''].filter(Boolean).join(' · ')
  return (
    <div className="brand brand-app">
      <div className="brand-row">
        <span className="brand-mark" style={{ width: t.appLogoUkuran, height: t.appLogoUkuran, borderRadius: r, background: latar }}>
          {t.appLogo ? <img src={t.appLogo} alt="" draggable={false} /> : <Icon name="school" size={Math.round(t.appLogoUkuran * 0.6)} />}
        </span>
        <div className="brand-teks">
          <b style={{ fontSize: t.appNamaUkuran, fontFamily: (FONT_APP[t.appNamaFont] ?? FONT_APP.segoe).css, fontWeight: t.appNamaTebal ? 800 : 500, color: t.appNamaWarna || undefined, letterSpacing: t.appNamaSpasi * 0.5 }}>{t.appNama || 'SIMAS'}</b>
          {sub && <span className="brand-sub" style={{ fontSize: t.appSubUkuran, fontFamily: (FONT_APP[t.appNamaFont] ?? FONT_APP.segoe).css }}>{sub}</span>}
          {bawah}
        </div>
      </div>
    </div>
  )
}
/** Tinggi minimal bilah atas agar identitas aplikasi (logo/nama + lampu) tidak terpotong. */
export const tinggiBrand = (t: Required<TampilanSetting>) => Math.max(t.appLogoUkuran, Math.round(t.appNamaUkuran * 1.05 + (t.appTampilSub || t.appTampilVersi ? t.appSubUkuran * 1.35 : 0) + (t.appTampilLampu ? 15 : 0))) + 14

export const FONT_DOK: Record<string, { nama: string; css: string }> = {
  times: { nama: 'Times New Roman (resmi, serif)', css: "'Times New Roman', Times, 'Liberation Serif', serif" },
  cambria: { nama: 'Cambria (serif modern)', css: "Cambria, Georgia, 'Times New Roman', serif" },
  georgia: { nama: 'Georgia (serif mudah dibaca)', css: "Georgia, 'Times New Roman', serif" },
  arial: { nama: 'Arial (sans-serif standar)', css: "Arial, Helvetica, 'Liberation Sans', sans-serif" },
  calibri: { nama: 'Calibri (sans-serif ringkas)', css: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif" },
  tahoma: { nama: 'Tahoma (sans-serif jelas)', css: "Tahoma, Verdana, 'Segoe UI', sans-serif" },
  verdana: { nama: 'Verdana (lebar, besar)', css: "Verdana, Tahoma, 'Segoe UI', sans-serif" },
  bookman: { nama: 'Book Antiqua (klasik)', css: "'Book Antiqua', Palatino, 'Palatino Linotype', Georgia, serif" },
}
export const FONT_APP: Record<string, { nama: string; css: string }> = {
  segoe: { nama: 'Segoe UI / bawaan sistem', css: "'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif" },
  arial: { nama: 'Arial', css: "Arial, Helvetica, sans-serif" },
  calibri: { nama: 'Calibri', css: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif" },
  tahoma: { nama: 'Tahoma', css: "Tahoma, Verdana, sans-serif" },
  verdana: { nama: 'Verdana', css: "Verdana, Tahoma, sans-serif" },
  georgia: { nama: 'Georgia (serif)', css: "Georgia, 'Times New Roman', serif" },
}

/** Terapkan pengaturan huruf sebagai variabel CSS global (dokumen cetak & aplikasi). */
export function terapkanHuruf(t: Required<TampilanSetting>, el: HTMLElement = document.documentElement) {
  el.style.setProperty('--doc-font', (FONT_DOK[t.dokFont] ?? FONT_DOK.times).css)
  el.style.setProperty('--doc-size', `${t.dokUkuran}pt`)
  el.style.setProperty('--doc-line', String(t.dokJarak / 100))
  el.style.setProperty('--app-font', (FONT_APP[t.appFont] ?? FONT_APP.segoe).css)
  el.style.setProperty('--app-size', `${t.appUkuran}px`)
}

/** Pasang tanda air logo sekolah di belakang semua dokumen cetak (.doc): ukuran proporsional lebar kertas, diulang tiap halaman. */
export async function terapkanTandaAir(logo: string | undefined, on: boolean, ukuran: number, opasitas: number, kertas: { w: number; h: number } = { w: 210, h: 297 }) {
  let st = document.getElementById('simas-tanda-air') as HTMLStyleElement | null
  if (!st) { st = document.createElement('style'); st.id = 'simas-tanda-air'; document.head.appendChild(st) }
  if (!on || !logo || !logo.startsWith('data:image/')) { st.textContent = ''; return }
  const rasio = await new Promise<number>((ok) => {
    const im = new Image()
    im.onload = () => ok(im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1)
    im.onerror = () => ok(0)
    im.src = logo
  })
  if (!rasio) { st.textContent = ''; return }
  const ubin = (w: number, h: number) => {
    // kotak logo = persen dari sisi pendek kertas, rasio gambar dipertahankan, di tengah halaman
    const maks = Math.min(w, h) * (ukuran / 100)
    const lw = rasio >= 1 ? maks : maks * rasio, lh = rasio >= 1 ? maks / rasio : maks
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><image href="${logo}" x="${(w - lw) / 2}" y="${(h - lh) / 2}" width="${lw}" height="${lh}" opacity="${opasitas / 100}" preserveAspectRatio="xMidYMid meet"/></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }
  const { w, h } = kertas
  const cetakP = { w: w - 2 * MARGIN.potret.x, h: h - MARGIN.potret.y - MARGIN.potret.b }
  const cetakL = { w: h - 2 * MARGIN.lanskap.x, h: w - MARGIN.lanskap.y - MARGIN.lanskap.b }
  const bg = (d: { w: number; h: number }, o: string) => `background:${ubin(d.w, d.h)} ${o}/${d.w}mm ${d.h}mm repeat-y`
  // Layar/pratinjau: satu halaman penuh per ubin. Cetak: isi halaman (tanpa margin), sehingga logo tepat di tengah tiap halaman fisik.
  st.textContent = `.doc,.pp-sheet{position:relative;isolation:isolate}
.doc::before,.pp-sheet::before{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;${bg({ w, h }, '50% 0')};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc.landscape::before,.pp-sheet.landscape::before{${bg({ w: h, h: w }, '50% 0')}}
.doc.label-sheet::before{display:none}
@media print{.doc::before{${bg(cetakP, '0 0')}}.doc.landscape::before{${bg(cetakL, '0 0')}}}`
}
