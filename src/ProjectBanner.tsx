import { useMemo } from 'react'
import type { AppState, Project } from './types'
import { computeDash } from './dashboard'
import { bannerOf, bannerStyle } from './banner'
import { BannerImg } from './ui'
import { fmtDate } from './util'

export type BannerView = 'detail' | 'compact' | 'list'


/** Kepala banner: logo diletakkan sejajar blok judul (bawaan) atau di baris sendiri di atas judul, sesuai pengaturan tiap logo. */
export function BannerHead({ project, factor, scale = 100, children }: { project: Project; factor: number; scale?: number; children: React.ReactNode }) {
  const bn = bannerOf(project)
  const items = (['client', 'contractor'] as const)
    .map((x) => ({ x, src: x === 'client' ? project.clientLogo : project.contractorLogo, label: x === 'client' ? project.client : project.contractor, ...bn[x] }))
    .filter((i) => i.src && i.show)
  const logo = (i: (typeof items)[number]) => (
    <span key={i.x} className={'lg-pill bg-' + (i.bg ?? bn.bg)}
      style={{ alignSelf: ({ start: 'flex-start', center: 'center', end: 'flex-end' } as const)[i.valign ?? 'center'], transform: i.dx || i.dy ? `translate(${i.dx ?? 0}px, ${i.dy ?? 0}px)` : undefined }}>
      <BannerImg src={i.src} label={i.label} h={Math.max(16, Math.round(i.size * factor * scale / 100))} clearWhite={i.clearWhite} fx={{ shadow: i.shadow, sharp: i.sharp, halo: i.halo }} />
    </span>
  )
  const top = items.filter((i) => i.row === 'top')
  const inl = items.filter((i) => i.row !== 'top')
  const zone = (list: typeof items, pos: string) => <div className={'zone ' + pos}>{list.filter((i) => i.pos === pos).map(logo)}</div>
  return (
    <>
      {top.length > 0 && <div className="hero-logos-row">{zone(top, 'left')}{zone(top, 'center')}{zone(top, 'right')}</div>}
      {inl.length > 0 ? (
        <div className="hero-hrow">
          {inl.some((i) => i.pos === 'left') && zone(inl, 'left')}
          <div className="hero-htext">{children}</div>
          {inl.some((i) => i.pos === 'center') && zone(inl, 'center')}
          {inl.some((i) => i.pos === 'right') && zone(inl, 'right')}
        </div>
      ) : children}
    </>
  )
}

// Banner proyek bergaya sama dengan banner Dashboard, dengan tiga tampilan.
export function ProjectBanner({ state, project, view, today, actions, logoScale = 100 }: { state: AppState; project: Project; view: BannerView; today: string; actions?: React.ReactNode; logoScale?: number }) {
  const d = useMemo(() => computeDash(state, project, state.settings.report.period, today, today), [state, project, today])
  const k = d.kpi, P = d.progress
  const bn = bannerOf(project)
  const bs = bannerStyle(project)
  const bg = { ...bs.style, opacity: project.archived ? 0.65 : 1 }
  const dk = bs.dark ? ' dark' : ''
  const items = (['client', 'contractor'] as const)
    .map((x) => ({ x, src: x === 'client' ? project.clientLogo : project.contractorLogo, label: x === 'client' ? project.client : project.contractor, ...bn[x] }))
    .filter((i) => i.src && i.show)
  // tinggi logo = ukuran di pengaturan proyek x faktor tampilan x slider ukuran logo kartu
  const cap = (f: number, v: number) => Math.max(16, Math.round(v * f * logoScale / 100))
  const logo = (i: (typeof items)[number], max: number) => (
    <span key={i.x} className={'lg-pill bg-' + (i.bg ?? bn.bg)}><BannerImg src={i.src} label={i.label} h={cap(max, i.size)} clearWhite={i.clearWhite} fx={{ shadow: i.shadow, sharp: i.sharp, halo: i.halo }} /></span>
  )
  const onTime = k.pending ? Math.round(((k.pending - k.late) / k.pending) * 100) : 100
  const arsip = project.archived && <span className="pill" style={{ marginLeft: 8 }}>arsip</span>

  if (view === 'list') {
    return (
      <div className={'hero pb-list' + dk} style={bg}>
        <div className="pb-logos">{items.map((i) => logo(i, 0.32))}</div>
        <div className="pb-main">
          <div className="hero-code">{project.code}{project.contractNo && <span> · Kontrak {project.contractNo}</span>}{arsip}</div>
          <b className="pb-name">{project.name}</b>
          <small>{project.client || '-'} · {project.location || '-'} · {k.total} dokumen · disetujui {P.docs}%</small>
        </div>
        <div className="row hero-act pb-act">{actions}</div>
      </div>
    )
  }

  if (view === 'compact') {
    return (
      <div className={'hero pb-compact' + dk} style={bg}>
        <BannerHead project={project} factor={0.42} scale={logoScale}>
          <div className="hero-code">{project.code}{arsip}</div>
          <h2 className="pbc-name" style={{ color: 'inherit' }}>{project.name}</h2>
          <div className="hero-meta">{project.client && <span>🏢 {project.client}</span>}{project.location && <span>📍 {project.location}</span>}</div>
        </BannerHead>
        <div className="hp-b" style={{ marginTop: 6 }}><i style={{ width: P.docs + '%', background: '#4ade80' }} /></div>
        <small>{k.approved} dari {k.total} dokumen disetujui ({P.docs}%)</small>
        <div className="row hero-act" style={{ marginTop: 7 }}>{actions}</div>
      </div>
    )
  }

  return (
    <div className={'hero pb-d' + dk} style={bg}>
      <BannerHead project={project} factor={0.7} scale={logoScale}>
        <div className="hero-code">{project.code}{project.contractNo && <span> · Kontrak {project.contractNo}</span>}{arsip}</div>
        <h1>{project.name}</h1>
        <div className="hero-meta">
          {project.client && <span>🏢 {project.client}</span>}
          {project.contractor && <span>🏗 {project.contractor}</span>}
          {project.location && <span>📍 {project.location}</span>}
          {project.manager && <span>👤 PM: {project.manager}</span>}
        </div>
      </BannerHead>
      <div className="hero-prog">
        {P.schedule !== null && (
          <div><div className="hp-l"><span>Jadwal proyek</span><b>{P.schedule}%</b></div><div className="hp-b"><i style={{ width: P.schedule + '%' }} /></div>
            <small>{fmtDate(project.startDate)} → {fmtDate(project.endDate)}{P.daysLeft !== null && (P.daysLeft >= 0 ? ` · sisa ${P.daysLeft} hari` : ` · lewat ${-P.daysLeft} hari`)}</small></div>
        )}
        <div><div className="hp-l"><span>Dokumen disetujui</span><b>{P.docs}%</b></div><div className="hp-b"><i style={{ width: P.docs + '%', background: '#4ade80' }} /></div><small>{k.approved} dari {k.total} dokumen</small></div>
        <div><div className="hp-l"><span>Tepat waktu</span><b>{onTime}%</b></div><div className="hp-b"><i style={{ width: onTime + '%', background: '#fbbf24' }} /></div><small>{k.late} dari {k.pending} review terlambat</small></div>
      </div>
      <div className="row hero-act">{actions}</div>
    </div>
  )
}
