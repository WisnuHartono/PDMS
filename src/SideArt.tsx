import { PATTERNS, ARTS, sideStyleOf } from './sidestyle'
import type { SideStyle } from './types'

type Full = ReturnType<typeof sideStyleOf>

/** Lapisan pola, siluet vektor, dan gambar di belakang isi sidebar. */
export function SideArt({ sx, scale = 1 }: { sx: Full; scale?: number }) {
  const pat = sx.pattern !== 'none' ? PATTERNS.find((p) => p.id === sx.pattern) : undefined
  const art = sx.art !== 'none' ? ARTS.find((a) => a.id === sx.art) : undefined
  if (!pat && !art && !sx.image) return null
  const fit = { bottom: ['100% auto', 'center bottom'], top: ['100% auto', 'center top'], center: ['contain', 'center'], cover: ['cover', 'center'] }[sx.imgPos]
  const size = pat ? `${pat.tile[0] * sx.patternScale / 100 * scale}px ${pat.tile[1] * sx.patternScale / 100 * scale}px` : undefined
  return (
    <div className="side-art" aria-hidden="true">
      {pat && <div className="sa-pat" style={{ opacity: sx.patternOpacity / 100, WebkitMaskImage: pat.css, maskImage: pat.css, WebkitMaskSize: size, maskSize: size }} />}
      {art && <svg className="sa-art" viewBox="0 0 240 140" preserveAspectRatio="xMidYMax slice" fill="currentColor" style={{ opacity: sx.artOpacity / 100, height: Math.round(1.6 * sx.artSize * scale) + 'px' }} dangerouslySetInnerHTML={{ __html: art.body }} />}
      {sx.image && <div className="sa-img" style={{ opacity: sx.imgOpacity / 100, backgroundImage: `url("${sx.image}")`, backgroundSize: fit[0], backgroundPosition: fit[1] }} />}
    </div>
  )
}
export type { SideStyle }
