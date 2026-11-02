import { describe, expect, it } from 'vitest'
import { tampilanDari } from '../src/logo'
import { PRESET, campur, teksDiAtas, varsTema } from '../src/tema'

const v = (t: object) => varsTema(tampilanDari({ tampilan: t as never }))
describe('tema', () => {
  it('tiap tema punya warna, sudut, dan header sendiri', () => {
    const m = v({ tema: 'modern' }), c = v({ tema: 'classic' }), s = v({ tema: 'simple' })
    expect(m['--radius']).toBe('8px'); expect(c['--radius']).toBe('2px'); expect(s['--radius']).toBe('4px')
    expect(c['--hdr-border']).toContain('solid'); expect(s['--hdr-fg']).toBe('#0f172a'); expect(m['--hdr-fg']).toBe('#ffffff')
    expect(new Set([m['--accent'], c['--accent'], s['--accent']]).size).toBe(3)
    expect(s['--side-bg']).toBe('#ffffff'); expect(m['--side-bg']).toContain('gradient')
  })
  it('penyesuaian mengalahkan bawaan tema', () => {
    const x = v({ tema: 'simple', temaAksen: '#ff0000', temaSudut: 12, temaBayangan: 'tidak', temaSidebar: 'gelap', temaLatar: '#ffffee' })
    expect(x['--accent']).toBe('#ff0000'); expect(x['--radius']).toBe('12px'); expect(x['--shadow']).toBe('none')
    expect(x['--side-bg']).toContain('gradient'); expect(x['--bg']).toBe('#ffffee')
    expect(x['--accent-soft']).toBe(campur('#ff0000', '#ffffff', 0.88))
  })
  it('latar header: warna, gradien, gambar, dan teks otomatis terbaca', () => {
    expect(v({ headerMode: 'warna', headerWarna1: '#ffffff' })['--hdr-fg']).toBe('#0f172a')
    expect(v({ headerMode: 'warna', headerWarna1: '#102030' })['--hdr-fg']).toBe('#ffffff')
    const g = v({ headerMode: 'gradien', headerWarna1: '#102030', headerWarna2: '#304050', headerSudut: 45 })
    expect(g['--hdr-bg']).toContain('linear-gradient(45deg')
    const im = v({ headerMode: 'gambar', headerGambar: 'data:image/png;base64,AAA', headerRedam: 50 })
    expect(im['--hdr-bg']).toContain('url("data:image/png;base64,AAA")'); expect(im['--hdr-bg']).toContain('rgba(0,0,0,0.5)')
    expect(v({ headerMode: 'gambar', headerGambar: '' })['--hdr-bg']).toBe(PRESET.modern.header.css)
    expect(teksDiAtas('#ffff00')).toBe('#0f172a')
  })
})
