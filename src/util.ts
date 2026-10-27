export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const today = () => new Date().toISOString().slice(0, 10)
export const nowIso = () => new Date().toISOString()

export function addDays(date: string, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function fmtDate(d?: string) {
  if (!d) return '-'
  const x = new Date(d)
  if (isNaN(+x)) return d
  return x.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtSize(n?: number) {
  if (!n) return '-'
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}

export function nextRev(prev: string | undefined, scheme: 'alpha' | 'numeric') {
  if (!prev) return scheme === 'alpha' ? 'A' : '0'
  if (scheme === 'numeric') return String((parseInt(prev, 10) || 0) + 1)
  const c = prev.toUpperCase()
  if (/^[A-Y]$/.test(c)) return String.fromCharCode(c.charCodeAt(0) + 1)
  return c + 'A'
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function toCsv(rows: (string | number | undefined)[][]) {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

const readAs = (file: Blob, mode: 'text' | 'dataUrl') =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    mode === 'text' ? r.readAsText(file) : r.readAsDataURL(file)
  })

const IMG_ERR = 'File gambar tidak dapat dibaca. Gunakan PNG, JPG, WebP, atau SVG yang valid (bukan PDF/ICO/HEIC).'

/** Memuat gambar dari file apa pun (mime kosong, SVG tanpa ukuran, WebP, dll) menjadi elemen yang siap digambar. */
async function loadImage(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; svgUrl?: string }> {
  const head = (await readAs(file.slice(0, 512), 'text')).trimStart().toLowerCase()
  const isSvg = /svg/.test(file.type) || /\.svg$/i.test(file.name) || head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))
  if (isSvg) {
    const text = await readAs(file, 'text')
    if (!/<svg[\s>]/i.test(text)) throw new Error(IMG_ERR)
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)
    const img = new Image()
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error(IMG_ERR)); img.src = svgUrl })
    return { src: img, w: img.naturalWidth || 256, h: img.naturalHeight || 256, svgUrl }
  }
  const url = await readAs(file, 'dataUrl')
  const img = new Image()
  try {
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('x')); img.src = url })
    return { src: img, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height }
  } catch {
    try {
      const bmp = await createImageBitmap(file)
      return { src: bmp, w: bmp.width, h: bmp.height }
    } catch {
      throw new Error(IMG_ERR)
    }
  }
}

function drawTo(src: CanvasImageSource, w: number, h: number, cw: number, ch: number, sx = 0, sy = 0, sw = w, sh = h, bg?: string) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(cw))
  c.height = Math.max(1, Math.round(ch))
  const ctx = c.getContext('2d')!
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height) }
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return c
}

// Perkecil gambar logo (maks 240px) menjadi data URL agar ringan disimpan & disinkronkan.
export async function fileToLogo(file: File, max = 240): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran gambar terlalu besar (maks 15 MB).')
  const im = await loadImage(file)
  // SVG kecil disimpan apa adanya agar tetap tajam di semua ukuran
  if (im.svgUrl && im.svgUrl.length < 400_000) return im.svgUrl
  const k = Math.min(1, max / Math.max(im.w, im.h, 1))
  return drawTo(im.src, im.w, im.h, im.w * k, im.h * k).toDataURL('image/png')
}

// Gambar latar banner: diperkecil (JPEG) agar ringan.
export async function fileToBanner(file: File, max = 1200): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Ukuran gambar terlalu besar (maks 20 MB).')
  const im = await loadImage(file)
  const k = Math.min(1, max / Math.max(im.w, im.h, 1))
  return drawTo(im.src, im.w, im.h, im.w * k, im.h * k, 0, 0, im.w, im.h, '#fff').toDataURL('image/jpeg', 0.8)
}

// Foto profil: dipotong persegi dan diperkecil (JPEG) agar ringan.
export async function fileToPhoto(file: File, size = 200): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran gambar terlalu besar (maks 15 MB).')
  const im = await loadImage(file)
  const s = Math.min(im.w, im.h) || size
  return drawTo(im.src, im.w, im.h, size, size, (im.w - s) / 2, (im.h - s) / 2, s, s, '#fff').toDataURL('image/jpeg', 0.85)
}
