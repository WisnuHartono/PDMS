import type { CSSProperties } from 'react'
import { Icon } from './icons'
import type { Sekolah, TampilanSetting } from './types'

export const TAMPILAN_DEFAULT: Required<TampilanSetting> = {
  logoUkuran: 42, logoBentuk: 'sudut', logoLatar: 'putih', logoBingkai: false, logoBayangan: false, logoIsi: 'contain',
  logoZoom: 100, logoGeserX: 0, logoGeserY: 0, namaUkuran: 17, tampilLegalitas: true, tampilNama: true,
}
export const tampilanDari = (s: Pick<Sekolah, 'tampilan'>): Required<TampilanSetting> => ({ ...TAMPILAN_DEFAULT, ...s.tampilan })

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
