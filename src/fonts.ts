import type { FontSettings } from './types'

export const FONT_OPTIONS: { id: string; name: string; stack: string }[] = [
  { id: 'system', name: 'Bawaan sistem', stack: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif' },
  { id: 'segoe', name: 'Segoe UI', stack: '"Segoe UI",Tahoma,sans-serif' },
  { id: 'arial', name: 'Arial / Helvetica', stack: 'Arial,Helvetica,sans-serif' },
  { id: 'verdana', name: 'Verdana', stack: 'Verdana,Geneva,sans-serif' },
  { id: 'tahoma', name: 'Tahoma', stack: 'Tahoma,Geneva,sans-serif' },
  { id: 'trebuchet', name: 'Trebuchet MS', stack: '"Trebuchet MS",Helvetica,sans-serif' },
  { id: 'calibri', name: 'Calibri', stack: 'Calibri,Carlito,"Segoe UI",sans-serif' },
  { id: 'georgia', name: 'Georgia (serif)', stack: 'Georgia,"Times New Roman",serif' },
  { id: 'times', name: 'Times New Roman (serif)', stack: '"Times New Roman",Times,serif' },
  { id: 'mono', name: 'Monospace', stack: '"Cascadia Mono",Consolas,"Courier New",monospace' },
  { id: 'custom', name: 'Lainnya (ketik nama huruf)...', stack: '' },
]

export const WEIGHTS: [number, string][] = [[300, 'Ringan (300)'], [400, 'Normal (400)'], [500, 'Sedang (500)'], [600, 'Semi-tebal (600)'], [700, 'Tebal (700)'], [800, 'Sangat tebal (800)'], [900, 'Hitam (900)']]

export const defaultFont = (): FontSettings => ({ body: 'system', size: 14, bodyWeight: 400, head: 'system', headWeight: 700, headScale: 100 })

export const fontOf = (f?: Partial<FontSettings>): FontSettings => ({ ...defaultFont(), ...f })

export function stackOf(id: string, custom?: string): string {
  if (id === 'custom') {
    const n = (custom || '').replace(/["';{}<>]/g, '').trim()
    return n ? `"${n}",${FONT_OPTIONS[0].stack}` : FONT_OPTIONS[0].stack
  }
  return (FONT_OPTIONS.find((x) => x.id === id) || FONT_OPTIONS[0]).stack
}

/** Terapkan pengaturan huruf sebagai variabel CSS di <html>. */
export function applyFont(f?: Partial<FontSettings>) {
  const o = fontOf(f)
  const st = document.documentElement.style
  st.setProperty('--font-body', stackOf(o.body, o.bodyCustom))
  st.setProperty('--font-head', stackOf(o.head, o.headCustom))
  st.setProperty('--fs', o.size + 'px')
  st.setProperty('--fw-body', String(o.bodyWeight))
  st.setProperty('--fw-head', String(o.headWeight))
  st.setProperty('--hs', String(o.headScale / 100))
}
