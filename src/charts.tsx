import { useState } from 'react'
import type { Bucket } from './dashboard'

export interface Slice { key: string; label: string; color: string; value: number }

/** Donat interaktif: hover menampilkan rincian di tengah, klik membuka rincian dokumen. */
export function Donut({ data, onPick, size = 118, thick = 18, centerLabel = 'Total' }: { data: Slice[]; onPick?: (k: string) => void; size?: number; thick?: number; centerLabel?: string }) {
  const [h, setH] = useState<string | null>(null)
  const total = data.reduce((a, d) => a + d.value, 0)
  const pad = 4, r = (size - thick) / 2 - pad, c = 2 * Math.PI * r
  let acc = 0
  const hv = data.find((d) => d.key === h)
  const lab = hv ? hv.label : centerLabel
  const hole = size - 2 * thick - 2 * pad - 6
  const lfs = Math.max(7.5, Math.min(size * 0.092, hole / (lab.length * 0.56)))
  const shown = lab.length * lfs * 0.56 > hole ? lab.slice(0, Math.floor(hole / (lfs * 0.56)) - 1) + '…' : lab
  return (
    <div className="donut">
      <svg className="donut-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Diagram donat" style={{ overflow: 'visible' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg)" strokeWidth={thick} />
        <g className="donut-g">{total > 0 && data.map((d) => {
          const len = (d.value / total) * c
          const el = (
            <circle key={d.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={h === d.key ? thick + 2 * pad : thick}
              strokeDasharray={`${Math.max(0, len - 1.5)} ${c - Math.max(0, len - 1.5)}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ cursor: onPick ? 'pointer' : 'default', transition: 'stroke-width .22s cubic-bezier(.3,.7,.4,1), opacity .22s', opacity: h && h !== d.key ? 0.4 : 1 }}
              onMouseEnter={() => setH(d.key)} onMouseLeave={() => setH(null)} onClick={() => onPick?.(d.key)}>
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          )
          acc += len
          return el
        })}</g>
        <text className="donut-t" x="50%" y="47%" textAnchor="middle" fontSize={size * 0.2} fontWeight={700} fill="var(--text)" pointerEvents="none">{hv ? hv.value : total}</text>
        <text className="donut-t" x="50%" y="62%" textAnchor="middle" fontSize={lfs} fill="var(--muted)" pointerEvents="none">{shown}</text>
      </svg>
      <div className="legend">
        {data.map((d) => (
          <div key={d.key} className={'lg' + (h === d.key ? ' on' : '')} onMouseEnter={() => setH(d.key)} onMouseLeave={() => setH(null)} onClick={() => onPick?.(d.key)}>
            <i style={{ background: d.color }} /> <span>{d.label}</span> <b>{d.value}</b>
            <span className="muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Grafik tren dua seri (diterbitkan vs direview) dengan tooltip dan klik per periode. */
export function Trend({ buckets, onPick }: { buckets: Bucket[]; onPick?: (b: Bucket) => void }) {
  const [hi, setHi] = useState<number | null>(null)
  const W = 640, H = 170, L = 30, R = 20, T = 10, B = 24
  const max = Math.max(3, ...buckets.map((b) => Math.max(b.issued, b.reviewed, b.trs)))
  const step = Math.ceil(max / 4)
  const top = step * 4
  const x = (i: number) => L + (buckets.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (buckets.length - 1))
  const y = (v: number) => T + (H - T - B) * (1 - v / top)
  const line = (k: 'issued' | 'reviewed' | 'trs') => buckets.map((b, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(b[k]).toFixed(1)}`).join(' ')
  const area = (k: 'issued') => `${line(k)} L${x(buckets.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`
  const S: [keyof Bucket, string, string][] = [['issued', 'Diterbitkan', '#2563eb'], ['reviewed', 'Direview / kembali', '#16a34a'], ['trs', 'Transmittal', '#d97706']]
  const hb = hi !== null ? buckets[hi] : null
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} onMouseLeave={() => setHi(null)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}><line x1={L} x2={W - R} y1={y(i * step)} y2={y(i * step)} stroke="var(--line)" /><text x={L - 6} y={y(i * step) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{i * step}</text></g>
        ))}
        <path d={area('issued')} fill="#2563eb" opacity="0.08" />
        {S.map(([k, , col]) => <path key={k} d={line(k as 'issued')} fill="none" stroke={col} strokeWidth={2.2} strokeLinejoin="round" />)}
        {buckets.map((b, i) => (
          <g key={b.key}>
            <rect x={x(i) - (W - L - R) / buckets.length / 2} y={T} width={(W - L - R) / buckets.length} height={H - T - B} fill="transparent" style={{ cursor: onPick ? 'pointer' : 'default' }}
              onMouseEnter={() => setHi(i)} onClick={() => onPick?.(b)} />
            {S.map(([k, , col]) => <circle key={k} cx={x(i)} cy={y(b[k] as number)} r={hi === i ? 4.5 : 2.8} fill={col} pointerEvents="none" />)}
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={hi === i ? 'var(--text)' : 'var(--muted)'} fontWeight={hi === i ? 700 : 400}>{b.label}</text>
          </g>
        ))}
        {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="var(--muted)" strokeDasharray="3 3" pointerEvents="none" />}
      </svg>
      <div className="legend row-legend">{S.map(([k, l, c]) => <span key={k} className="lg"><i style={{ background: c }} /> {l}</span>)}</div>
      {hb && (
        <div className="tip" style={{ left: `${(x(hi!) / W) * 100}%` }}>
          <b>{hb.start === hb.end ? hb.start : `${hb.start} s.d. ${hb.end}`}</b>
          {S.map(([k, l, c]) => <div key={k}><i style={{ background: c }} /> {l}: <b>{hb[k] as number}</b></div>)}
          {onPick && <div className="muted" style={{ fontSize: 11 }}>Klik untuk rincian</div>}
        </div>
      )}
    </div>
  )
}

/** Batang horizontal bertumpuk (mis. per disiplin). */
export function StackBars({ rows, onPick }: { rows: { key: string; parts: { v: number; color: string; label: string }[] }[]; onPick?: (k: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((a, p) => a + p.v, 0)))
  return (
    <div className="sbars">
      {rows.map((r) => {
        const tot = r.parts.reduce((a, p) => a + p.v, 0)
        return (
          <div key={r.key} className="sb" onClick={() => onPick?.(r.key)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
            <span className="sbl" title={r.key}>{r.key}</span>
            <span className="sbt"><span style={{ display: 'flex', width: `${(tot / max) * 100}%`, height: '100%' }}>
              {r.parts.map((p) => p.v > 0 && <i key={p.label} title={`${p.label}: ${p.v}`} style={{ width: `${(p.v / tot) * 100}%`, background: p.color }} />)}
            </span></span>
            <b>{tot}</b>
          </div>
        )
      })}
    </div>
  )
}

export function Columns({ data, onPick, unit = '' }: { data: { key: string; label: string; value: number; danger?: boolean }[]; onPick?: (k: string) => void; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="cols">
      {data.map((d) => (
        <div key={d.key} className="col" onClick={() => onPick?.(d.key)} style={{ cursor: onPick ? 'pointer' : 'default' }} title={`${d.label}${unit}: ${d.value}`}>
          <b>{d.value}</b>
          <span className="colbar"><i style={{ height: `${(d.value / max) * 100}%`, background: d.danger ? '#dc2626' : 'var(--pri)' }} /></span>
          <span className="muted">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
